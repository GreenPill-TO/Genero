// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICharityRegistry} from "./interfaces/ICharityRegistry.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {IReserveRegistry} from "./interfaces/IReserveRegistry.sol";
import {ITCOINToken} from "./interfaces/ITCOINToken.sol";
import {ILiquidityRouterGovernance} from "./interfaces/ILiquidityRouterGovernance.sol";
import {ITreasuryController} from "./interfaces/ITreasuryController.sol";

abstract contract GovernanceExecutionStorage {
    struct Proposal {
        uint256 proposalId;
        uint8 proposalType;
        uint8 status;
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

contract GovernanceExecutionHelper is GovernanceExecutionStorage {
    uint8 internal constant CHARITY_ADD = 0;
    uint8 internal constant CHARITY_REMOVE = 1;
    uint8 internal constant CHARITY_SUSPEND = 2;
    uint8 internal constant CHARITY_UNSUSPEND = 3;
    uint8 internal constant SET_DEFAULT_CHARITY = 4;
    uint8 internal constant POOL_ADD = 5;
    uint8 internal constant POOL_REMOVE = 6;
    uint8 internal constant POOL_SUSPEND = 7;
    uint8 internal constant POOL_UNSUSPEND = 8;
    uint8 internal constant MERCHANT_APPROVE = 9;
    uint8 internal constant MERCHANT_REMOVE = 10;
    uint8 internal constant MERCHANT_SUSPEND = 11;
    uint8 internal constant MERCHANT_UNSUSPEND = 12;
    uint8 internal constant MERCHANT_POOL_REASSIGN = 13;
    uint8 internal constant RESERVE_ASSET_ADD = 14;
    uint8 internal constant RESERVE_ASSET_REMOVE = 15;
    uint8 internal constant RESERVE_ASSET_PAUSE = 16;
    uint8 internal constant RESERVE_ASSET_UNPAUSE = 17;
    uint8 internal constant RESERVE_ORACLE_UPDATE = 18;
    uint8 internal constant CAD_PEG_UPDATE = 19;
    uint8 internal constant USER_REDEEM_RATE_UPDATE = 20;
    uint8 internal constant MERCHANT_REDEEM_RATE_UPDATE = 21;
    uint8 internal constant CHARITY_MINT_RATE_UPDATE = 22;
    uint8 internal constant OVERCOLLATERALIZATION_TARGET_UPDATE = 23;
    uint8 internal constant CHARITY_MINT_FROM_EXCESS = 24;
    uint8 internal constant EXPIRE_PERIOD_UPDATE = 25;
    uint8 internal constant TREASURY_CONTROLLER_SET_TREASURY = 26;
    uint8 internal constant TREASURY_CONTROLLER_SET_GOVERNANCE = 27;
    uint8 internal constant TREASURY_CONTROLLER_SET_INDEXER = 28;
    uint8 internal constant TREASURY_CONTROLLER_SET_LIQUIDITY_ROUTER = 29;
    uint8 internal constant TREASURY_CONTROLLER_SET_TCOIN_TOKEN = 30;
    uint8 internal constant TREASURY_CONTROLLER_SET_RESERVE_REGISTRY = 31;
    uint8 internal constant TREASURY_CONTROLLER_SET_CHARITY_REGISTRY = 32;
    uint8 internal constant TREASURY_CONTROLLER_SET_POOL_REGISTRY = 33;
    uint8 internal constant TREASURY_CONTROLLER_SET_ORACLE_ROUTER = 34;
    uint8 internal constant TREASURY_CONTROLLER_PAUSE_MINTING = 35;
    uint8 internal constant TREASURY_CONTROLLER_UNPAUSE_MINTING = 36;
    uint8 internal constant TREASURY_CONTROLLER_PAUSE_REDEMPTION = 37;
    uint8 internal constant TREASURY_CONTROLLER_UNPAUSE_REDEMPTION = 38;
    uint8 internal constant TREASURY_CONTROLLER_PAUSE_ASSET = 39;
    uint8 internal constant TREASURY_CONTROLLER_UNPAUSE_ASSET = 40;
    uint8 internal constant TREASURY_CONTROLLER_SET_ADMIN_CAN_MINT_TO_CHARITY = 41;
    uint8 internal constant LIQUIDITY_ROUTER_SET_GOVERNANCE = 42;
    uint8 internal constant LIQUIDITY_ROUTER_SET_TREASURY_CONTROLLER = 43;
    uint8 internal constant LIQUIDITY_ROUTER_SET_RESERVE_INPUT_ROUTER = 44;
    uint8 internal constant LIQUIDITY_ROUTER_SET_CPL_TCOIN = 45;
    uint8 internal constant LIQUIDITY_ROUTER_SET_CHARITY_PREFERENCES_REGISTRY = 46;
    uint8 internal constant LIQUIDITY_ROUTER_SET_ACCEPTANCE_PREFERENCES_REGISTRY = 47;
    uint8 internal constant LIQUIDITY_ROUTER_SET_POOL_REGISTRY = 48;
    uint8 internal constant LIQUIDITY_ROUTER_SET_POOL_ADAPTER = 49;
    uint8 internal constant LIQUIDITY_ROUTER_SET_CHARITY_TOPUP_BPS = 50;
    uint8 internal constant LIQUIDITY_ROUTER_SET_SCORING_WEIGHTS = 51;

    error InvalidProposalType(uint8 proposalType);

    function execute(uint256 proposalId, uint8 proposalType) external {
        if (proposalType == CHARITY_ADD) {
            CharityAddPayload storage payload = _charityAddPayloads[proposalId];
            ICharityRegistry(charityRegistry).addCharity(payload.name, payload.wallet, payload.metadataRecordId);
        } else if (proposalType == CHARITY_REMOVE) {
            ICharityRegistry(charityRegistry).removeCharity(_charityIdPayloads[proposalId].charityId);
        } else if (proposalType == CHARITY_SUSPEND) {
            ICharityRegistry(charityRegistry).suspendCharity(_charityIdPayloads[proposalId].charityId);
        } else if (proposalType == CHARITY_UNSUSPEND) {
            ICharityRegistry(charityRegistry).unsuspendCharity(_charityIdPayloads[proposalId].charityId);
        } else if (proposalType == SET_DEFAULT_CHARITY) {
            ICharityRegistry(charityRegistry).setDefaultCharity(_charityIdPayloads[proposalId].charityId);
        } else if (proposalType == POOL_ADD) {
            PoolAddPayload storage payload = _poolAddPayloads[proposalId];
            IPoolRegistry(poolRegistry).addPool(payload.poolId, payload.name, payload.metadataRecordId);
        } else if (proposalType == POOL_REMOVE) {
            IPoolRegistry(poolRegistry).removePool(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == POOL_SUSPEND) {
            IPoolRegistry(poolRegistry).suspendPool(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == POOL_UNSUSPEND) {
            IPoolRegistry(poolRegistry).unsuspendPool(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == MERCHANT_APPROVE) {
            MerchantApprovePayload storage payload = _merchantApprovePayloads[proposalId];
            IPoolRegistry(poolRegistry)
                .approveMerchant(payload.merchantId, payload.poolId, payload.metadataRecordId, payload.initialWallets);
        } else if (proposalType == MERCHANT_REMOVE) {
            IPoolRegistry(poolRegistry).removeMerchant(_merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == MERCHANT_SUSPEND) {
            IPoolRegistry(poolRegistry).suspendMerchant(_merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == MERCHANT_UNSUSPEND) {
            IPoolRegistry(poolRegistry).unsuspendMerchant(_merchantIdPayloads[proposalId].merchantId);
        } else if (proposalType == MERCHANT_POOL_REASSIGN) {
            MerchantPoolReassignPayload storage payload = _merchantPoolReassignPayloads[proposalId];
            IPoolRegistry(poolRegistry).reassignMerchantPool(payload.merchantId, payload.newPoolId);
        } else if (proposalType == RESERVE_ASSET_ADD) {
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
        } else if (proposalType == RESERVE_ASSET_REMOVE) {
            IReserveRegistry(reserveRegistry).removeReserveAsset(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == RESERVE_ASSET_PAUSE) {
            IReserveRegistry(reserveRegistry).pauseReserveAsset(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == RESERVE_ASSET_UNPAUSE) {
            IReserveRegistry(reserveRegistry).unpauseReserveAsset(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == RESERVE_ORACLE_UPDATE) {
            ReserveOracleUpdatePayload storage payload = _reserveOracleUpdatePayloads[proposalId];
            IReserveRegistry(reserveRegistry)
                .updateReserveAssetOracles(payload.assetId, payload.primaryOracle, payload.fallbackOracle);
            IReserveRegistry(reserveRegistry).updateReserveAssetStaleness(payload.assetId, payload.staleAfter);
        } else if (proposalType == CAD_PEG_UPDATE) {
            ITreasuryController(treasuryController).setCadPeg(_uintPayloads[proposalId].value);
        } else if (proposalType == USER_REDEEM_RATE_UPDATE) {
            ITreasuryController(treasuryController).setUserRedeemRate(_uintPayloads[proposalId].value);
        } else if (proposalType == MERCHANT_REDEEM_RATE_UPDATE) {
            ITreasuryController(treasuryController).setMerchantRedeemRate(_uintPayloads[proposalId].value);
        } else if (proposalType == CHARITY_MINT_RATE_UPDATE) {
            ITreasuryController(treasuryController).setCharityMintRate(_uintPayloads[proposalId].value);
        } else if (proposalType == OVERCOLLATERALIZATION_TARGET_UPDATE) {
            ITreasuryController(treasuryController).setOvercollateralizationTarget(_uintPayloads[proposalId].value);
        } else if (proposalType == CHARITY_MINT_FROM_EXCESS) {
            CharityMintPayload storage payload = _charityMintPayloads[proposalId];
            if (payload.charityId == 0) {
                ITreasuryController(treasuryController).mintToCharity(payload.amount);
            } else {
                ITreasuryController(treasuryController).mintToCharity(payload.charityId, payload.amount);
            }
        } else if (proposalType == EXPIRE_PERIOD_UPDATE) {
            ITCOINToken(tcoinToken).setExpirePeriod(_uintPayloads[proposalId].value);
        } else if (proposalType == TREASURY_CONTROLLER_SET_TREASURY) {
            ITreasuryController(treasuryController).setTreasury(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_SET_GOVERNANCE) {
            ITreasuryController(treasuryController).setGovernance(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_SET_INDEXER) {
            ITreasuryController(treasuryController).setIndexer(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_SET_LIQUIDITY_ROUTER) {
            ITreasuryController(treasuryController).setLiquidityRouter(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_SET_TCOIN_TOKEN) {
            ITreasuryController(treasuryController).setTcoinToken(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_SET_RESERVE_REGISTRY) {
            ITreasuryController(treasuryController).setReserveRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_SET_CHARITY_REGISTRY) {
            ITreasuryController(treasuryController).setCharityRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_SET_POOL_REGISTRY) {
            ITreasuryController(treasuryController).setPoolRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_SET_ORACLE_ROUTER) {
            ITreasuryController(treasuryController).setOracleRouter(_addressPayloads[proposalId].account);
        } else if (proposalType == TREASURY_CONTROLLER_PAUSE_MINTING) {
            ITreasuryController(treasuryController).pauseMinting();
        } else if (proposalType == TREASURY_CONTROLLER_UNPAUSE_MINTING) {
            ITreasuryController(treasuryController).unpauseMinting();
        } else if (proposalType == TREASURY_CONTROLLER_PAUSE_REDEMPTION) {
            ITreasuryController(treasuryController).pauseRedemption();
        } else if (proposalType == TREASURY_CONTROLLER_UNPAUSE_REDEMPTION) {
            ITreasuryController(treasuryController).unpauseRedemption();
        } else if (proposalType == TREASURY_CONTROLLER_PAUSE_ASSET) {
            ITreasuryController(treasuryController).pauseAssetForTreasury(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == TREASURY_CONTROLLER_UNPAUSE_ASSET) {
            ITreasuryController(treasuryController).unpauseAssetForTreasury(_bytes32IdPayloads[proposalId].id);
        } else if (proposalType == TREASURY_CONTROLLER_SET_ADMIN_CAN_MINT_TO_CHARITY) {
            ITreasuryController(treasuryController).setAdminCanMintToCharity(_boolPayloads[proposalId].value);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_GOVERNANCE) {
            ILiquidityRouterGovernance(liquidityRouter).setGovernance(_addressPayloads[proposalId].account);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_TREASURY_CONTROLLER) {
            ILiquidityRouterGovernance(liquidityRouter).setTreasuryController(_addressPayloads[proposalId].account);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_RESERVE_INPUT_ROUTER) {
            ILiquidityRouterGovernance(liquidityRouter).setReserveInputRouter(_addressPayloads[proposalId].account);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_CPL_TCOIN) {
            ILiquidityRouterGovernance(liquidityRouter).setCplTcoin(_addressPayloads[proposalId].account);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_CHARITY_PREFERENCES_REGISTRY) {
            ILiquidityRouterGovernance(liquidityRouter)
                .setCharityPreferencesRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_ACCEPTANCE_PREFERENCES_REGISTRY) {
            ILiquidityRouterGovernance(liquidityRouter)
                .setAcceptancePreferencesRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_POOL_REGISTRY) {
            ILiquidityRouterGovernance(liquidityRouter).setPoolRegistry(_addressPayloads[proposalId].account);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_POOL_ADAPTER) {
            ILiquidityRouterGovernance(liquidityRouter).setPoolAdapter(_addressPayloads[proposalId].account);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_CHARITY_TOPUP_BPS) {
            ILiquidityRouterGovernance(liquidityRouter).setCharityTopupBps(_uintPayloads[proposalId].value);
        } else if (proposalType == LIQUIDITY_ROUTER_SET_SCORING_WEIGHTS) {
            ScoringWeightsPayload storage payload = _scoringWeightsPayloads[proposalId];
            ILiquidityRouterGovernance(liquidityRouter)
                .setScoringWeights(
                    payload.weightLowMrTcoinLiquidity,
                    payload.weightHighCplTcoinLiquidity,
                    payload.weightUserPoolPreference,
                    payload.weightUserMerchantPreference
                );
        } else {
            revert InvalidProposalType(proposalType);
        }
    }
}
