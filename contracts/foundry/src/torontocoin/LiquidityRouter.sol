// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITreasuryControllerForLiquidityRouter {
    function depositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount, address payer)
        external
        returns (uint256 mrTcoinOut);

    function previewDepositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 mrTcoinOut, uint256 cadValue18, bool usedFallbackOracle);

    function getReserveAssetToken(bytes32 assetId) external view returns (address token);
    function treasury() external view returns (address);
    function tcoinToken() external view returns (address);
    function resolveAcceptedReserveAsset(address token)
        external
        view
        returns (bool accepted, bytes32 assetId, address reserveToken);
}

interface ICplTcoinForLiquidityRouter {
    function mint(address to, uint256 amount, bytes calldata data) external;
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IUserCharityPreferencesRegistryForLiquidityRouter {
    function resolveFeePreferences(address user)
        external
        view
        returns (uint256 resolvedCharityId, address charityWallet, uint16 voluntaryFeeBps);
}

interface IUserAcceptancePreferencesRegistryForLiquidityRouter {
    function getRoutingPreferences(address user)
        external
        view
        returns (
            bool strictAcceptedOnly_,
            bytes32[] memory acceptedPoolIds_,
            bytes32[] memory deniedPoolIds_,
            bytes32[] memory acceptedMerchantIds_,
            bytes32[] memory deniedMerchantIds_,
            bytes32[] memory preferredMerchantIds_,
            address[] memory acceptedTokenAddresses_,
            address[] memory deniedTokenAddresses_,
            address[] memory preferredTokenAddresses_
        );
}

interface IPoolRegistryForLiquidityRouter {
    function listPoolIds() external view returns (bytes32[] memory);
    function isPoolActive(bytes32 poolId) external view returns (bool);
}

interface IPoolAdapter {
    function getPoolLiquidityState(bytes32 poolId)
        external
        view
        returns (uint256 mrTcoinLiquidity, uint256 cplTcoinLiquidity, bool active);

    function previewBuyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn)
        external
        view
        returns (uint256 cplTcoinOut);

    function buyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn, uint256 minCplTcoinOut, address recipient)
        external
        returns (uint256 cplTcoinOut);

    function poolMatchesAnyMerchantIds(bytes32 poolId, bytes32[] memory merchantIds)
        external
        view
        returns (bool matches);

    function getPoolAccount(bytes32 poolId) external view returns (address poolAccount);
}

interface IReserveInputRouterForLiquidityRouter {
    function normalizeReserveInput(address tokenIn, uint256 amountIn, uint256 minReserveOut, address payer)
        external
        returns (bytes32 reserveAssetId, address reserveToken, uint256 reserveAmountOut);

    function previewNormalizeReserveInput(address tokenIn, uint256 amountIn)
        external
        view
        returns (
            bool directAccepted,
            bool requiresSwap,
            bytes32 reserveAssetId,
            address reserveToken,
            uint256 reserveAmountOut
        );
}

