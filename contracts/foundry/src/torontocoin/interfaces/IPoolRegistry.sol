// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPoolRegistry {
    function addPool(bytes32 poolId, string calldata name, string calldata metadataRecordId) external;
    function removePool(bytes32 poolId) external;
    function suspendPool(bytes32 poolId) external;
    function unsuspendPool(bytes32 poolId) external;

    function approveMerchant(address merchant, bytes32 poolId, string calldata metadataRecordId) external;
    function removeMerchant(address merchant) external;
    function suspendMerchant(address merchant) external;
    function unsuspendMerchant(address merchant) external;
    function reassignMerchantPool(address merchant, bytes32 newPoolId) external;

    function isMerchantApprovedInActivePool(address merchant) external view returns (bool);
    function getMerchantPool(address merchant) external view returns (bytes32);
}
