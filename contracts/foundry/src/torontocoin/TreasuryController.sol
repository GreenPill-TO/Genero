// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICharityRegistry} from "./interfaces/ICharityRegistry.sol";
import {IOracleRouter} from "./interfaces/IOracleRouter.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {IReserveRegistry} from "./interfaces/IReserveRegistry.sol";
import {ITCOINToken} from "./interfaces/ITCOINToken.sol";

contract TreasuryController is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant CAD_PEG_MAX_DELTA_BPS = 1_000; // 10%
    uint256 public constant VALUE_SCALE = 1e18;

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressIndexer();
    error ZeroAddressToken();
    error ZeroAddressRegistry();
    error ZeroAmount();
    error MintingPaused();
    error RedemptionPaused();
    error AssetPaused(bytes32 assetId);
    error AssetInactive(bytes32 assetId);
    error UnknownAsset(bytes32 assetId);
    error InsufficientReserveBalance(bytes32 assetId, uint256 requested, uint256 available);
    error InvalidRedeemRate();
    error InvalidCharityMintRate();
    error InvalidCadPeg();
    error MerchantNotEligible(address merchant);
    error MerchantAllowanceExceeded(address merchant, uint256 requested, uint256 available);
    error InvalidMinOut(uint256 actualOut, uint256 minOut);
    error Unauthorized();
    error SameAddress();
    error InvalidPegChange(uint256 oldPeg18, uint256 newPeg18);
    error InvalidCharityResolution(uint256 charityId);

    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event IndexerUpdated(address indexed oldIndexer, address indexed newIndexer);
    event TcoinTokenUpdated(address indexed oldToken, address indexed newToken);
    event ReserveRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event OracleRouterUpdated(address indexed oldRouter, address indexed newRouter);

    event ReserveDeposited(
        address indexed depositor,
        bytes32 indexed assetId,
        uint256 assetAmount,
        uint256 cadValue18,
        uint256 userTcoinMinted,
        uint256 charityTcoinMinted,
        uint256 indexed charityId,
        bool usedFallbackOracle
    );

    event LiquidityRouteDeposited(
        address indexed router,
        address indexed payer,
        bytes32 indexed assetId,
        uint256 assetAmount,
        uint256 cadValue18,
        uint256 mrTcoinOut,
        bool usedFallbackOracle
    );

    event RedeemedAsUser(
        address indexed user,
        bytes32 indexed assetId,
        uint256 tcoinBurned,
        uint256 assetOut,
        uint256 grossCad18,
        uint256 redeemableCad18,
        bool usedFallbackOracle
    );

    event RedeemedAsMerchant(
        address indexed merchant,
        bytes32 indexed assetId,
        uint256 tcoinBurned,
        uint256 assetOut,
        uint256 grossCad18,
        uint256 redeemableCad18,
        uint256 allowanceRemaining,
        bool usedFallbackOracle
    );

    event MerchantAllowanceUpdated(
        address indexed merchant, uint256 oldAmount, uint256 newAmount, address indexed actor
    );

    event CadPegUpdated(uint256 oldPeg18, uint256 newPeg18);
    event UserRedeemRateUpdated(uint256 oldRateBps, uint256 newRateBps);
    event MerchantRedeemRateUpdated(uint256 oldRateBps, uint256 newRateBps);
    event CharityMintRateUpdated(uint256 oldRateBps, uint256 newRateBps);

    event MintingPauseUpdated(bool paused, address indexed actor);
    event RedemptionPauseUpdated(bool paused, address indexed actor);
    event TreasuryAssetPauseUpdated(bytes32 indexed assetId, bool paused, address indexed actor);

    address public governance;
    address public indexer;
    address public tcoinToken;
    address public reserveRegistry;
    address public charityRegistry;
    address public poolRegistry;
    address public oracleRouter;

    uint256 public cadPeg18;
    uint256 public userRedeemRateBps;
    uint256 public merchantRedeemRateBps;
    uint256 public charityMintRateBps;

    bool public mintingPaused;
    bool public redemptionPaused;

    mapping(bytes32 => bool) public assetTreasuryPaused;
    mapping(address => uint256) private merchantRedemptionAllowance;

    mapping(bytes32 => uint256) public totalDepositedByAsset;
    mapping(bytes32 => uint256) public totalRedeemedByAsset;
    uint256 public totalTcoinMintedViaDeposits;
    uint256 public totalTcoinBurnedViaRedemption;
    uint256 public totalCharityTcoinMinted;

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier onlyIndexerOrOwner() {
        if (msg.sender != indexer && msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier whenMintingNotPaused() {
        if (mintingPaused) revert MintingPaused();
        _;
    }

    modifier whenRedemptionNotPaused() {
        if (redemptionPaused) revert RedemptionPaused();
        _;
    }

    function initialize(
        address owner_,
        address governance_,
        address indexer_,
        address tcoinToken_,
        address reserveRegistry_,
        address charityRegistry_,
        address poolRegistry_,
        address oracleRouter_,
        uint256 cadPeg18_,
        uint256 userRedeemRateBps_,
        uint256 merchantRedeemRateBps_,
        uint256 charityMintRateBps_
    ) external initializer {
        if (owner_ == address(0)) revert ZeroAddressOwner();
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (indexer_ == address(0)) revert ZeroAddressIndexer();
        if (tcoinToken_ == address(0)) revert ZeroAddressToken();
        if (
            reserveRegistry_ == address(0) || charityRegistry_ == address(0) || poolRegistry_ == address(0)
                || oracleRouter_ == address(0)
        ) {
            revert ZeroAddressRegistry();
        }

        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        _transferOwnership(owner_);

        governance = governance_;
        indexer = indexer_;
        tcoinToken = tcoinToken_;
        reserveRegistry = reserveRegistry_;
        charityRegistry = charityRegistry_;
        poolRegistry = poolRegistry_;
        oracleRouter = oracleRouter_;

        emit GovernanceUpdated(address(0), governance_);
        emit IndexerUpdated(address(0), indexer_);
        emit TcoinTokenUpdated(address(0), tcoinToken_);
        emit ReserveRegistryUpdated(address(0), reserveRegistry_);
        emit CharityRegistryUpdated(address(0), charityRegistry_);
        emit PoolRegistryUpdated(address(0), poolRegistry_);
        emit OracleRouterUpdated(address(0), oracleRouter_);

        _setCadPeg(cadPeg18_, true);
        _setUserRedeemRate(userRedeemRateBps_);
        _setMerchantRedeemRate(merchantRedeemRateBps_);
        _setCharityMintRate(charityMintRateBps_);
    }

    function setGovernance(address governance_) external onlyOwner {
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (governance_ == governance) revert SameAddress();
        address old = governance;
        governance = governance_;
        emit GovernanceUpdated(old, governance_);
    }

    function setIndexer(address indexer_) external onlyOwner {
        if (indexer_ == address(0)) revert ZeroAddressIndexer();
        if (indexer_ == indexer) revert SameAddress();
        address old = indexer;
        indexer = indexer_;
        emit IndexerUpdated(old, indexer_);
    }

    function setTcoinToken(address tcoinToken_) external onlyOwner {
        if (tcoinToken_ == address(0)) revert ZeroAddressToken();
        if (tcoinToken_ == tcoinToken) revert SameAddress();
        address old = tcoinToken;
        tcoinToken = tcoinToken_;
        emit TcoinTokenUpdated(old, tcoinToken_);
    }

    function setReserveRegistry(address reserveRegistry_) external onlyOwner {
        if (reserveRegistry_ == address(0)) revert ZeroAddressRegistry();
        if (reserveRegistry_ == reserveRegistry) revert SameAddress();
        address old = reserveRegistry;
        reserveRegistry = reserveRegistry_;
        emit ReserveRegistryUpdated(old, reserveRegistry_);
    }

    function setCharityRegistry(address charityRegistry_) external onlyOwner {
        if (charityRegistry_ == address(0)) revert ZeroAddressRegistry();
        if (charityRegistry_ == charityRegistry) revert SameAddress();
        address old = charityRegistry;
        charityRegistry = charityRegistry_;
        emit CharityRegistryUpdated(old, charityRegistry_);
    }

    function setPoolRegistry(address poolRegistry_) external onlyOwner {
        if (poolRegistry_ == address(0)) revert ZeroAddressRegistry();
        if (poolRegistry_ == poolRegistry) revert SameAddress();
        address old = poolRegistry;
        poolRegistry = poolRegistry_;
        emit PoolRegistryUpdated(old, poolRegistry_);
    }

    function setOracleRouter(address oracleRouter_) external onlyOwner {
        if (oracleRouter_ == address(0)) revert ZeroAddressRegistry();
        if (oracleRouter_ == oracleRouter) revert SameAddress();
        address old = oracleRouter;
        oracleRouter = oracleRouter_;
        emit OracleRouterUpdated(old, oracleRouter_);
    }

    function depositAndMint(bytes32 assetId, uint256 assetAmount, uint256 requestedCharityId, uint256 minTcoinOut)
        external
        nonReentrant
        whenMintingNotPaused
        returns (uint256 userTcoinOut, uint256 charityTcoinOut)
    {
        if (assetAmount == 0) revert ZeroAmount();

        IReserveRegistry.ReserveAsset memory asset = _resolveActiveAsset(assetId);
        (uint256 cadValue18,, bool usedFallbackOracle) =
            IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);

        userTcoinOut = _tcoinFromCad(cadValue18);
        if (userTcoinOut < minTcoinOut) revert InvalidMinOut(userTcoinOut, minTcoinOut);

        (uint256 resolvedCharityId, address charityWallet) = _resolveMintCharity(requestedCharityId);
        charityTcoinOut = (userTcoinOut * charityMintRateBps) / BPS_DENOMINATOR;

        IERC20(asset.token).safeTransferFrom(msg.sender, address(this), assetAmount);
        ITCOINToken(tcoinToken).mint(msg.sender, userTcoinOut, "");
        if (charityTcoinOut > 0) {
            ITCOINToken(tcoinToken).mint(charityWallet, charityTcoinOut, "");
        }

        totalDepositedByAsset[assetId] += assetAmount;
        totalTcoinMintedViaDeposits += userTcoinOut;
        totalCharityTcoinMinted += charityTcoinOut;

        emit ReserveDeposited(
            msg.sender,
            assetId,
            assetAmount,
            cadValue18,
            userTcoinOut,
            charityTcoinOut,
            resolvedCharityId,
            usedFallbackOracle
        );
    }

    function previewMint(bytes32 assetId, uint256 assetAmount, uint256 requestedCharityId)
        external
        view
        returns (
            uint256 userTcoinOut,
            uint256 charityTcoinOut,
            uint256 resolvedCharityId,
            bool usedFallbackOracle,
            uint256 cadValue18
        )
    {
        if (assetAmount == 0) revert ZeroAmount();
        _resolveActiveAsset(assetId);

        (cadValue18,, usedFallbackOracle) = IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);
        userTcoinOut = _tcoinFromCad(cadValue18);
        charityTcoinOut = (userTcoinOut * charityMintRateBps) / BPS_DENOMINATOR;
        (resolvedCharityId,) = _resolveMintCharity(requestedCharityId);
    }

    function depositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount, address payer)
        external
        nonReentrant
        whenMintingNotPaused
        returns (uint256 mrTcoinOut)
    {
        if (assetAmount == 0) revert ZeroAmount();

        IReserveRegistry.ReserveAsset memory asset = _resolveActiveAsset(assetId);
        (uint256 cadValue18,, bool usedFallbackOracle) =
            IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);

        mrTcoinOut = _tcoinFromCad(cadValue18);

        IERC20(asset.token).safeTransferFrom(msg.sender, address(this), assetAmount);

        totalDepositedByAsset[assetId] += assetAmount;

        emit LiquidityRouteDeposited(
            msg.sender, payer, assetId, assetAmount, cadValue18, mrTcoinOut, usedFallbackOracle
        );
    }

    function previewLiquidityRouteDeposit(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 mrTcoinOut, bool usedFallbackOracle, uint256 cadValue18)
    {
        if (assetAmount == 0) revert ZeroAmount();
        _resolveActiveAsset(assetId);

        (cadValue18,, usedFallbackOracle) = IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);
        mrTcoinOut = _tcoinFromCad(cadValue18);
    }

    function getReserveAssetToken(bytes32 assetId) external view returns (address token) {
        token = _resolveActiveAsset(assetId).token;
    }

    function redeemAsUser(bytes32 assetId, uint256 tcoinAmount, uint256 minAssetOut)
        external
        nonReentrant
        whenRedemptionNotPaused
        returns (uint256 assetOut)
    {
        if (tcoinAmount == 0) revert ZeroAmount();

        bool usedFallbackOracle;
        uint256 grossCad18;
        uint256 redeemableCad18;
        (assetOut, usedFallbackOracle, grossCad18, redeemableCad18) =
            _previewRedeem(assetId, tcoinAmount, userRedeemRateBps);

        if (assetOut < minAssetOut) revert InvalidMinOut(assetOut, minAssetOut);
        _ensureSufficientReserve(assetId, assetOut);

        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        IERC20(tcoinToken).safeTransferFrom(msg.sender, address(this), tcoinAmount);
        ITCOINToken(tcoinToken).burn(tcoinAmount);
        IERC20(asset.token).safeTransfer(msg.sender, assetOut);

        totalRedeemedByAsset[assetId] += assetOut;
        totalTcoinBurnedViaRedemption += tcoinAmount;

        emit RedeemedAsUser(msg.sender, assetId, tcoinAmount, assetOut, grossCad18, redeemableCad18, usedFallbackOracle);
    }

    function redeemAsMerchant(bytes32 assetId, uint256 tcoinAmount, uint256 minAssetOut)
        external
        nonReentrant
        whenRedemptionNotPaused
        returns (uint256 assetOut)
    {
        if (tcoinAmount == 0) revert ZeroAmount();
        if (!IPoolRegistry(poolRegistry).isMerchantApprovedInActivePool(msg.sender)) {
            revert MerchantNotEligible(msg.sender);
        }

        uint256 allowanceAvailable = merchantRedemptionAllowance[msg.sender];
        if (allowanceAvailable < tcoinAmount) {
            revert MerchantAllowanceExceeded(msg.sender, tcoinAmount, allowanceAvailable);
        }

        bool usedFallbackOracle;
        uint256 grossCad18;
        uint256 redeemableCad18;
        (assetOut, usedFallbackOracle, grossCad18, redeemableCad18) =
            _previewRedeem(assetId, tcoinAmount, merchantRedeemRateBps);

        if (assetOut < minAssetOut) revert InvalidMinOut(assetOut, minAssetOut);
        _ensureSufficientReserve(assetId, assetOut);

        merchantRedemptionAllowance[msg.sender] = allowanceAvailable - tcoinAmount;

        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        IERC20(tcoinToken).safeTransferFrom(msg.sender, address(this), tcoinAmount);
        ITCOINToken(tcoinToken).burn(tcoinAmount);
        IERC20(asset.token).safeTransfer(msg.sender, assetOut);

        totalRedeemedByAsset[assetId] += assetOut;
        totalTcoinBurnedViaRedemption += tcoinAmount;

        emit MerchantAllowanceUpdated(msg.sender, allowanceAvailable, allowanceAvailable - tcoinAmount, address(this));
        emit RedeemedAsMerchant(
            msg.sender,
            assetId,
            tcoinAmount,
            assetOut,
            grossCad18,
            redeemableCad18,
            merchantRedemptionAllowance[msg.sender],
            usedFallbackOracle
        );
    }

    function previewRedeemAsUser(bytes32 assetId, uint256 tcoinAmount)
        external
        view
        returns (uint256 assetOut, bool usedFallbackOracle, uint256 grossCad18, uint256 redeemableCad18)
    {
        if (tcoinAmount == 0) revert ZeroAmount();
        return _previewRedeem(assetId, tcoinAmount, userRedeemRateBps);
    }

    function previewRedeemAsMerchant(bytes32 assetId, uint256 tcoinAmount, address merchant)
        external
        view
        returns (
            uint256 assetOut,
            bool eligible,
            uint256 allowanceRemaining,
            bool usedFallbackOracle,
            uint256 grossCad18,
            uint256 redeemableCad18
        )
    {
        if (tcoinAmount == 0) revert ZeroAmount();
        eligible = IPoolRegistry(poolRegistry).isMerchantApprovedInActivePool(merchant);
        allowanceRemaining = merchantRedemptionAllowance[merchant];
        (assetOut, usedFallbackOracle, grossCad18, redeemableCad18) =
            _previewRedeem(assetId, tcoinAmount, merchantRedeemRateBps);
    }

    function setMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        uint256 oldAmount = merchantRedemptionAllowance[merchant];
        merchantRedemptionAllowance[merchant] = amount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, amount, msg.sender);
    }

    function increaseMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 oldAmount = merchantRedemptionAllowance[merchant];
        uint256 newAmount = oldAmount + amount;
        merchantRedemptionAllowance[merchant] = newAmount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, newAmount, msg.sender);
    }

    function decreaseMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 oldAmount = merchantRedemptionAllowance[merchant];
        uint256 newAmount = amount >= oldAmount ? 0 : oldAmount - amount;
        merchantRedemptionAllowance[merchant] = newAmount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, newAmount, msg.sender);
    }

    function getMerchantRedemptionAllowance(address merchant) external view returns (uint256) {
        return merchantRedemptionAllowance[merchant];
    }

    function setCadPeg(uint256 newCadPeg18) external onlyGovernanceOrOwner {
        _setCadPeg(newCadPeg18, false);
    }

    function setUserRedeemRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        _setUserRedeemRate(newRateBps);
    }

    function setMerchantRedeemRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        _setMerchantRedeemRate(newRateBps);
    }

    function setCharityMintRate(uint256 newRateBps) external onlyGovernanceOrOwner {
        _setCharityMintRate(newRateBps);
    }

    function pauseMinting() external onlyGovernanceOrOwner {
        mintingPaused = true;
        emit MintingPauseUpdated(true, msg.sender);
    }

    function unpauseMinting() external onlyGovernanceOrOwner {
        mintingPaused = false;
        emit MintingPauseUpdated(false, msg.sender);
    }

    function pauseRedemption() external onlyGovernanceOrOwner {
        redemptionPaused = true;
        emit RedemptionPauseUpdated(true, msg.sender);
    }

    function unpauseRedemption() external onlyGovernanceOrOwner {
        redemptionPaused = false;
        emit RedemptionPauseUpdated(false, msg.sender);
    }

    function pauseAssetForTreasury(bytes32 assetId) external onlyGovernanceOrOwner {
        assetTreasuryPaused[assetId] = true;
        emit TreasuryAssetPauseUpdated(assetId, true, msg.sender);
    }

    function unpauseAssetForTreasury(bytes32 assetId) external onlyGovernanceOrOwner {
        assetTreasuryPaused[assetId] = false;
        emit TreasuryAssetPauseUpdated(assetId, false, msg.sender);
    }

    function isMintingPaused() external view returns (bool) {
        return mintingPaused;
    }

    function isRedemptionPaused() external view returns (bool) {
        return redemptionPaused;
    }

    function isTreasuryAssetPaused(bytes32 assetId) external view returns (bool) {
        return assetTreasuryPaused[assetId];
    }

    function getCadPeg() external view returns (uint256) {
        return cadPeg18;
    }

    function getUserRedeemRate() external view returns (uint256) {
        return userRedeemRateBps;
    }

    function getMerchantRedeemRate() external view returns (uint256) {
        return merchantRedeemRateBps;
    }

    function getCharityMintRate() external view returns (uint256) {
        return charityMintRateBps;
    }

    function _resolveActiveAsset(bytes32 assetId) internal view returns (IReserveRegistry.ReserveAsset memory asset) {
        asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        if (asset.assetId == bytes32(0)) revert UnknownAsset(assetId);
        if (asset.status != IReserveRegistry.ReserveAssetStatus.Active) revert AssetInactive(assetId);
        if (assetTreasuryPaused[assetId]) revert AssetPaused(assetId);
    }

    function _resolveMintCharity(uint256 requestedCharityId)
        internal
        view
        returns (uint256 charityId, address charityWallet)
    {
        ICharityRegistry registry = ICharityRegistry(charityRegistry);

        charityId = requestedCharityId;
        if (charityId == 0 || !registry.isActiveCharity(charityId)) {
            charityId = registry.getDefaultCharityId();
        }

        if (charityId == 0 || !registry.isActiveCharity(charityId)) {
            revert InvalidCharityResolution(charityId);
        }

        charityWallet = registry.getCharityWallet(charityId);
        if (charityWallet == address(0)) revert InvalidCharityResolution(charityId);
    }

    function _grossCadValueFromTcoin(uint256 tcoinAmount) internal view returns (uint256 grossCad18) {
        grossCad18 = (tcoinAmount * cadPeg18) / VALUE_SCALE;
    }

    function _tcoinFromCad(uint256 cadValue18) internal view returns (uint256 tcoinAmount) {
        tcoinAmount = (cadValue18 * VALUE_SCALE) / cadPeg18;
    }

    function _assetAmountFromCad(bytes32 assetId, uint256 cadValue18)
        internal
        view
        returns (uint256 assetAmount, bool usedFallback)
    {
        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        (uint256 price18,, bool usedFallbackQuote) = IOracleRouter(oracleRouter).getCadPrice(assetId);
        assetAmount = (cadValue18 * (10 ** asset.tokenDecimals)) / price18;
        usedFallback = usedFallbackQuote;
    }

    function _previewRedeem(bytes32 assetId, uint256 tcoinAmount, uint256 rateBps)
        internal
        view
        returns (uint256 assetOut, bool usedFallbackOracle, uint256 grossCad18, uint256 redeemableCad18)
    {
        _resolveActiveAsset(assetId);
        grossCad18 = _grossCadValueFromTcoin(tcoinAmount);
        redeemableCad18 = (grossCad18 * rateBps) / BPS_DENOMINATOR;
        (assetOut, usedFallbackOracle) = _assetAmountFromCad(assetId, redeemableCad18);
    }

    function _ensureSufficientReserve(bytes32 assetId, uint256 requested) internal view {
        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        uint256 available = IERC20(asset.token).balanceOf(address(this));
        if (available < requested) {
            revert InsufficientReserveBalance(assetId, requested, available);
        }
    }

    function _setCadPeg(uint256 newCadPeg18, bool initializing) internal {
        if (newCadPeg18 == 0) revert InvalidCadPeg();
        uint256 old = cadPeg18;
        if (!initializing && old != 0) {
            uint256 lowerBound = old - ((old * CAD_PEG_MAX_DELTA_BPS) / BPS_DENOMINATOR);
            uint256 upperBound = old + ((old * CAD_PEG_MAX_DELTA_BPS) / BPS_DENOMINATOR);
            if (newCadPeg18 < lowerBound || newCadPeg18 > upperBound) {
                revert InvalidPegChange(old, newCadPeg18);
            }
        }
        cadPeg18 = newCadPeg18;
        emit CadPegUpdated(old, newCadPeg18);
    }

    function _setUserRedeemRate(uint256 newRateBps) internal {
        if (newRateBps > BPS_DENOMINATOR) revert InvalidRedeemRate();
        uint256 old = userRedeemRateBps;
        userRedeemRateBps = newRateBps;
        emit UserRedeemRateUpdated(old, newRateBps);
    }

    function _setMerchantRedeemRate(uint256 newRateBps) internal {
        if (newRateBps > BPS_DENOMINATOR) revert InvalidRedeemRate();
        uint256 old = merchantRedeemRateBps;
        merchantRedeemRateBps = newRateBps;
        emit MerchantRedeemRateUpdated(old, newRateBps);
    }

    function _setCharityMintRate(uint256 newRateBps) internal {
        if (newRateBps > BPS_DENOMINATOR) revert InvalidCharityMintRate();
        uint256 old = charityMintRateBps;
        charityMintRateBps = newRateBps;
        emit CharityMintRateUpdated(old, newRateBps);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
