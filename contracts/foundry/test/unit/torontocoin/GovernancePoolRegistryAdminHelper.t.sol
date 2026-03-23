// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Governance} from "../../../src/torontocoin/Governance.sol";
import {GovernanceExecutionHelper} from "../../../src/torontocoin/GovernanceExecutionHelper.sol";
import {GovernancePoolRegistryAdminHelper} from "../../../src/torontocoin/GovernancePoolRegistryAdminHelper.sol";
import {GovernanceProposalHelper} from "../../../src/torontocoin/GovernanceProposalHelper.sol";
import {GovernanceRouterProposalHelper} from "../../../src/torontocoin/GovernanceRouterProposalHelper.sol";
import {PoolRegistry} from "../../../src/torontocoin/PoolRegistry.sol";

contract GovernancePoolRegistryAdminHelperTest is Test {
    bytes32 private constant POOL_ID = bytes32("external-pool");
    address private constant POOL_ADDRESS = address(0xA6f024Ad53766d332057d5e40215b695522ee3dE);

    Governance private governance;
    PoolRegistry private poolRegistry;
    GovernancePoolRegistryAdminHelper private adminHelper;
    GovernanceExecutionHelper private executionHelper;
    GovernanceProposalHelper private proposalHelper;
    GovernanceRouterProposalHelper private routerProposalHelper;

    function setUp() public {
        executionHelper = new GovernanceExecutionHelper();
        proposalHelper = new GovernanceProposalHelper();
        routerProposalHelper = new GovernanceRouterProposalHelper();
        adminHelper = new GovernancePoolRegistryAdminHelper();

        poolRegistry = new PoolRegistry(address(this), address(this));

        governance = new Governance(
            address(this),
            address(0x1001),
            address(0x1002),
            address(poolRegistry),
            address(0x1003),
            address(0x1004),
            address(0x1005),
            address(0x1006),
            address(executionHelper),
            address(proposalHelper),
            address(routerProposalHelper),
            1 days
        );

        poolRegistry.setGovernance(address(governance));
        poolRegistry.transferOwnership(address(governance));

        governance.setProposalHelper(address(adminHelper));
    }

    function test_GovernanceFallbackCanSetPoolAddressForExistingPool() public {
        vm.prank(address(governance));
        poolRegistry.addPool(POOL_ID, "External Pool", "");

        (bool ok,) =
            address(governance).call(abi.encodeWithSignature("setPoolAddress(bytes32,address)", POOL_ID, POOL_ADDRESS));

        assertTrue(ok);
        assertEq(poolRegistry.getPoolAddress(POOL_ID), POOL_ADDRESS);
        assertTrue(poolRegistry.isRegisteredPoolAddress(POOL_ADDRESS));
    }
}
