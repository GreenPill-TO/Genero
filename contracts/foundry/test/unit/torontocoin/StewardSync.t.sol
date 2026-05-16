// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CharityRegistry} from "../../../src/torontocoin/CharityRegistry.sol";
import {StewardRegistry} from "../../../src/torontocoin/StewardRegistry.sol";

contract StewardSyncTest is Test {
    CharityRegistry private charity;
    StewardRegistry private stewardRegistry;

    address private steward = address(0xBEEF);

    function setUp() public {
        charity = new CharityRegistry(address(this), address(this), address(this));

        stewardRegistry = new StewardRegistry();
        stewardRegistry.initialize(address(this), address(this), address(charity));

        charity.setStewardRegistry(address(stewardRegistry));

        stewardRegistry.registerSteward(steward, "Steward One", "meta-1");
        charity.addCharity("Charity One", address(0xCAFE), "charity-meta");
    }

    function test_AssignAndClearStewardSyncsWeights() public {
        charity.assignSteward(1, steward);

        assertEq(stewardRegistry.getStewardWeight(steward), 1);
        assertEq(stewardRegistry.getCharityAssignedSteward(1), steward);

        charity.clearSteward(1);

        assertEq(stewardRegistry.getStewardWeight(steward), 0);
        assertEq(stewardRegistry.getCharityAssignedSteward(1), address(0));
    }

    function test_RemoveCharityClearsStewardAssignment() public {
        charity.assignSteward(1, steward);
        assertEq(stewardRegistry.getStewardWeight(steward), 1);

        charity.removeCharity(1);

        assertEq(stewardRegistry.getStewardWeight(steward), 0);
        assertEq(stewardRegistry.getCharityAssignedSteward(1), address(0));
    }
}
