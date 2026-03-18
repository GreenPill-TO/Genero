// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPoolRegistry {
    enum MerchantStatus {
        None,
        Approved,
        Suspended,
        Removed
    }

    struct MerchantEntity {
        bytes32 merchantId;
        bytes32 poolId;
        string metadataRecordId;
        MerchantStatus status;
        bool acceptsCplTcoin;
        bool posFeeEligible;
        uint64 createdAt;
        uint64 updatedAt;
    }

    function addPool(bytes32 poolId, string calldata name, string calldata metadataRecordId) external;
    function removePool(bytes32 poolId) external;
    function suspendPool(bytes32 poolId) external;
    function unsuspendPool(bytes32 poolId) external;

    function approveMerchant(
        bytes32 merchantId,
        bytes32 poolId,
        string calldata metadataRecordId,
        address[] calldata initialWallets
    ) external;

    function addMerchantWallet(bytes32 merchantId, address wallet) external;
    function removeMerchantWallet(bytes32 merchantId, address wallet) external;
    function setMerchantCplAcceptance(bytes32 merchantId, bool acceptsCplTcoin) external;
    function setMerchantPosFeeEligibility(bytes32 merchantId, bool posFeeEligible) external;
    function removeMerchant(bytes32 merchantId) external;
    function suspendMerchant(bytes32 merchantId) external;
    function unsuspendMerchant(bytes32 merchantId) external;
    function reassignMerchantPool(bytes32 merchantId, bytes32 newPoolId) external;

    function getMerchant(bytes32 merchantId) external view returns (MerchantEntity memory);
    function getMerchantIdByWallet(address wallet) external view returns (bytes32);
    function getMerchantWallets(bytes32 merchantId) external view returns (address[] memory);
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
        );

    function isMerchantWallet(address wallet) external view returns (bool);
    function isMerchantApprovedWallet(address wallet) external view returns (bool);
    function isMerchantPaymentTarget(address wallet) external view returns (bool);
    function isMerchantPosFeeTarget(address wallet) external view returns (bool);
    function acceptsCplTcoin(address wallet) external view returns (bool);

    function isMerchantApprovedInActivePool(address wallet) external view returns (bool);
    function getMerchantPool(address wallet) external view returns (bytes32);
}
