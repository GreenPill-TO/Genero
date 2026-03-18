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

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressWallet();
    error ZeroMerchantId();
    error ZeroPoolId();
    error EmptyName();
    error UnknownPool(bytes32 poolId);
    error UnknownMerchant(bytes32 merchantId);
    error PoolAlreadyExists(bytes32 poolId);
    error MerchantAlreadyExists(bytes32 merchantId);
    error InvalidPoolStatus(bytes32 poolId);
    error InvalidMerchantStatus(bytes32 merchantId);
    error MerchantPoolInactive(bytes32 poolId);
    error WalletAlreadyLinked(address wallet, bytes32 merchantId);
    error WalletNotLinked(bytes32 merchantId, address wallet);
    error Unauthorized();
    error SameAddress();

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);

    event PoolAdded(bytes32 indexed poolId, string name, string metadataRecordId, address indexed actor);

    event PoolRemoved(bytes32 indexed poolId, address indexed actor);
    event PoolSuspended(bytes32 indexed poolId, address indexed actor);
    event PoolUnsuspended(bytes32 indexed poolId, address indexed actor);

    event MerchantApproved(
        bytes32 indexed merchantId, bytes32 indexed poolId, string metadataRecordId, address indexed actor
    );

    event MerchantRemoved(bytes32 indexed merchantId, bytes32 indexed poolId, address indexed actor);
    event MerchantSuspended(bytes32 indexed merchantId, bytes32 indexed poolId, address indexed actor);
    event MerchantUnsuspended(bytes32 indexed merchantId, bytes32 indexed poolId, address indexed actor);

    event MerchantPoolReassigned(
        bytes32 indexed merchantId, bytes32 indexed oldPoolId, bytes32 indexed newPoolId, address actor
    );

    event MerchantWalletAdded(bytes32 indexed merchantId, address indexed wallet, address indexed actor);
    event MerchantWalletRemoved(bytes32 indexed merchantId, address indexed wallet, address indexed actor);
    event MerchantCplAcceptanceUpdated(bytes32 indexed merchantId, bool acceptsCplTcoin, address indexed actor);
    event MerchantPosFeeEligibilityUpdated(bytes32 indexed merchantId, bool posFeeEligible, address indexed actor);

    address public governance;

    mapping(bytes32 => Pool) private pools;
    bytes32[] private poolIds;
    mapping(bytes32 => bool) private poolExists;

    mapping(bytes32 => MerchantEntity) private merchants;
    mapping(bytes32 => bool) private merchantExists;
    bytes32[] private merchantIds;

    mapping(address => bytes32) private merchantIdByWallet;
    mapping(bytes32 => address[]) private merchantWallets;
    mapping(bytes32 => mapping(address => bool)) private walletLinkedToMerchant;
    mapping(bytes32 => mapping(address => uint256)) private merchantWalletIndex;

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

    function addPool(bytes32 poolId, string calldata name, string calldata metadataRecordId)
        external
        onlyGovernanceOrOwner
        whenNotPaused
    {
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
        bytes32 merchantId,
        bytes32 poolId,
        string calldata metadataRecordId,
        address[] calldata initialWallets
    ) external onlyGovernanceOrOwner whenNotPaused {
        if (merchantId == bytes32(0)) revert ZeroMerchantId();
        if (merchantExists[merchantId]) revert MerchantAlreadyExists(merchantId);
        if (!_isPoolActive(poolId)) revert MerchantPoolInactive(poolId);

        uint64 timestamp = uint64(block.timestamp);
        merchantExists[merchantId] = true;
        merchantIds.push(merchantId);

        merchants[merchantId] = MerchantEntity({
            merchantId: merchantId,
            poolId: poolId,
            metadataRecordId: metadataRecordId,
            status: MerchantStatus.Approved,
            acceptsCplTcoin: true,
            posFeeEligible: true,
            createdAt: timestamp,
            updatedAt: timestamp
        });

        emit MerchantApproved(merchantId, poolId, metadataRecordId, msg.sender);

        for (uint256 i = 0; i < initialWallets.length; ++i) {
            _linkWallet(merchantId, initialWallets[i]);
        }
    }

    function addMerchantWallet(bytes32 merchantId, address wallet) external onlyGovernanceOrOwner whenNotPaused {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);

        _linkWallet(merchantId, wallet);
        merchantRecord.updatedAt = uint64(block.timestamp);
    }

    function removeMerchantWallet(bytes32 merchantId, address wallet) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);

        _unlinkWallet(merchantId, wallet);
        merchantRecord.updatedAt = uint64(block.timestamp);
    }

    function setMerchantCplAcceptance(bytes32 merchantId, bool acceptsCplTcoin_) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);

        merchantRecord.acceptsCplTcoin = acceptsCplTcoin_;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantCplAcceptanceUpdated(merchantId, acceptsCplTcoin_, msg.sender);
    }

    function setMerchantPosFeeEligibility(bytes32 merchantId, bool posFeeEligible_) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);

        merchantRecord.posFeeEligible = posFeeEligible_;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantPosFeeEligibilityUpdated(merchantId, posFeeEligible_, msg.sender);
    }

    function removeMerchant(bytes32 merchantId) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);

        merchantRecord.status = MerchantStatus.Removed;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantRemoved(merchantId, merchantRecord.poolId, msg.sender);
    }

    function suspendMerchant(bytes32 merchantId) external onlyGovernanceOrOwner {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status != MerchantStatus.Approved) revert InvalidMerchantStatus(merchantId);

        merchantRecord.status = MerchantStatus.Suspended;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantSuspended(merchantId, merchantRecord.poolId, msg.sender);
    }

    function unsuspendMerchant(bytes32 merchantId) external onlyGovernanceOrOwner whenNotPaused {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status != MerchantStatus.Suspended) revert InvalidMerchantStatus(merchantId);

        merchantRecord.status = MerchantStatus.Approved;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantUnsuspended(merchantId, merchantRecord.poolId, msg.sender);
    }

    function reassignMerchantPool(bytes32 merchantId, bytes32 newPoolId) external onlyGovernanceOrOwner whenNotPaused {
        MerchantEntity storage merchantRecord = _getMerchantStorage(merchantId);
        if (merchantRecord.status == MerchantStatus.Removed) revert InvalidMerchantStatus(merchantId);
        if (!_isPoolActive(newPoolId)) revert MerchantPoolInactive(newPoolId);

        bytes32 oldPoolId = merchantRecord.poolId;
        merchantRecord.poolId = newPoolId;
        merchantRecord.updatedAt = uint64(block.timestamp);

        emit MerchantPoolReassigned(merchantId, oldPoolId, newPoolId, msg.sender);
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

    function getMerchant(bytes32 merchantId) external view returns (MerchantEntity memory) {
        return _getMerchantStorage(merchantId);
    }

    function getMerchantIdByWallet(address wallet) external view returns (bytes32) {
        return merchantIdByWallet[wallet];
    }

    function getMerchantWallets(bytes32 merchantId) external view returns (address[] memory) {
        _getMerchantStorage(merchantId);
        return merchantWallets[merchantId];
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
        merchantId_ = merchantIdByWallet[wallet];
        if (merchantId_ == bytes32(0)) {
            return (false, bytes32(0), false, false, false, false, bytes32(0));
        }

        MerchantEntity storage merchantRecord = merchants[merchantId_];
        approved_ = merchantRecord.status == MerchantStatus.Approved;
        poolActive_ = _isPoolActive(merchantRecord.poolId);
        acceptsCpl_ = merchantRecord.acceptsCplTcoin;
        posFeeEligible_ = merchantRecord.posFeeEligible;
        poolId_ = merchantRecord.poolId;

        return (true, merchantId_, approved_, poolActive_, acceptsCpl_, posFeeEligible_, poolId_);
    }

    function isPoolActive(bytes32 poolId) external view returns (bool) {
        return _isPoolActive(poolId);
    }

    function isMerchantWallet(address wallet) external view returns (bool) {
        return merchantIdByWallet[wallet] != bytes32(0);
    }

    function isMerchantApproved(address wallet) external view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        return merchants[merchantId].status == MerchantStatus.Approved;
    }

    function isMerchantApprovedWallet(address wallet) external view returns (bool) {
        return _isMerchantApprovedWallet(wallet);
    }

    function isMerchantApprovedInActivePool(address wallet) external view returns (bool) {
        return _isMerchantApprovedWallet(wallet);
    }

    function isMerchantPaymentTarget(address wallet) external view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        MerchantEntity storage merchantRecord = merchants[merchantId];
        if (!_isMerchantApprovedWallet(wallet)) return false;

        return merchantRecord.acceptsCplTcoin;
    }

    function isMerchantPosFeeTarget(address wallet) external view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        MerchantEntity storage merchantRecord = merchants[merchantId];
        if (!_isMerchantApprovedWallet(wallet)) return false;

        return merchantRecord.acceptsCplTcoin && merchantRecord.posFeeEligible;
    }

    function acceptsCplTcoin(address wallet) external view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        return merchants[merchantId].acceptsCplTcoin;
    }

    function getMerchantPool(address wallet) external view returns (bytes32) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return bytes32(0);

        return merchants[merchantId].poolId;
    }

    function listPoolIds() external view returns (bytes32[] memory) {
        return poolIds;
    }

    function getPoolCount() external view returns (uint256) {
        return poolIds.length;
    }

    function listMerchantIds() external view returns (bytes32[] memory) {
        return merchantIds;
    }

    function getMerchantCount() external view returns (uint256) {
        return merchantIds.length;
    }

    function _getPoolStorage(bytes32 poolId) internal view returns (Pool storage pool) {
        if (!poolExists[poolId]) revert UnknownPool(poolId);
        pool = pools[poolId];
    }

    function _getMerchantStorage(bytes32 merchantId) internal view returns (MerchantEntity storage merchantRecord) {
        if (!merchantExists[merchantId]) revert UnknownMerchant(merchantId);
        merchantRecord = merchants[merchantId];
    }

    function _isMerchantApprovedWallet(address wallet) internal view returns (bool) {
        bytes32 merchantId = merchantIdByWallet[wallet];
        if (merchantId == bytes32(0)) return false;

        MerchantEntity storage merchantRecord = merchants[merchantId];
        if (merchantRecord.status != MerchantStatus.Approved) return false;

        return _isPoolActive(merchantRecord.poolId);
    }

    function _isPoolActive(bytes32 poolId) internal view returns (bool) {
        if (!poolExists[poolId]) return false;
        return pools[poolId].status == PoolStatus.Active;
    }

    function _linkWallet(bytes32 merchantId, address wallet) internal {
        if (wallet == address(0)) revert ZeroAddressWallet();

        bytes32 existingMerchantId = merchantIdByWallet[wallet];
        if (existingMerchantId != bytes32(0)) revert WalletAlreadyLinked(wallet, existingMerchantId);

        merchantIdByWallet[wallet] = merchantId;
        walletLinkedToMerchant[merchantId][wallet] = true;
        merchantWallets[merchantId].push(wallet);
        merchantWalletIndex[merchantId][wallet] = merchantWallets[merchantId].length;

        emit MerchantWalletAdded(merchantId, wallet, msg.sender);
    }

    function _unlinkWallet(bytes32 merchantId, address wallet) internal {
        if (!walletLinkedToMerchant[merchantId][wallet]) revert WalletNotLinked(merchantId, wallet);

        uint256 indexPlusOne = merchantWalletIndex[merchantId][wallet];
        uint256 walletIndex = indexPlusOne - 1;
        uint256 lastIndex = merchantWallets[merchantId].length - 1;

        if (walletIndex != lastIndex) {
            address movedWallet = merchantWallets[merchantId][lastIndex];
            merchantWallets[merchantId][walletIndex] = movedWallet;
            merchantWalletIndex[merchantId][movedWallet] = walletIndex + 1;
        }

        merchantWallets[merchantId].pop();
        delete merchantWalletIndex[merchantId][wallet];
        delete walletLinkedToMerchant[merchantId][wallet];
        delete merchantIdByWallet[wallet];

        emit MerchantWalletRemoved(merchantId, wallet, msg.sender);
    }

    function _setGovernance(address governance_) internal {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();

        address oldGovernance = governance;
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }
}
