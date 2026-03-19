// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {
    ReserveInputRouter,
    ITreasuryControllerForReserveInputRouter
} from "../../../src/torontocoin/ReserveInputRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapAdapter} from "./mocks/MockSwapAdapter.sol";

contract MockTreasuryControllerForReserveInput is ITreasuryControllerForReserveInputRouter {
    mapping(address => bytes32) public assetIdByToken;

    function setAcceptedReserve(address token, bytes32 assetId) external {
        assetIdByToken[token] = assetId;
    }

    function resolveAcceptedReserveAsset(address token)
        external
        view
        returns (bool accepted, bytes32 assetId, address reserveToken)
    {
        assetId = assetIdByToken[token];
        if (assetId == bytes32(0)) {
            return (false, bytes32(0), address(0));
        }
        return (true, assetId, token);
    }
}

contract ReserveInputRouterTest is Test {
    bytes32 private constant USDC_ASSET_ID = bytes32("USDC");
    bytes32 private constant MCAD_ASSET_ID = bytes32("MCAD");

    address private constant LIQUIDITY_ROUTER = address(0xBEEF);
    address private constant USER = address(0xA11CE);

    MockERC20 private usdc;
    MockERC20 private dai;
    MockERC20 private cadm;
    MockSwapAdapter private swapAdapter;
    MockTreasuryControllerForReserveInput private treasuryController;
    ReserveInputRouter private reserveInputRouter;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 18);
        dai = new MockERC20("Dai Stablecoin", "DAI", 18);
        cadm = new MockERC20("Mento CAD", "mCAD", 18);
        swapAdapter = new MockSwapAdapter();
        treasuryController = new MockTreasuryControllerForReserveInput();
        reserveInputRouter = new ReserveInputRouter(
            address(this), LIQUIDITY_ROUTER, address(treasuryController), address(swapAdapter), address(cadm)
        );

        treasuryController.setAcceptedReserve(address(usdc), USDC_ASSET_ID);
        treasuryController.setAcceptedReserve(address(cadm), MCAD_ASSET_ID);
        reserveInputRouter.setInputTokenEnabled(address(dai), true);

        usdc.mint(USER, 1_000e18);
        dai.mint(USER, 1_000e18);

        vm.startPrank(USER);
        usdc.approve(address(reserveInputRouter), type(uint256).max);
        dai.approve(address(reserveInputRouter), type(uint256).max);
        vm.stopPrank();
    }

    function test_PreviewReturnsDirectAcceptanceForTreasuryAcceptedInput() public view {
        (
            bool directAccepted,
            bool requiresSwap,
            bytes32 reserveAssetId,
            address reserveToken,
            uint256 reserveAmountOut
        ) = reserveInputRouter.previewNormalizeReserveInput(address(usdc), 100e18);

        assertTrue(directAccepted);
        assertFalse(requiresSwap);
        assertEq(reserveAssetId, USDC_ASSET_ID);
        assertEq(reserveToken, address(usdc));
        assertEq(reserveAmountOut, 100e18);
    }

    function test_NormalizeReserveInputPassesThroughDirectReserveAsset() public {
        vm.prank(LIQUIDITY_ROUTER);
        (bytes32 reserveAssetId, address reserveToken, uint256 reserveAmountOut) =
            reserveInputRouter.normalizeReserveInput(address(usdc), 100e18, 90e18, USER);

        assertEq(reserveAssetId, USDC_ASSET_ID);
        assertEq(reserveToken, address(usdc));
        assertEq(reserveAmountOut, 100e18);
        assertEq(usdc.balanceOf(LIQUIDITY_ROUTER), 100e18);
        assertEq(usdc.balanceOf(address(reserveInputRouter)), 0);
    }

    function test_NormalizeReserveInputSwapsUnsupportedInputIntoCadm() public {
        vm.prank(LIQUIDITY_ROUTER);
        (bytes32 reserveAssetId, address reserveToken, uint256 reserveAmountOut) =
            reserveInputRouter.normalizeReserveInput(address(dai), 100e18, 90e18, USER);

        assertEq(reserveAssetId, MCAD_ASSET_ID);
        assertEq(reserveToken, address(cadm));
        assertEq(reserveAmountOut, 100e18);
        assertEq(cadm.balanceOf(LIQUIDITY_ROUTER), 100e18);
        assertEq(dai.balanceOf(address(reserveInputRouter)), 0);
        assertEq(cadm.balanceOf(address(reserveInputRouter)), 0);
    }

    function test_RevertWhenUnsupportedInputIsNotEnabledForSwap() public {
        MockERC20 unsupported = new MockERC20("Unsupported", "NOPE", 18);
        unsupported.mint(USER, 100e18);

        vm.prank(USER);
        unsupported.approve(address(reserveInputRouter), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(ReserveInputRouter.InputTokenNotEnabled.selector, address(unsupported)));
        vm.prank(LIQUIDITY_ROUTER);
        reserveInputRouter.normalizeReserveInput(address(unsupported), 100e18, 90e18, USER);
    }

    function test_StateChangingNormalizeIsLiquidityRouterOnly() public {
        vm.expectRevert(abi.encodeWithSelector(ReserveInputRouter.LiquidityRouterOnly.selector, address(this)));
        reserveInputRouter.normalizeReserveInput(address(usdc), 100e18, 90e18, USER);
    }
}