contract LiquidityRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct PoolSelection {
        bytes32 poolId;
        uint256 score;
        uint256 cplTcoinOut;
        bool found;
    }

    struct PoolCandidate {
        uint256 score;
        uint256 cplTcoinOut;
        bool eligible;
    }

    struct ReserveDepositContext {
        bytes32 reserveAssetId;
        address reserveToken;
        uint256 reserveAmount;
        uint256 mrTcoinOut;
        address mrTcoinToken;
    }

    struct CharityResolution {
        uint256 charityId;
        address charityWallet;
    }

    struct BuyRequest {
        address inputToken;
        uint256 inputAmount;
        uint256 minReserveOut;
        uint256 minCplTcoinOut;
        address buyer;
    }

    struct PurchaseResult {
        bytes32 selectedPoolId;
        bytes32 reserveAssetId;
        uint256 reserveAmountUsed;
        uint256 mrTcoinUsed;
        uint256 cplTcoinOut;
        uint256 charityTopupOut;
        uint256 resolvedCharityId;
        address charityWallet;
    }

    struct AcceptanceContext {
        bool strictAcceptedOnly;
        bytes32[] acceptedPoolIds;
        bytes32[] deniedPoolIds;
        bytes32[] acceptedMerchantIds;
        bytes32[] deniedMerchantIds;
        bytes32[] preferredMerchantIds;
        address[] acceptedTokenAddresses;
        address[] deniedTokenAddresses;
        address[] preferredTokenAddresses;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressDependency();
    error ZeroAddressToken();
    error ZeroPoolId();
    error ZeroAmount();
    error InvalidBps(uint256 bps);
    error InvalidReserveOut(uint256 actualOut, uint256 minOut);
    error UnsupportedReserveInput(address token);
    error Unauthorized();
    error SameAddress();
    error NoEligiblePool();
    error InvalidPoolAccount(bytes32 poolId);
    error InvalidCharityResolution(uint256 charityId);

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event TreasuryControllerUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ReserveInputRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event CplTcoinUpdated(address indexed oldToken, address indexed newToken);
    event CharityPreferencesRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event AcceptancePreferencesRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);

    event CharityTopupBpsUpdated(uint256 oldBps, uint256 newBps);
    event ScoringWeightsUpdated(
        uint256 weightLowMrTcoinLiquidity,
        uint256 weightHighCplTcoinLiquidity,
        uint256 weightUserPoolPreference,
        uint256 weightUserMerchantPreference
    );

    event PoolSeeded(bytes32 indexed poolId, uint256 amount, address indexed actor);
    event PoolToppedUp(bytes32 indexed poolId, uint256 amount, address indexed actor);

    event CplTcoinPurchased(
        address indexed buyer,
        address indexed inputToken,
        bytes32 indexed selectedPoolId,
        bytes32 reserveAssetId,
        uint256 inputAmount,
        uint256 reserveAmountUsed,
        uint256 mrTcoinUsed,
        uint256 cplTcoinOut,
        uint256 charityTopupOut,
        uint256 resolvedCharityId,
        address charityWallet
    );

    address public governance;
    address public treasuryController;
    address public reserveInputRouter;
    address public cplTcoin;
    address public charityPreferencesRegistry;
    address public acceptancePreferencesRegistry;
    address public poolRegistry;
    address public poolAdapter;

    uint256 public charityTopupBps;
    uint256 public weightLowMrTcoinLiquidity;
    uint256 public weightHighCplTcoinLiquidity;
    uint256 public weightUserPoolPreference;
    uint256 public weightUserMerchantPreference;

    constructor(
        address initialOwner,
        address governance_,
        address treasuryController_,
        address reserveInputRouter_,
        address cplTcoin_,
        address charityPreferencesRegistry_,
        address acceptancePreferencesRegistry_,
        address poolRegistry_,
        address poolAdapter_
    ) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);

        _setGovernance(governance_);
        _setTreasuryController(treasuryController_);
        _setReserveInputRouter(reserveInputRouter_);
        _setCplTcoin(cplTcoin_);
        _setCharityPreferencesRegistry(charityPreferencesRegistry_);
        _setAcceptancePreferencesRegistry(acceptancePreferencesRegistry_);
        _setPoolRegistry(poolRegistry_);
        _setPoolAdapter(poolAdapter_);

        charityTopupBps = 300;
        emit CharityTopupBpsUpdated(0, 300);

        weightLowMrTcoinLiquidity = 1;
        weightHighCplTcoinLiquidity = 1;
        weightUserPoolPreference = 100;
        weightUserMerchantPreference = 50;
        emit ScoringWeightsUpdated(1, 1, 100, 50);
    }

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    function buyCplTcoin(address inputToken, uint256 inputAmount, uint256 minReserveOut, uint256 minCplTcoinOut)
        external
        nonReentrant
        returns (
            bytes32 selectedPoolId,
            bytes32 reserveAssetId,
            uint256 reserveAmountUsed,
            uint256 mrTcoinUsed,
            uint256 cplTcoinOut,
            uint256 charityTopupOut,
            uint256 resolvedCharityId
        )
    {
        BuyRequest memory request = BuyRequest({
            inputToken: inputToken,
            inputAmount: inputAmount,
            minReserveOut: minReserveOut,
            minCplTcoinOut: minCplTcoinOut,
            buyer: msg.sender
        });
        PurchaseResult memory result = _buyCplTcoin(request);
        return (
            result.selectedPoolId,
            result.reserveAssetId,
            result.reserveAmountUsed,
            result.mrTcoinUsed,
            result.cplTcoinOut,
            result.charityTopupOut,
            result.resolvedCharityId
        );
    }

    function previewBuyCplTcoin(address buyer, address inputToken, uint256 inputAmount)
        external
        view
        returns (
            bytes32 selectedPoolId,
            bytes32 reserveAssetId,
            uint256 reserveAmountOut,
            uint256 mrTcoinOut,
            uint256 cplTcoinOut,
            uint256 charityTopupOut,
            uint256 resolvedCharityId,
            address charityWallet
        )
    {
        BuyRequest memory request = BuyRequest({
            inputToken: inputToken, inputAmount: inputAmount, minReserveOut: 0, minCplTcoinOut: 0, buyer: buyer
        });
        PurchaseResult memory result = _previewBuyCplTcoin(request);
        return (
            result.selectedPoolId,
            result.reserveAssetId,
            result.reserveAmountUsed,
            result.mrTcoinUsed,
            result.cplTcoinOut,
            result.charityTopupOut,
            result.resolvedCharityId,
            result.charityWallet
        );
    }

    function seedPoolWithCplTcoin(bytes32 poolId, uint256 amount) external onlyGovernanceOrOwner {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (amount == 0) revert ZeroAmount();

        address poolAccount = _resolvePoolAccount(poolId);
        ICplTcoinForLiquidityRouter(cplTcoin).mint(poolAccount, amount, "");

        emit PoolSeeded(poolId, amount, msg.sender);
    }

    function topUpPoolWithCplTcoin(bytes32 poolId, uint256 amount) external onlyGovernanceOrOwner {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (amount == 0) revert ZeroAmount();

        address poolAccount = _resolvePoolAccount(poolId);
        ICplTcoinForLiquidityRouter(cplTcoin).mint(poolAccount, amount, "");

        emit PoolToppedUp(poolId, amount, msg.sender);
    }

    function setGovernance(address governance_) external onlyOwner {
        _setGovernance(governance_);
    }

    function setTreasuryController(address treasury_) external onlyGovernanceOrOwner {
        _setTreasuryController(treasury_);
    }

    function setReserveInputRouter(address router_) external onlyGovernanceOrOwner {
        _setReserveInputRouter(router_);
    }

    function setCplTcoin(address cplTcoin_) external onlyGovernanceOrOwner {
        _setCplTcoin(cplTcoin_);
    }

    function setCharityPreferencesRegistry(address registry_) external onlyGovernanceOrOwner {
        _setCharityPreferencesRegistry(registry_);
    }

    function setAcceptancePreferencesRegistry(address registry_) external onlyGovernanceOrOwner {
        _setAcceptancePreferencesRegistry(registry_);
    }

    function setPoolRegistry(address registry_) external onlyGovernanceOrOwner {
        _setPoolRegistry(registry_);
    }

    function setPoolAdapter(address adapter_) external onlyGovernanceOrOwner {
        _setPoolAdapter(adapter_);
    }

    function setCharityTopupBps(uint256 newBps) external onlyGovernanceOrOwner {
        uint256 oldBps = charityTopupBps;
        if (newBps > BPS_DENOMINATOR) revert InvalidBps(newBps);
        charityTopupBps = newBps;
        emit CharityTopupBpsUpdated(oldBps, newBps);
    }

    function setScoringWeights(
        uint256 newWeightLowMrTcoinLiquidity,
        uint256 newWeightHighCplTcoinLiquidity,
        uint256 newWeightUserPoolPreference,
        uint256 newWeightUserMerchantPreference
    ) external onlyGovernanceOrOwner {
        weightLowMrTcoinLiquidity = newWeightLowMrTcoinLiquidity;
        weightHighCplTcoinLiquidity = newWeightHighCplTcoinLiquidity;
        weightUserPoolPreference = newWeightUserPoolPreference;
        weightUserMerchantPreference = newWeightUserMerchantPreference;

        emit ScoringWeightsUpdated(
            newWeightLowMrTcoinLiquidity,
            newWeightHighCplTcoinLiquidity,
            newWeightUserPoolPreference,
            newWeightUserMerchantPreference
        );
    }

    function _selectPool(uint256 mrTcoinOut, uint256 minCplTcoinOut, AcceptanceContext memory acceptance)
        internal
        view
        returns (PoolSelection memory best)
    {
        bytes32[] memory poolIds = IPoolRegistryForLiquidityRouter(poolRegistry).listPoolIds();

        for (uint256 i = 0; i < poolIds.length; ++i) {
            bytes32 poolId = poolIds[i];
            PoolCandidate memory candidate = _evaluatePoolCandidate(poolId, mrTcoinOut, minCplTcoinOut, acceptance);
            if (!candidate.eligible) continue;

            if (
                !best.found || candidate.score > best.score
                    || (candidate.score == best.score && candidate.cplTcoinOut > best.cplTcoinOut)
                    || (candidate.score == best.score
                        && candidate.cplTcoinOut == best.cplTcoinOut
                        && poolId < best.poolId)
            ) {
                best = PoolSelection({
                    poolId: poolId, score: candidate.score, cplTcoinOut: candidate.cplTcoinOut, found: true
                });
            }
        }

        if (!best.found) revert NoEligiblePool();
    }

    function _evaluatePoolCandidate(
        bytes32 poolId,
        uint256 mrTcoinOut,
        uint256 minCplTcoinOut,
        AcceptanceContext memory acceptance
    ) internal view returns (PoolCandidate memory candidate) {
        if (!_isAddressAccepted(
                acceptance.acceptedTokenAddresses,
                acceptance.deniedTokenAddresses,
                cplTcoin,
                acceptance.strictAcceptedOnly,
                acceptance.preferredTokenAddresses
            )) {
            return candidate;
        }

        if (!IPoolRegistryForLiquidityRouter(poolRegistry).isPoolActive(poolId)) {
            return candidate;
        }

        if (_containsBytes32(acceptance.deniedPoolIds, poolId)) {
            return candidate;
        }

        if (
            acceptance.deniedMerchantIds.length > 0
                && IPoolAdapter(poolAdapter).poolMatchesAnyMerchantIds(poolId, acceptance.deniedMerchantIds)
        ) {
            return candidate;
        }

        (uint256 mrLiquidity, uint256 cplLiquidity, bool active) =
            IPoolAdapter(poolAdapter).getPoolLiquidityState(poolId);
        if (!active) {
            return candidate;
        }

        candidate.cplTcoinOut = IPoolAdapter(poolAdapter).previewBuyCplTcoinFromPool(poolId, mrTcoinOut);
        if (
            candidate.cplTcoinOut == 0 || candidate.cplTcoinOut < minCplTcoinOut || cplLiquidity < candidate.cplTcoinOut
        ) {
            return candidate;
        }

        bool poolAccepted = _containsBytes32(acceptance.acceptedPoolIds, poolId);
        bool acceptedMerchantMatch = acceptance.acceptedMerchantIds.length > 0
            && IPoolAdapter(poolAdapter).poolMatchesAnyMerchantIds(poolId, acceptance.acceptedMerchantIds);

        if (acceptance.strictAcceptedOnly && !poolAccepted && !acceptedMerchantMatch) {
            return candidate;
        }

        candidate.score = _scorePool(poolId, mrTcoinOut, mrLiquidity, cplLiquidity, acceptance, poolAccepted);
        candidate.eligible = true;
    }

    function _buyCplTcoin(BuyRequest memory request) internal returns (PurchaseResult memory result) {
        if (request.inputToken == address(0)) revert ZeroAddressToken();
        if (request.inputAmount == 0) revert ZeroAmount();

        AcceptanceContext memory acceptance = _loadAcceptanceContext(request.buyer);
        ReserveDepositContext memory depositContext =
            _collectReserveAndDeposit(request.inputToken, request.inputAmount, request.minReserveOut, request.buyer);
        result.reserveAssetId = depositContext.reserveAssetId;
        result.reserveAmountUsed = depositContext.reserveAmount;
        result.mrTcoinUsed = depositContext.mrTcoinOut;

        PoolSelection memory selection = _selectPool(result.mrTcoinUsed, request.minCplTcoinOut, acceptance);
        result.selectedPoolId = selection.poolId;
        _approveExact(depositContext.mrTcoinToken, poolAdapter, result.mrTcoinUsed);
        result.cplTcoinOut =
            _buyFromPool(result.selectedPoolId, result.mrTcoinUsed, request.minCplTcoinOut, request.buyer);

        CharityResolution memory charity = _resolveCharity(request.buyer);
        result.resolvedCharityId = charity.charityId;
        result.charityWallet = charity.charityWallet;
        result.charityTopupOut = (result.cplTcoinOut * charityTopupBps) / BPS_DENOMINATOR;

        if (result.charityTopupOut > 0) {
            ICplTcoinForLiquidityRouter(cplTcoin).mint(result.charityWallet, result.charityTopupOut, "");
        }

        emit CplTcoinPurchased(
            request.buyer,
            request.inputToken,
            result.selectedPoolId,
            result.reserveAssetId,
            request.inputAmount,
            result.reserveAmountUsed,
            result.mrTcoinUsed,
            result.cplTcoinOut,
            result.charityTopupOut,
            result.resolvedCharityId,
            result.charityWallet
        );
    }

    function _previewBuyCplTcoin(BuyRequest memory request) internal view returns (PurchaseResult memory result) {
        if (request.inputToken == address(0)) revert ZeroAddressToken();
        if (request.inputAmount == 0) revert ZeroAmount();

        AcceptanceContext memory acceptance = _loadAcceptanceContext(request.buyer);
        bool directAccepted;
        (directAccepted,, result.reserveAssetId,, result.reserveAmountUsed) =
            _previewNormalizeReserveInput(request.inputToken, request.inputAmount);
        if (!directAccepted && result.reserveAssetId == bytes32(0)) revert UnsupportedReserveInput(request.inputToken);

        (result.mrTcoinUsed,,) = ITreasuryControllerForLiquidityRouter(treasuryController)
            .previewDepositAssetForLiquidityRoute(result.reserveAssetId, result.reserveAmountUsed);

        PoolSelection memory selection = _selectPool(result.mrTcoinUsed, request.minCplTcoinOut, acceptance);
        result.selectedPoolId = selection.poolId;
        result.cplTcoinOut = selection.cplTcoinOut;
        result.charityTopupOut = (result.cplTcoinOut * charityTopupBps) / BPS_DENOMINATOR;

        CharityResolution memory charity = _resolveCharity(request.buyer);
        result.resolvedCharityId = charity.charityId;
        result.charityWallet = charity.charityWallet;
    }

    function _scorePool(
        bytes32 poolId,
        uint256 mrTcoinOut,
        uint256 mrLiquidity,
        uint256 cplLiquidity,
        AcceptanceContext memory acceptance,
        bool poolAccepted
    ) internal view returns (uint256 score) {
        uint256 mrNeed = mrTcoinOut > mrLiquidity ? mrTcoinOut - mrLiquidity : 0;

        score += mrNeed * weightLowMrTcoinLiquidity;
        score += cplLiquidity * weightHighCplTcoinLiquidity;

        if (poolAccepted) {
            score += weightUserPoolPreference;
        }

        (bool rankedMatch, uint256 bestMatchedRank) =
            _getBestPreferredMerchantRank(poolId, acceptance.preferredMerchantIds);
        if (rankedMatch) {
            score += weightUserMerchantPreference * (acceptance.preferredMerchantIds.length - bestMatchedRank);
        }
    }

    function _resolvePoolAccount(bytes32 poolId) internal view returns (address poolAccount) {
        if (poolId == bytes32(0)) revert ZeroPoolId();
        if (!IPoolRegistryForLiquidityRouter(poolRegistry).isPoolActive(poolId)) revert NoEligiblePool();

        poolAccount = IPoolAdapter(poolAdapter).getPoolAccount(poolId);
        if (poolAccount == address(0)) revert InvalidPoolAccount(poolId);
    }

    function _setGovernance(address governance_) internal {
        address oldGovernance = governance;
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == oldGovernance) revert SameAddress();
        governance = governance_;
        emit GovernanceUpdated(oldGovernance, governance_);
    }

    function _setTreasuryController(address treasury_) internal {
        address oldTreasury = treasuryController;
        if (treasury_ == address(0)) revert ZeroAddressDependency();
        if (treasury_ == oldTreasury) revert SameAddress();
        treasuryController = treasury_;
        emit TreasuryControllerUpdated(oldTreasury, treasury_);
    }

    function _setReserveInputRouter(address router_) internal {
        address oldRouter = reserveInputRouter;
        if (router_ == address(0)) revert ZeroAddressDependency();
        if (router_ == oldRouter) revert SameAddress();
        reserveInputRouter = router_;
        emit ReserveInputRouterUpdated(oldRouter, router_);
    }

    function _setCplTcoin(address cplTcoin_) internal {
        address oldToken = cplTcoin;
        if (cplTcoin_ == address(0)) revert ZeroAddressDependency();
        if (cplTcoin_ == oldToken) revert SameAddress();
        cplTcoin = cplTcoin_;
        emit CplTcoinUpdated(oldToken, cplTcoin_);
    }

    function _setCharityPreferencesRegistry(address registry_) internal {
        address oldRegistry = charityPreferencesRegistry;
        if (registry_ == address(0)) revert ZeroAddressDependency();
        if (registry_ == oldRegistry) revert SameAddress();
        charityPreferencesRegistry = registry_;
        emit CharityPreferencesRegistryUpdated(oldRegistry, registry_);
    }

    function _setAcceptancePreferencesRegistry(address registry_) internal {
        address oldRegistry = acceptancePreferencesRegistry;
        if (registry_ == address(0)) revert ZeroAddressDependency();
        if (registry_ == oldRegistry) revert SameAddress();
        acceptancePreferencesRegistry = registry_;
        emit AcceptancePreferencesRegistryUpdated(oldRegistry, registry_);
    }

    function _setPoolRegistry(address registry_) internal {
        address oldRegistry = poolRegistry;
        if (registry_ == address(0)) revert ZeroAddressDependency();
        if (registry_ == oldRegistry) revert SameAddress();
        poolRegistry = registry_;
        emit PoolRegistryUpdated(oldRegistry, registry_);
    }

    function _setPoolAdapter(address adapter_) internal {
        address oldAdapter = poolAdapter;
        if (adapter_ == address(0)) revert ZeroAddressDependency();
        if (adapter_ == oldAdapter) revert SameAddress();
        poolAdapter = adapter_;
        emit PoolAdapterUpdated(oldAdapter, adapter_);
    }

    function _collectReserveAndDeposit(address inputToken, uint256 inputAmount, uint256 minReserveOut, address payer)
        internal
        returns (ReserveDepositContext memory context)
    {
        (context.reserveAssetId, context.reserveToken, context.reserveAmount) =
            _normalizeReserveInput(inputToken, inputAmount, minReserveOut, payer);

        address treasuryVault = ITreasuryControllerForLiquidityRouter(treasuryController).treasury();
        _approveExact(context.reserveToken, treasuryVault, context.reserveAmount);

        context.mrTcoinOut = ITreasuryControllerForLiquidityRouter(treasuryController)
            .depositAssetForLiquidityRoute(context.reserveAssetId, context.reserveAmount, address(this));
        context.mrTcoinToken = ITreasuryControllerForLiquidityRouter(treasuryController).tcoinToken();
    }

    function _normalizeReserveInput(address inputToken, uint256 inputAmount, uint256 minReserveOut, address payer)
        internal
        returns (bytes32 reserveAssetId, address reserveToken, uint256 reserveAmountOut)
    {
        (bool directAccepted, bytes32 directAssetId, address directReserveToken) =
            ITreasuryControllerForLiquidityRouter(treasuryController).resolveAcceptedReserveAsset(inputToken);
        IERC20(inputToken).safeTransferFrom(payer, address(this), inputAmount);
        if (directAccepted) {
            if (inputAmount < minReserveOut) revert InvalidReserveOut(inputAmount, minReserveOut);
            return (directAssetId, directReserveToken, inputAmount);
        }

        _approveExact(inputToken, reserveInputRouter, inputAmount);
        return IReserveInputRouterForLiquidityRouter(reserveInputRouter)
            .normalizeReserveInput(inputToken, inputAmount, minReserveOut, address(this));
    }

    function _previewNormalizeReserveInput(address inputToken, uint256 inputAmount)
        internal
        view
        returns (
            bool directAccepted,
            bool requiresSwap,
            bytes32 reserveAssetId,
            address reserveToken,
            uint256 reserveAmountOut
        )
    {
        (directAccepted, reserveAssetId, reserveToken) = ITreasuryControllerForLiquidityRouter(treasuryController)
            .resolveAcceptedReserveAsset(inputToken);
        if (directAccepted) {
            return (true, false, reserveAssetId, reserveToken, inputAmount);
        }

        return
            IReserveInputRouterForLiquidityRouter(reserveInputRouter)
                .previewNormalizeReserveInput(inputToken, inputAmount);
    }

    function _loadAcceptanceContext(address buyer) internal view returns (AcceptanceContext memory acceptance) {
        (
            acceptance.strictAcceptedOnly,
            acceptance.acceptedPoolIds,
            acceptance.deniedPoolIds,
            acceptance.acceptedMerchantIds,
            acceptance.deniedMerchantIds,
            acceptance.preferredMerchantIds,
            acceptance.acceptedTokenAddresses,
            acceptance.deniedTokenAddresses,
            acceptance.preferredTokenAddresses
        ) =
            IUserAcceptancePreferencesRegistryForLiquidityRouter(acceptancePreferencesRegistry)
                .getRoutingPreferences(buyer);
    }

    function _resolveCharity(address payer) internal view returns (CharityResolution memory charity) {
        (charity.charityId, charity.charityWallet,) =
            IUserCharityPreferencesRegistryForLiquidityRouter(charityPreferencesRegistry).resolveFeePreferences(payer);
        if (charity.charityId == 0 || charity.charityWallet == address(0)) {
            revert InvalidCharityResolution(charity.charityId);
        }
    }

    function _buyFromPool(bytes32 poolId, uint256 mrTcoinAmountIn, uint256 minCplTcoinOut, address recipient)
        internal
        returns (uint256 cplTcoinOut)
    {
        cplTcoinOut = IPoolAdapter(poolAdapter).buyCplTcoinFromPool(poolId, mrTcoinAmountIn, minCplTcoinOut, recipient);
    }

    function _approveExact(address token, address spender, uint256 amount) internal {
        IERC20 erc20 = IERC20(token);
        erc20.safeApprove(spender, 0);
        erc20.safeApprove(spender, amount);
    }

    function _getBestPreferredMerchantRank(bytes32 poolId, bytes32[] memory preferredMerchantIds)
        internal
        view
        returns (bool rankedMatch, uint256 rank)
    {
        bytes32[] memory singleMerchant = new bytes32[](1);
        for (uint256 i = 0; i < preferredMerchantIds.length; ++i) {
            singleMerchant[0] = preferredMerchantIds[i];
            if (IPoolAdapter(poolAdapter).poolMatchesAnyMerchantIds(poolId, singleMerchant)) {
                return (true, i);
            }
        }
    }

    function _isAddressAccepted(
        address[] memory acceptedValues,
        address[] memory deniedValues,
        address needle,
        bool strictAcceptedOnly,
        address[] memory preferredValues
    ) internal pure returns (bool) {
        if (_containsAddress(deniedValues, needle)) return false;
        if (_containsAddress(acceptedValues, needle)) return true;
        if (_containsAddress(preferredValues, needle)) return true;
        return !strictAcceptedOnly;
    }

    function _containsBytes32(bytes32[] memory values, bytes32 needle) internal pure returns (bool) {
        for (uint256 i = 0; i < values.length; ++i) {
            if (values[i] == needle) return true;
        }
        return false;
    }

    function _containsAddress(address[] memory values, address needle) internal pure returns (bool) {
        for (uint256 i = 0; i < values.length; ++i) {
            if (values[i] == needle) return true;
        }
        return false;
    }
}
