// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayLinkProfileGuard} from "../../../script/helpers/PayLinkProfileGuard.sol";

contract PayLinkProfileGuardHarness {
    function validate(PayLinkProfileGuard.Profile memory profile) external pure returns (bool) {
        return PayLinkProfileGuard.validate(profile);
    }
}

contract PayLinkProfileGuardTest is Test {
    PayLinkProfileGuardHarness private harness;

    function setUp() public {
        harness = new PayLinkProfileGuardHarness();
    }

    function _profile() internal pure returns (PayLinkProfileGuard.Profile memory profile) {
        profile = PayLinkProfileGuard.Profile({
            target: "celo-sepolia-pay-link",
            purpose: "pay-link-only",
            chainId: 11142220,
            requireExplicitAddresses: true,
            governanceOwnsTokens: false,
            mentoEnabled: false,
            executeBuy: false,
            mrTcoinDecimals: 6,
            cplTcoinDecimals: 6,
            mrTcoinSymbol: "mrTCOIN-cs",
            cplTcoinSymbol: "cplTCOIN-cs",
            mintAmount: 500_000_000,
            paymentAmount: 100_000_000,
            deployedReserveMintAmount: 0,
            initialPoolSeed: 0
        });
    }

    function test_AcceptsOnlyExactZeroSeedPayLinkProfile() public pure {
        assertTrue(PayLinkProfileGuard.validate(_profile()));
    }

    function test_FullSuiteDoesNotEnableZeroSeedBypass() public pure {
        PayLinkProfileGuard.Profile memory profile = _profile();
        profile.target = "celo-mainnet";
        profile.purpose = "full-suite";
        assertFalse(PayLinkProfileGuard.validate(profile));
    }

    function test_RejectsDedicatedTargetWithoutPurposeAndPurposeWithoutTarget() public {
        PayLinkProfileGuard.Profile memory profile = _profile();
        profile.purpose = "full-suite";
        vm.expectRevert(
            abi.encodeWithSelector(
                PayLinkProfileGuard.InvalidPayLinkProfile.selector,
                "dedicated target and pay-link-only purpose must be selected together"
            )
        );
        harness.validate(profile);

        profile = _profile();
        profile.target = "celo-mainnet";
        vm.expectRevert(
            abi.encodeWithSelector(
                PayLinkProfileGuard.InvalidPayLinkProfile.selector,
                "dedicated target and pay-link-only purpose must be selected together"
            )
        );
        harness.validate(profile);
    }

    function test_RejectsWrongChainAndExtraIssuance() public {
        PayLinkProfileGuard.Profile memory profile = _profile();
        profile.chainId = 42220;
        vm.expectRevert(
            abi.encodeWithSelector(
                PayLinkProfileGuard.InvalidPayLinkProfile.selector, "pay-link-only profile must target Celo Sepolia"
            )
        );
        harness.validate(profile);

        profile = _profile();
        profile.initialPoolSeed = 1;
        vm.expectRevert(
            abi.encodeWithSelector(
                PayLinkProfileGuard.InvalidPayLinkProfile.selector,
                "pay-link issuance and disabled-path amounts changed"
            )
        );
        harness.validate(profile);
    }
}
