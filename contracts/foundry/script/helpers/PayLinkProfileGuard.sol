// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library PayLinkProfileGuard {
    error InvalidPayLinkProfile(string reason);

    struct Profile {
        string target;
        string purpose;
        uint256 chainId;
        bool requireExplicitAddresses;
        bool governanceOwnsTokens;
        bool mentoEnabled;
        bool executeBuy;
        uint8 mrTcoinDecimals;
        uint8 cplTcoinDecimals;
        string mrTcoinSymbol;
        string cplTcoinSymbol;
        uint256 mintAmount;
        uint256 paymentAmount;
        uint256 deployedReserveMintAmount;
        uint256 initialPoolSeed;
    }

    function validate(Profile memory profile) internal pure returns (bool payLinkOnly) {
        bool dedicatedTarget = keccak256(bytes(profile.target)) == keccak256("celo-sepolia-pay-link");
        payLinkOnly = keccak256(bytes(profile.purpose)) == keccak256("pay-link-only");
        if (dedicatedTarget != payLinkOnly) {
            revert InvalidPayLinkProfile("dedicated target and pay-link-only purpose must be selected together");
        }
        if (!payLinkOnly) return false;
        if (!dedicatedTarget || profile.chainId != 11142220) {
            revert InvalidPayLinkProfile("pay-link-only profile must target Celo Sepolia");
        }
        if (!profile.requireExplicitAddresses) {
            revert InvalidPayLinkProfile("explicit role addresses are required");
        }
        if (
            profile.governanceOwnsTokens || profile.mentoEnabled || profile.executeBuy
                || profile.deployedReserveMintAmount != 0 || profile.initialPoolSeed != 0
                || profile.mrTcoinDecimals != 6 || profile.cplTcoinDecimals != 6
                || keccak256(bytes(profile.mrTcoinSymbol)) != keccak256("mrTCOIN-cs")
                || keccak256(bytes(profile.cplTcoinSymbol)) != keccak256("cplTCOIN-cs")
                || profile.mintAmount != 500_000_000 || profile.paymentAmount != 100_000_000
        ) {
            revert InvalidPayLinkProfile("pay-link issuance and disabled-path amounts changed");
        }
    }
}
