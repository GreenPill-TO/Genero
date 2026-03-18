// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {
    GeneroTokenV3,
    IPoolRegistryForCplTCOIN,
    IUserCharityPreferencesRegistryForCplTCOIN
} from "../../../src/torontocoin/GeneroTokenV3.sol";

contract MockPoolRegistryForGeneroToken is IPoolRegistryForCplTCOIN {
    struct MerchantConfig {
        bool exists_;
        bytes32 merchantId_;
        bool approved_;
        bool poolActive_;
        bool acceptsCpl_;
        bool posFeeEligible_;
        bytes32 poolId_;
    }

    mapping(address => MerchantConfig) internal configs;

    function setMerchant(
        address wallet,
        bytes32 merchantId,
        bool approved,
        bool poolActive,
        bool acceptsCpl,
        bool posFeeEligible,
        bytes32 poolId
    ) external {
        configs[wallet] = MerchantConfig({
            exists_: true,
            merchantId_: merchantId,
            approved_: approved,
            poolActive_: poolActive,
            acceptsCpl_: acceptsCpl,
            posFeeEligible_: posFeeEligible,
            poolId_: poolId
        });
    }

    function isMerchantPosFeeTarget(address wallet) external view returns (bool) {
        MerchantConfig memory config = configs[wallet];
        return config.exists_ && config.approved_ && config.poolActive_ && config.acceptsCpl_ && config.posFeeEligible_;
    }

    function getMerchantPaymentConfig(address wallet)
        external
        view
        returns (
            bool exists_,
            bytes32 merchantId_,
            bool approved_,
            bool poolActive_,
            bool acceptsCpl_,
            bool posFeeEligible_,
            bytes32 poolId_
        )
    {
        MerchantConfig memory config = configs[wallet];
        return (
            config.exists_,
            config.merchantId_,
            config.approved_,
            config.poolActive_,
            config.acceptsCpl_,
            config.posFeeEligible_,
            config.poolId_
        );
    }
}

contract MockCharityPreferencesForGeneroToken is IUserCharityPreferencesRegistryForCplTCOIN {
    struct Preference {
        uint256 charityId;
        address charityWallet;
        uint16 voluntaryFeeBps;
    }

    mapping(address => Preference) internal preferences;

    function setPreference(address user, uint256 charityId, address charityWallet, uint16 voluntaryFeeBps) external {
        preferences[user] =
            Preference({charityId: charityId, charityWallet: charityWallet, voluntaryFeeBps: voluntaryFeeBps});
    }

    function resolveFeePreferences(address user)
        external
        view
        returns (uint256 resolvedCharityId, address charityWallet, uint16 voluntaryFeeBps)
    {
        Preference memory pref = preferences[user];
        return (pref.charityId, pref.charityWallet, pref.voluntaryFeeBps);
    }
}

