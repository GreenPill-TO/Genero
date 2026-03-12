// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ICharityRegistry} from "./interfaces/ICharityRegistry.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {IReserveRegistry} from "./interfaces/IReserveRegistry.sol";
import {IStewardRegistry} from "./interfaces/IStewardRegistry.sol";
import {ITCOINToken} from "./interfaces/ITCOINToken.sol";
import {ITreasuryController} from "./interfaces/ITreasuryController.sol";

contract Governance is Ownable, ReentrancyGuard {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant CAD_PEG_MAX_DELTA_BPS = 1_000; // 10%
    uint256 public constant MINIMUM_PARTICIPATION_WEIGHT = 1;

    enum ProposalType {
        CharityAdd,
        CharityRemove,
        CharitySuspend,
        CharityUnsuspend,
        SetDefaultCharity,
        PoolAdd,
        PoolRemove,
        PoolSuspend,
        PoolUnsuspend,
        MerchantApprove,
        MerchantRemove,
        MerchantSuspend,
        MerchantUnsuspend,
        MerchantPoolReassign,
        ReserveAssetAdd,
        ReserveAssetRemove,
        ReserveAssetPause,
        ReserveAssetUnpause,
        ReserveOracleUpdate,
        CadPegUpdate,
        UserRedeemRateUpdate,
        MerchantRedeemRateUpdate,
        CharityMintRateUpdate,
        DemurrageRateUpdate
    }

    enum ProposalStatus {
        None,
        Pending,
        Approved,
        Rejected,
        Executed,
        Cancelled
    }

    struct Proposal {
        uint256 proposalId;
        ProposalType proposalType;
        ProposalStatus status;
        address proposer;
        uint64 createdAt;
        uint64 deadline;
        uint256 yesWeight;
        uint256 noWeight;
        uint256 totalSnapshotWeight;
        uint256 participationWeight;
    }

    struct CharityAddPayload {
        string name;
        address wallet;
        string metadataRecordId;
    }

    struct CharityIdPayload {
        uint256 charityId;
    }

    struct PoolAddPayload {
        bytes32 poolId;
        string name;
        string metadataRecordId;
    }

    struct Bytes32IdPayload {
        bytes32 id;
    }

    struct MerchantApprovePayload {
        address merchant;
        bytes32 poolId;
        string metadataRecordId;
    }

    struct MerchantAddressPayload {
        address merchant;
    }

    struct MerchantPoolReassignPayload {
        address merchant;
        bytes32 newPoolId;
    }

    struct ReserveAssetAddPayload {
        bytes32 assetId;
        address token;
        string code;
        uint8 tokenDecimals;
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
    }

    struct ReserveOracleUpdatePayload {
        bytes32 assetId;
        address primaryOracle;
        address fallbackOracle;
        uint256 staleAfter;
    }

    struct UIntPayload {
        uint256 value;
    }

    error ZeroAddressOwner();
    error ZeroAddressRegistry();
    error ZeroAddressTarget();
    error NotSteward(address caller);
    error UnknownProposal(uint256 proposalId);
    error ProposalNotPending(uint256 proposalId);
    error ProposalNotApproved(uint256 proposalId);
    error ProposalExpired(uint256 proposalId);
    error ProposalAlreadyVoted(uint256 proposalId, address steward);
    error ProposalExecutionBeforeDeadline(uint256 proposalId, uint64 deadline, uint256 currentTimestamp);
    error InvalidVotingWindow();
    error InvalidProposalValue();
    error InvalidPegChange(uint256 oldPeg, uint256 newPeg);
    error Unauthorized();
    error EmptyString();
    error NoSnapshotWeight(uint256 proposalId, address steward);

    event StewardRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event ReserveRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event TreasuryControllerUpdated(address indexed oldController, address indexed newController);
    event TcoinTokenUpdated(address indexed oldToken, address indexed newToken);
    event DefaultVotingWindowUpdated(uint64 oldWindow, uint64 newWindow);

    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType indexed proposalType,
        address indexed proposer,
        uint64 deadline,
        uint256 totalSnapshotWeight
    );

    event ProposalVoted(
        uint256 indexed proposalId,
        address indexed steward,
        bool support,
        uint256 weight,
        uint256 yesWeight,
        uint256 noWeight
    );

    event ProposalApproved(uint256 indexed proposalId);
    event ProposalRejected(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId, address indexed actor);
    event ProposalCancelled(uint256 indexed proposalId, address indexed actor);

    address public stewardRegistry;
    address public charityRegistry;
    address public poolRegistry;
    address public reserveRegistry;
    address public treasuryController;
    address public tcoinToken;

    uint64 public defaultVotingWindow;
    uint256 public proposalCount;

    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => uint256)) private stewardSnapshotWeight;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    mapping(uint256 => CharityAddPayload) private charityAddPayloads;
    mapping(uint256 => CharityIdPayload) private charityIdPayloads;
    mapping(uint256 => PoolAddPayload) private poolAddPayloads;
    mapping(uint256 => Bytes32IdPayload) private bytes32IdPayloads;
    mapping(uint256 => MerchantApprovePayload) private merchantApprovePayloads;
    mapping(uint256 => MerchantAddressPayload) private merchantAddressPayloads;
    mapping(uint256 => MerchantPoolReassignPayload) private merchantPoolReassignPayloads;
    mapping(uint256 => ReserveAssetAddPayload) private reserveAssetAddPayloads;
    mapping(uint256 => ReserveOracleUpdatePayload) private reserveOracleUpdatePayloads;
    mapping(uint256 => UIntPayload) private uintPayloads;

    constructor(
        address initialOwner,
        address stewardRegistry_,
        address charityRegistry_,
        address poolRegistry_,
        address reserveRegistry_,
        address treasuryController_,
        address tcoinToken_,
        uint64 defaultVotingWindow_
    ) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
        _setStewardRegistry(stewardRegistry_);
        _setCharityRegistry(charityRegistry_);
        _setPoolRegistry(poolRegistry_);
        _setReserveRegistry(reserveRegistry_);
        _setTreasuryController(treasuryController_);
        _setTcoinToken(tcoinToken_);
        _setDefaultVotingWindow(defaultVotingWindow_);
    }

    modifier onlySteward() {
        if (!IStewardRegistry(stewardRegistry).isSteward(msg.sender)) {
            revert NotSteward(msg.sender);
        }
        _;
    }

    modifier onlyPendingProposal(uint256 proposalId) {
        Proposal storage proposal = _getProposalStorage(proposalId);
        if (proposal.status != ProposalStatus.Pending) revert ProposalNotPending(proposalId);
        _;
    }

    function setStewardRegistry(address newRegistry) external onlyOwner {
        _setStewardRegistry(newRegistry);
    }

    function setCharityRegistry(address newRegistry) external onlyOwner {
        _setCharityRegistry(newRegistry);
    }

    function setPoolRegistry(address newRegistry) external onlyOwner {
        _setPoolRegistry(newRegistry);
    }

    function setReserveRegistry(address newRegistry) external onlyOwner {
        _setReserveRegistry(newRegistry);
    }

    function setTreasuryController(address newController) external onlyOwner {
        _setTreasuryController(newController);
    }

    function setTcoinToken(address newToken) external onlyOwner {
        _setTcoinToken(newToken);
    }

    function setDefaultVotingWindow(uint64 newWindow) external onlyOwner {
        _setDefaultVotingWindow(newWindow);
    }

    function proposeCharityAdd(
        string calldata name,
        address wallet,
        string calldata metadataRecordId,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (bytes(name).length == 0) revert EmptyString();
        if (wallet == address(0)) revert ZeroAddressTarget();

        proposalId = _createProposal(ProposalType.CharityAdd, votingWindow);
        charityAddPayloads[proposalId] = CharityAddPayload({
            name: name,
            wallet: wallet,
            metadataRecordId: metadataRecordId
        });
    }

    function proposeCharityRemove(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeCharityId(ProposalType.CharityRemove, charityId, votingWindow);
    }

    function proposeCharitySuspend(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeCharityId(ProposalType.CharitySuspend, charityId, votingWindow);
    }

    function proposeCharityUnsuspend(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeCharityId(ProposalType.CharityUnsuspend, charityId, votingWindow);
    }

    function proposeSetDefaultCharity(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeCharityId(ProposalType.SetDefaultCharity, charityId, votingWindow);
    }

    function proposePoolAdd(
        bytes32 poolId,
        string calldata name,
        string calldata metadataRecordId,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (poolId == bytes32(0)) revert InvalidProposalValue();
        if (bytes(name).length == 0) revert EmptyString();

        proposalId = _createProposal(ProposalType.PoolAdd, votingWindow);
        poolAddPayloads[proposalId] = PoolAddPayload({
            poolId: poolId,
            name: name,
            metadataRecordId: metadataRecordId
        });
    }

    function proposePoolRemove(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.PoolRemove, poolId, votingWindow);
    }

    function proposePoolSuspend(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.PoolSuspend, poolId, votingWindow);
    }

    function proposePoolUnsuspend(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.PoolUnsuspend, poolId, votingWindow);
    }

    function proposeMerchantApprove(
        address merchant,
        bytes32 poolId,
        string calldata metadataRecordId,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (merchant == address(0)) revert ZeroAddressTarget();
        if (poolId == bytes32(0)) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.MerchantApprove, votingWindow);
        merchantApprovePayloads[proposalId] = MerchantApprovePayload({
            merchant: merchant,
            poolId: poolId,
            metadataRecordId: metadataRecordId
        });
    }

    function proposeMerchantRemove(address merchant, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantAddress(ProposalType.MerchantRemove, merchant, votingWindow);
    }

    function proposeMerchantSuspend(address merchant, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantAddress(ProposalType.MerchantSuspend, merchant, votingWindow);
    }

    function proposeMerchantUnsuspend(address merchant, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantAddress(ProposalType.MerchantUnsuspend, merchant, votingWindow);
    }

    function proposeMerchantPoolReassign(
        address merchant,
        bytes32 newPoolId,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (merchant == address(0)) revert ZeroAddressTarget();
        if (newPoolId == bytes32(0)) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.MerchantPoolReassign, votingWindow);
        merchantPoolReassignPayloads[proposalId] = MerchantPoolReassignPayload({
            merchant: merchant,
            newPoolId: newPoolId
        });
    }

    function proposeReserveAssetAdd(
        bytes32 assetId,
        address token,
        string calldata code,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (assetId == bytes32(0)) revert InvalidProposalValue();
        if (token == address(0)) revert ZeroAddressTarget();
        if (bytes(code).length == 0) revert EmptyString();
        if (primaryOracle == address(0)) revert ZeroAddressTarget();
        if (staleAfter == 0) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.ReserveAssetAdd, votingWindow);
        reserveAssetAddPayloads[proposalId] = ReserveAssetAddPayload({
            assetId: assetId,
            token: token,
            code: code,
            tokenDecimals: tokenDecimals,
            primaryOracle: primaryOracle,
            fallbackOracle: fallbackOracle,
            staleAfter: staleAfter
        });
    }

    function proposeReserveAssetRemove(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.ReserveAssetRemove, assetId, votingWindow);
    }

    function proposeReserveAssetPause(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.ReserveAssetPause, assetId, votingWindow);
    }

    function proposeReserveAssetUnpause(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBytes32Id(ProposalType.ReserveAssetUnpause, assetId, votingWindow);
    }

    function proposeReserveOracleUpdate(
        bytes32 assetId,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (assetId == bytes32(0)) revert InvalidProposalValue();
        if (primaryOracle == address(0)) revert ZeroAddressTarget();
        if (staleAfter == 0) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.ReserveOracleUpdate, votingWindow);
        reserveOracleUpdatePayloads[proposalId] = ReserveOracleUpdatePayload({
            assetId: assetId,
            primaryOracle: primaryOracle,
            fallbackOracle: fallbackOracle,
            staleAfter: staleAfter
        });
    }

    function proposeCadPegUpdate(uint256 newCadPeg18, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (newCadPeg18 == 0) revert InvalidProposalValue();
        _validateCadPegChange(newCadPeg18);

        proposalId = _createProposal(ProposalType.CadPegUpdate, votingWindow);
        uintPayloads[proposalId] = UIntPayload({value: newCadPeg18});
    }

    function proposeUserRedeemRateUpdate(uint256 newRateBps, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeRateLike(ProposalType.UserRedeemRateUpdate, newRateBps, votingWindow);
    }

    function proposeMerchantRedeemRateUpdate(uint256 newRateBps, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeRateLike(ProposalType.MerchantRedeemRateUpdate, newRateBps, votingWindow);
    }

    function proposeCharityMintRateUpdate(uint256 newRateBps, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeRateLike(ProposalType.CharityMintRateUpdate, newRateBps, votingWindow);
    }

    function proposeDemurrageRateUpdate(uint256 newRate, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (newRate == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.DemurrageRateUpdate, votingWindow);
        uintPayloads[proposalId] = UIntPayload({value: newRate});
    }

    /// @notice Cast a weighted steward vote on a pending proposal.
    /// @dev A proposal can move to Approved before deadline if quorum and majority conditions are met.
    function voteProposal(uint256 proposalId, bool support) external onlySteward onlyPendingProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        if (block.timestamp > proposal.deadline) revert ProposalExpired(proposalId);
        if (hasVoted[proposalId][msg.sender]) revert ProposalAlreadyVoted(proposalId, msg.sender);

        uint256 weight = stewardSnapshotWeight[proposalId][msg.sender];
        if (weight == 0) revert NoSnapshotWeight(proposalId, msg.sender);

        hasVoted[proposalId][msg.sender] = true;
        proposal.participationWeight += weight;

        if (support) {
            proposal.yesWeight += weight;
        } else {
            proposal.noWeight += weight;
        }

        emit ProposalVoted(proposalId, msg.sender, support, weight, proposal.yesWeight, proposal.noWeight);

        if (_shouldApprove(proposal)) {
            proposal.status = ProposalStatus.Approved;
            emit ProposalApproved(proposalId);
        }
    }

    /// @notice Finalize an expired pending proposal as Approved or Rejected.
    function refreshProposalStatus(uint256 proposalId) public {
        Proposal storage proposal = _getProposalStorage(proposalId);
        if (proposal.status != ProposalStatus.Pending) return;
        if (block.timestamp <= proposal.deadline) return;

        if (_shouldApprove(proposal)) {
            proposal.status = ProposalStatus.Approved;
            emit ProposalApproved(proposalId);
        } else {
            proposal.status = ProposalStatus.Rejected;
            emit ProposalRejected(proposalId);
        }
    }

    /// @notice Execute an approved proposal after the proposal deadline has passed.
    /// @dev Execution is deadline-gated even if early approval happened before expiry.
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = _getProposalStorage(proposalId);
        if (block.timestamp < proposal.deadline) {
            revert ProposalExecutionBeforeDeadline(proposalId, proposal.deadline, block.timestamp);
        }

        refreshProposalStatus(proposalId);

        proposal = _getProposalStorage(proposalId);
        if (proposal.status != ProposalStatus.Approved) revert ProposalNotApproved(proposalId);

        ProposalType proposalType = proposal.proposalType;

        if (proposalType == ProposalType.CharityAdd) {
            CharityAddPayload storage payload = charityAddPayloads[proposalId];
            ICharityRegistry(charityRegistry).addCharity(payload.name, payload.wallet, payload.metadataRecordId);
        } else if (proposalType == ProposalType.CharityRemove) {
            ICharityRegistry(charityRegistry).removeCharity(charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.CharitySuspend) {
            ICharityRegistry(charityRegistry).suspendCharity(charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.CharityUnsuspend) {
            ICharityRegistry(charityRegistry).unsuspendCharity(charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.SetDefaultCharity) {
            ICharityRegistry(charityRegistry).setDefaultCharity(charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.PoolAdd) {
            PoolAddPayload storage payload = poolAddPayloads[proposalId];
            IPoolRegistry(poolRegistry).addPool(payload.poolId, payload.name, payload.metadataRecordId);
        } else if (proposalType == ProposalType.PoolRemove) {
            IPoolRegistry(poolRegistry).removePool(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.PoolSuspend) {
            IPoolRegistry(poolRegistry).suspendPool(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.PoolUnsuspend) {
            IPoolRegistry(poolRegistry).unsuspendPool(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.MerchantApprove) {
            MerchantApprovePayload storage payload = merchantApprovePayloads[proposalId];
            IPoolRegistry(poolRegistry).approveMerchant(payload.merchant, payload.poolId, payload.metadataRecordId);
        } else if (proposalType == ProposalType.MerchantRemove) {
            IPoolRegistry(poolRegistry).removeMerchant(merchantAddressPayloads[proposalId].merchant);
        } else if (proposalType == ProposalType.MerchantSuspend) {
            IPoolRegistry(poolRegistry).suspendMerchant(merchantAddressPayloads[proposalId].merchant);
        } else if (proposalType == ProposalType.MerchantUnsuspend) {
            IPoolRegistry(poolRegistry).unsuspendMerchant(merchantAddressPayloads[proposalId].merchant);
        } else if (proposalType == ProposalType.MerchantPoolReassign) {
            MerchantPoolReassignPayload storage payload = merchantPoolReassignPayloads[proposalId];
            IPoolRegistry(poolRegistry).reassignMerchantPool(payload.merchant, payload.newPoolId);
        } else if (proposalType == ProposalType.ReserveAssetAdd) {
            ReserveAssetAddPayload storage payload = reserveAssetAddPayloads[proposalId];
            IReserveRegistry(reserveRegistry).addReserveAsset(
                payload.assetId,
                payload.token,
                payload.code,
                payload.tokenDecimals,
                payload.primaryOracle,
                payload.fallbackOracle,
                payload.staleAfter
            );
        } else if (proposalType == ProposalType.ReserveAssetRemove) {
            IReserveRegistry(reserveRegistry).removeReserveAsset(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveAssetPause) {
            IReserveRegistry(reserveRegistry).pauseReserveAsset(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveAssetUnpause) {
            IReserveRegistry(reserveRegistry).unpauseReserveAsset(bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveOracleUpdate) {
            ReserveOracleUpdatePayload storage payload = reserveOracleUpdatePayloads[proposalId];
            IReserveRegistry(reserveRegistry).updateReserveAssetOracles(
                payload.assetId,
                payload.primaryOracle,
                payload.fallbackOracle
            );
            IReserveRegistry(reserveRegistry).updateReserveAssetStaleness(payload.assetId, payload.staleAfter);
        } else if (proposalType == ProposalType.CadPegUpdate) {
            uint256 newCadPeg18 = uintPayloads[proposalId].value;
            _validateCadPegChange(newCadPeg18);
            ITreasuryController(treasuryController).setCadPeg(newCadPeg18);
        } else if (proposalType == ProposalType.UserRedeemRateUpdate) {
            ITreasuryController(treasuryController).setUserRedeemRate(uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.MerchantRedeemRateUpdate) {
            ITreasuryController(treasuryController).setMerchantRedeemRate(uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.CharityMintRateUpdate) {
            ITreasuryController(treasuryController).setCharityMintRate(uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.DemurrageRateUpdate) {
            ITCOINToken(tcoinToken).updateDemurrageRate(uintPayloads[proposalId].value);
        } else {
            revert InvalidProposalValue();
        }

        proposal.status = ProposalStatus.Executed;
        emit ProposalExecuted(proposalId, msg.sender);
    }

    /// @notice Owner-only cancellation hook for non-executed proposals.
    function cancelProposal(uint256 proposalId) external onlyOwner {
        Proposal storage proposal = _getProposalStorage(proposalId);
        if (proposal.status == ProposalStatus.Executed || proposal.status == ProposalStatus.Cancelled) {
            revert Unauthorized();
        }
        proposal.status = ProposalStatus.Cancelled;
        emit ProposalCancelled(proposalId, msg.sender);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return _getProposalStorage(proposalId);
    }

    function getSnapshotWeight(uint256 proposalId, address steward) external view returns (uint256) {
        return stewardSnapshotWeight[proposalId][steward];
    }

    function getProposalCount() external view returns (uint256) {
        return proposalCount;
    }

    function listProposalIds(uint256 cursor, uint256 size)
        external
        view
        returns (uint256[] memory ids, uint256 nextCursor)
    {
        if (cursor >= proposalCount || size == 0) {
            return (new uint256[](0), cursor);
        }

        uint256 end = cursor + size;
        if (end > proposalCount) end = proposalCount;

        ids = new uint256[](end - cursor);
        for (uint256 i = cursor; i < end; ++i) {
            ids[i - cursor] = i + 1;
        }

        nextCursor = end;
    }

    function _proposeCharityId(
        ProposalType proposalType,
        uint256 charityId,
        uint64 votingWindow
    ) internal returns (uint256 proposalId) {
        if (charityId == 0) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        charityIdPayloads[proposalId] = CharityIdPayload({charityId: charityId});
    }

    function _proposeBytes32Id(
        ProposalType proposalType,
        bytes32 id,
        uint64 votingWindow
    ) internal returns (uint256 proposalId) {
        if (id == bytes32(0)) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        bytes32IdPayloads[proposalId] = Bytes32IdPayload({id: id});
    }

    function _proposeMerchantAddress(
        ProposalType proposalType,
        address merchant,
        uint64 votingWindow
    ) internal returns (uint256 proposalId) {
        if (merchant == address(0)) revert ZeroAddressTarget();
        proposalId = _createProposal(proposalType, votingWindow);
        merchantAddressPayloads[proposalId] = MerchantAddressPayload({merchant: merchant});
    }

    function _proposeRateLike(
        ProposalType proposalType,
        uint256 value,
        uint64 votingWindow
    ) internal returns (uint256 proposalId) {
        if (value > BPS_DENOMINATOR) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        uintPayloads[proposalId] = UIntPayload({value: value});
    }

    function _createProposal(ProposalType proposalType, uint64 votingWindow) internal returns (uint256 proposalId) {
        uint64 window = votingWindow == 0 ? defaultVotingWindow : votingWindow;
        if (window == 0) revert InvalidVotingWindow();

        proposalId = ++proposalCount;
        uint64 createdAt = uint64(block.timestamp);
        uint64 deadline = createdAt + window;

        Proposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposalType = proposalType;
        proposal.status = ProposalStatus.Pending;
        proposal.proposer = msg.sender;
        proposal.createdAt = createdAt;
        proposal.deadline = deadline;

        uint256 totalSnapshotWeight = _snapshotStewardWeights(proposalId);
        proposal.totalSnapshotWeight = totalSnapshotWeight;

        emit ProposalCreated(proposalId, proposalType, msg.sender, deadline, totalSnapshotWeight);
    }

    function _snapshotStewardWeights(uint256 proposalId) internal returns (uint256 totalSnapshotWeight) {
        address[] memory stewards = IStewardRegistry(stewardRegistry).listStewardAddresses();

        for (uint256 i = 0; i < stewards.length; ++i) {
            address steward = stewards[i];
            uint256 weight = IStewardRegistry(stewardRegistry).getStewardWeight(steward);
            if (weight == 0) continue;

            stewardSnapshotWeight[proposalId][steward] = weight;
            totalSnapshotWeight += weight;
        }
    }

    function _shouldApprove(Proposal storage proposal) internal view returns (bool) {
        return proposal.yesWeight > proposal.noWeight && proposal.participationWeight >= MINIMUM_PARTICIPATION_WEIGHT;
    }

    function _validateCadPegChange(uint256 newCadPeg18) internal view {
        uint256 oldPeg = ITreasuryController(treasuryController).cadPeg18();
        if (oldPeg == 0 || newCadPeg18 == 0) revert InvalidProposalValue();

        uint256 lowerBound = oldPeg - ((oldPeg * CAD_PEG_MAX_DELTA_BPS) / BPS_DENOMINATOR);
        uint256 upperBound = oldPeg + ((oldPeg * CAD_PEG_MAX_DELTA_BPS) / BPS_DENOMINATOR);

        if (newCadPeg18 < lowerBound || newCadPeg18 > upperBound) {
            revert InvalidPegChange(oldPeg, newCadPeg18);
        }
    }

    function _getProposalStorage(uint256 proposalId) internal view returns (Proposal storage proposal) {
        proposal = proposals[proposalId];
        if (proposal.status == ProposalStatus.None) revert UnknownProposal(proposalId);
    }

    function _setStewardRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressRegistry();
        address old = stewardRegistry;
        stewardRegistry = newRegistry;
        emit StewardRegistryUpdated(old, newRegistry);
    }

    function _setCharityRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressRegistry();
        address old = charityRegistry;
        charityRegistry = newRegistry;
        emit CharityRegistryUpdated(old, newRegistry);
    }

    function _setPoolRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressRegistry();
        address old = poolRegistry;
        poolRegistry = newRegistry;
        emit PoolRegistryUpdated(old, newRegistry);
    }

    function _setReserveRegistry(address newRegistry) internal {
        if (newRegistry == address(0)) revert ZeroAddressRegistry();
        address old = reserveRegistry;
        reserveRegistry = newRegistry;
        emit ReserveRegistryUpdated(old, newRegistry);
    }

    function _setTreasuryController(address newController) internal {
        if (newController == address(0)) revert ZeroAddressRegistry();
        address old = treasuryController;
        treasuryController = newController;
        emit TreasuryControllerUpdated(old, newController);
    }

    function _setTcoinToken(address newToken) internal {
        if (newToken == address(0)) revert ZeroAddressRegistry();
        address old = tcoinToken;
        tcoinToken = newToken;
        emit TcoinTokenUpdated(old, newToken);
    }

    function _setDefaultVotingWindow(uint64 newWindow) internal {
        if (newWindow == 0) revert InvalidVotingWindow();
        uint64 oldWindow = defaultVotingWindow;
        defaultVotingWindow = newWindow;
        emit DefaultVotingWindowUpdated(oldWindow, newWindow);
    }
}
