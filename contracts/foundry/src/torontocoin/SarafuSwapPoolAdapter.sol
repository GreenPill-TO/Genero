// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPoolRegistryForSarafuSwapPoolAdapter {
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
    function getMerchant(bytes32 merchantId) external view returns (MerchantEntity memory);
    function getPoolAddress(bytes32 poolId) external view returns (address poolAddress);
}

interface ISarafuSwapPool {
    function feePpm() external view returns (uint256);
    function withdraw(address tokenOut, address tokenIn, uint256 value) external;
}

contract SarafuSwapPoolAdapter is Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant FEE_DENOMINATOR = 1_000_000;

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressDependency();
    error ZeroAddressRecipient();
    error ZeroPoolId();
    error SameAddress();
    error Unauthorized();
    error UnknownPool(bytes32 poolId);
    error PoolNotActive(bytes32 poolId);
    error InvalidMinOut(uint256 actualOut, uint256 minOut);
    error InsufficientPoolLiquidity(bytes32 poolId, uint256 requested, uint256 available);
    error InvalidSwapQuote(bytes32 poolId);
    error SwapPoolCallFailed(bytes32 poolId, bytes data);

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolTokensUpdated(
        address indexed oldMrTcoin, address indexed newMrTcoin, address indexed oldCplTcoin, address newCplTcoin
    );

    address public governance;
    address public poolRegistry;
    address public mrTcoin;
    address public cplTcoin;

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

    function getPoolLiquidityState(bytes32 poolId)
        external
        view
        returns (uint256 mrTcoinLiquidity, uint256 cplTcoinLiquidity, bool active)
    {
        address poolAddress = _poolAddress(poolId);
        if (poolAddress == address(0)) {
            return (0, 0, false);
        }

        mrTcoinLiquidity = IERC20(mrTcoin).balanceOf(poolAddress);
        cplTcoinLiquidity = IERC20(cplTcoin).balanceOf(poolAddress);
        active = IPoolRegistryForSarafuSwapPoolAdapter(poolRegistry).isPoolActive(poolId);
    }

    function previewBuyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn) external view returns (uint256) {
        address poolAddress = _activePoolAddress(poolId);
        uint256 quotedOut = _quotedOutAfterFee(poolId, poolAddress, mrTcoinAmountIn);
        uint256 available = IERC20(cplTcoin).balanceOf(poolAddress);
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

        address poolAddress = _activePoolAddress(poolId);
        uint256 available = IERC20(cplTcoin).balanceOf(poolAddress);
        uint256 quotedOut = _quotedOutAfterFee(poolId, poolAddress, mrTcoinAmountIn);
        if (quotedOut > available) revert InsufficientPoolLiquidity(poolId, quotedOut, available);

        IERC20(mrTcoin).safeTransferFrom(msg.sender, address(this), mrTcoinAmountIn);
        _approveExact(mrTcoin, poolAddress, mrTcoinAmountIn);

        uint256 cplBefore = IERC20(cplTcoin).balanceOf(address(this));
        ISarafuSwapPool(poolAddress).withdraw(cplTcoin, mrTcoin, mrTcoinAmountIn);
        uint256 cplAfter = IERC20(cplTcoin).balanceOf(address(this));
        cplTcoinOut = cplAfter - cplBefore;

        if (cplTcoinOut < minCplTcoinOut) revert InvalidMinOut(cplTcoinOut, minCplTcoinOut);

        IERC20(cplTcoin).safeTransfer(recipient, cplTcoinOut);
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
        poolAccount = _poolAddress(poolId);
    }

    function _quotedOutAfterFee(bytes32 poolId, address poolAddress, uint256 mrTcoinAmountIn)
        internal
        view
        returns (uint256 quotedOut)
    {
        (bool ok, bytes memory data) = poolAddress.staticcall(
            abi.encodeWithSignature("getQuote(address,address,uint256)", cplTcoin, mrTcoin, mrTcoinAmountIn)
        );
        if (!ok) revert SwapPoolCallFailed(poolId, data);
        quotedOut = abi.decode(data, (uint256));

        uint256 feePpm = ISarafuSwapPool(poolAddress).feePpm();
        if (feePpm >= FEE_DENOMINATOR) revert InvalidSwapQuote(poolId);

        uint256 fee = (quotedOut * feePpm) / FEE_DENOMINATOR;
        quotedOut -= fee;
    }

    function _merchantMatchesPool(bytes32 poolId, bytes32 merchantId) internal view returns (bool) {
        if (merchantId == bytes32(0)) return false;

        try IPoolRegistryForSarafuSwapPoolAdapter(poolRegistry).getMerchant(merchantId) returns (
            IPoolRegistryForSarafuSwapPoolAdapter.MerchantEntity memory merchant
        ) {
            return merchant.status == 1 && merchant.poolId == poolId;
        } catch {
            return false;
        }
    }

    function _poolAddress(bytes32 poolId) internal view returns (address) {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        return IPoolRegistryForSarafuSwapPoolAdapter(poolRegistry).getPoolAddress(poolId);
    }

    function _activePoolAddress(bytes32 poolId) internal view returns (address poolAddress) {
        poolAddress = _poolAddress(poolId);
        if (poolAddress == address(0)) revert UnknownPool(poolId);
        if (!IPoolRegistryForSarafuSwapPoolAdapter(poolRegistry).isPoolActive(poolId)) revert PoolNotActive(poolId);
    }

    function _approveExact(address token, address spender, uint256 amount) internal {
        IERC20 erc20 = IERC20(token);
        erc20.safeApprove(spender, 0);
        erc20.safeApprove(spender, amount);
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
        address oldMr = mrTcoin;
        address oldCpl = cplTcoin;
        mrTcoin = mrTcoin_;
        cplTcoin = cplTcoin_;
        emit PoolTokensUpdated(oldMr, mrTcoin_, oldCpl, cplTcoin_);
    }
}
