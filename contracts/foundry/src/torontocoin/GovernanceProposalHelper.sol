// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IStewardRegistry} from "./interfaces/IStewardRegistry.sol";
import {ITreasuryController} from "./interfaces/ITreasuryController.sol";

abstract contract GovernanceProposalStorage {
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant CAD_PEG_MAX_DELTA_BPS = 1_000;

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
        LiquidityRouterSetScoringWeights
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

    address private _owner;
    uint256 private _status;

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

    mapping(uint256 => Proposal) internal _proposals;
    mapping(uint256 => mapping(address => uint256)) internal _stewardSnapshotWeight;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    mapping(uint256 => CharityAddPayload) internal _charityAddPayloads;
    mapping(uint256 => CharityIdPayload) internal _charityIdPayloads;
    mapping(uint256 => PoolAddPayload) internal _poolAddPayloads;
    mapping(uint256 => Bytes32IdPayload) internal _bytes32IdPayloads;
    mapping(uint256 => MerchantApprovePayload) internal _merchantApprovePayloads;
    mapping(uint256 => MerchantIdPayload) internal _merchantIdPayloads;
    mapping(uint256 => MerchantPoolReassignPayload) internal _merchantPoolReassignPayloads;
    mapping(uint256 => ReserveAssetAddPayload) internal _reserveAssetAddPayloads;
    mapping(uint256 => ReserveOracleUpdatePayload) internal _reserveOracleUpdatePayloads;
    mapping(uint256 => UIntPayload) internal _uintPayloads;
    mapping(uint256 => AddressPayload) internal _addressPayloads;
    mapping(uint256 => BoolPayload) internal _boolPayloads;
    mapping(uint256 => CharityMintPayload) internal _charityMintPayloads;
    mapping(uint256 => ScoringWeightsPayload) internal _scoringWeightsPayloads;
}