contract GeneroTokenV3Test is Test {
    int128 private constant DECAY_LEVEL = 18446735446994636799;

    GeneroTokenV3 private token;
    MockPoolRegistryForGeneroToken private poolRegistry;
    MockCharityPreferencesForGeneroToken private charityPreferences;

    bytes32 private constant MERCHANT_ID = keccak256("merchant-one");
    bytes32 private constant POOL_ID = bytes32("pool-1");
    address private constant PAYER = address(0x1001);
    address private constant SPENDER = address(0x1002);
    address private constant MERCHANT = address(0x2001);
    address private constant CHARITY = address(0x3001);

    function setUp() public {
        poolRegistry = new MockPoolRegistryForGeneroToken();
        charityPreferences = new MockCharityPreferencesForGeneroToken();

        token = new GeneroTokenV3(
            "Cross Pool Liquidity TCOIN",
            "cplTCOIN",
            6,
            DECAY_LEVEL,
            43_200,
            address(0xD00D),
            address(poolRegistry),
            address(charityPreferences),
            100
        );

        poolRegistry.setMerchant(MERCHANT, MERCHANT_ID, true, true, true, true, POOL_ID);
        charityPreferences.setPreference(PAYER, 1, CHARITY, 500);
    }

    function test_PreviewAndTransferToMerchantChargeBaseAndVoluntaryFees() public {
        token.mintTo(PAYER, 200e6);

        (
            uint256 payerDebit,
            uint256 merchantCredit,
            uint256 charityCredit,
            uint256 resolvedCharityId,
            address charityWallet,
            uint16 baseFeeBps,
            uint16 voluntaryFeeBps,
            bool feeApplies_
        ) = token.previewMerchantTransfer(PAYER, MERCHANT, 100e6);

        assertEq(payerDebit, 105e6);
        assertEq(merchantCredit, 99e6);
        assertEq(charityCredit, 6e6);
        assertEq(resolvedCharityId, 1);
        assertEq(charityWallet, CHARITY);
        assertEq(baseFeeBps, 100);
        assertEq(voluntaryFeeBps, 500);
        assertTrue(feeApplies_);

        vm.prank(PAYER);
        assertTrue(token.transfer(MERCHANT, 100e6));

        assertEq(token.balanceOf(PAYER), 95e6);
        assertEq(token.balanceOf(MERCHANT), 99e6);
        assertEq(token.balanceOf(CHARITY), 6e6);
    }

    function test_TransferFromUsesFromAsPayerAndConsumesActualDebit() public {
        charityPreferences.setPreference(PAYER, 1, CHARITY, 200);
        token.mintTo(PAYER, 200e6);

        vm.prank(PAYER);
        assertTrue(token.approve(SPENDER, 102e6));

        vm.prank(SPENDER);
        assertTrue(token.transferFrom(PAYER, MERCHANT, 100e6));

        assertEq(token.balanceOf(PAYER), 98e6);
        assertEq(token.balanceOf(MERCHANT), 99e6);
        assertEq(token.balanceOf(CHARITY), 3e6);
        assertEq(token.allowance(PAYER, SPENDER), 0);
    }

    function test_TransferFromRevertsIfAllowanceOnlyCoversStickerPrice() public {
        charityPreferences.setPreference(PAYER, 1, CHARITY, 200);
        token.mintTo(PAYER, 200e6);

        vm.prank(PAYER);
        assertTrue(token.approve(SPENDER, 100e6));

        vm.prank(SPENDER);
        vm.expectRevert(bytes("ERR_SPENDER"));
        token.transferFrom(PAYER, MERCHANT, 100e6);
    }

    function test_FeeExemptBypassesMerchantFeeLogic() public {
        token.mintTo(PAYER, 150e6);
        token.setFeeExempt(PAYER, true);

        (uint256 payerDebit, uint256 merchantCredit, uint256 charityCredit,,,,, bool feeApplies_) =
            token.previewMerchantTransfer(PAYER, MERCHANT, 100e6);

        assertEq(payerDebit, 100e6);
        assertEq(merchantCredit, 100e6);
        assertEq(charityCredit, 0);
        assertFalse(feeApplies_);

        vm.prank(PAYER);
        assertTrue(token.transfer(MERCHANT, 100e6));

        assertEq(token.balanceOf(PAYER), 50e6);
        assertEq(token.balanceOf(MERCHANT), 100e6);
        assertEq(token.balanceOf(CHARITY), 0);
    }

    function test_MerchantOverrideLowersEffectiveBaseFee() public {
        token.setMerchantFeeOverride(MERCHANT_ID, 25);
        charityPreferences.setPreference(PAYER, 1, CHARITY, 0);
        token.mintTo(PAYER, 500e6);

        assertEq(token.getEffectiveMerchantFeeBps(MERCHANT), 25);

        (
            uint256 payerDebit,
            uint256 merchantCredit,
            uint256 charityCredit,,,
            uint16 baseFeeBps,
            uint16 voluntaryFeeBps,
            bool feeApplies_
        ) = token.previewMerchantTransfer(PAYER, MERCHANT, 400e6);

        assertEq(payerDebit, 400e6);
        assertEq(merchantCredit, 399e6);
        assertEq(charityCredit, 1e6);
        assertEq(baseFeeBps, 25);
        assertEq(voluntaryFeeBps, 0);
        assertTrue(feeApplies_);

        vm.prank(PAYER);
        assertTrue(token.transfer(MERCHANT, 400e6));

        assertEq(token.balanceOf(PAYER), 100e6);
        assertEq(token.balanceOf(MERCHANT), 399e6);
        assertEq(token.balanceOf(CHARITY), 1e6);
    }
}
