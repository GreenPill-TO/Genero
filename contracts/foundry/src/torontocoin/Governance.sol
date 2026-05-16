// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IStewardRegistry} from "./interfaces/IStewardRegistry.sol";
import {ITreasuryController} from "./interfaces/ITreasuryController.sol";
import {GovernanceExecutionHelper} from "./GovernanceExecutionHelper.sol";
import {GovernanceRouterProposalHelper} from "./GovernanceRouterProposalHelper.sol";

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
        OvercollateralizationTargetUpdate,
        CharityMintFromExcess,
        ExpirePeriodUpdate,
        TreasuryControllerSetTreasury,
        TreasuryControllerSetGovernance,
        TreasuryControllerSetIndexer,
        TreasuryControllerSetLiquidityRouter,
        TreasuryControllerSetTcoinToken,
        TreasuryControllerSetReserveRegistry,
        TreasuryControllerSetCharityRegistry,
        TreasuryControllerSetPoolRegistry,
        TreasuryControllerSetOracleRouter,
        TreasuryControllerPauseMinting,
        TreasuryControllerUnpauseMinting,
        TreasuryControllerPauseRedemption,
        TreasuryControllerUnpauseRedemption,
        TreasuryControllerPauseAsset,
        TreasuryControllerUnpauseAsset,
        TreasuryControllerSetAdminCanMintToCharity,
        LiquidityRouterSetGovernance,
        LiquidityRouterSetTreasuryController,
        LiquidityRouterSetReserveInputRouter,
        LiquidityRouterSetCplTcoin,
        LiquidityRouterSetCharityPreferencesRegistry,
        LiquidityRouterSetAcceptancePreferencesRegistry,
        LiquidityRouterSetPoolRegistry,
        LiquidityRouterSetPoolAdapter,
        LiquidityRouterSetCharityTopupBps,
        LiquidityRouterSetScoringWeights,
        PoolAddWithAddress
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

    struct PoolAddWithAddressPayload {
        bytes32 poolId;
        string name;
        string metadataRecordId;
        address poolAddress;
    }

    struct Bytes32IdPayload {
        bytes32 id;
    }

    struct MerchantApprovePayload {
        bytes32 merchantId;
        bytes32 poolId;
        string metadataRecordId;
        address[] initialWallets;
    }

    struct MerchantIdPayload {
        bytes32 merchantId;
    }

    struct MerchantPoolReassignPayload {
        bytes32 merchantId;
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

    struct AddressPayload {
        address account;
    }

    struct BoolPayload {
        bool value;
    }

    struct CharityMintPayload {
        uint256 charityId;
        uint256 amount;
    }

    struct ScoringWeightsPayload {
        uint256 weightLowMrTcoinLiquidity;
        uint256 weightHighCplTcoinLiquidity;
        uint256 weightUserPoolPreference;
        uint256 weightUserMerchantPreference;
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
    event LiquidityRouterUpdated(address indexed oldRouter, address indexed newRouter);
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
    address public liquidityRouter;
    address public tcoinToken;
    address public executionHelper;
    address public proposalHelper;
    address public routerProposalHelper;

    uint64 public defaultVotingWindow;
    uint256 public proposalCount;

    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => uint256)) private _stewardSnapshotWeight;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    mapping(uint256 => CharityAddPayload) private _charityAddPayloads;
    mapping(uint256 => CharityIdPayload) private _charityIdPayloads;
    mapping(uint256 => PoolAddPayload) private _poolAddPayloads;
    mapping(uint256 => PoolAddWithAddressPayload) private _poolAddWithAddressPayloads;
    mapping(uint256 => Bytes32IdPayload) private _bytes32IdPayloads;
    mapping(uint256 => MerchantApprovePayload) private _merchantApprovePayloads;
    mapping(uint256 => MerchantIdPayload) private _merchantIdPayloads;
    mapping(uint256 => MerchantPoolReassignPayload) private _merchantPoolReassignPayloads;
    mapping(uint256 => ReserveAssetAddPayload) private _reserveAssetAddPayloads;
    mapping(uint256 => ReserveOracleUpdatePayload) private _reserveOracleUpdatePayloads;
    mapping(uint256 => UIntPayload) private _uintPayloads;
    mapping(uint256 => AddressPayload) private _addressPayloads;
    mapping(uint256 => BoolPayload) private _boolPayloads;
    mapping(uint256 => CharityMintPayload) private _charityMintPayloads;
    mapping(uint256 => ScoringWeightsPayload) private _scoringWeightsPayloads;

    constructor(
        address initialOwner,
        address stewardRegistry_,
        address charityRegistry_,
        address poolRegistry_,
        address reserveRegistry_,
        address treasuryController_,
        address liquidityRouter_,
        address tcoinToken_,
        address executionHelper_,
        address proposalHelper_,
        address routerProposalHelper_,
        uint64 defaultVotingWindow_
    ) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
        _setStewardRegistry(stewardRegistry_);
        _setCharityRegistry(charityRegistry_);
        _setPoolRegistry(poolRegistry_);
        _setReserveRegistry(reserveRegistry_);
        _setTreasuryController(treasuryController_);
        _setLiquidityRouter(liquidityRouter_);
        _setTcoinToken(tcoinToken_);
        _setExecutionHelper(executionHelper_);
        _setProposalHelper(proposalHelper_);
        _setRouterProposalHelper(routerProposalHelper_);
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

    function setLiquidityRouter(address newRouter) external onlyOwner {
        _setLiquidityRouter(newRouter);
    }

    function setTcoinToken(address newToken) external onlyOwner {
        _setTcoinToken(newToken);
    }

    function setDefaultVotingWindow(uint64 newWindow) external onlyOwner {
        _setDefaultVotingWindow(newWindow);
    }

    function setExecutionHelper(address newHelper) external onlyOwner {
        _setExecutionHelper(newHelper);
    }

    function setProposalHelper(address newHelper) external onlyOwner {
        _setProposalHelper(newHelper);
    }

    function setRouterProposalHelper(address newHelper) external onlyOwner {
        _setRouterProposalHelper(newHelper);
    }

    fallback() external payable {
        address helper = _isRouterProposalSelector(msg.sig) ? routerProposalHelper : proposalHelper;
        if (helper == address(0)) revert Unauthorized();

        (bool ok, bytes memory result) = helper.delegatecall(msg.data);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }
        assembly ("memory-safe") {
            return(add(result, 0x20), mload(result))
        }
    }

    receive() external payable {
        revert Unauthorized();
    }

    /// @notice Cast a weighted steward vote on a pending proposal.
    /// @dev A proposal can move to Approved before deadline if quorum and majority conditions are met.
    function voteProposal(uint256 proposalId, bool support) external onlySteward onlyPendingProposal(proposalId) {
        Proposal storage proposal = _proposals[proposalId];
        if (block.timestamp > proposal.deadline) revert ProposalExpired(proposalId);
        if (hasVoted[proposalId][msg.sender]) revert ProposalAlreadyVoted(proposalId, msg.sender);

        uint256 weight = _stewardSnapshotWeight[proposalId][msg.sender];
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
        if (proposalType == ProposalType.CadPegUpdate) {
            _validateCadPegChange(_uintPayloads[proposalId].value);
        }
        (bool ok, bytes memory result) = executionHelper.delegatecall(
            abi.encodeCall(GovernanceExecutionHelper.execute, (proposalId, uint8(proposalType)))
        );
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }

        proposal.status = ProposalStatus.Executed;
        emit ProposalExecuted(proposalId, msg.sender);
    }

    /// @notice Owner-only cancellation hook for non-executed _proposals.
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
        return _stewardSnapshotWeight[proposalId][steward];
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
        proposal = _proposals[proposalId];
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

    function _setLiquidityRouter(address newRouter) internal {
        if (newRouter == address(0)) revert ZeroAddressRegistry();
        address old = liquidityRouter;
        liquidityRouter = newRouter;
        emit LiquidityRouterUpdated(old, newRouter);
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

    function _setExecutionHelper(address newHelper) internal {
        if (newHelper == address(0)) revert ZeroAddressTarget();
        executionHelper = newHelper;
    }

    function _setProposalHelper(address newHelper) internal {
        if (newHelper == address(0)) revert ZeroAddressTarget();
        proposalHelper = newHelper;
    }

    function _setRouterProposalHelper(address newHelper) internal {
        if (newHelper == address(0)) revert ZeroAddressTarget();
        routerProposalHelper = newHelper;
    }

    function _isRouterProposalSelector(bytes4 selector) internal pure returns (bool) {
        return selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetGovernance.selector
            || selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetTreasuryController.selector
            || selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetReserveInputRouter.selector
            || selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetCplTcoin.selector
            || selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetCharityPreferencesRegistry.selector
            || selector
                == GovernanceRouterProposalHelper.proposeLiquidityRouterSetAcceptancePreferencesRegistry.selector
            || selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetPoolRegistry.selector
            || selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetPoolAdapter.selector
            || selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetCharityTopupBps.selector
            || selector == GovernanceRouterProposalHelper.proposeLiquidityRouterSetScoringWeights.selector;
    }
}
