// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ICharityRegistry} from "./interfaces/ICharityRegistry.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {IReserveRegistry} from "./interfaces/IReserveRegistry.sol";
import {IStewardRegistry} from "./interfaces/IStewardRegistry.sol";
import {ITCOINToken} from "./interfaces/ITCOINToken.sol";
import {ILiquidityRouterGovernance} from "./interfaces/ILiquidityRouterGovernance.sol";
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

    uint64 public defaultVotingWindow;
    uint256 public proposalCount;

    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => uint256)) private _stewardSnapshotWeight;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    mapping(uint256 => CharityAddPayload) private _charityAddPayloads;
    mapping(uint256 => CharityIdPayload) private _charityIdPayloads;
    mapping(uint256 => PoolAddPayload) private _poolAddPayloads;
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

        if (proposalType == ProposalType.CharityAdd) {
            CharityAddPayload storage payload = _charityAddPayloads[proposalId];
            ICharityRegistry(charityRegistry).addCharity(payload.name, payload.wallet, payload.metadataRecordId);
        } else if (proposalType == ProposalType.CharityRemove) {
            ICharityRegistry(charityRegistry).removeCharity(_charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.CharitySuspend) {
            ICharityRegistry(charityRegistry).suspendCharity(_charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.CharityUnsuspend) {
            ICharityRegistry(charityRegistry).unsuspendCharity(_charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.SetDefaultCharity) {
            ICharityRegistry(charityRegistry).setDefaultCharity(_charityIdPayloads[proposalId].charityId);
        } else if (proposalType == ProposalType.PoolAdd) {
            PoolAddPayload storage payload = _poolAddPayloads[proposalId];
            IPoolRegistry(poolRegistry).addPool(payload.poolId, payload.name, payload.metadataRecordId);
        } else if (proposalType == ProposalType.PoolRemove) {
            IPoolRegistry(poolRegistry).removePool(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.PoolSuspend) {
            IPoolRegistry(poolRegistry).suspendPool(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.PoolUnsuspend) {
            IPoolRegistry(poolRegistry).unsuspendPool(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.MerchantApprove) {
            MerchantApprovePayload storage payload = _merchantApprovePayloads[proposalId];
            IPoolRegistry(poolRegistry)
                .approveMerchant(payload.merchantId, payload.poolId, payload.metadataRecordId, payload.initialWallets);
        } else if (proposalType == ProposalType.MerchantRemove) {
            IPoolRegistry(poolRegistry).removeMerchant(_merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == ProposalType.MerchantSuspend) {
            IPoolRegistry(poolRegistry).suspendMerchant(_merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == ProposalType.MerchantUnsuspend) {
            IPoolRegistry(poolRegistry).unsuspendMerchant(_merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == ProposalType.MerchantPoolReassign) {
            MerchantPoolReassignPayload storage payload = _merchantPoolReassignPayloads[proposalId];
            IPoolRegistry(poolRegistry).reassignMerchantPool(payload.merchantId, payload.newPoolId);
        } else if (proposalType == ProposalType.ReserveAssetAdd) {
            ReserveAssetAddPayload storage payload = _reserveAssetAddPayloads[proposalId];
            IReserveRegistry(reserveRegistry)
                .addReserveAsset(
                    payload.assetId,
                    payload.token,
                    payload.code,
                    payload.tokenDecimals,
                    payload.primaryOracle,
                    payload.fallbackOracle,
                    payload.staleAfter
                );
        } else if (proposalType == ProposalType.ReserveAssetRemove) {
            IReserveRegistry(reserveRegistry).removeReserveAsset(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveAssetPause) {
            IReserveRegistry(reserveRegistry).pauseReserveAsset(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveAssetUnpause) {
            IReserveRegistry(reserveRegistry).unpauseReserveAsset(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.ReserveOracleUpdate) {
            ReserveOracleUpdatePayload storage payload = _reserveOracleUpdatePayloads[proposalId];
            IReserveRegistry(reserveRegistry)
                .updateReserveAssetOracles(payload.assetId, payload.primaryOracle, payload.fallbackOracle);
            IReserveRegistry(reserveRegistry).updateReserveAssetStaleness(payload.assetId, payload.staleAfter);
        } else if (proposalType == ProposalType.CadPegUpdate) {
            uint256 newCadPeg18 = _uintPayloads[proposalId].value;
            _validateCadPegChange(newCadPeg18);
            ITreasuryController(treasuryController).setCadPeg(newCadPeg18);
        } else if (proposalType == ProposalType.UserRedeemRateUpdate) {
            ITreasuryController(treasuryController).setUserRedeemRate(_uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.MerchantRedeemRateUpdate) {
            ITreasuryController(treasuryController).setMerchantRedeemRate(_uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.CharityMintRateUpdate) {
            ITreasuryController(treasuryController).setCharityMintRate(_uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.OvercollateralizationTargetUpdate) {
            ITreasuryController(treasuryController).setOvercollateralizationTarget(_uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.CharityMintFromExcess) {
            CharityMintPayload storage payload = _charityMintPayloads[proposalId];
            if (payload.charityId == 0) {
                ITreasuryController(treasuryController).mintToCharity(payload.amount);
            } else {
                ITreasuryController(treasuryController).mintToCharity(payload.charityId, payload.amount);
            }
        } else if (proposalType == ProposalType.ExpirePeriodUpdate) {
            ITCOINToken(tcoinToken).setExpirePeriod(_uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.TreasuryControllerSetTreasury) {
            ITreasuryController(treasuryController).setTreasury(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerSetGovernance) {
            ITreasuryController(treasuryController).setGovernance(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerSetIndexer) {
            ITreasuryController(treasuryController).setIndexer(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerSetLiquidityRouter) {
            ITreasuryController(treasuryController).setLiquidityRouter(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerSetTcoinToken) {
            ITreasuryController(treasuryController).setTcoinToken(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerSetReserveRegistry) {
            ITreasuryController(treasuryController).setReserveRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerSetCharityRegistry) {
            ITreasuryController(treasuryController).setCharityRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerSetPoolRegistry) {
            ITreasuryController(treasuryController).setPoolRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerSetOracleRouter) {
            ITreasuryController(treasuryController).setOracleRouter(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.TreasuryControllerPauseMinting) {
            ITreasuryController(treasuryController).pauseMinting();
        } else if (proposalType == ProposalType.TreasuryControllerUnpauseMinting) {
            ITreasuryController(treasuryController).unpauseMinting();
        } else if (proposalType == ProposalType.TreasuryControllerPauseRedemption) {
            ITreasuryController(treasuryController).pauseRedemption();
        } else if (proposalType == ProposalType.TreasuryControllerUnpauseRedemption) {
            ITreasuryController(treasuryController).unpauseRedemption();
        } else if (proposalType == ProposalType.TreasuryControllerPauseAsset) {
            ITreasuryController(treasuryController).pauseAssetForTreasury(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.TreasuryControllerUnpauseAsset) {
            ITreasuryController(treasuryController).unpauseAssetForTreasury(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == ProposalType.TreasuryControllerSetAdminCanMintToCharity) {
            ITreasuryController(treasuryController).setAdminCanMintToCharity(_boolPayloads[proposalId].value);
        } else if (proposalType == ProposalType.LiquidityRouterSetGovernance) {
            ILiquidityRouterGovernance(liquidityRouter).setGovernance(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.LiquidityRouterSetTreasuryController) {
            ILiquidityRouterGovernance(liquidityRouter).setTreasuryController(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.LiquidityRouterSetCplTcoin) {
            ILiquidityRouterGovernance(liquidityRouter).setCplTcoin(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.LiquidityRouterSetCharityPreferencesRegistry) {
            ILiquidityRouterGovernance(liquidityRouter)
                .setCharityPreferencesRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.LiquidityRouterSetAcceptancePreferencesRegistry) {
            ILiquidityRouterGovernance(liquidityRouter)
                .setAcceptancePreferencesRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.LiquidityRouterSetPoolRegistry) {
            ILiquidityRouterGovernance(liquidityRouter).setPoolRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.LiquidityRouterSetPoolAdapter) {
            ILiquidityRouterGovernance(liquidityRouter).setPoolAdapter(_addressPayloads[proposalId].account);
        } else if (proposalType == ProposalType.LiquidityRouterSetCharityTopupBps) {
            ILiquidityRouterGovernance(liquidityRouter).setCharityTopupBps(_uintPayloads[proposalId].value);
        } else if (proposalType == ProposalType.LiquidityRouterSetScoringWeights) {
            ScoringWeightsPayload storage payload = _scoringWeightsPayloads[proposalId];
            ILiquidityRouterGovernance(liquidityRouter)
                .setScoringWeights(
                    payload.weightLowMrTcoinLiquidity,
                    payload.weightHighCplTcoinLiquidity,
                    payload.weightUserPoolPreference,
                    payload.weightUserMerchantPreference
                );
        } else {
            revert InvalidProposalValue();
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
}
