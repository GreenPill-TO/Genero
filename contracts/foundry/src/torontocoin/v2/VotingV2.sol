// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IOrchestratorV2.sol";

contract VotingV2 is Initializable, OwnableUpgradeable {
    enum ProposalType {
        Charity,
        ReserveCurrency
    }

    enum ProposalStatus {
        Pending,
        Approved,
        Rejected,
        Executed,
        Cancelled
    }

    struct Proposal {
        uint256 proposalId;
        ProposalType proposalType;
        bytes32 cityId;
        uint256 charityId;
        string name;
        address wallet;
        bytes32 code;
        address token;
        uint8 decimals;
        string metadataRecordId;
        uint256 yesVotes;
        uint256 noVotes;
        uint64 deadline;
        ProposalStatus status;
        address proposer;
    }

    struct PegProposal {
        uint256 proposedPegValue;
        uint64 deadline;
        bool exists;
    }

    IOrchestratorV2 public orchestrator;
    bytes32 public cityId;

    uint256 public pegValue;
    uint256 public redemptionRateUserTTC;
    uint256 public redemptionRateStoreTTC;
    uint256 public redemptionRateUserCAD;
    uint256 public redemptionRateStoreCAD;
    uint256 public minimumReserveRatio;
    uint256 public maximumReserveRatio;
    uint256 public demurrageRate;
    uint256 public reserveRatio;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnProposal;

    mapping(uint256 => PegProposal) public pegProposals;
    uint256[] public proposedPegValues;
    mapping(uint256 => bool) private hasPegProposalValue;
    mapping(uint256 => uint256) public pegValueVoteCounts;
    mapping(address => uint256) public stewardPegVotes;

    event PegProposalCreated(uint256 indexed proposedPegValue, uint64 deadline, address indexed proposer);
    event PegVoteCast(uint256 indexed proposedPegValue, address indexed steward, uint256 votesForValue);
    event PegValueUpdated(uint256 oldPegValue, uint256 newPegValue);

    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType indexed proposalType,
        bytes32 indexed cityId,
        address proposer,
        uint64 deadline
    );
    event ProposalVoteCast(uint256 indexed proposalId, address indexed steward, bool support, uint256 yesVotes, uint256 noVotes);
    event ProposalStatusChanged(uint256 indexed proposalId, ProposalStatus status, address indexed actor);

    modifier onlySteward() {
        require(orchestrator.isSteward(msg.sender), "voting: only steward");
        _;
    }

    modifier onlyStewardOrOwner() {
        require(orchestrator.isSteward(msg.sender) || msg.sender == owner(), "voting: only steward/owner");
        _;
    }

    function initialize(address orchestratorAddress, bytes32 cityKey) external initializer {
        require(orchestratorAddress != address(0), "voting: orchestrator required");
        __Ownable_init();

        orchestrator = IOrchestratorV2(orchestratorAddress);
        cityId = cityKey;

        pegValue = 330;
        redemptionRateUserTTC = 92;
        redemptionRateStoreTTC = 95;
        redemptionRateUserCAD = 87;
        redemptionRateStoreCAD = 90;
        minimumReserveRatio = 800_000;
        maximumReserveRatio = 1_200_000;
        demurrageRate = 99_967;
        reserveRatio = 1_000_000;
    }

    function getPegValue() external view returns (uint256) {
        return pegValue;
    }

    function getRedemptionRateUserTTC() external view returns (uint256) {
        return redemptionRateUserTTC;
    }

    function getRedemptionRateStoreTTC() external view returns (uint256) {
        return redemptionRateStoreTTC;
    }

    function getRedemptionRateUserCAD() external view returns (uint256) {
        return redemptionRateUserCAD;
    }

    function getRedemptionRateStoreCAD() external view returns (uint256) {
        return redemptionRateStoreCAD;
    }

    function getMinimumReserveRatio() external view returns (uint256) {
        return minimumReserveRatio;
    }

    function getMaximumReserveRatio() external view returns (uint256) {
        return maximumReserveRatio;
    }

    function getDemurrageRate() external view returns (uint256) {
        return demurrageRate;
    }

    function getReserveRatio() external view returns (uint256) {
        return reserveRatio;
    }

    function proposePegValue(uint256 proposedPegValue, uint64 votingWindow) external onlySteward {
        require(proposedPegValue > 0, "voting: peg value required");
        require(votingWindow > 0, "voting: voting window required");

        uint64 deadline = uint64(block.timestamp + votingWindow);
        pegProposals[proposedPegValue] = PegProposal({
            proposedPegValue: proposedPegValue,
            deadline: deadline,
            exists: true
        });

        if (!hasPegProposalValue[proposedPegValue]) {
            hasPegProposalValue[proposedPegValue] = true;
            proposedPegValues.push(proposedPegValue);
        }

        emit PegProposalCreated(proposedPegValue, deadline, msg.sender);
    }

    function votePegValue(uint256 proposedPegValue) external onlySteward {
        PegProposal memory proposal = pegProposals[proposedPegValue];
        require(proposal.exists, "voting: unknown peg proposal");
        require(block.timestamp <= proposal.deadline, "voting: peg proposal expired");

        uint256 previousVote = stewardPegVotes[msg.sender];
        if (previousVote != 0 && previousVote != proposedPegValue && pegValueVoteCounts[previousVote] > 0) {
            pegValueVoteCounts[previousVote] -= 1;
        }

        if (previousVote != proposedPegValue) {
            pegValueVoteCounts[proposedPegValue] += 1;
            stewardPegVotes[msg.sender] = proposedPegValue;
        }

        emit PegVoteCast(proposedPegValue, msg.sender, pegValueVoteCounts[proposedPegValue]);
        _maybeUpdatePegValue();
    }

    function proposeCharity(
        uint256 charityId,
        string calldata name,
        address wallet,
        string calldata metadataRecordId,
        uint64 votingWindow
    ) external onlyStewardOrOwner returns (uint256 proposalId) {
        require(charityId > 0, "voting: charity id required");
        require(bytes(name).length > 0, "voting: charity name required");
        require(wallet != address(0), "voting: wallet required");
        require(bytes(metadataRecordId).length > 0, "voting: metadata required");
        require(votingWindow > 0, "voting: voting window required");

        proposalId = _nextProposalId();

        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposalType = ProposalType.Charity;
        proposal.cityId = cityId;
        proposal.charityId = charityId;
        proposal.name = name;
        proposal.wallet = wallet;
        proposal.metadataRecordId = metadataRecordId;
        proposal.deadline = uint64(block.timestamp + votingWindow);
        proposal.status = ProposalStatus.Pending;
        proposal.proposer = msg.sender;

        emit ProposalCreated(proposalId, ProposalType.Charity, cityId, msg.sender, proposal.deadline);
    }

    function proposeReserveCurrency(
        bytes32 code,
        address token,
        uint8 decimals,
        string calldata metadataRecordId,
        uint64 votingWindow
    ) external onlyStewardOrOwner returns (uint256 proposalId) {
        require(code != bytes32(0), "voting: reserve code required");
        require(token != address(0), "voting: reserve token required");
        require(bytes(metadataRecordId).length > 0, "voting: metadata required");
        require(votingWindow > 0, "voting: voting window required");

        proposalId = _nextProposalId();

        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposalType = ProposalType.ReserveCurrency;
        proposal.cityId = cityId;
        proposal.code = code;
        proposal.token = token;
        proposal.decimals = decimals;
        proposal.metadataRecordId = metadataRecordId;
        proposal.deadline = uint64(block.timestamp + votingWindow);
        proposal.status = ProposalStatus.Pending;
        proposal.proposer = msg.sender;

        emit ProposalCreated(proposalId, ProposalType.ReserveCurrency, cityId, msg.sender, proposal.deadline);
    }

    function voteProposal(uint256 proposalId, bool support) external onlySteward {
        _refreshExpiry(proposalId);

        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalId != 0, "voting: unknown proposal");
        require(proposal.status == ProposalStatus.Pending, "voting: proposal not pending");
        require(block.timestamp <= proposal.deadline, "voting: proposal expired");
        require(!hasVotedOnProposal[proposalId][msg.sender], "voting: already voted");

        hasVotedOnProposal[proposalId][msg.sender] = true;
        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit ProposalVoteCast(proposalId, msg.sender, support, proposal.yesVotes, proposal.noVotes);

        if (_isApproved(proposal)) {
            proposal.status = ProposalStatus.Approved;
            emit ProposalStatusChanged(proposalId, ProposalStatus.Approved, msg.sender);
        }
    }

    function executeProposal(uint256 proposalId) external onlyOwner {
        _refreshExpiry(proposalId);

        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalId != 0, "voting: unknown proposal");
        require(proposal.status == ProposalStatus.Approved, "voting: proposal not approved");
        require(block.timestamp <= proposal.deadline, "voting: proposal expired");

        if (proposal.proposalType == ProposalType.Charity) {
            orchestrator.addCharity(proposal.charityId, proposal.name, proposal.wallet);
        } else if (proposal.proposalType == ProposalType.ReserveCurrency) {
            orchestrator.addReserveCurrency(proposal.code, proposal.token, proposal.decimals);
        } else {
            revert("voting: unsupported proposal type");
        }

        proposal.status = ProposalStatus.Executed;
        emit ProposalStatusChanged(proposalId, ProposalStatus.Executed, msg.sender);
    }

    function cancelProposal(uint256 proposalId) external onlyOwner {
        _refreshExpiry(proposalId);

        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalId != 0, "voting: unknown proposal");
        require(
            proposal.status == ProposalStatus.Pending || proposal.status == ProposalStatus.Approved,
            "voting: proposal not cancellable"
        );

        proposal.status = ProposalStatus.Cancelled;
        emit ProposalStatusChanged(proposalId, ProposalStatus.Cancelled, msg.sender);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function listProposalIdsByStatus(
        ProposalStatus status,
        uint256 cursor,
        uint256 size
    ) external view returns (uint256[] memory ids, uint256 nextCursor) {
        if (size == 0) {
            return (new uint256[](0), cursor);
        }

        uint256[] memory temp = new uint256[](size);
        uint256 found = 0;
        uint256 i = cursor + 1;

        while (i <= proposalCount && found < size) {
            Proposal memory proposal = proposals[i];
            ProposalStatus currentStatus = _deriveStatus(proposal);
            if (currentStatus == status) {
                temp[found] = i;
                found += 1;
            }
            i += 1;
        }

        ids = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            ids[j] = temp[j];
        }

        nextCursor = i > 0 ? i - 1 : cursor;
    }

    function _nextProposalId() internal returns (uint256 proposalId) {
        proposalCount += 1;
        proposalId = proposalCount;
    }

    function _maybeUpdatePegValue() internal {
        uint256 topValue = pegValue;
        uint256 topVotes = 0;
        bool tie = false;

        for (uint256 i = 0; i < proposedPegValues.length; i++) {
            uint256 candidate = proposedPegValues[i];
            PegProposal memory proposal = pegProposals[candidate];
            if (!proposal.exists || block.timestamp > proposal.deadline) {
                continue;
            }

            uint256 votes = pegValueVoteCounts[candidate];
            if (votes > topVotes) {
                topVotes = votes;
                topValue = candidate;
                tie = false;
            } else if (votes == topVotes && votes > 0 && candidate != topValue) {
                tie = true;
            }
        }

        if (!tie && topVotes >= _quorum() && topValue != pegValue) {
            uint256 previous = pegValue;
            pegValue = topValue;
            emit PegValueUpdated(previous, topValue);
        }
    }

    function _isApproved(Proposal storage proposal) internal view returns (bool) {
        return proposal.yesVotes > proposal.noVotes && proposal.yesVotes >= _quorum();
    }

    function _quorum() internal view returns (uint256) {
        uint256 activeStewardCount = orchestrator.getStewardCount();
        uint256 threshold = (activeStewardCount + 1) / 2;
        return threshold == 0 ? 1 : threshold;
    }

    function _refreshExpiry(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.proposalId == 0) {
            return;
        }

        if (
            block.timestamp > proposal.deadline
                && (proposal.status == ProposalStatus.Pending || proposal.status == ProposalStatus.Approved)
        ) {
            proposal.status = ProposalStatus.Rejected;
            emit ProposalStatusChanged(proposalId, ProposalStatus.Rejected, msg.sender);
        }
    }

    function _deriveStatus(Proposal memory proposal) internal view returns (ProposalStatus) {
        if (
            block.timestamp > proposal.deadline
                && (proposal.status == ProposalStatus.Pending || proposal.status == ProposalStatus.Approved)
        ) {
            return ProposalStatus.Rejected;
        }
        return proposal.status;
    }
}
