// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GovernanceProposalStorage} from "./GovernanceProposalHelper.sol";
import {IStewardRegistry} from "./interfaces/IStewardRegistry.sol";

contract GovernanceRouterProposalHelper is GovernanceProposalStorage {
    error NotSteward(address caller);
    error InvalidVotingWindow();
    error InvalidProposalValue();
    error ZeroAddressTarget();

    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType indexed proposalType,
        address indexed proposer,
        uint64 deadline,
        uint256 totalSnapshotWeight
    );

    modifier onlySteward() {
        if (!IStewardRegistry(stewardRegistry).isSteward(msg.sender)) {
            revert NotSteward(msg.sender);
        }
        _;
    }

    function proposeLiquidityRouterSetGovernance(address governance_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.LiquidityRouterSetGovernance, governance_, votingWindow);
    }

    function proposeLiquidityRouterSetTreasuryController(address treasuryController_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(
            ProposalType.LiquidityRouterSetTreasuryController, treasuryController_, votingWindow
        );
    }

    function proposeLiquidityRouterSetReserveInputRouter(address router_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.LiquidityRouterSetReserveInputRouter, router_, votingWindow);
    }

    function proposeLiquidityRouterSetCplTcoin(address cplTcoin_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.LiquidityRouterSetCplTcoin, cplTcoin_, votingWindow);
    }

    function proposeLiquidityRouterSetCharityPreferencesRegistry(address registry_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.LiquidityRouterSetCharityPreferencesRegistry, registry_, votingWindow);
    }

    function proposeLiquidityRouterSetAcceptancePreferencesRegistry(address registry_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(
            ProposalType.LiquidityRouterSetAcceptancePreferencesRegistry, registry_, votingWindow
        );
    }

    function proposeLiquidityRouterSetPoolRegistry(address registry_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.LiquidityRouterSetPoolRegistry, registry_, votingWindow);
    }

    function proposeLiquidityRouterSetPoolAdapter(address adapter_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.LiquidityRouterSetPoolAdapter, adapter_, votingWindow);
    }

    function proposeLiquidityRouterSetCharityTopupBps(uint256 newBps, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeRateLike(ProposalType.LiquidityRouterSetCharityTopupBps, newBps, votingWindow);
    }

    function proposeLiquidityRouterSetScoringWeights(
        uint256 newWeightLowMrTcoinLiquidity,
        uint256 newWeightHighCplTcoinLiquidity,
        uint256 newWeightUserPoolPreference,
        uint256 newWeightUserMerchantPreference,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        proposalId = _createProposal(ProposalType.LiquidityRouterSetScoringWeights, votingWindow);
        _scoringWeightsPayloads[proposalId] = ScoringWeightsPayload({
            weightLowMrTcoinLiquidity: newWeightLowMrTcoinLiquidity,
            weightHighCplTcoinLiquidity: newWeightHighCplTcoinLiquidity,
            weightUserPoolPreference: newWeightUserPoolPreference,
            weightUserMerchantPreference: newWeightUserMerchantPreference
        });
    }

    function _proposeAddressTarget(ProposalType proposalType, address account, uint64 votingWindow)
        internal
        returns (uint256 proposalId)
    {
        if (account == address(0)) revert ZeroAddressTarget();
        proposalId = _createProposal(proposalType, votingWindow);
        _addressPayloads[proposalId] = AddressPayload({account: account});
    }

    function _proposeRateLike(ProposalType proposalType, uint256 value, uint64 votingWindow)
        internal
        returns (uint256 proposalId)
    {
        if (value > BPS_DENOMINATOR) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        _uintPayloads[proposalId] = UIntPayload({value: value});
    }

    function _createProposal(ProposalType proposalType, uint64 votingWindow) internal returns (uint256 proposalId) {
        uint64 window = votingWindow == 0 ? defaultVotingWindow : votingWindow;
        if (window == 0) revert InvalidVotingWindow();

        proposalId = ++proposalCount;
        uint64 createdAt = uint64(block.timestamp);
        uint64 deadline = createdAt + window;

        Proposal storage proposal = _proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposalType = proposalType;
        proposal.status = ProposalStatus.Pending;
        proposal.proposer = msg.sender;
        proposal.createdAt = createdAt;
        proposal.deadline = deadline;
        proposal.totalSnapshotWeight = _snapshotStewardWeights(proposalId);

        emit ProposalCreated(proposalId, proposalType, msg.sender, deadline, proposal.totalSnapshotWeight);
    }

    function _snapshotStewardWeights(uint256 proposalId) internal returns (uint256 totalSnapshotWeight) {
        address[] memory stewards = IStewardRegistry(stewardRegistry).listStewardAddresses();
        for (uint256 i = 0; i < stewards.length; ++i) {
            address steward = stewards[i];
            uint256 weight = IStewardRegistry(stewardRegistry).getStewardWeight(steward);
            if (weight == 0) continue;
            _stewardSnapshotWeight[proposalId][steward] = weight;
            totalSnapshotWeight += weight;
        }
    }
}
