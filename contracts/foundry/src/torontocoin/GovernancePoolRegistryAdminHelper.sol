// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GovernanceProposalHelper} from "./GovernanceProposalHelper.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";

/// @notice Narrow governance fallback helper for PoolRegistry admin gaps.
/// @dev This executes through Governance.delegatecall so `msg.sender` at PoolRegistry is Governance itself.
contract GovernancePoolRegistryAdminHelper is GovernanceProposalHelper {
    function setPoolAddress(bytes32 poolId, address poolAddress) external {
        IPoolRegistry(poolRegistry).setPoolAddress(poolId, poolAddress);
    }
}
