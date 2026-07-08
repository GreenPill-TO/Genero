// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

interface IMentoBroker {
    function getAmountOut(
        address exchangeProvider,
        bytes32 exchangeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    function swapIn(
        address exchangeProvider,
        bytes32 exchangeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut);
}

contract MentoBrokerSwapAdapter is Ownable, ISwapAdapter {
    using SafeERC20 for IERC20;

    struct Route {
        address exchangeProvider;
        bytes32 exchangeId;
        address intermediateToken;
        address secondExchangeProvider;
        bytes32 secondExchangeId;
        bool configured;
    }

    error InvalidAddress();
    error InvalidAmount();
    error DeadlineExpired();
    error RouteNotConfigured(address tokenIn);
    error InvalidSwapData();
    error InvalidCadmOut(uint256 expectedMin, uint256 actual);

    event BrokerUpdated(address indexed oldBroker, address indexed newBroker, address indexed actor);
    event DefaultRouteUpdated(
        address indexed tokenIn, address indexed exchangeProvider, bytes32 indexed exchangeId, address actor
    );
    event DefaultMultiHopRouteUpdated(
        address indexed tokenIn,
        address indexed intermediateToken,
        address indexed firstExchangeProvider,
        bytes32 firstExchangeId,
        address secondExchangeProvider,
        bytes32 secondExchangeId,
        address actor
    );
    event DefaultRouteCleared(address indexed tokenIn, address indexed actor);
    event CadmSwapped(
        address indexed caller,
        address indexed tokenIn,
        address indexed cadmToken,
        address exchangeProvider,
        bytes32 exchangeId,
        uint256 amountIn,
        uint256 cadmOut
    );
    event CadmMultiHopSwapped(
        address indexed caller,
        address indexed tokenIn,
        address indexed intermediateToken,
        address cadmToken,
        address firstExchangeProvider,
        bytes32 firstExchangeId,
        address secondExchangeProvider,
        bytes32 secondExchangeId,
        uint256 amountIn,
        uint256 cadmOut
    );

    address public broker;

    mapping(address => Route) private _defaultRoutes;

    constructor(address initialOwner, address broker_) {
        if (initialOwner == address(0) || broker_ == address(0)) revert InvalidAddress();
        _transferOwnership(initialOwner);
        broker = broker_;
        emit BrokerUpdated(address(0), broker_, msg.sender);
    }

    function swapToCadm(
        address tokenIn,
        address cadmToken,
        uint256 amountIn,
        uint256 minCadmOut,
        uint256 deadline,
        bytes calldata swapData
    ) external returns (uint256 cadmOut) {
        if (tokenIn == address(0) || cadmToken == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();
        if (block.timestamp > deadline) revert DeadlineExpired();

        Route memory route = _resolveRoute(tokenIn, swapData);
        uint256 cadmBefore = IERC20(cadmToken).balanceOf(address(this));

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        if (_isMultiHopRoute(route)) {
            _swapMultiHop(route, tokenIn, cadmToken, amountIn, minCadmOut);
        } else {
            _approveExact(tokenIn, broker, amountIn);
            IMentoBroker(broker)
                .swapIn(route.exchangeProvider, route.exchangeId, tokenIn, cadmToken, amountIn, minCadmOut);
        }

        uint256 cadmAfter = IERC20(cadmToken).balanceOf(address(this));
        cadmOut = cadmAfter - cadmBefore;
        if (cadmOut < minCadmOut) revert InvalidCadmOut(minCadmOut, cadmOut);

        IERC20(cadmToken).safeTransfer(msg.sender, cadmOut);

        if (_isMultiHopRoute(route)) {
            emit CadmMultiHopSwapped(
                msg.sender,
                tokenIn,
                route.intermediateToken,
                cadmToken,
                route.exchangeProvider,
                route.exchangeId,
                route.secondExchangeProvider,
                route.secondExchangeId,
                amountIn,
                cadmOut
            );
        } else {
            emit CadmSwapped(
                msg.sender, tokenIn, cadmToken, route.exchangeProvider, route.exchangeId, amountIn, cadmOut
            );
        }
    }

    function previewSwapToCadm(address tokenIn, address cadmToken, uint256 amountIn, bytes calldata swapData)
        external
        view
        returns (uint256 cadmOut)
    {
        if (tokenIn == address(0) || cadmToken == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();

        Route memory route = _resolveRoute(tokenIn, swapData);
        if (!_isMultiHopRoute(route)) {
            return
                IMentoBroker(broker)
                    .getAmountOut(route.exchangeProvider, route.exchangeId, tokenIn, cadmToken, amountIn);
        }

        uint256 intermediateOut = IMentoBroker(broker)
            .getAmountOut(route.exchangeProvider, route.exchangeId, tokenIn, route.intermediateToken, amountIn);
        return IMentoBroker(broker)
            .getAmountOut(
                route.secondExchangeProvider,
                route.secondExchangeId,
                route.intermediateToken,
                cadmToken,
                intermediateOut
            );
    }

    function setBroker(address broker_) external onlyOwner {
        if (broker_ == address(0)) revert InvalidAddress();
        address oldBroker = broker;
        broker = broker_;
        emit BrokerUpdated(oldBroker, broker_, msg.sender);
    }

    function setDefaultRoute(address tokenIn, address exchangeProvider, bytes32 exchangeId) external onlyOwner {
        if (tokenIn == address(0) || exchangeProvider == address(0)) revert InvalidAddress();
        _defaultRoutes[tokenIn] = Route({
            exchangeProvider: exchangeProvider,
            exchangeId: exchangeId,
            intermediateToken: address(0),
            secondExchangeProvider: address(0),
            secondExchangeId: bytes32(0),
            configured: true
        });
        emit DefaultRouteUpdated(tokenIn, exchangeProvider, exchangeId, msg.sender);
    }

    function setDefaultMultiHopRoute(
        address tokenIn,
        address intermediateToken,
        address firstExchangeProvider,
        bytes32 firstExchangeId,
        address secondExchangeProvider,
        bytes32 secondExchangeId
    ) external onlyOwner {
        if (
            tokenIn == address(0) || intermediateToken == address(0) || firstExchangeProvider == address(0)
                || secondExchangeProvider == address(0)
        ) revert InvalidAddress();

        _defaultRoutes[tokenIn] = Route({
            exchangeProvider: firstExchangeProvider,
            exchangeId: firstExchangeId,
            intermediateToken: intermediateToken,
            secondExchangeProvider: secondExchangeProvider,
            secondExchangeId: secondExchangeId,
            configured: true
        });

        emit DefaultMultiHopRouteUpdated(
            tokenIn,
            intermediateToken,
            firstExchangeProvider,
            firstExchangeId,
            secondExchangeProvider,
            secondExchangeId,
            msg.sender
        );
    }

    function clearDefaultRoute(address tokenIn) external onlyOwner {
        if (tokenIn == address(0)) revert InvalidAddress();
        delete _defaultRoutes[tokenIn];
        emit DefaultRouteCleared(tokenIn, msg.sender);
    }

    function getDefaultRoute(address tokenIn)
        external
        view
        returns (address exchangeProvider, bytes32 exchangeId, bool configured)
    {
        Route memory route = _defaultRoutes[tokenIn];
        return (route.exchangeProvider, route.exchangeId, route.configured);
    }

    function getDefaultRouteConfig(address tokenIn)
        external
        view
        returns (
            address exchangeProvider,
            bytes32 exchangeId,
            address intermediateToken,
            address secondExchangeProvider,
            bytes32 secondExchangeId,
            bool configured
        )
    {
        Route memory route = _defaultRoutes[tokenIn];
        return (
            route.exchangeProvider,
            route.exchangeId,
            route.intermediateToken,
            route.secondExchangeProvider,
            route.secondExchangeId,
            route.configured
        );
    }

    function _resolveRoute(address tokenIn, bytes calldata swapData) internal view returns (Route memory route) {
        if (swapData.length == 0) {
            route = _defaultRoutes[tokenIn];
            if (!route.configured || route.exchangeProvider == address(0)) revert RouteNotConfigured(tokenIn);
            return route;
        }

        if (swapData.length == 64) {
            (address exchangeProvider, bytes32 exchangeId) = abi.decode(swapData, (address, bytes32));
            if (exchangeProvider == address(0)) revert InvalidSwapData();

            return Route({
                exchangeProvider: exchangeProvider,
                exchangeId: exchangeId,
                intermediateToken: address(0),
                secondExchangeProvider: address(0),
                secondExchangeId: bytes32(0),
                configured: true
            });
        }

        if (swapData.length != 160) revert InvalidSwapData();
        (
            address firstExchangeProvider,
            bytes32 firstExchangeId,
            address intermediateToken,
            address secondExchangeProvider,
            bytes32 secondExchangeId
        ) = abi.decode(swapData, (address, bytes32, address, address, bytes32));
        if (
            firstExchangeProvider == address(0) || intermediateToken == address(0)
                || secondExchangeProvider == address(0)
        ) {
            revert InvalidSwapData();
        }

        return Route({
            exchangeProvider: firstExchangeProvider,
            exchangeId: firstExchangeId,
            intermediateToken: intermediateToken,
            secondExchangeProvider: secondExchangeProvider,
            secondExchangeId: secondExchangeId,
            configured: true
        });
    }

    function _swapMultiHop(Route memory route, address tokenIn, address cadmToken, uint256 amountIn, uint256 minCadmOut)
        internal
    {
        uint256 intermediateBefore = IERC20(route.intermediateToken).balanceOf(address(this));
        uint256 quotedIntermediateOut = IMentoBroker(broker)
            .getAmountOut(route.exchangeProvider, route.exchangeId, tokenIn, route.intermediateToken, amountIn);

        _approveExact(tokenIn, broker, amountIn);
        IMentoBroker(broker)
            .swapIn(
                route.exchangeProvider,
                route.exchangeId,
                tokenIn,
                route.intermediateToken,
                amountIn,
                quotedIntermediateOut
            );

        uint256 intermediateAfter = IERC20(route.intermediateToken).balanceOf(address(this));
        uint256 intermediateOut = intermediateAfter - intermediateBefore;

        _approveExact(route.intermediateToken, broker, intermediateOut);
        IMentoBroker(broker)
            .swapIn(
                route.secondExchangeProvider,
                route.secondExchangeId,
                route.intermediateToken,
                cadmToken,
                intermediateOut,
                minCadmOut
            );
    }

    function _isMultiHopRoute(Route memory route) internal pure returns (bool) {
        return route.intermediateToken != address(0);
    }

    function _approveExact(address token, address spender, uint256 amount) internal {
        IERC20(token).forceApprove(spender, 0);
        IERC20(token).forceApprove(spender, amount);
    }
}
