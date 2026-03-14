// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryController {
    function cadPeg18() external view returns (uint256);
    function setCadPeg(uint256 newCadPeg18) external;
    function setUserRedeemRate(uint256 newRateBps) external;
    function setMerchantRedeemRate(uint256 newRateBps) external;
    function setCharityMintRate(uint256 newRateBps) external;
}
