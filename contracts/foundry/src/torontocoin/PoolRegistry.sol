// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract PoolRegistry is Ownable, Pausable {
    enum PoolStatus {
        None,
        Active,
        Suspended,
        Removed
    }

    enum MerchantStatus {
        None,
        Approved,
        Suspended,
        Removed
    }

    struct Pool {
        bytes32 poolId;
        string name;
        string metadataRecordId;
        PoolStatus status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct Merchant {
        address wallet;
        bytes32 poolId;
        string metadataRecordId;
        MerchantStatus status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressMerchant();
    error ZeroPoolId();
    error EmptyName();
    error UnknownPool(bytes32 poolId);
    error UnknownMerchant(address merchant);
    error PoolAlreadyExists(bytes32 poolId);
    error MerchantAlreadyExists(address merchant);
    error InvalidPoolStatus(bytes32 poolId);
    error InvalidMerchantStatus(address merchant);
    error MerchantPoolInactive(bytes32 poolId);
    error Unauthorized();
    error SameAddress();

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);

    event PoolAdded(
        bytes32 indexed poolId,
        string name,
        string metadataRecordId,
        address indexed actor
    );

    event PoolRemoved(bytes32 indexed poolId, address indexed actor);
    event PoolSuspended(bytes32 indexed poolId, address indexed actor);
    event PoolUnsuspended(bytes32 indexed poolId, address indexed actor);

    event MerchantApproved(
        address indexed merchant,
        bytes32 indexed poolId,
        string metadataRecordId,
        address indexed actor
    );

    event MerchantRemoved(address indexed merchant, bytes32 indexed poolId, address indexed actor);
    event MerchantSuspended(address indexed merchant, bytes32 indexed poolId, address indexed actor);
    event MerchantUnsuspended(address indexed merchant, bytes32 indexed poolId, address indexed actor);

    event MerchantPoolReassigned(
        address indexed merchant,
        bytes32 indexed oldPoolId,
        bytes32 indexed newPoolId,
        address actor
    );

    address public governance;

    mapping(bytes32 => Pool) private pools;
    bytes32[] private poolIds;
    mapping(bytes32 => bool) private poolExists;

    mapping(address => Merchant) private merchants;
    address[] private merchantAddresses;
    mapping(address => bool) private merchantExists;

    constructor(address initialOwner, address governance_) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
        _setGovernance(governance_);
    }

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    function setGovernance(address governance_) external onlyOwner {
        _setGovernance(governance_);
    }

    function addPool(
        bytes32 poolId,
        string calldata name,
        string calldata metadataRecordId
    ) external onlyGovernanceOrOwner whenNotPaused {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (bytes(name).length == 0) revert EmptyName();
        if (poolExists[poolId]) revert PoolAlreadyExists(poolId);

        poolExists[poolId] = true;
        poolIds.push(poolId);

        pools[poolId] = Pool({
            poolId: poolId,
            name: name,
            metadataRecordId: metadataRecordId,
            status: PoolStatus.Active,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        emit PoolAdded(poolId, name, metadataRecordId, msg.sender);
    }

    function removePool(bytes32 poolId) external onlyGovernanceOrOwner {
        Pool storage pool = _getPoolStorage(poolId);
        if (pool.status == PoolStatus.Removed) revert InvalidPoolStatus(poolId);

        pool.status = PoolStatus.Removed;
        pool.updatedAt = uint64(block.timestamp);

        emit PoolRemoved(poolId, msg.sender);
    }

    function suspendPool(bytes32 poolId) external onlyGovernanceOrOwner {
        Pool storage pool = _getPoolStorage(poolId);
        if (pool.status != PoolStatus.Active) revert InvalidPoolStatus(poolId);

        pool.status = PoolStatus.Suspended;
        pool.updatedAt = uint64(block.timestamp);

        emit PoolSuspended(poolId, msg.sender);
    }

    function unsuspendPool(bytes32 poolId) external onlyGovernanceOrOwner whenNotPaused {
        Pool storage pool = _getPoolStorage(poolId);
        if (pool.status != PoolStatus.Suspended) revert InvalidPoolStatus(poolId);

        pool.status = PoolStatus.Active;
        pool.updatedAt = uint64(block.timestamp);

        emit PoolUnsuspended(poolId, msg.sender);
    }

    function approveMerchant(
        address merchant,
        bytes32 poolId,
        string calldata metadataRecordId
    ) external onlyGovernanceOrOwner whenNotPaused {
        if (merchant == address(0)) revert ZeroAddressMerchant();
        if (merchantExists[merchant]) revert MerchantAlreadyExists(merchant);
        if (!_isPoolActive(poolId)) revert MerchantPoolInactive(poolId);

        merchantExists[merchant] = true;
        merchantAddresses.push(merchant);

        merchants[merchant] = Merchant({
            wallet: merchant,
            poolId: poolId,
            metadataRecordId: metadataRecordId,
            status: MerchantStatus.Approved,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        emit MerchantApproved(merchant, poolId, metadataRecordId, msg.sender);
    }

    function removeMerchant(address merchant) external onlyGovernanceOrOwner {
        Merchant storage merchantRecord = _getMerchantStorage(merchant);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchant);

        merchantRecord.status = MerchantStatus.Removed;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantRemoved(merchant, merchantRecord.poolId, msg.sender);
    }

    function suspendMerchant(address merchant) external onlyGovernanceOrOwner {
        Merchant storage merchantRecord = _getMerchantStorage(merchant);
        if (merchantRecord.status != MerchantStatus.Approved) revert InvalidMerchantStatus(merchant);

        merchantRecord.status = MerchantStatus.Suspended;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantSuspended(merchant, merchantRecord.poolId, msg.sender);
    }

    function unsuspendMerchant(address merchant) external onlyGovernanceOrOwner whenNotPaused {
        Merchant storage merchantRecord = _getMerchantStorage(merchant);
        if (merchantRecord.status != MerchantStatus.Suspended) revert InvalidMerchantStatus(merchant);

        merchantRecord.status = MerchantStatus.Approved;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantUnsuspended(merchant, merchantRecord.poolId, msg.sender);
    }

    function reassignMerchantPool(address merchant, bytes32 newPoolId) external onlyGovernanceOrOwner whenNotPaused {
        Merchant storage merchantRecord = _getMerchantStorage(merchant);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchant);
        if (!_isPoolActive(newPoolId)) revert MerchantPoolInactive(newPoolId);

        bytes32 oldPoolId = merchantRecord.poolId;
        merchantRecord.poolId = newPoolId;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantPoolReassigned(merchant, oldPoolId, newPoolId, msg.sender);
    }

    function pause() external onlyGovernanceOrOwner {
        _pause();
    }

    function unpause() external onlyGovernanceOrOwner {
        _unpause();
    }

    function getPool(bytes32 poolId) external view returns (Pool memory) {
        return _getPoolStorage(poolId);
    }

    function getMerchant(address merchant) external view returns (Merchant memory) {
        return _getMerchantStorage(merchant);
    }

    function isPoolActive(bytes32 poolId) external view returns (bool) {
        return _isPoolActive(poolId);
    }

    function isMerchantApproved(address merchant) external view returns (bool) {
        if (!merchantExists[merchant]) return false;
        return merchants[merchant].status == MerchantStatus.Approved;
    }

    function isMerchantApprovedInActivePool(address merchant) external view returns (bool) {
        if (!merchantExists[merchant]) return false;

        Merchant storage merchantRecord = merchants[merchant];
        if (merchantRecord.status != MerchantStatus.Approved) return false;

        return _isPoolActive(merchantRecord.poolId);
    }

    function getMerchantPool(address merchant) external view returns (bytes32) {
        return _getMerchantStorage(merchant).poolId;
    }

    function listPoolIds() external view returns (bytes32[] memory) {
        return poolIds;
    }

    function getPoolCount() external view returns (uint256) {
        return poolIds.length;
    }

    function listMerchantAddresses() external view returns (address[] memory) {
        return merchantAddresses;
    }

    function getMerchantCount() external view returns (uint256) {
        return merchantAddresses.length;
    }

    function _getPoolStorage(bytes32 poolId) internal view returns (Pool storage pool) {
        if (!poolExists[poolId]) revert UnknownPool(poolId);
        pool = pools[poolId];
    }

    function _getMerchantStorage(address merchant) internal view returns (Merchant storage merchantRecord) {
        if (!merchantExists[merchant]) revert UnknownMerchant(merchant);
        merchantRecord = merchants[merchant];
    }

    function _isPoolActive(bytes32 poolId) internal view returns (bool) {
        if (!poolExists[poolId]) return false;
        return pools[poolId].status == PoolStatus.Active;
    }

    function _setGovernance(address governance_) internal {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();

        address oldGovernance = governance;
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }
}
