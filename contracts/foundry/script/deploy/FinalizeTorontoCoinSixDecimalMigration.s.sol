// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TorontoCoinSixDecimalMigrationBase} from "./TorontoCoinSixDecimalMigrationBase.s.sol";

contract FinalizeTorontoCoinSixDecimalMigration is TorontoCoinSixDecimalMigrationBase {
    function run() external pure returns (MigrationArtifact memory artifact) {
        artifact;
        _revertDeprecatedManagedPoolMigration();
    }
}
