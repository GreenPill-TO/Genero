// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PoolRegistry} from "../../../src/torontocoin/PoolRegistry.sol";

contract PoolRegistryTest is Test {
    PoolRegistry private registry;

    address private governance = address(0xBEEF);
    bytes32 private constant POOL_A = bytes32("pool-a");
    bytes32 private constant POOL_B = bytes32("pool-b");
    bytes32 private constant MERCHANT_A = keccak256("merchant-a");
    bytes32 private constant MERCHANT_B = keccak256("merchant-b");
    address private constant WALLET_A1 = address(0x1001);
    address private constant WALLET_A2 = address(0x1002);
    address private constant WALLET_B1 = address(0x2001);
    address private constant POOL_A_ADDRESS = address(0x3001);
    address private constant POOL_B_ADDRESS = address(0x3002);

    function setUp() public {
        registry = new PoolRegistry(address(this), governance);

        registry.addPool(POOL_A, "Pool A", "pool-a-metadata");
        registry.addPool(POOL_B, "Pool B", "pool-b-metadata");
        registry.setPoolAddress(POOL_A, POOL_A_ADDRESS);
        registry.setPoolAddress(POOL_B, POOL_B_ADDRESS);
    }

    function test_ApproveMerchantStoresEntityAndWalletConfig() public {
        address[] memory wallets = new address[](2);
        wallets[0] = WALLET_A1;
        wallets[1] = WALLET_A2;

        registry.approveMerchant(MERCHANT_A, POOL_A, "merchant-a-metadata", wallets);

        PoolRegistry.MerchantEntity memory merchant = registry.getMerchant(MERCHANT_A);
        assertEq(merchant.merchantId, MERCHANT_A);
        assertEq(merchant.poolId, POOL_A);
        assertEq(merchant.metadataRecordId, "merchant-a-metadata");
        assertEq(uint256(merchant.status), uint256(PoolRegistry.MerchantStatus.Approved));
        assertTrue(merchant.acceptsCplTcoin);
        assertTrue(merchant.posFeeEligible);

        address[] memory merchantWallets = registry.getMerchantWallets(MERCHANT_A);
        assertEq(merchantWallets.length, 2);
        assertEq(merchantWallets[0], WALLET_A1);
        assertEq(merchantWallets[1], WALLET_A2);
        assertEq(registry.getMerchantIdByWallet(WALLET_A2), MERCHANT_A);

        (
            bool exists_,
            bytes32 merchantId_,
            bool approved_,
            bool poolActive_,
            bool acceptsCpl_,
            bool posFeeEligible_,
            bytes32 poolId_
        ) = registry.getMerchantPaymentConfig(WALLET_A1);

        assertTrue(exists_);
        assertEq(merchantId_, MERCHANT_A);
        assertTrue(approved_);
        assertTrue(poolActive_);
        assertTrue(acceptsCpl_);
        assertTrue(posFeeEligible_);
        assertEq(poolId_, POOL_A);

        assertTrue(registry.isMerchantWallet(WALLET_A1));
        assertTrue(registry.isMerchantApprovedWallet(WALLET_A1));
        assertTrue(registry.isMerchantPaymentTarget(WALLET_A1));
        assertTrue(registry.isMerchantPosFeeTarget(WALLET_A1));
        assertTrue(registry.acceptsCplTcoin(WALLET_A1));
        assertTrue(registry.isMerchantApprovedInActivePool(WALLET_A1));
        assertEq(registry.getMerchantPool(WALLET_A1), POOL_A);
        assertEq(registry.getPoolAddress(POOL_A), POOL_A_ADDRESS);
        assertEq(registry.getPoolIdByAddress(POOL_A_ADDRESS), POOL_A);
        assertTrue(registry.isRegisteredPoolAddress(POOL_A_ADDRESS));
    }

    function test_MerchantFlagsGatePaymentAndPosPredicates() public {
        address[] memory wallets = new address[](1);
        wallets[0] = WALLET_A1;
        registry.approveMerchant(MERCHANT_A, POOL_A, "merchant-a-metadata", wallets);

        registry.setMerchantCplAcceptance(MERCHANT_A, false);
        assertFalse(registry.acceptsCplTcoin(WALLET_A1));
        assertFalse(registry.isMerchantPaymentTarget(WALLET_A1));
        assertFalse(registry.isMerchantPosFeeTarget(WALLET_A1));

        registry.setMerchantCplAcceptance(MERCHANT_A, true);
        registry.setMerchantPosFeeEligibility(MERCHANT_A, false);
        assertTrue(registry.isMerchantPaymentTarget(WALLET_A1));
        assertFalse(registry.isMerchantPosFeeTarget(WALLET_A1));
    }

    function test_WalletsCanBeMovedAfterExplicitRemoval() public {
        address[] memory merchantAWallets = new address[](1);
        merchantAWallets[0] = WALLET_A1;
        registry.approveMerchant(MERCHANT_A, POOL_A, "merchant-a-metadata", merchantAWallets);

        address[] memory noWallets = new address[](0);
        registry.approveMerchant(MERCHANT_B, POOL_B, "merchant-b-metadata", noWallets);
        registry.addMerchantWallet(MERCHANT_B, WALLET_B1);

        vm.expectRevert(abi.encodeWithSelector(PoolRegistry.WalletAlreadyLinked.selector, WALLET_A1, MERCHANT_A));
        registry.addMerchantWallet(MERCHANT_B, WALLET_A1);

        registry.removeMerchantWallet(MERCHANT_A, WALLET_A1);
        assertEq(registry.getMerchantIdByWallet(WALLET_A1), bytes32(0));
        assertFalse(registry.isMerchantWallet(WALLET_A1));

        registry.addMerchantWallet(MERCHANT_B, WALLET_A1);
        assertEq(registry.getMerchantIdByWallet(WALLET_A1), MERCHANT_B);

        address[] memory merchantBWallets = registry.getMerchantWallets(MERCHANT_B);
        assertEq(merchantBWallets.length, 2);
    }

    function test_PoolAndMerchantSuspensionsDisableMerchantWallet() public {
        address[] memory wallets = new address[](1);
        wallets[0] = WALLET_A1;
        registry.approveMerchant(MERCHANT_A, POOL_A, "merchant-a-metadata", wallets);

        registry.suspendPool(POOL_A);
        assertFalse(registry.isMerchantApprovedWallet(WALLET_A1));
        assertFalse(registry.isMerchantPaymentTarget(WALLET_A1));

        registry.unsuspendPool(POOL_A);
        assertTrue(registry.isMerchantApprovedWallet(WALLET_A1));

        registry.suspendMerchant(MERCHANT_A);
        assertFalse(registry.isMerchantApprovedWallet(WALLET_A1));
        assertFalse(registry.isMerchantPaymentTarget(WALLET_A1));

        registry.unsuspendMerchant(MERCHANT_A);
        assertTrue(registry.isMerchantApprovedWallet(WALLET_A1));
    }

    function test_SetPoolAddressUpdatesCanonicalPoolAddressLookup() public {
        address replacementPoolAddress = address(0x3003);

        assertEq(registry.getPoolIdByAddress(POOL_A_ADDRESS), POOL_A);
        assertTrue(registry.isRegisteredPoolAddress(POOL_A_ADDRESS));

        registry.setPoolAddress(POOL_A, replacementPoolAddress);

        assertEq(registry.getPoolIdByAddress(POOL_A_ADDRESS), bytes32(0));
        assertFalse(registry.isRegisteredPoolAddress(POOL_A_ADDRESS));
        assertEq(registry.getPoolIdByAddress(replacementPoolAddress), POOL_A);
        assertTrue(registry.isRegisteredPoolAddress(replacementPoolAddress));
    }
}
