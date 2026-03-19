// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MentoBrokerSwapAdapter, IMentoBroker} from "../../../src/torontocoin/MentoBrokerSwapAdapter.sol";
import {
    ReserveInputRouter,
    ITreasuryControllerForReserveInputRouter
} from "../../../src/torontocoin/ReserveInputRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract MockTreasuryControllerForMentoAdapter is ITreasuryControllerForReserveInputRouter {
    struct Resolution {
        bool accepted;
        bytes32 assetId;
        address reserveToken;
    }

    mapping(address => Resolution) private _resolutions;

    function setAcceptedAsset(address token, bytes32 assetId) external {
        _resolutions[token] = Resolution({accepted: true, assetId: assetId, reserveToken: token});
    }

    function resolveAcceptedReserveAsset(address token)
        external
        view
        override
        returns (bool accepted, bytes32 assetId, address reserveToken)
    {
        Resolution memory resolution = _resolutions[token];
        return (resolution.accepted, resolution.assetId, resolution.reserveToken);
    }
}

contract MockMentoBroker is IMentoBroker {
    using SafeERC20 for IERC20;

    struct RouteQuote {
        uint16 outBps;
        bool configured;
    }

    mapping(bytes32 => RouteQuote) private _quotes;

    function setQuote(address tokenIn, address exchangeProvider, bytes32 exchangeId, uint16 outBps) external {
        _quotes[_quoteKey(tokenIn, exchangeProvider, exchangeId)] = RouteQuote({outBps: outBps, configured: true});
    }

    function getAmountOut(address exchangeProvider, bytes32 exchangeId, address tokenIn, address, uint256 amountIn)
        external
        view
        override
        returns (uint256 amountOut)
    {
        RouteQuote memory route = _requireRoute(tokenIn, exchangeProvider, exchangeId);
        return (amountIn * route.outBps) / 10_000;
    }

    function swapIn(
        address exchangeProvider,
        bytes32 exchangeId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external override returns (uint256 amountOut) {
        RouteQuote memory route = _requireRoute(tokenIn, exchangeProvider, exchangeId);
        amountOut = (amountIn * route.outBps) / 10_000;
        require(amountOut >= amountOutMin, "amountOutMin not met");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        MockERC20(tokenOut).mint(msg.sender, amountOut);
    }

    function _requireRoute(address tokenIn, address exchangeProvider, bytes32 exchangeId)
        internal
        view
        returns (RouteQuote memory route)
    {
        route = _quotes[_quoteKey(tokenIn, exchangeProvider, exchangeId)];
        require(route.configured, "route missing");
    }

    function _quoteKey(address tokenIn, address exchangeProvider, bytes32 exchangeId)
        internal
        pure
        returns (bytes32 key)
    {
        return keccak256(abi.encode(tokenIn, exchangeProvider, exchangeId));
    }
}

contract MentoBrokerSwapAdapterTest is Test {
    bytes32 private constant _MCAD_ASSET_ID = keccak256("mCAD");
    bytes32 private constant _ROUTE_A = keccak256("route-a");
    bytes32 private constant _ROUTE_B = keccak256("route-b");
    bytes32 private constant _ROUTE_C = keccak256("route-c");
    bytes32 private constant _ROUTE_D = keccak256("route-d");

    address private constant _PROVIDER_A = address(0xAAA1);
    address private constant _PROVIDER_B = address(0xBBB2);
    address private constant _PROVIDER_C = address(0xCCC3);
    address private constant _LIQUIDITY_ROUTER = address(0xA11CE);

    MockERC20 private _dai;
    MockERC20 private _usdc;
    MockERC20 private _usdm;
    MockERC20 private _cadm;
    MockMentoBroker private _broker;
    MentoBrokerSwapAdapter private _adapter;
    MockTreasuryControllerForMentoAdapter private _treasuryController;
    ReserveInputRouter private _reserveInputRouter;

    function setUp() public {
        _dai = new MockERC20("Dai Stablecoin", "DAI", 18);
        _usdc = new MockERC20("USD Coin", "USDC", 6);
        _usdm = new MockERC20("Mento Dollar", "USDm", 18);
        _cadm = new MockERC20("Mento CAD", "mCAD", 18);
        _broker = new MockMentoBroker();
        _adapter = new MentoBrokerSwapAdapter(address(this), address(_broker));
        _treasuryController = new MockTreasuryControllerForMentoAdapter();
        _treasuryController.setAcceptedAsset(address(_cadm), _MCAD_ASSET_ID);

        _reserveInputRouter = new ReserveInputRouter(
            address(this), _LIQUIDITY_ROUTER, address(_treasuryController), address(_adapter), address(_cadm)
        );

        _reserveInputRouter.setInputTokenEnabled(address(_dai), true);
        _reserveInputRouter.setInputTokenEnabled(address(_usdc), true);
        _adapter.setDefaultRoute(address(_dai), _PROVIDER_A, _ROUTE_A);
        _adapter.setDefaultMultiHopRoute(address(_usdc), address(_usdm), _PROVIDER_C, _ROUTE_C, _PROVIDER_C, _ROUTE_D);
        _broker.setQuote(address(_dai), _PROVIDER_A, _ROUTE_A, 9_700);
        _broker.setQuote(address(_dai), _PROVIDER_B, _ROUTE_B, 9_500);
        _broker.setQuote(address(_usdc), _PROVIDER_C, _ROUTE_C, 9_900);
        _broker.setQuote(address(_usdm), _PROVIDER_C, _ROUTE_D, 9_800);
    }

    function test_PreviewUsesConfiguredDefaultRoute() public view {
        uint256 quote = _adapter.previewSwapToCadm(address(_dai), address(_cadm), 100e18, "");
        assertEq(quote, 97e18);
    }

    function test_SwapDataOverrideUsesAlternateMentoRoute() public {
        uint256 amountIn = 100e18;
        _dai.mint(address(this), amountIn);
        IERC20(address(_dai)).approve(address(_adapter), amountIn);

        bytes memory swapData = abi.encode(_PROVIDER_B, _ROUTE_B);
        uint256 cadmOut = _adapter.swapToCadm(address(_dai), address(_cadm), amountIn, 95e18, block.timestamp, swapData);

        assertEq(cadmOut, 95e18);
        assertEq(_cadm.balanceOf(address(this)), 95e18);
        assertEq(_dai.balanceOf(address(_broker)), amountIn);
    }

    function test_PreviewUsesConfiguredMultiHopRouteForUsdc() public view {
        uint256 quote = _adapter.previewSwapToCadm(address(_usdc), address(_cadm), 100e6, "");
        assertEq(quote, 97_020_000);
    }

    function test_SwapToCadmSupportsConfiguredMultiHopRoute() public {
        uint256 amountIn = 100e6;
        _usdc.mint(address(this), amountIn);
        IERC20(address(_usdc)).approve(address(_adapter), amountIn);

        uint256 cadmOut = _adapter.swapToCadm(address(_usdc), address(_cadm), amountIn, 97_000_000, block.timestamp, "");

        assertEq(cadmOut, 97_020_000);
        assertEq(_cadm.balanceOf(address(this)), 97_020_000);
        assertEq(_usdc.balanceOf(address(_broker)), amountIn);
    }

    function test_ReserveInputRouterNormalizesUnsupportedInputThroughMentoBrokerAdapter() public {
        uint256 amountIn = 50e18;

        _dai.mint(_LIQUIDITY_ROUTER, amountIn);
        vm.prank(_LIQUIDITY_ROUTER);
        IERC20(address(_dai)).approve(address(_reserveInputRouter), amountIn);

        vm.prank(_LIQUIDITY_ROUTER);
        (bytes32 reserveAssetId, address reserveToken, uint256 reserveAmountOut) =
            _reserveInputRouter.normalizeReserveInput(address(_dai), amountIn, 48e18, _LIQUIDITY_ROUTER);

        assertEq(reserveAssetId, _MCAD_ASSET_ID);
        assertEq(reserveToken, address(_cadm));
        assertEq(reserveAmountOut, 48_500_000000000000000);
        assertEq(_cadm.balanceOf(_LIQUIDITY_ROUTER), 48_500_000000000000000);
        assertEq(_dai.balanceOf(address(_broker)), amountIn);
    }

    function test_ReserveInputRouterNormalizesUsdcThroughUsdmIntoCadm() public {
        uint256 amountIn = 100e6;

        _usdc.mint(_LIQUIDITY_ROUTER, amountIn);
        vm.prank(_LIQUIDITY_ROUTER);
        IERC20(address(_usdc)).approve(address(_reserveInputRouter), amountIn);

        vm.prank(_LIQUIDITY_ROUTER);
        (bytes32 reserveAssetId, address reserveToken, uint256 reserveAmountOut) =
            _reserveInputRouter.normalizeReserveInput(address(_usdc), amountIn, 97_000_000, _LIQUIDITY_ROUTER);

        assertEq(reserveAssetId, _MCAD_ASSET_ID);
        assertEq(reserveToken, address(_cadm));
        assertEq(reserveAmountOut, 97_020_000);
        assertEq(_cadm.balanceOf(_LIQUIDITY_ROUTER), 97_020_000);
        assertEq(_usdc.balanceOf(address(_broker)), amountIn);
    }
}
