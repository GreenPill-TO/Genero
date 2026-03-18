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
    bool internal revertOnResolve;

    function setPreference(address user, uint256 charityId, address charityWallet, uint16 voluntaryFeeBps) external {
        preferences[user] =
            Preference({charityId: charityId, charityWallet: charityWallet, voluntaryFeeBps: voluntaryFeeBps});
    }

    function setRevertOnResolve(bool shouldRevert) external {
        revertOnResolve = shouldRevert;
    }

    function resolveFeePreferences(address user)
        external
        view
        returns (uint256 resolvedCharityId, address charityWallet, uint16 voluntaryFeeBps)
    {
        require(!revertOnResolve, "MOCK_RESOLUTION_FAILURE");
        Preference memory pref = preferences[user];
        return (pref.charityId, pref.charityWallet, pref.voluntaryFeeBps);
    }
}

contract GeneroTokenV3Test is Test {
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
    event CharityFeeRouted(
        address indexed payer, uint256 indexed charityId, address indexed charityWallet, uint256 amount
    );
    event MerchantTransferCharged(
        address indexed payer,
        address indexed merchant,
        address indexed charityWallet,
        bytes32 merchantId,
        uint256 displayedAmount,
        uint256 payerDebit,
        uint256 merchantCredit,
        uint256 charityCredit,
        uint16 baseFeeBps,
        uint16 voluntaryFeeBps
    );

    int128 private constant DECAY_LEVEL = 18446735446994636799;

    bytes32 private constant MERCHANT_ID = keccak256("merchant-one");
    bytes32 private constant POOL_ID = bytes32("pool-1");
    address private constant PAYER = address(0x1001);
    address private constant SPENDER = address(0x1002);
    address private constant MERCHANT = address(0x2001);
    address private constant CHARITY = address(0x3001);
    address private constant PLAIN_RECIPIENT = address(0x4001);

    GeneroTokenV3 private token;
    MockPoolRegistryForGeneroToken private poolRegistry;
    MockCharityPreferencesForGeneroToken private charityPreferences;

    function setUp() public {
        poolRegistry = new MockPoolRegistryForGeneroToken();
        charityPreferences = new MockCharityPreferencesForGeneroToken();

        poolRegistry.setMerchant(MERCHANT, MERCHANT_ID, true, true, true, true, POOL_ID);
        charityPreferences.setPreference(PAYER, 1, CHARITY, 500);

        token = _deployToken(6, true);
    }

    function test_OwnerMustBeExplicitWriterToMintAndBurn() public {
        GeneroTokenV3 localToken = _deployToken(6, false);

        assertFalse(localToken.isWriter(address(this)));

        vm.expectRevert(bytes("ERR_ACCESS"));
        localToken.mintTo(address(this), 10e6);

        localToken.addWriter(address(this));
        assertTrue(localToken.isWriter(address(this)));

        assertTrue(localToken.mintTo(address(this), 10e6));
        assertTrue(localToken.burn(5e6));

        localToken.deleteWriter(address(this));
        assertFalse(localToken.isWriter(address(this)));

        vm.expectRevert(bytes("ERR_ACCESS"));
        localToken.burn(1e6);
    }

    function test_PreviewTransferAndMerchantPreviewAgree() public view {
        (uint256 payerDebit, uint256 recipientCredit, uint256 charityCredit, bool feeApplies_) =
            token.previewTransfer(PAYER, MERCHANT, 100e6);

        (
            uint256 merchantPayerDebit,
            uint256 merchantCredit,
            uint256 merchantCharityCredit,
            uint256 resolvedCharityId,
            address charityWallet,
            uint16 baseFeeBps,
            uint16 voluntaryFeeBps,
            bool merchantFeeApplies
        ) = token.previewMerchantTransfer(PAYER, MERCHANT, 100e6);

        assertEq(payerDebit, merchantPayerDebit);
        assertEq(recipientCredit, merchantCredit);
        assertEq(charityCredit, merchantCharityCredit);
        assertEq(payerDebit, 105e6);
        assertEq(recipientCredit, 99e6);
        assertEq(charityCredit, 6e6);
        assertEq(resolvedCharityId, 1);
        assertEq(charityWallet, CHARITY);
        assertEq(baseFeeBps, 100);
        assertEq(voluntaryFeeBps, 500);
        assertTrue(feeApplies_);
        assertTrue(merchantFeeApplies);
    }

    function test_PreviewTransferForPlainRecipientHasNoFee() public view {
        (uint256 payerDebit, uint256 recipientCredit, uint256 charityCredit, bool feeApplies_) =
            token.previewTransfer(PAYER, PLAIN_RECIPIENT, 100e6);

        assertEq(payerDebit, 100e6);
        assertEq(recipientCredit, 100e6);
        assertEq(charityCredit, 0);
        assertFalse(feeApplies_);
    }

    function test_PreviewAllowanceRequiredMatchesMerchantTransferFromSpend() public {
        uint256 payerBaseBefore;
        uint256 payerBaseAfter;
        uint256 requiredVisible;
        uint256 requiredBase;

        charityPreferences.setPreference(PAYER, 1, CHARITY, 200);
        token.mintTo(PAYER, 200e6);

        (requiredVisible, requiredBase) = token.previewAllowanceRequired(PAYER, MERCHANT, 100e6);
        assertEq(requiredVisible, 102e6);

        vm.prank(PAYER);
        assertTrue(token.approve(SPENDER, requiredVisible));

        payerBaseBefore = token.baseBalanceOf(PAYER);

        vm.prank(SPENDER);
        assertTrue(token.transferFrom(PAYER, MERCHANT, 100e6));

        payerBaseAfter = token.baseBalanceOf(PAYER);

        assertEq(payerBaseBefore - payerBaseAfter, requiredBase);
        assertEq(token.allowance(PAYER, SPENDER), 0);
    }

    function test_AllowanceGetterAndAllowanceEventsUseVisibleUnits() public {
        vm.startPrank(PAYER);

        vm.expectEmit(true, true, false, true);
        emit Approval(PAYER, SPENDER, 50e6);
        assertTrue(token.approve(SPENDER, 50e6));
        assertEq(token.allowance(PAYER, SPENDER), 50e6);

        vm.expectEmit(true, true, false, true);
        emit Approval(PAYER, SPENDER, 75e6);
        assertTrue(token.increaseAllowance(SPENDER, 25e6));
        assertEq(token.allowance(PAYER, SPENDER), 75e6);

        vm.expectEmit(true, true, false, true);
        emit Approval(PAYER, SPENDER, 70e6);
        assertTrue(token.decreaseAllowance(SPENDER, 5e6));
        assertEq(token.allowance(PAYER, SPENDER), 70e6);

        vm.stopPrank();

        vm.warp(block.timestamp + 2 days);
        assertLt(token.allowance(PAYER, SPENDER), 70e6);
    }

    function test_TransferFromUsesFromAsPayerConsumesActualDebitAndEmitsEvents() public {
        charityPreferences.setPreference(PAYER, 1, CHARITY, 200);
        token.mintTo(PAYER, 200e6);

        vm.prank(PAYER);
        assertTrue(token.approve(SPENDER, 102e6));

        vm.expectEmit(true, true, false, true);
        emit Approval(PAYER, SPENDER, 0);
        vm.expectEmit(true, true, false, true);
        emit Transfer(PAYER, MERCHANT, 99e6);
        vm.expectEmit(true, true, false, true);
        emit Transfer(PAYER, CHARITY, 3e6);
        vm.expectEmit(true, true, true, true);
        emit CharityFeeRouted(PAYER, 1, CHARITY, 3e6);
        vm.expectEmit(true, true, true, true);
        emit MerchantTransferCharged(PAYER, MERCHANT, CHARITY, MERCHANT_ID, 100e6, 102e6, 99e6, 3e6, 100, 200);

        vm.prank(SPENDER);
        assertTrue(token.transferFrom(PAYER, MERCHANT, 100e6));

        assertEq(token.balanceOf(PAYER), 98e6);
        assertEq(token.balanceOf(MERCHANT), 99e6);
        assertEq(token.balanceOf(CHARITY), 3e6);
        assertEq(token.allowance(PAYER, SPENDER), 0);
    }

    function test_PlainTransferFromEmitsRemainingVisibleAllowance() public {
        token.mintTo(PAYER, 200e6);

        vm.prank(PAYER);
        assertTrue(token.approve(SPENDER, 100e6));

        vm.expectEmit(true, true, false, true);
        emit Approval(PAYER, SPENDER, 60e6);
        vm.expectEmit(true, true, false, true);
        emit Transfer(PAYER, PLAIN_RECIPIENT, 40e6);

        vm.prank(SPENDER);
        assertTrue(token.transferFrom(PAYER, PLAIN_RECIPIENT, 40e6));

        assertEq(token.allowance(PAYER, SPENDER), 60e6);
        assertEq(token.balanceOf(PLAIN_RECIPIENT), 40e6);
    }

    function test_FeeExemptBypassesMerchantFeeLogic() public {
        token.mintTo(PAYER, 150e6);
        token.setFeeExempt(PAYER, true);

        (uint256 payerDebit, uint256 recipientCredit, uint256 charityCredit, bool feeApplies_) =
            token.previewTransfer(PAYER, MERCHANT, 100e6);

        assertEq(payerDebit, 100e6);
        assertEq(recipientCredit, 100e6);
        assertEq(charityCredit, 0);
        assertFalse(feeApplies_);

        vm.prank(PAYER);
        assertTrue(token.transfer(MERCHANT, 100e6));

        assertEq(token.balanceOf(PAYER), 50e6);
        assertEq(token.balanceOf(MERCHANT), 100e6);
        assertEq(token.balanceOf(CHARITY), 0);
    }

    function test_MerchantOverrideLowersEffectiveBaseFeeAndExposesConfig() public {
        token.setMerchantFeeOverride(MERCHANT_ID, 25);
        charityPreferences.setPreference(PAYER, 1, CHARITY, 0);
        token.mintTo(PAYER, 500e6);

        assertEq(token.getEffectiveMerchantFeeBps(MERCHANT), 25);

        (bytes32 merchantId, bool hasOverride, uint16 effectiveFeeBps, uint16 overrideFeeBps, uint16 defaultFeeBps) =
            token.getMerchantFeeConfig(MERCHANT);

        assertEq(merchantId, MERCHANT_ID);
        assertTrue(hasOverride);
        assertEq(effectiveFeeBps, 25);
        assertEq(overrideFeeBps, 25);
        assertEq(defaultFeeBps, 100);

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

    function test_MerchantFeeConfigForNonMerchantReturnsDefaults() public view {
        (bytes32 merchantId, bool hasOverride, uint16 effectiveFeeBps, uint16 overrideFeeBps, uint16 defaultFeeBps) =
            token.getMerchantFeeConfig(PLAIN_RECIPIENT);

        assertEq(merchantId, bytes32(0));
        assertFalse(hasOverride);
        assertEq(effectiveFeeBps, 0);
        assertEq(overrideFeeBps, 0);
        assertEq(defaultFeeBps, 100);
    }

    function test_BurnUsesBaseDeltaAndZeroArgOverloadIsRemoved() public {
        uint256 baseBefore;
        uint256 baseAfter;
        uint256 delta;
        bool success;

        token.mintTo(address(this), 100e6);
        vm.warp(block.timestamp + 3 days);

        baseBefore = token.baseBalanceOf(address(this));
        delta = token.toBaseAmount(10e6);

        assertTrue(token.burn(10e6));

        baseAfter = token.baseBalanceOf(address(this));
        assertEq(baseBefore - baseAfter, delta);

        (success,) = address(token).call(abi.encodeWithSignature("burn()"));
        assertFalse(success);
    }

    function test_CanResolveCharityForReflectsWalletAndReverts() public {
        assertTrue(token.canResolveCharityFor(PAYER));

        charityPreferences.setPreference(PAYER, 1, address(0), 500);
        assertFalse(token.canResolveCharityFor(PAYER));

        charityPreferences.setPreference(PAYER, 1, CHARITY, 500);
        charityPreferences.setRevertOnResolve(true);
        assertFalse(token.canResolveCharityFor(PAYER));
    }

    function test_MerchantTransferRoundingBoundHoldsAcrossDecimalsAndDemurrage() public {
        _assertRoundingBound(_deployToken(6, true), 100e6, 0);
        _assertRoundingBound(_deployToken(6, true), 100e6, 3 days);
        _assertRoundingBound(_deployToken(18, true), 1e18, 0);
        _assertRoundingBound(_deployToken(18, true), 1e18, 3 days);
    }

    function _assertRoundingBound(GeneroTokenV3 localToken, uint256 displayedAmount, uint256 warpDelta) internal {
        uint256 payerBaseBefore;
        uint256 payerBaseAfter;
        uint256 recipientBase;
        uint256 charityBase;
        uint256 charityCredit;
        uint256 directCharityBase;

        localToken.mintTo(PAYER, displayedAmount * 2);

        if (warpDelta > 0) {
            vm.warp(block.timestamp + warpDelta);
        }

        (,, charityCredit,,,,,) = localToken.previewMerchantTransfer(PAYER, MERCHANT, displayedAmount);

        payerBaseBefore = localToken.baseBalanceOf(PAYER);

        vm.prank(PAYER);
        assertTrue(localToken.transfer(MERCHANT, displayedAmount));

        payerBaseAfter = localToken.baseBalanceOf(PAYER);
        recipientBase = localToken.baseBalanceOf(MERCHANT);
        charityBase = localToken.baseBalanceOf(CHARITY);
        directCharityBase = localToken.toBaseAmount(charityCredit);

        assertEq(payerBaseBefore - payerBaseAfter, recipientBase + charityBase);
        assertGe(charityBase, directCharityBase);
        assertLe(charityBase, directCharityBase + 1);
    }

    function _deployToken(uint8 tokenDecimals, bool grantWriter) internal returns (GeneroTokenV3 localToken) {
        localToken = new GeneroTokenV3(
            "Cross Pool Liquidity TCOIN",
            "cplTCOIN",
            tokenDecimals,
            DECAY_LEVEL,
            43_200,
            address(0xD00D),
            address(poolRegistry),
            address(charityPreferences),
            100
        );

        if (grantWriter) {
            localToken.addWriter(address(this));
        }
    }
}
