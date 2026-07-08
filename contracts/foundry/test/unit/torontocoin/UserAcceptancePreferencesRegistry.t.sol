// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {
    UserAcceptancePreferencesRegistry
} from "../../../src/torontocoin/UserAcceptancePreferencesRegistry.sol";

contract UserAcceptancePreferencesRegistryTest is Test {
    UserAcceptancePreferencesRegistry private registry;

    address private constant USER = address(0x1001);
    bytes32 private constant POOL_A = bytes32("pool-a");
    bytes32 private constant MERCHANT_A = bytes32("merchant-a");
    bytes32 private constant MERCHANT_B = bytes32("merchant-b");
    address private constant TOKEN_A = address(0x2001);
    address private constant TOKEN_B = address(0x2002);

    function setUp() public {
        registry = new UserAcceptancePreferencesRegistry(address(this));
    }

    function test_PoolAcceptanceCanBeAcceptedDeniedThenUnset() public {
        vm.startPrank(USER);
        registry.setPoolAcceptance(POOL_A, UserAcceptancePreferencesRegistry.AcceptanceStatus.Accepted);
        assertTrue(registry.isPoolAccepted(USER, POOL_A));

        registry.setPoolAcceptance(POOL_A, UserAcceptancePreferencesRegistry.AcceptanceStatus.Denied);
        assertFalse(registry.isPoolAccepted(USER, POOL_A));

        registry.setStrictAcceptedOnly(true);
        registry.setPoolAcceptance(POOL_A, UserAcceptancePreferencesRegistry.AcceptanceStatus.Unset);
        assertFalse(registry.isPoolAccepted(USER, POOL_A));
        vm.stopPrank();
    }

    function test_MerchantPreferredListImplicitlyAcceptsAndRejectsDuplicates() public {
        bytes32[] memory preferred = new bytes32[](2);
        preferred[0] = MERCHANT_A;
        preferred[1] = MERCHANT_B;

        vm.prank(USER);
        registry.replacePreferredMerchants(preferred);

        bytes32[] memory accepted = registry.getAcceptedMerchantIds(USER);
        bytes32[] memory ranked = registry.getPreferredMerchantIds(USER);
        assertEq(accepted.length, 2);
        assertEq(ranked.length, 2);
        assertEq(ranked[0], MERCHANT_A);
        assertEq(ranked[1], MERCHANT_B);
        assertTrue(registry.isMerchantAccepted(USER, MERCHANT_A));

        (bool rankedA, uint256 rankA) = registry.getMerchantPreferenceRank(USER, MERCHANT_A);
        (bool rankedB, uint256 rankB) = registry.getMerchantPreferenceRank(USER, MERCHANT_B);
        assertTrue(rankedA);
        assertTrue(rankedB);
        assertEq(rankA, 0);
        assertEq(rankB, 1);

        bytes32[] memory duplicate = new bytes32[](2);
        duplicate[0] = MERCHANT_A;
        duplicate[1] = MERCHANT_A;

        vm.expectRevert(
            abi.encodeWithSelector(UserAcceptancePreferencesRegistry.DuplicatePreferredMerchant.selector, MERCHANT_A)
        );
        vm.prank(USER);
        registry.replacePreferredMerchants(duplicate);
    }

    function test_DenyingPreferredMerchantRemovesRankAndHardRejects() public {
        bytes32[] memory preferred = new bytes32[](1);
        preferred[0] = MERCHANT_A;

        vm.prank(USER);
        registry.replacePreferredMerchants(preferred);

        vm.prank(USER);
        registry.setMerchantAcceptance(MERCHANT_A, UserAcceptancePreferencesRegistry.AcceptanceStatus.Denied);

        (bool ranked, uint256 rank) = registry.getMerchantPreferenceRank(USER, MERCHANT_A);
        assertFalse(ranked);
        assertEq(rank, 0);
        assertFalse(registry.isMerchantAccepted(USER, MERCHANT_A));
    }

    function test_TokenPreferenceReplacementClearsOldRanksAndSupportsStrictMode() public {
        address[] memory preferred = new address[](2);
        preferred[0] = TOKEN_A;
        preferred[1] = TOKEN_B;

        vm.prank(USER);
        registry.replacePreferredTokens(preferred);

        vm.prank(USER);
        registry.setStrictAcceptedOnly(true);

        assertTrue(registry.isTokenAccepted(USER, TOKEN_A));
        assertTrue(registry.isTokenAccepted(USER, TOKEN_B));

        address[] memory replacement = new address[](1);
        replacement[0] = TOKEN_B;

        vm.prank(USER);
        registry.replacePreferredTokens(replacement);

        (bool rankedA,) = registry.getTokenPreferenceRank(USER, TOKEN_A);
        (bool rankedB, uint256 rankB) = registry.getTokenPreferenceRank(USER, TOKEN_B);
        assertFalse(rankedA);
        assertTrue(rankedB);
        assertEq(rankB, 0);
        assertFalse(registry.isTokenAccepted(USER, TOKEN_A));
        assertTrue(registry.isTokenAccepted(USER, TOKEN_B));
    }

    function test_DefaultAllowAndStrictModeBothUseCanonicalReadSurface() public {
        assertTrue(registry.isMerchantAccepted(USER, MERCHANT_A));
        assertTrue(registry.isTokenAccepted(USER, TOKEN_A));

        vm.prank(USER);
        registry.setStrictAcceptedOnly(true);

        assertFalse(registry.isMerchantAccepted(USER, MERCHANT_A));
        assertFalse(registry.isTokenAccepted(USER, TOKEN_A));

        vm.prank(USER);
        registry.setMerchantAcceptance(MERCHANT_A, UserAcceptancePreferencesRegistry.AcceptanceStatus.Accepted);

        vm.prank(USER);
        registry.setTokenAcceptance(TOKEN_A, UserAcceptancePreferencesRegistry.AcceptanceStatus.Accepted);

        (
            bool strictAcceptedOnly_,
            bytes32[] memory acceptedPoolIds_,
            bytes32[] memory deniedPoolIds_,
            bytes32[] memory acceptedMerchantIds_,
            bytes32[] memory deniedMerchantIds_,
            bytes32[] memory preferredMerchantIds_,
            address[] memory acceptedTokenAddresses_,
            address[] memory deniedTokenAddresses_,
            address[] memory preferredTokenAddresses_
        ) = registry.getRoutingPreferences(USER);

        assertTrue(strictAcceptedOnly_);
        assertEq(acceptedPoolIds_.length, 0);
        assertEq(deniedPoolIds_.length, 0);
        assertEq(acceptedMerchantIds_.length, 1);
        assertEq(acceptedMerchantIds_[0], MERCHANT_A);
        assertEq(deniedMerchantIds_.length, 0);
        assertEq(preferredMerchantIds_.length, 0);
        assertEq(acceptedTokenAddresses_.length, 1);
        assertEq(acceptedTokenAddresses_[0], TOKEN_A);
        assertEq(deniedTokenAddresses_.length, 0);
        assertEq(preferredTokenAddresses_.length, 0);
    }
}
