// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/console2.sol";
import {TorontoCoinSixDecimalMigrationBase} from "./TorontoCoinSixDecimalMigrationBase.s.sol";

interface ITorontoCoinMigrationGovernanceProposer {
    function proposeTreasuryControllerSetTcoinToken(address tcoinToken_, uint64 votingWindow)
        external
        returns (uint256 proposalId);
    function proposeLiquidityRouterSetCplTcoin(address cplTcoin_, uint64 votingWindow)
        external
        returns (uint256 proposalId);
    function proposeLiquidityRouterSetPoolAdapter(address adapter_, uint64 votingWindow)
        external
        returns (uint256 proposalId);
    function voteProposal(uint256 proposalId, bool support) external;
}

contract ProposeTorontoCoinSixDecimalMigration is TorontoCoinSixDecimalMigrationBase {
    error MissingStagedContracts();
    error ProposalsAlreadyCreated();

    function run() external returns (MigrationArtifact memory artifact) {
        _assertCeloMainnet();
        artifact = _readArtifact();

        if (
            artifact.newMrTcoin == address(0) || artifact.newCplTcoin == address(0)
                || artifact.newManagedPoolAdapter == address(0) || artifact.newPoolAccount == address(0)
        ) {
            revert MissingStagedContracts();
        }
        if (
            artifact.treasuryControllerSetTcoinTokenProposalId != 0
                || artifact.liquidityRouterSetCplTcoinProposalId != 0
                || artifact.liquidityRouterSetPoolAdapterProposalId != 0
        ) {
            revert ProposalsAlreadyCreated();
        }

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        ITorontoCoinMigrationGovernanceProposer governance =
            ITorontoCoinMigrationGovernanceProposer(artifact.governance);

        vm.startBroadcast(privateKey);
        artifact.treasuryControllerSetTcoinTokenProposalId =
            governance.proposeTreasuryControllerSetTcoinToken(artifact.newMrTcoin, uint64(artifact.votingWindow));
        governance.voteProposal(artifact.treasuryControllerSetTcoinTokenProposalId, true);

        artifact.liquidityRouterSetCplTcoinProposalId =
            governance.proposeLiquidityRouterSetCplTcoin(artifact.newCplTcoin, uint64(artifact.votingWindow));
        governance.voteProposal(artifact.liquidityRouterSetCplTcoinProposalId, true);

        artifact.liquidityRouterSetPoolAdapterProposalId = governance.proposeLiquidityRouterSetPoolAdapter(
            artifact.newManagedPoolAdapter, uint64(artifact.votingWindow)
        );
        governance.voteProposal(artifact.liquidityRouterSetPoolAdapterProposalId, true);
        vm.stopBroadcast();

        artifact.proposedAt = block.timestamp;
        _writeArtifact(artifact);

        console2.log("Proposed and approved six-decimal migration");
        console2.log("TreasuryController.setTcoinToken proposal", artifact.treasuryControllerSetTcoinTokenProposalId);
        console2.log("LiquidityRouter.setCplTcoin proposal", artifact.liquidityRouterSetCplTcoinProposalId);
        console2.log("LiquidityRouter.setPoolAdapter proposal", artifact.liquidityRouterSetPoolAdapterProposalId);
    }
}
