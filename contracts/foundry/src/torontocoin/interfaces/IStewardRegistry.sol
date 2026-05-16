// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStewardRegistry {
    function isSteward(address steward) external view returns (bool);
    function getStewardWeight(address steward) external view returns (uint256);
    function getTotalActiveStewardWeight() external view returns (uint256);
    function listStewardAddresses() external view returns (address[] memory);

    function syncCharityAppointment(uint256 charityId, address oldSteward, address newSteward) external;
}
