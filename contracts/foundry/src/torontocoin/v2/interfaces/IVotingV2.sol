// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVotingV2 {
    function getPegValue() external view returns (uint256);
    function getRedemptionRateUserTTC() external view returns (uint256);
    function getRedemptionRateStoreTTC() external view returns (uint256);
    function getRedemptionRateUserCAD() external view returns (uint256);
    function getRedemptionRateStoreCAD() external view returns (uint256);
    function getMinimumReserveRatio() external view returns (uint256);
    function getMaximumReserveRatio() external view returns (uint256);
    function getDemurrageRate() external view returns (uint256);
    function getReserveRatio() external view returns (uint256);
}
