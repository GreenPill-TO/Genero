// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CharityRegistry} from "../../../src/torontocoin/CharityRegistry.sol";
import {Treasury} from "../../../src/torontocoin/Treasury.sol";
import {TreasuryController} from "../../../src/torontocoin/TreasuryController.sol";
import {IReserveRegistry} from "../../../src/torontocoin/interfaces/IReserveRegistry.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract MockReserveRegistryForTreasury is IReserveRegistry {
    ReserveAsset private asset;
    bytes32[] private assetIds;

    function setAsset(bytes32 assetId, address token, uint8 tokenDecimals) external {
        asset = ReserveAsset({
            assetId: assetId,
            token: token,
            code: "USDC",
            tokenDecimals: tokenDecimals,
            primaryOracle: address(0x11),
            fallbackOracle: address(0x12),
            staleAfter: 3600,
            status: ReserveAssetStatus.Active
        });
        delete assetIds;
        assetIds.push(assetId);
    }

    function addReserveAsset(bytes32, address, string calldata, uint8, address, address, uint256) external pure {}
    function removeReserveAsset(bytes32) external pure {}
    function pauseReserveAsset(bytes32) external pure {}
    function unpauseReserveAsset(bytes32) external pure {}
    function updateReserveAssetOracles(bytes32, address, address) external pure {}
    function updateReserveAssetStaleness(bytes32, uint256) external pure {}

    function getReserveAsset(bytes32) external view returns (ReserveAsset memory) {
        return asset;
    }

    function getReserveAssetByToken(address token) external view returns (ReserveAsset memory) {
        if (asset.token != token) {
            revert("UNKNOWN_TOKEN");
        }
        return asset;
    }

    function isReserveAssetActive(bytes32) external pure returns (bool) {
        return true;
    }

    function listReserveAssetIds() external view returns (bytes32[] memory) {
        return assetIds;
    }

    function getOracleConfig(bytes32)
        external
        view
        returns (address token, uint8 tokenDecimals, address primaryOracle, address fallbackOracle, uint256 staleAfter)
    {
        return (asset.token, asset.tokenDecimals, asset.primaryOracle, asset.fallbackOracle, asset.staleAfter);
    }
}

contract MockOracleRouterForTreasury {
    function previewCadValue(bytes32, uint256 assetAmount)
        external
        view
        returns (uint256 cadValue18, uint256 updatedAt, bool usedFallback)
    {
        cadValue18 = assetAmount * 1e12;
        updatedAt = block.timestamp;
        usedFallback = false;
    }

    function getCadPrice(bytes32) external view returns (uint256 price18, uint256 updatedAt, bool usedFallback) {
        price18 = 1e18;
        updatedAt = block.timestamp;
        usedFallback = false;
    }
}

contract MockPoolRegistryForTreasury {
    function isMerchantApprovedInActivePool(address) external pure returns (bool) {
        return true;
    }
}

contract MockTcoinForTreasury is MockERC20 {
    uint256 public expirePeriod;

    constructor() MockERC20("mrTCOIN", "MRT", 18) {}

    function mint(address to, uint256 amount, bytes calldata) external {
        _mint(to, amount);
    }

    function mintTo(address beneficiary, uint256 amount) external returns (bool) {
        _mint(beneficiary, amount);
        return true;
    }

    function burn(uint256 amount) external returns (bool) {
        _burn(msg.sender, amount);
        return true;
    }

    function setExpirePeriod(uint256 expirePeriod_) external {
        expirePeriod = expirePeriod_;
    }
}

