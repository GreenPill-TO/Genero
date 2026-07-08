// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

interface ITreasuryControllerForReserveInputRouter {
    function resolveAcceptedReserveAsset(address token)
        external
        view
        returns (bool accepted, bytes32 assetId, address reserveToken);
}

contract ReserveInputRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidAddress();
    error InvalidAmount();
    error UnsupportedReserveInput(address token);
    error InputTokenNotEnabled(address token);
    error LiquidityRouterOnly(address caller);
    error InsufficientReserveOut(uint256 expectedMin, uint256 actual);

    event LiquidityRouterUpdated(address indexed oldRouter, address indexed newRouter, address indexed actor);
    event TreasuryControllerUpdated(
        address indexed oldController, address indexed newController, address indexed actor
    );
    event SwapAdapterUpdated(address indexed oldSwapAdapter, address indexed newSwapAdapter, address indexed actor);
    event CadmTokenUpdated(address indexed oldCadmToken, address indexed newCadmToken, address indexed actor);
    event InputTokenStatusUpdated(address indexed token, bool enabled, address indexed actor);
    event ReserveInputNormalized(
        address indexed liquidityRouter,
        address indexed payer,
        address indexed tokenIn,
        bytes32 reserveAssetId,
        address reserveToken,
        uint256 amountIn,
        uint256 reserveAmountOut,
        bool usedSwap
    );
    event RefundIssued(address indexed token, address indexed to, uint256 amount);

    address public liquidityRouter;
    address public treasuryController;
    address public swapAdapter;
    address public cadmToken;

    mapping(address => bool) public enabledInputToken;

    modifier onlyLiquidityRouter() {
        if (msg.sender != liquidityRouter) revert LiquidityRouterOnly(msg.sender);
        _;
    }

    constructor(
        address initialOwner,
        address liquidityRouter_,
        address treasuryController_,
        address swapAdapter_,
        address cadmToken_
    ) {
        if (initialOwner == address(0)) revert InvalidAddress();
        _transferOwnership(initialOwner);

        _setLiquidityRouter(liquidityRouter_);
        _setTreasuryController(treasuryController_);
        _setSwapAdapter(swapAdapter_);
        _setCadmToken(cadmToken_);
    }

    function normalizeReserveInput(address tokenIn, uint256 amountIn, uint256 minReserveOut, address payer)
        external
        onlyLiquidityRouter
        whenNotPaused
        nonReentrant
        returns (bytes32 reserveAssetId, address reserveToken, uint256 reserveAmountOut)
    {
        if (tokenIn == address(0) || payer == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();

        (bool directAccepted, bytes32 directAssetId, address directReserveToken) =
            ITreasuryControllerForReserveInputRouter(treasuryController).resolveAcceptedReserveAsset(tokenIn);
        if (directAccepted) {
            if (amountIn < minReserveOut) revert InsufficientReserveOut(minReserveOut, amountIn);
            IERC20(tokenIn).safeTransferFrom(payer, msg.sender, amountIn);
            emit ReserveInputNormalized(
                msg.sender, payer, tokenIn, directAssetId, directReserveToken, amountIn, amountIn, false
            );
            return (directAssetId, directReserveToken, amountIn);
        }

        if (!enabledInputToken[tokenIn]) revert InputTokenNotEnabled(tokenIn);

        (bool cadmAccepted, bytes32 cadmAssetId, address cadmReserveToken) =
            ITreasuryControllerForReserveInputRouter(treasuryController).resolveAcceptedReserveAsset(cadmToken);
        if (!cadmAccepted || cadmReserveToken == address(0)) revert UnsupportedReserveInput(tokenIn);

        uint256 initialTokenInBalance = IERC20(tokenIn).balanceOf(address(this));
        uint256 initialCadmBalance = IERC20(cadmToken).balanceOf(address(this));

        IERC20(tokenIn).safeTransferFrom(payer, address(this), amountIn);

        reserveAmountOut = _swapToCadm(tokenIn, amountIn, minReserveOut);
        reserveAssetId = cadmAssetId;
        reserveToken = cadmReserveToken;

        IERC20(reserveToken).safeTransfer(msg.sender, reserveAmountOut);

        _refundSurplus(tokenIn, payer, initialTokenInBalance);
        if (tokenIn != reserveToken) {
            _refundSurplus(reserveToken, payer, initialCadmBalance);
        }

        emit ReserveInputNormalized(
            msg.sender, payer, tokenIn, reserveAssetId, reserveToken, amountIn, reserveAmountOut, true
        );
    }

    function previewNormalizeReserveInput(address tokenIn, uint256 amountIn)
        external
        view
        returns (
            bool directAccepted,
            bool requiresSwap,
            bytes32 reserveAssetId,
            address reserveToken,
            uint256 reserveAmountOut
        )
    {
        if (tokenIn == address(0) || amountIn == 0) {
            return (false, false, bytes32(0), address(0), 0);
        }

        (directAccepted, reserveAssetId, reserveToken) =
            ITreasuryControllerForReserveInputRouter(treasuryController).resolveAcceptedReserveAsset(tokenIn);
        if (directAccepted) {
            return (true, false, reserveAssetId, reserveToken, amountIn);
        }

        if (!enabledInputToken[tokenIn]) {
            return (false, false, bytes32(0), address(0), 0);
        }

        (bool cadmAccepted, bytes32 cadmAssetId, address cadmReserveToken) =
            ITreasuryControllerForReserveInputRouter(treasuryController).resolveAcceptedReserveAsset(cadmToken);
        if (!cadmAccepted || cadmReserveToken == address(0)) {
            return (false, false, bytes32(0), address(0), 0);
        }

        reserveAmountOut = tokenIn == cadmToken
            ? amountIn
            : ISwapAdapter(swapAdapter).previewSwapToCadm(tokenIn, cadmToken, amountIn, "");

        return (false, true, cadmAssetId, cadmReserveToken, reserveAmountOut);
    }

    function setLiquidityRouter(address liquidityRouter_) external onlyOwner {
        _setLiquidityRouter(liquidityRouter_);
    }

    function setTreasuryController(address treasuryController_) external onlyOwner {
        _setTreasuryController(treasuryController_);
    }

    function setSwapAdapter(address swapAdapter_) external onlyOwner {
        _setSwapAdapter(swapAdapter_);
    }

    function setCadmToken(address cadmToken_) external onlyOwner {
        _setCadmToken(cadmToken_);
    }

    function setInputTokenEnabled(address token, bool enabled) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        enabledInputToken[token] = enabled;
        emit InputTokenStatusUpdated(token, enabled, msg.sender);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _swapToCadm(address tokenIn, uint256 amountIn, uint256 minCadmOut) internal returns (uint256 cadmOut) {
        if (tokenIn == cadmToken) {
            cadmOut = amountIn;
        } else {
            uint256 cadmBefore = IERC20(cadmToken).balanceOf(address(this));
            _approveExact(tokenIn, swapAdapter, amountIn);

            ISwapAdapter(swapAdapter).swapToCadm(tokenIn, cadmToken, amountIn, minCadmOut, block.timestamp, "");

            uint256 cadmAfter = IERC20(cadmToken).balanceOf(address(this));
            cadmOut = cadmAfter - cadmBefore;
        }

        if (cadmOut < minCadmOut) {
            revert InsufficientReserveOut(minCadmOut, cadmOut);
        }
    }

    function _approveExact(address token, address spender, uint256 amount) internal {
        IERC20 erc20 = IERC20(token);
        erc20.forceApprove(spender, 0);
        erc20.forceApprove(spender, amount);
    }

    function _refundSurplus(address token, address to, uint256 initialBalance) internal {
        uint256 current = IERC20(token).balanceOf(address(this));
        if (current <= initialBalance) return;

        uint256 refundAmount = current - initialBalance;
        IERC20(token).safeTransfer(to, refundAmount);
        emit RefundIssued(token, to, refundAmount);
    }

    function _setLiquidityRouter(address liquidityRouter_) internal {
        if (liquidityRouter_ == address(0)) revert InvalidAddress();
        address oldLiquidityRouter = liquidityRouter;
        liquidityRouter = liquidityRouter_;
        emit LiquidityRouterUpdated(oldLiquidityRouter, liquidityRouter_, msg.sender);
    }

    function _setTreasuryController(address treasuryController_) internal {
        if (treasuryController_ == address(0)) revert InvalidAddress();
        address oldTreasuryController = treasuryController;
        treasuryController = treasuryController_;
        emit TreasuryControllerUpdated(oldTreasuryController, treasuryController_, msg.sender);
    }

    function _setSwapAdapter(address swapAdapter_) internal {
        if (swapAdapter_ == address(0)) revert InvalidAddress();
        address oldSwapAdapter = swapAdapter;
        swapAdapter = swapAdapter_;
        emit SwapAdapterUpdated(oldSwapAdapter, swapAdapter_, msg.sender);
    }

    function _setCadmToken(address cadmToken_) internal {
        if (cadmToken_ == address(0)) revert InvalidAddress();
        address oldCadmToken = cadmToken;
        cadmToken = cadmToken_;
        emit CadmTokenUpdated(oldCadmToken, cadmToken_, msg.sender);
    }
}
