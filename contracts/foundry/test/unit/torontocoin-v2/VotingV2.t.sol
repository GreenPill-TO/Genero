// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../../src/torontocoin/TCOIN.sol";
import "../../../src/torontocoin/TTCCOIN.sol";
import "../../../src/torontocoin/CADCOIN.sol";
import "../../../src/torontocoin/v2/OrchestratorV2.sol";
import "../../../src/torontocoin/v2/VotingV2.sol";

contract VotingV2Test is Test {
    TCOIN private tcoin;
    TTC private ttc;
    CAD private cad;
    OrchestratorV2 private orchestrator;
    VotingV2 private voting;

    address private charity = makeAddr("charity");
    address private steward1 = makeAddr("steward1");
    address private steward2 = makeAddr("steward2");
    address private steward3 = makeAddr("steward3");
    address private outsider = makeAddr("outsider");

    function setUp() public {
        tcoin = new TCOIN();
        tcoin.initialize();

        ttc = new TTC();
        cad = new CAD();

        orchestrator = new OrchestratorV2();
        orchestrator.initialize(address(tcoin), address(ttc), address(cad), makeAddr("defaultCharity"), makeAddr("reserve"), address(0));

        tcoin.setOrchestrator(address(orchestrator));

        voting = new VotingV2();
        voting.initialize(address(orchestrator), keccak256(bytes("tcoin")));

        orchestrator.setVotingAddress(address(voting));

        orchestrator.addCharity(1, "Initial Charity", charity);

        vm.prank(charity);
        orchestrator.nominateSteward(1, "Steward One", steward1);
        vm.prank(charity);
        orchestrator.nominateSteward(2, "Steward Two", steward2);
        vm.prank(charity);
        orchestrator.nominateSteward(3, "Steward Three", steward3);
    }

    function test_charityProposalLifecycle() public {
        vm.prank(steward1);
        uint256 proposalId = voting.proposeCharity(
            7,
            "Shelter Project",
            makeAddr("shelterWallet"),
            "meta-charity-7",
            1 days
        );

        vm.prank(steward1);
        voting.voteProposal(proposalId, true);

        VotingV2.Proposal memory afterFirstVote = voting.getProposal(proposalId);
        assertEq(uint256(afterFirstVote.status), uint256(VotingV2.ProposalStatus.Pending));
        assertEq(afterFirstVote.yesVotes, 1);

        vm.prank(steward2);
        voting.voteProposal(proposalId, true);

        VotingV2.Proposal memory approved = voting.getProposal(proposalId);
        assertEq(uint256(approved.status), uint256(VotingV2.ProposalStatus.Approved));

        voting.executeProposal(proposalId);

        VotingV2.Proposal memory executed = voting.getProposal(proposalId);
        assertEq(uint256(executed.status), uint256(VotingV2.ProposalStatus.Executed));
        assertTrue(orchestrator.isCharityAddress(makeAddr("shelterWallet")));
        assertEq(orchestrator.charityNames(7), "Shelter Project");
    }

    function test_reserveProposalLifecycle() public {
        vm.prank(steward1);
        uint256 proposalId = voting.proposeReserveCurrency(
            bytes32("USDC"),
            makeAddr("usdcToken"),
            6,
            "meta-reserve-usdc",
            1 days
        );

        vm.prank(steward1);
        voting.voteProposal(proposalId, true);
        vm.prank(steward2);
        voting.voteProposal(proposalId, true);

        voting.executeProposal(proposalId);

        OrchestratorV2.ReserveCurrency memory reserve = orchestrator.getReserveCurrency(bytes32("USDC"));
        assertEq(reserve.code, bytes32("USDC"));
        assertEq(reserve.token, makeAddr("usdcToken"));
        assertEq(reserve.decimals, 6);
        assertTrue(reserve.enabled);
    }

    function test_quorumRequiresMajorityCeilHalf() public {
        vm.prank(steward1);
        uint256 proposalId = voting.proposeCharity(8, "Charity Q", makeAddr("qWallet"), "meta-charity-q", 1 days);

        vm.prank(steward1);
        voting.voteProposal(proposalId, true);

        VotingV2.Proposal memory proposal = voting.getProposal(proposalId);
        assertEq(uint256(proposal.status), uint256(VotingV2.ProposalStatus.Pending));

        vm.expectRevert("voting: proposal not approved");
        voting.executeProposal(proposalId);
    }

    function test_oneVotePerStewardPerProposal() public {
        vm.prank(steward1);
        uint256 proposalId = voting.proposeCharity(9, "Charity V", makeAddr("vWallet"), "meta-charity-v", 1 days);

        vm.prank(steward1);
        voting.voteProposal(proposalId, true);

        vm.prank(steward1);
        vm.expectRevert("voting: already voted");
        voting.voteProposal(proposalId, false);
    }

    function test_ownerOnlyExecuteAndCancel() public {
        vm.prank(steward1);
        uint256 proposalId = voting.proposeCharity(10, "Charity C", makeAddr("cWallet"), "meta-charity-c", 1 days);

        vm.prank(outsider);
        vm.expectRevert("Ownable: caller is not the owner");
        voting.cancelProposal(proposalId);

        vm.prank(steward1);
        voting.voteProposal(proposalId, true);
        vm.prank(steward2);
        voting.voteProposal(proposalId, true);

        vm.prank(outsider);
        vm.expectRevert("Ownable: caller is not the owner");
        voting.executeProposal(proposalId);
    }

    function test_expiredProposalCannotBeVotedOrExecuted() public {
        vm.prank(steward1);
        uint256 proposalId = voting.proposeCharity(11, "Charity E", makeAddr("eWallet"), "meta-charity-e", 1);

        vm.warp(block.timestamp + 2);

        vm.prank(steward2);
        vm.expectRevert("voting: proposal not pending");
        voting.voteProposal(proposalId, true);

        vm.expectRevert("voting: proposal not approved");
        voting.executeProposal(proposalId);
    }

    function test_pegProposalAndVotingUpdatesPeg() public {
        vm.prank(steward1);
        voting.proposePegValue(345, 1 days);

        vm.prank(steward1);
        voting.votePegValue(345);

        assertEq(voting.getPegValue(), 330);

        vm.prank(steward2);
        voting.votePegValue(345);

        assertEq(voting.getPegValue(), 345);
    }

    function test_listProposalIdsByStatus() public {
        vm.prank(steward1);
        uint256 p1 = voting.proposeCharity(12, "A", makeAddr("aWallet"), "meta-a", 1 days);
        vm.prank(steward1);
        uint256 p2 = voting.proposeCharity(13, "B", makeAddr("bWallet"), "meta-b", 1 days);

        vm.prank(steward1);
        voting.voteProposal(p1, true);
        vm.prank(steward2);
        voting.voteProposal(p1, true);

        (uint256[] memory approved, ) = voting.listProposalIdsByStatus(VotingV2.ProposalStatus.Approved, 0, 10);
        (uint256[] memory pending, ) = voting.listProposalIdsByStatus(VotingV2.ProposalStatus.Pending, 0, 10);

        assertEq(approved.length, 1);
        assertEq(approved[0], p1);
        assertEq(pending.length, 1);
        assertEq(pending[0], p2);
    }
}
