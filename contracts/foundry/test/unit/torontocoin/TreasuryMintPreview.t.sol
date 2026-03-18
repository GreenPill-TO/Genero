// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CharityRegistry} from "../../../src/torontocoin/CharityRegistry.sol";
import {TreasuryController} from "../../../src/torontocoin/TreasuryController.sol";
import {IReserveRegistry} from "../../../src/torontocoin/interfaces/IReserveRegistry.sol";

contract MockReserveRegistryForTreasury is IReserveRegistry {
    ReserveAsset private asset;

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

    function isReserveAssetActive(bytes32) external pure returns (bool) {
        return true;
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
        cadValue18 = assetAmount * 1e12; // token 6 decimals -> CAD 18-decimal parity
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

    function getMerchantPool(address) external pure returns (bytes32) {
        return bytes32("pool-1");
    }
}

contract MockTcoinForTreasury {
    function decimals() external pure returns (uint8) {
        return 18;
    }
    function mint(address, uint256, bytes calldata) external pure {}

    function mintTo(address, uint256) external pure returns (bool) {
        return true;
    }

    function burn(uint256) external pure returns (bool) {
        return true;
    }
    function setExpirePeriod(uint256) external pure {}
}

contract TreasuryMintPreviewTest is Test {
    CharityRegistry private charity;
    TreasuryController private treasury;
    MockReserveRegistryForTreasury private reserve;

    function setUp() public {
        charity = new CharityRegistry(address(this), address(this), address(this));
        charity.addCharity("Default Charity", address(0xABCD), "default-charity");

        reserve = new MockReserveRegistryForTreasury();
        reserve.setAsset(bytes32("USDC"), address(0x1234), 6);

        treasury = new TreasuryController();
        treasury.initialize(
            address(this),
            address(this),
            address(this),
            address(new MockTcoinForTreasury()),
            address(reserve),
            address(charity),
            address(new MockPoolRegistryForTreasury()),
            address(new MockOracleRouterForTreasury()),
            1e18,
            8000,
            9700,
            300
        );
    }

    function test_PreviewMintResolvesDefaultCharity() public {
        (uint256 userTcoinOut, uint256 charityTcoinOut, uint256 resolvedCharityId,,) =
            treasury.previewMint(bytes32("USDC"), 1_000_000, 0);

        assertEq(resolvedCharityId, 1);
        assertGt(userTcoinOut, 0);
        assertGt(charityTcoinOut, 0);
    }
}