contract GovernanceProposalHelper is GovernanceProposalStorage {
    error NotSteward(address caller);
    error InvalidVotingWindow();
    error InvalidProposalValue();
    error ZeroAddressTarget();
    error EmptyString();
    error InvalidPegChange(uint256 oldPeg, uint256 newPeg);

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

    function proposeCharityAdd(
        string calldata name,
        address wallet,
        string calldata metadataRecordId,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (bytes(name).length == 0) revert EmptyString();
        if (wallet == address(0)) revert ZeroAddressTarget();
        proposalId = _createProposal(ProposalType.CharityAdd, votingWindow);
        _charityAddPayloads[proposalId] =
            CharityAddPayload({name: name, wallet: wallet, metadataRecordId: metadataRecordId});
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

    function proposePoolAdd(bytes32 poolId, string calldata name, string calldata metadataRecordId, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (poolId == bytes32(0)) revert InvalidProposalValue();
        if (bytes(name).length == 0) revert EmptyString();
        proposalId = _createProposal(ProposalType.PoolAdd, votingWindow);
        _poolAddPayloads[proposalId] = PoolAddPayload({poolId: poolId, name: name, metadataRecordId: metadataRecordId});
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
        bytes32 merchantId,
        bytes32 poolId,
        string calldata metadataRecordId,
        address[] calldata initialWallets,
        uint64 votingWindow
    ) external onlySteward returns (uint256 proposalId) {
        if (merchantId == bytes32(0)) revert InvalidProposalValue();
        if (poolId == bytes32(0)) revert InvalidProposalValue();

        proposalId = _createProposal(ProposalType.MerchantApprove, votingWindow);
        MerchantApprovePayload storage payload = _merchantApprovePayloads[proposalId];
        payload.merchantId = merchantId;
        payload.poolId = poolId;
        payload.metadataRecordId = metadataRecordId;

        for (uint256 i = 0; i < initialWallets.length; ++i) {
            if (initialWallets[i] == address(0)) revert ZeroAddressTarget();
            payload.initialWallets.push(initialWallets[i]);
        }
    }

    function proposeMerchantRemove(bytes32 merchantId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantId(ProposalType.MerchantRemove, merchantId, votingWindow);
    }

    function proposeMerchantSuspend(bytes32 merchantId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantId(ProposalType.MerchantSuspend, merchantId, votingWindow);
    }

    function proposeMerchantUnsuspend(bytes32 merchantId, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeMerchantId(ProposalType.MerchantUnsuspend, merchantId, votingWindow);
    }

    function proposeMerchantPoolReassign(bytes32 merchantId, bytes32 newPoolId, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (merchantId == bytes32(0)) revert InvalidProposalValue();
        if (newPoolId == bytes32(0)) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.MerchantPoolReassign, votingWindow);
        _merchantPoolReassignPayloads[proposalId] =
            MerchantPoolReassignPayload({merchantId: merchantId, newPoolId: newPoolId});
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
        _reserveAssetAddPayloads[proposalId] = ReserveAssetAddPayload({
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
        _reserveOracleUpdatePayloads[proposalId] = ReserveOracleUpdatePayload({
            assetId: assetId, primaryOracle: primaryOracle, fallbackOracle: fallbackOracle, staleAfter: staleAfter
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
        _uintPayloads[proposalId] = UIntPayload({value: newCadPeg18});
    }

    function proposeUserRedeemRateUpdate(uint256 newRateBps, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
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

    function proposeExpirePeriodUpdate(uint256 newExpirePeriod, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (newExpirePeriod == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.ExpirePeriodUpdate, votingWindow);
        _uintPayloads[proposalId] = UIntPayload({value: newExpirePeriod});
    }

    function proposeOvercollateralizationTargetUpdate(uint256 newTarget18, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (newTarget18 == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.OvercollateralizationTargetUpdate, votingWindow);
        _uintPayloads[proposalId] = UIntPayload({value: newTarget18});
    }

    function proposeMintToDefaultCharity(uint256 amount, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (amount == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.CharityMintFromExcess, votingWindow);
        _charityMintPayloads[proposalId] = CharityMintPayload({charityId: 0, amount: amount});
    }

    function proposeMintToCharity(uint256 charityId, uint256 amount, uint64 votingWindow)
        external
        onlySteward
        returns (uint256 proposalId)
    {
        if (charityId == 0) revert InvalidProposalValue();
        if (amount == 0) revert InvalidProposalValue();
        proposalId = _createProposal(ProposalType.CharityMintFromExcess, votingWindow);
        _charityMintPayloads[proposalId] = CharityMintPayload({charityId: charityId, amount: amount});
    }

    function proposeTreasuryControllerSetTreasury(address treasury_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetTreasury, treasury_, votingWindow);
    }

    function proposeTreasuryControllerSetGovernance(address governance_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetGovernance, governance_, votingWindow);
    }

    function proposeTreasuryControllerSetIndexer(address indexer_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetIndexer, indexer_, votingWindow);
    }

    function proposeTreasuryControllerSetLiquidityRouter(address liquidityRouter_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetLiquidityRouter, liquidityRouter_, votingWindow);
    }

    function proposeTreasuryControllerSetTcoinToken(address tcoinToken_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetTcoinToken, tcoinToken_, votingWindow);
    }

    function proposeTreasuryControllerSetReserveRegistry(address reserveRegistry_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetReserveRegistry, reserveRegistry_, votingWindow);
    }

    function proposeTreasuryControllerSetCharityRegistry(address charityRegistry_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetCharityRegistry, charityRegistry_, votingWindow);
    }

    function proposeTreasuryControllerSetPoolRegistry(address poolRegistry_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetPoolRegistry, poolRegistry_, votingWindow);
    }

    function proposeTreasuryControllerSetOracleRouter(address oracleRouter_, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeAddressTarget(ProposalType.TreasuryControllerSetOracleRouter, oracleRouter_, votingWindow);
    }

    function proposeTreasuryControllerPauseMinting(uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeNoPayload(ProposalType.TreasuryControllerPauseMinting, votingWindow);
    }

    function proposeTreasuryControllerUnpauseMinting(uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeNoPayload(ProposalType.TreasuryControllerUnpauseMinting, votingWindow);
    }

    function proposeTreasuryControllerPauseRedemption(uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeNoPayload(ProposalType.TreasuryControllerPauseRedemption, votingWindow);
    }

    function proposeTreasuryControllerUnpauseRedemption(uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeNoPayload(ProposalType.TreasuryControllerUnpauseRedemption, votingWindow);
    }

    function proposeTreasuryControllerPauseAsset(bytes32 assetId, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeBytes32Id(ProposalType.TreasuryControllerPauseAsset, assetId, votingWindow);
    }

    function proposeTreasuryControllerUnpauseAsset(bytes32 assetId, uint64 votingWindow)
        external
        onlySteward
        returns (uint256)
    {
        return _proposeBytes32Id(ProposalType.TreasuryControllerUnpauseAsset, assetId, votingWindow);
    }

    function proposeSetAdminCanMintToCharity(bool enabled, uint64 votingWindow) external onlySteward returns (uint256) {
        return _proposeBool(ProposalType.TreasuryControllerSetAdminCanMintToCharity, enabled, votingWindow);
    }

    function _proposeCharityId(ProposalType proposalType, uint256 charityId, uint64 votingWindow)
        internal
        returns (uint256 proposalId)
    {
        if (charityId == 0) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        _charityIdPayloads[proposalId] = CharityIdPayload({charityId: charityId});
    }

    function _proposeBytes32Id(ProposalType proposalType, bytes32 id, uint64 votingWindow)
        internal
        returns (uint256 proposalId)
    {
        if (id == bytes32(0)) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        _bytes32IdPayloads[proposalId] = Bytes32IdPayload({id: id});
    }

    function _proposeMerchantId(ProposalType proposalType, bytes32 merchantId, uint64 votingWindow)
        internal
        returns (uint256 proposalId)
    {
        if (merchantId == bytes32(0)) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        _merchantIdPayloads[proposalId] = MerchantIdPayload({merchantId: merchantId});
    }

    function _proposeRateLike(ProposalType proposalType, uint256 value, uint64 votingWindow)
        internal
        returns (uint256 proposalId)
    {
        if (value > BPS_DENOMINATOR) revert InvalidProposalValue();
        proposalId = _createProposal(proposalType, votingWindow);
        _uintPayloads[proposalId] = UIntPayload({value: value});
    }

    function _proposeAddressTarget(ProposalType proposalType, address account, uint64 votingWindow)
        internal
        returns (uint256 proposalId)
    {
        if (account == address(0)) revert ZeroAddressTarget();
        proposalId = _createProposal(proposalType, votingWindow);
        _addressPayloads[proposalId] = AddressPayload({account: account});
    }

    function _proposeBool(ProposalType proposalType, bool value, uint64 votingWindow)
        internal
        returns (uint256 proposalId)
    {
        proposalId = _createProposal(proposalType, votingWindow);
        _boolPayloads[proposalId] = BoolPayload({value: value});
    }

    function _proposeNoPayload(ProposalType proposalType, uint64 votingWindow) internal returns (uint256 proposalId) {
        proposalId = _createProposal(proposalType, votingWindow);
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
            _stewardSnapshotWeight[proposalId][steward] = weight;
            totalSnapshotWeight += weight;
        }
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
}
