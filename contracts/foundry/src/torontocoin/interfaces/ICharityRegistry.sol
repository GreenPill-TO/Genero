// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICharityRegistry {
    function addCharity(string calldata name, address wallet, string calldata metadataRecordId)
        external
        returns (uint256 charityId);

    function removeCharity(uint256 charityId) external;
    function suspendCharity(uint256 charityId) external;
    function unsuspendCharity(uint256 charityId) external;
    function setDefaultCharity(uint256 charityId) external;

    function getDefaultCharityId() external view returns (uint256);
    function isActiveCharity(uint256 charityId) external view returns (bool);
    function getCharityWallet(uint256 charityId) external view returns (address);
}
