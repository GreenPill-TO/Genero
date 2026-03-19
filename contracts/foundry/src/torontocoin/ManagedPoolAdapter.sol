// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPoolRegistryForManagedPoolAdapter {
    struct MerchantEntity {
        bytes32 merchantId;
        bytes32 poolId;
        string metadataRecordId;
        uint8 status;
        bool acceptsCplTcoin;
        bool posFeeEligible;
        uint64 createdAt;
        uint64 updatedAt;
    }

    function isPoolActive(bytes32 poolId) external view returns (bool);
    function listMerchantIds() external view returns (bytes32[] memory);
    function getMerchant(bytes32 merchantId) external view returns (MerchantEntity memory);
}

contract ManagedPoolInventory {
    using SafeERC20 for IERC20;

    error AdapterOnly(address caller);

    address private immutable ADAPTER;

    constructor(address adapter_) {
        ADAPTER = adapter_;
    }

    function transferToken(address token, address to, uint256 amount) external {
        if (msg.sender != ADAPTER) revert AdapterOnly(msg.sender);
        IERC20(token).safeTransfer(to, amount);
    }
}

contract ManagedPoolAdapter is Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct PoolConfig {
        address poolAccount;
        uint256 quoteBps;
        bool executionEnabled;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressDependency();
    error ZeroAddressRecipient();
    error ZeroPoolId();
    error InvalidQuoteBps(uint256 quoteBps);
    error SameAddress();
    error Unauthorized();
    error PoolAccountAlreadyExists(bytes32 poolId, address poolAccount);
    error UnknownPoolAccount(bytes32 poolId);
    error PoolNotActive(bytes32 poolId);
    error PoolExecutionDisabled(bytes32 poolId);
    error InvalidMinOut(uint256 actualOut, uint256 minOut);
    error InsufficientPoolLiquidity(bytes32 poolId, uint256 requested, uint256 available);

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolTokensUpdated(
        address indexed oldMrTcoin, address indexed newMrTcoin, address indexed oldCplTcoin, address newCplTcoin
    );
    event PoolAccountCreated(bytes32 indexed poolId, address indexed poolAccount, address indexed actor);
    event PoolAccountUpdated(bytes32 indexed poolId, address indexed oldPoolAccount, address indexed newPoolAccount);
    event PoolQuoteUpdated(bytes32 indexed poolId, uint256 oldQuoteBps, uint256 newQuoteBps);
    event PoolExecutionUpdated(bytes32 indexed poolId, bool enabled);

    address public governance;
    address public poolRegistry;
    address public mrTcoin;
    address public cplTcoin;

    mapping(bytes32 => PoolConfig) private _poolConfigs;
    mapping(address => bool) private _managedPoolAccounts;

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    constructor(address initialOwner, address governance_, address poolRegistry_, address mrTcoin_, address cplTcoin_) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);

        _setGovernance(governance_);
        _setPoolRegistry(poolRegistry_);
        _setPoolTokens(mrTcoin_, cplTcoin_);
    }

    function setGovernance(address governance_) external onlyOwner {
        _setGovernance(governance_);
    }

    function setPoolRegistry(address registry_) external onlyGovernanceOrOwner {
        _setPoolRegistry(registry_);
    }

    function setPoolTokens(address mrTcoin_, address cplTcoin_) external onlyGovernanceOrOwner {
        _setPoolTokens(mrTcoin_, cplTcoin_);
    }

    function createPoolAccount(bytes32 poolId) external onlyGovernanceOrOwner returns (address poolAccount) {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (_poolConfigs[poolId].poolAccount != address(0)) {
            revert PoolAccountAlreadyExists(poolId, _poolConfigs[poolId].poolAccount);
        }

        ManagedPoolInventory inventory = new ManagedPoolInventory(address(this));
        poolAccount = address(inventory);
        _managedPoolAccounts[poolAccount] = true;
        _poolConfigs[poolId].poolAccount = poolAccount;

        emit PoolAccountCreated(poolId, poolAccount, msg.sender);
    }

    function setPoolAccount(bytes32 poolId, address poolAccount) external onlyGovernanceOrOwner {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (poolAccount == address(0)) revert ZeroAddressDependency();

        PoolConfig storage config = _poolConfigs[poolId];
        address oldPoolAccount = config.poolAccount;
        config.poolAccount = poolAccount;

        emit PoolAccountUpdated(poolId, oldPoolAccount, poolAccount);
    }

    function setPoolQuoteBps(bytes32 poolId, uint256 quoteBps) external onlyGovernanceOrOwner {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (quoteBps == 0 || quoteBps > BPS_DENOMINATOR) revert InvalidQuoteBps(quoteBps);

        PoolConfig storage config = _poolConfigs[poolId];
        uint256 oldQuoteBps = config.quoteBps;
        config.quoteBps = quoteBps;

        emit PoolQuoteUpdated(poolId, oldQuoteBps, quoteBps);
    }

    function setPoolExecutionEnabled(bytes32 poolId, bool enabled) external onlyGovernanceOrOwner {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        _poolConfigs[poolId].executionEnabled = enabled;
        emit PoolExecutionUpdated(poolId, enabled);
    }

    function getPoolConfig(bytes32 poolId) external view returns (PoolConfig memory) {
        return _poolConfigs[poolId];
    }

    function getPoolLiquidityState(bytes32 poolId)
        external
        view
        returns (uint256 mrTcoinLiquidity, uint256 cplTcoinLiquidity, bool active)
    {
        PoolConfig storage config = _poolConfigs[poolId];
        address poolAccount = config.poolAccount;
        if (poolAccount == address(0)) {
            return (0, 0, false);
        }

        mrTcoinLiquidity = IERC20(mrTcoin).balanceOf(poolAccount);
        cplTcoinLiquidity = IERC20(cplTcoin).balanceOf(poolAccount);
        active = config.executionEnabled && IPoolRegistryForManagedPoolAdapter(poolRegistry).isPoolActive(poolId);
    }

    function previewBuyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn) external view returns (uint256) {
        PoolConfig storage config = _poolConfigs[poolId];
        address poolAccount = config.poolAccount;
        if (
            poolAccount == address(0) || !config.executionEnabled
                || !IPoolRegistryForManagedPoolAdapter(poolRegistry).isPoolActive(poolId)
        ) {
            return 0;
        }

        uint256 quotedOut = (mrTcoinAmountIn * config.quoteBps) / BPS_DENOMINATOR;
        uint256 available = IERC20(cplTcoin).balanceOf(poolAccount);
        if (quotedOut > available) {
            return available;
        }
        return quotedOut;
    }

    function buyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn, uint256 minCplTcoinOut, address recipient)
        external
        returns (uint256 cplTcoinOut)
    {
        if (recipient == address(0)) revert ZeroAddressRecipient();
        PoolConfig storage config = _poolConfigs[poolId];
        address poolAccount = config.poolAccount;
        if (poolAccount == address(0)) revert UnknownPoolAccount(poolId);
        if (!IPoolRegistryForManagedPoolAdapter(poolRegistry).isPoolActive(poolId)) revert PoolNotActive(poolId);
        if (!config.executionEnabled) revert PoolExecutionDisabled(poolId);

        cplTcoinOut = (mrTcoinAmountIn * config.quoteBps) / BPS_DENOMINATOR;
        uint256 available = IERC20(cplTcoin).balanceOf(poolAccount);
        if (cplTcoinOut > available) revert InsufficientPoolLiquidity(poolId, cplTcoinOut, available);
        if (cplTcoinOut < minCplTcoinOut) revert InvalidMinOut(cplTcoinOut, minCplTcoinOut);

        IERC20(mrTcoin).safeTransferFrom(msg.sender, poolAccount, mrTcoinAmountIn);

        if (_managedPoolAccounts[poolAccount]) {
            ManagedPoolInventory(poolAccount).transferToken(cplTcoin, recipient, cplTcoinOut);
        } else {
            IERC20(cplTcoin).safeTransferFrom(poolAccount, recipient, cplTcoinOut);
        }
    }

    function poolMatchesAnyMerchantIds(bytes32 poolId, bytes32[] memory merchantIds)
        external
        view
        returns (bool matches)
    {
        for (uint256 i = 0; i < merchantIds.length; ++i) {
            if (_merchantMatchesPool(poolId, merchantIds[i])) {
                return true;
            }
        }
        return false;
    }

    function getPoolAccount(bytes32 poolId) external view returns (address poolAccount) {
        poolAccount = _poolConfigs[poolId].poolAccount;
    }

    function _merchantMatchesPool(bytes32 poolId, bytes32 merchantId) internal view returns (bool) {
        if (merchantId == bytes32(0)) return false;

        try IPoolRegistryForManagedPoolAdapter(poolRegistry).getMerchant(merchantId) returns (
            IPoolRegistryForManagedPoolAdapter.MerchantEntity memory merchant
        ) {
            return merchant.status == 1 && merchant.poolId == poolId;
        } catch {
            return false;
        }
    }

    function _setGovernance(address governance_) internal {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();
        address oldGovernance = governance;
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }

    function _setPoolRegistry(address registry_) internal {
        if (registry_ == address(0)) revert ZeroAddressDependency();
        if (registry_ == poolRegistry) revert SameAddress();
        address oldRegistry = poolRegistry;
        poolRegistry = registry_;
        emit PoolRegistryUpdated(oldRegistry, registry_);
    }

    function _setPoolTokens(address mrTcoin_, address cplTcoin_) internal {
        if (mrTcoin_ == address(0) || cplTcoin_ == address(0)) revert ZeroAddressDependency();
        if (mrTcoin_ == mrTcoin && cplTcoin_ == cplTcoin) revert SameAddress();
        address oldMrTcoin = mrTcoin;
        address oldCplTcoin = cplTcoin;
        mrTcoin = mrTcoin_;
        cplTcoin = cplTcoin_;
        emit PoolTokensUpdated(oldMrTcoin, mrTcoin_, oldCplTcoin, cplTcoin_);
    }
}
