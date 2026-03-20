// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/console2.sol";
import {TorontoCoinSixDecimalMigrationBase} from "./TorontoCoinSixDecimalMigrationBase.s.sol";

interface ITorontoCoinMigrationGovernanceOwner {
    function cancelProposal(uint256 proposalId) external;
}

contract AbortTorontoCoinSixDecimalMigration is TorontoCoinSixDecimalMigrationBase {
    error MissingProposals();

    function run() external returns (MigrationArtifact memory artifact) {
        _assertCeloMainnet();
        artifact = _readArtifact();

        if (
            artifact.treasuryControllerSetTcoinTokenProposalId == 0
                || artifact.liquidityRouterSetCplTcoinProposalId == 0
                || artifact.liquidityRouterSetPoolAdapterProposalId == 0
        ) {
            revert MissingProposals();
        }

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        ITorontoCoinMigrationGovernanceOwner governance = ITorontoCoinMigrationGovernanceOwner(artifact.governance);

        vm.startBroadcast(privateKey);
        governance.cancelProposal(artifact.treasuryControllerSetTcoinTokenProposalId);
        governance.cancelProposal(artifact.liquidityRouterSetCplTcoinProposalId);
        governance.cancelProposal(artifact.liquidityRouterSetPoolAdapterProposalId);
        vm.stopBroadcast();

        artifact.cancelledAt = block.timestamp;
        _writeArtifact(artifact);

        console2.log("Cancelled six-decimal migration proposals");
        console2.log("cancelled proposal", artifact.treasuryControllerSetTcoinTokenProposalId);
        console2.log("cancelled proposal", artifact.liquidityRouterSetCplTcoinProposalId);
        console2.log("cancelled proposal", artifact.liquidityRouterSetPoolAdapterProposalId);
    }
}