contract TreasuryMintPreviewTest is Test {
    bytes32 private constant ASSET_ID = bytes32("USDC");

    CharityRegistry private charity;
    Treasury private treasuryVault;
    TreasuryController private treasury;
    MockReserveRegistryForTreasury private reserve;
    MockERC20 private reserveToken;
    MockTcoinForTreasury private mrTcoin;

    address private router = address(0xCAFE);
    address private user = address(0xBEEF);
    address private governance = address(0xD00D);

    function setUp() public {
        charity = new CharityRegistry(address(this), address(this), address(this));
        charity.addCharity("Default Charity", address(0xABCD), "default-charity");

        reserveToken = new MockERC20("USD Coin", "USDC", 6);
        mrTcoin = new MockTcoinForTreasury();

        reserve = new MockReserveRegistryForTreasury();
        reserve.setAsset(ASSET_ID, address(reserveToken), 6);

        treasuryVault = new Treasury(address(this));
        treasury = new TreasuryController();
        treasury.initialize(
            address(this),
            governance,
            address(this),
            address(treasuryVault),
            address(mrTcoin),
            address(reserve),
            address(charity),
            address(new MockPoolRegistryForTreasury()),
            address(new MockOracleRouterForTreasury()),
            1e18,
            8000,
            9700,
            300,
            11e17
        );

        treasuryVault.setAuthorizedCaller(address(treasury), true);
        treasury.setLiquidityRouter(router);
    }

    function test_PreviewMintResolvesDefaultCharity() public view {
        (uint256 userTcoinOut, uint256 charityTcoinOut, uint256 resolvedCharityId,,) =
            treasury.previewMint(ASSET_ID, 1_000_000, 0);

        assertEq(resolvedCharityId, 1);
        assertGt(userTcoinOut, 0);
        assertGt(charityTcoinOut, 0);
    }

    function test_DepositAndMintMovesReserveIntoTreasuryVault() public {
        reserveToken.mint(user, 1_000_000);

        vm.startPrank(user);
        reserveToken.approve(address(treasuryVault), type(uint256).max);
        treasury.depositAndMint(ASSET_ID, 1_000_000, 0, 1_000_000e12);
        vm.stopPrank();

        assertEq(treasuryVault.reserveBalance(address(reserveToken)), 1_000_000);
        assertEq(reserveToken.balanceOf(address(treasury)), 0);
        assertEq(mrTcoin.balanceOf(user), 1_000_000e12);
    }

    function test_DepositAssetForLiquidityRouteIsRouterOnlyAndMintsToRouter() public {
        reserveToken.mint(router, 2_000_000);

        vm.prank(router);
        reserveToken.approve(address(treasuryVault), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(TreasuryController.NotLiquidityRouter.selector, address(this)));
        treasury.depositAssetForLiquidityRoute(ASSET_ID, 1_000_000, address(this));

        vm.prank(router);
        uint256 mrOut = treasury.depositAssetForLiquidityRoute(ASSET_ID, 1_000_000, router);

        assertEq(mrOut, 1_000_000e12);
        assertEq(mrTcoin.balanceOf(router), 1_000_000e12);
        assertEq(treasuryVault.reserveBalance(address(reserveToken)), 1_000_000);
    }

    function test_MintToCharityUsesOvercollateralizationHeadroom() public {
        reserveToken.mint(address(treasuryVault), 121_000_000);
        mrTcoin.mint(address(0x1111), 100_000_000e12, "");

        uint256 maxMintable = treasury.getMaxMintableCharityAmount();
        assertEq(maxMintable, 10_000_000e12);

        treasury.mintToCharity(1, maxMintable);

        assertEq(mrTcoin.balanceOf(address(0xABCD)), maxMintable);
        assertEq(treasury.getCurrentCollateralizationRatio18(), 11e17);
    }

    function test_GovernanceCanDisableAdminCharityMinting() public {
        reserveToken.mint(address(treasuryVault), 121_000_000);
        mrTcoin.mint(address(0x1111), 100_000_000e12, "");

        vm.prank(governance);
        treasury.setAdminCanMintToCharity(false);

        assertFalse(treasury.adminCanMintToCharity());

        uint256 maxMintable = treasury.getMaxMintableCharityAmount();

        vm.expectRevert(TreasuryController.Unauthorized.selector);
        treasury.mintToCharity(1, maxMintable);

        vm.prank(governance);
        treasury.mintToCharity(1, maxMintable);

        assertEq(mrTcoin.balanceOf(address(0xABCD)), maxMintable);
    }

    function test_AdminCanSelfDisableCharityMinting() public {
        reserveToken.mint(address(treasuryVault), 121_000_000);
        mrTcoin.mint(address(0x1111), 100_000_000e12, "");

        treasury.setAdminCanMintToCharity(false);

        assertFalse(treasury.adminCanMintToCharity());

        uint256 maxMintable = treasury.getMaxMintableCharityAmount();

        vm.expectRevert(TreasuryController.Unauthorized.selector);
        treasury.mintToCharity(1, maxMintable);

        vm.prank(governance);
        treasury.mintToCharity(1, maxMintable);

        assertEq(mrTcoin.balanceOf(address(0xABCD)), maxMintable);
    }
}
