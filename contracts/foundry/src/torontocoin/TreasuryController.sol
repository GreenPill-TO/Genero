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
import {ITreasuryVault} from "./interfaces/ITreasuryVault.sol";

contract TreasuryController is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant CAD_PEG_MAX_DELTA_BPS = 1_000;
    uint256 public constant VALUE_SCALE = 1e18;

    struct MintComputation {
        address assetToken;
        uint256 cadValue18;
        uint256 userTcoinOut;
        uint256 charityTcoinOut;
        uint256 resolvedCharityId;
        address charityWallet;
        bool usedFallbackOracle;
    }

    struct RedeemComputation {
        address assetToken;
        uint256 assetOut;
        bool usedFallbackOracle;
        uint256 grossCad18;
        uint256 redeemableCad18;
    }

    error ZeroAddressOwner();
    error ZeroAddressGovernance();
    error ZeroAddressIndexer();
    error ZeroAddressToken();
    error ZeroAddressRegistry();
    error ZeroAddressTreasury();
    error ZeroAddressRouter();
    error ZeroAddressPayer();
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
    error OvercollateralizationTargetTooLow();
    error CharityMintExceedsHeadroom(uint256 requested, uint256 maxMintable);
    error InvalidCharityTarget(uint256 charityId);
    error NotLiquidityRouter(address caller);

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    event IndexerUpdated(address indexed oldIndexer, address indexed newIndexer);
    event TcoinTokenUpdated(address indexed oldToken, address indexed newToken);
    event ReserveRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event OracleRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event LiquidityRouterUpdated(address indexed oldRouter, address indexed newRouter);

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
    event OvercollateralizationTargetUpdated(uint256 oldTarget18, uint256 newTarget18);
    event AdminCanMintToCharityUpdated(bool oldValue, bool newValue, address indexed actor);

    event CharityMintedFromExcess(
        uint256 indexed charityId,
        address indexed charityWallet,
        uint256 amount,
        uint256 collateralizationRatioBefore18,
        uint256 collateralizationRatioAfter18
    );

    event MintingPauseUpdated(bool paused, address indexed actor);
    event RedemptionPauseUpdated(bool paused, address indexed actor);
    event TreasuryAssetPauseUpdated(bytes32 indexed assetId, bool paused, address indexed actor);

    address public treasury;
    address public governance;
    address public indexer;
    address public tcoinToken;
    address public reserveRegistry;
    address public charityRegistry;
    address public poolRegistry;
    address public oracleRouter;
    address public liquidityRouter;

    uint256 public cadPeg18;
    uint256 public userRedeemRateBps;
    uint256 public merchantRedeemRateBps;
    uint256 public charityMintRateBps;
    uint256 public overcollateralizationTarget18;
    bool public adminCanMintToCharity;

    bool public mintingPaused;
    bool public redemptionPaused;

    mapping(bytes32 => bool) public assetTreasuryPaused;
    mapping(address => uint256) private _merchantRedemptionAllowance;

    mapping(bytes32 => uint256) public totalDepositedByAsset;
    mapping(bytes32 => uint256) public totalRedeemedByAsset;
    uint256 public totalTcoinMintedViaDeposits;
    uint256 public totalTcoinBurnedViaRedemption;
    uint256 public totalCharityTcoinMinted;

    modifier onlyGovernanceOrOwner() {
        if (msg.sender != governance && msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyCharityMintAuthority() {
        if (msg.sender == governance) {
            _;
            return;
        }

        if (msg.sender == owner() && adminCanMintToCharity) {
            _;
            return;
        }

        revert Unauthorized();
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

    modifier onlyLiquidityRouter() {
        if (msg.sender != liquidityRouter) revert NotLiquidityRouter(msg.sender);
        _;
    }

    function initialize(
        address owner_,
        address governance_,
        address indexer_,
        address treasury_,
        address tcoinToken_,
        address reserveRegistry_,
        address charityRegistry_,
        address poolRegistry_,
        address oracleRouter_,
        uint256 cadPeg18_,
        uint256 userRedeemRateBps_,
        uint256 merchantRedeemRateBps_,
        uint256 charityMintRateBps_,
        uint256 overcollateralizationTarget18_
    ) external initializer {
        if (owner_ == address(0)) revert ZeroAddressOwner();
        if (governance_ == address(0)) revert ZeroAddressGovernance();
        if (indexer_ == address(0)) revert ZeroAddressIndexer();
        if (treasury_ == address(0)) revert ZeroAddressTreasury();
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

        _setCorePointers(
            treasury_,
            governance_,
            indexer_,
            tcoinToken_,
            reserveRegistry_,
            charityRegistry_,
            poolRegistry_,
            oracleRouter_
        );

        _setCadPeg(cadPeg18_, true);
        _setUserRedeemRate(userRedeemRateBps_);
        _setMerchantRedeemRate(merchantRedeemRateBps_);
        _setCharityMintRate(charityMintRateBps_);
        _setOvercollateralizationTarget(overcollateralizationTarget18_);
        adminCanMintToCharity = true;
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddressTreasury();
        if (treasury_ == treasury) revert SameAddress();
        address old = treasury;
        treasury = treasury_;
        emit TreasuryUpdated(old, treasury_);
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

    function setLiquidityRouter(address liquidityRouter_) external onlyOwner {
        if (liquidityRouter_ == address(0)) revert ZeroAddressRouter();
        if (liquidityRouter_ == liquidityRouter) revert SameAddress();
        address old = liquidityRouter;
        liquidityRouter = liquidityRouter_;
        emit LiquidityRouterUpdated(old, liquidityRouter_);
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

        MintComputation memory mintResult = _computeMint(assetId, assetAmount, requestedCharityId);
        userTcoinOut = mintResult.userTcoinOut;
        if (userTcoinOut < minTcoinOut) revert InvalidMinOut(userTcoinOut, minTcoinOut);
        charityTcoinOut = mintResult.charityTcoinOut;

        ITreasuryVault(treasury).depositReserveFrom(msg.sender, mintResult.assetToken, assetAmount);
        ITCOINToken(tcoinToken).mint(msg.sender, userTcoinOut, "");
        if (charityTcoinOut > 0) {
            ITCOINToken(tcoinToken).mint(mintResult.charityWallet, charityTcoinOut, "");
        }

        totalDepositedByAsset[assetId] += assetAmount;
        totalTcoinMintedViaDeposits += userTcoinOut;
        totalCharityTcoinMinted += charityTcoinOut;

        emit ReserveDeposited(
            msg.sender,
            assetId,
            assetAmount,
            mintResult.cadValue18,
            userTcoinOut,
            charityTcoinOut,
            mintResult.resolvedCharityId,
            mintResult.usedFallbackOracle
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
        MintComputation memory mintResult = _computeMint(assetId, assetAmount, requestedCharityId);
        userTcoinOut = mintResult.userTcoinOut;
        charityTcoinOut = mintResult.charityTcoinOut;
        resolvedCharityId = mintResult.resolvedCharityId;
        usedFallbackOracle = mintResult.usedFallbackOracle;
        cadValue18 = mintResult.cadValue18;
    }

    function depositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount, address payer)
        external
        nonReentrant
        onlyLiquidityRouter
        whenMintingNotPaused
        returns (uint256 mrTcoinOut)
    {
        if (payer == address(0)) revert ZeroAddressPayer();
        if (assetAmount == 0) revert ZeroAmount();

        MintComputation memory mintResult = _computeMint(assetId, assetAmount, 0);
        mrTcoinOut = mintResult.userTcoinOut;

        ITreasuryVault(treasury).depositReserveFrom(payer, mintResult.assetToken, assetAmount);
        ITCOINToken(tcoinToken).mint(msg.sender, mrTcoinOut, "");

        totalDepositedByAsset[assetId] += assetAmount;
        totalTcoinMintedViaDeposits += mrTcoinOut;

        emit LiquidityRouteDeposited(
            msg.sender, payer, assetId, assetAmount, mintResult.cadValue18, mrTcoinOut, mintResult.usedFallbackOracle
        );
    }

    function previewDepositAssetForLiquidityRoute(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 mrTcoinOut, uint256 cadValue18, bool usedFallbackOracle)
    {
        if (assetAmount == 0) revert ZeroAmount();
        MintComputation memory mintResult = _computeMint(assetId, assetAmount, 0);
        mrTcoinOut = mintResult.userTcoinOut;
        cadValue18 = mintResult.cadValue18;
        usedFallbackOracle = mintResult.usedFallbackOracle;
    }

    function previewLiquidityRouteDeposit(bytes32 assetId, uint256 assetAmount)
        external
        view
        returns (uint256 mrTcoinOut, bool usedFallbackOracle, uint256 cadValue18)
    {
        (mrTcoinOut, cadValue18, usedFallbackOracle) = this.previewDepositAssetForLiquidityRoute(assetId, assetAmount);
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

        RedeemComputation memory redeemResult = _computeRedeem(assetId, tcoinAmount, userRedeemRateBps);
        assetOut = redeemResult.assetOut;

        if (assetOut < minAssetOut) revert InvalidMinOut(assetOut, minAssetOut);

        IERC20(tcoinToken).safeTransferFrom(msg.sender, address(this), tcoinAmount);
        ITCOINToken(tcoinToken).burn(tcoinAmount);
        ITreasuryVault(treasury).withdrawReserveTo(msg.sender, redeemResult.assetToken, assetOut);

        totalRedeemedByAsset[assetId] += assetOut;
        totalTcoinBurnedViaRedemption += tcoinAmount;

        emit RedeemedAsUser(
            msg.sender,
            assetId,
            tcoinAmount,
            assetOut,
            redeemResult.grossCad18,
            redeemResult.redeemableCad18,
            redeemResult.usedFallbackOracle
        );
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

        uint256 allowanceAvailable = _merchantRedemptionAllowance[msg.sender];
        if (allowanceAvailable < tcoinAmount) {
            revert MerchantAllowanceExceeded(msg.sender, tcoinAmount, allowanceAvailable);
        }

        RedeemComputation memory redeemResult = _computeRedeem(assetId, tcoinAmount, merchantRedeemRateBps);
        assetOut = redeemResult.assetOut;

        if (assetOut < minAssetOut) revert InvalidMinOut(assetOut, minAssetOut);

        _merchantRedemptionAllowance[msg.sender] = allowanceAvailable - tcoinAmount;

        IERC20(tcoinToken).safeTransferFrom(msg.sender, address(this), tcoinAmount);
        ITCOINToken(tcoinToken).burn(tcoinAmount);
        ITreasuryVault(treasury).withdrawReserveTo(msg.sender, redeemResult.assetToken, assetOut);

        totalRedeemedByAsset[assetId] += assetOut;
        totalTcoinBurnedViaRedemption += tcoinAmount;

        emit MerchantAllowanceUpdated(msg.sender, allowanceAvailable, allowanceAvailable - tcoinAmount, address(this));
        emit RedeemedAsMerchant(
            msg.sender,
            assetId,
            tcoinAmount,
            assetOut,
            redeemResult.grossCad18,
            redeemResult.redeemableCad18,
            _merchantRedemptionAllowance[msg.sender],
            redeemResult.usedFallbackOracle
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
        allowanceRemaining = _merchantRedemptionAllowance[merchant];
        (assetOut, usedFallbackOracle, grossCad18, redeemableCad18) =
            _previewRedeem(assetId, tcoinAmount, merchantRedeemRateBps);
    }

    function setMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        uint256 oldAmount = _merchantRedemptionAllowance[merchant];
        _merchantRedemptionAllowance[merchant] = amount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, amount, msg.sender);
    }

    function increaseMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 oldAmount = _merchantRedemptionAllowance[merchant];
        uint256 newAmount = oldAmount + amount;
        _merchantRedemptionAllowance[merchant] = newAmount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, newAmount, msg.sender);
    }

    function decreaseMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 oldAmount = _merchantRedemptionAllowance[merchant];
        uint256 newAmount = amount >= oldAmount ? 0 : oldAmount - amount;
        _merchantRedemptionAllowance[merchant] = newAmount;
        emit MerchantAllowanceUpdated(merchant, oldAmount, newAmount, msg.sender);
    }

    function getMerchantRedemptionAllowance(address merchant) external view returns (uint256) {
        return _merchantRedemptionAllowance[merchant];
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

    function setOvercollateralizationTarget(uint256 newTarget18) external onlyGovernance {
        _setOvercollateralizationTarget(newTarget18);
    }

    function setAdminCanMintToCharity(bool enabled) external onlyGovernanceOrOwner {
        bool oldValue = adminCanMintToCharity;
        adminCanMintToCharity = enabled;
        emit AdminCanMintToCharityUpdated(oldValue, enabled, msg.sender);
    }

    function mintToCharity(uint256 amount) external onlyCharityMintAuthority {
        _mintToCharity(ICharityRegistry(charityRegistry).getDefaultCharityId(), amount);
    }

    function mintToCharity(uint256 charityId, uint256 amount) external onlyCharityMintAuthority {
        _mintToCharity(charityId, amount);
    }

    function getTotalReserveValue18() public view returns (uint256 totalReserveValue18) {
        bytes32[] memory assetIds = IReserveRegistry(reserveRegistry).listReserveAssetIds();

        for (uint256 i = 0; i < assetIds.length; ++i) {
            IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetIds[i]);
            if (asset.token == address(0)) continue;

            uint256 balance = ITreasuryVault(treasury).reserveBalance(asset.token);
            if (balance == 0) continue;

            (uint256 cadValue18,,) = IOracleRouter(oracleRouter).previewCadValue(assetIds[i], balance);
            totalReserveValue18 += cadValue18;
        }
    }

    function getCurrentMrTcoinSupply() public view returns (uint256) {
        return ITCOINToken(tcoinToken).totalSupply();
    }

    function getCurrentCollateralizationRatio18() public view returns (uint256) {
        uint256 supply = getCurrentMrTcoinSupply();
        if (supply == 0) return type(uint256).max;

        return (getTotalReserveValue18() * VALUE_SCALE) / supply;
    }

    function getMaxMintableCharityAmount() public view returns (uint256) {
        uint256 supply = getCurrentMrTcoinSupply();
        uint256 reserveValue18 = getTotalReserveValue18();
        uint256 maxSupportedSupply = (reserveValue18 * VALUE_SCALE) / overcollateralizationTarget18;

        if (maxSupportedSupply <= supply) return 0;
        return maxSupportedSupply - supply;
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

    function _previewRedeem(bytes32 assetId, uint256 tcoinAmount, uint256 redeemRateBps)
        internal
        view
        returns (uint256 assetOut, bool usedFallbackOracle, uint256 grossCad18, uint256 redeemableCad18)
    {
        IReserveRegistry.ReserveAsset memory asset = _resolveActiveAsset(assetId);

        grossCad18 = _cadFromTcoin(tcoinAmount);
        redeemableCad18 = (grossCad18 * redeemRateBps) / BPS_DENOMINATOR;

        (uint256 price18,, bool fallbackUsed) = IOracleRouter(oracleRouter).getCadPrice(assetId);
        usedFallbackOracle = fallbackUsed;
        assetOut = (redeemableCad18 * (10 ** asset.tokenDecimals)) / price18;

        _ensureSufficientReserve(assetId, assetOut);
    }

    function _setCorePointers(
        address treasury_,
        address governance_,
        address indexer_,
        address tcoinToken_,
        address reserveRegistry_,
        address charityRegistry_,
        address poolRegistry_,
        address oracleRouter_
    ) internal {
        treasury = treasury_;
        governance = governance_;
        indexer = indexer_;
        tcoinToken = tcoinToken_;
        reserveRegistry = reserveRegistry_;
        charityRegistry = charityRegistry_;
        poolRegistry = poolRegistry_;
        oracleRouter = oracleRouter_;

        emit TreasuryUpdated(address(0), treasury_);
        emit GovernanceUpdated(address(0), governance_);
        emit IndexerUpdated(address(0), indexer_);
        emit TcoinTokenUpdated(address(0), tcoinToken_);
        emit ReserveRegistryUpdated(address(0), reserveRegistry_);
        emit CharityRegistryUpdated(address(0), charityRegistry_);
        emit PoolRegistryUpdated(address(0), poolRegistry_);
        emit OracleRouterUpdated(address(0), oracleRouter_);
    }

    function _computeMint(bytes32 assetId, uint256 assetAmount, uint256 requestedCharityId)
        internal
        view
        returns (MintComputation memory mintResult)
    {
        mintResult.assetToken = _resolveActiveAsset(assetId).token;
        (mintResult.cadValue18,, mintResult.usedFallbackOracle) =
            IOracleRouter(oracleRouter).previewCadValue(assetId, assetAmount);
        mintResult.userTcoinOut = _tcoinFromCad(mintResult.cadValue18);
        mintResult.charityTcoinOut = (mintResult.userTcoinOut * charityMintRateBps) / BPS_DENOMINATOR;

        if (requestedCharityId != 0 || charityMintRateBps > 0) {
            (mintResult.resolvedCharityId, mintResult.charityWallet) = _resolveMintCharity(requestedCharityId);
        }
    }

    function _computeRedeem(bytes32 assetId, uint256 tcoinAmount, uint256 redeemRateBps)
        internal
        view
        returns (RedeemComputation memory redeemResult)
    {
        redeemResult.assetToken = IReserveRegistry(reserveRegistry).getReserveAsset(assetId).token;
        (
            redeemResult.assetOut,
            redeemResult.usedFallbackOracle,
            redeemResult.grossCad18,
            redeemResult.redeemableCad18
        ) = _previewRedeem(assetId, tcoinAmount, redeemRateBps);
    }

    function _resolveActiveAsset(bytes32 assetId) internal view returns (IReserveRegistry.ReserveAsset memory asset) {
        if (assetId == bytes32(0)) revert UnknownAsset(assetId);
        asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        if (asset.status == IReserveRegistry.ReserveAssetStatus.None) revert UnknownAsset(assetId);
        if (asset.status != IReserveRegistry.ReserveAssetStatus.Active) revert AssetInactive(assetId);
        if (assetTreasuryPaused[assetId]) revert AssetPaused(assetId);
    }

    function _resolveMintCharity(uint256 requestedCharityId) internal view returns (uint256 charityId, address wallet) {
        charityId = requestedCharityId;
        if (charityId == 0) {
            charityId = ICharityRegistry(charityRegistry).getDefaultCharityId();
        }

        if (charityId == 0 || !ICharityRegistry(charityRegistry).isActiveCharity(charityId)) {
            revert InvalidCharityResolution(charityId);
        }

        wallet = ICharityRegistry(charityRegistry).getCharityWallet(charityId);
        if (wallet == address(0)) revert InvalidCharityResolution(charityId);
    }

    function _mintToCharity(uint256 charityId, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        if (charityId == 0 || !ICharityRegistry(charityRegistry).isActiveCharity(charityId)) {
            revert InvalidCharityTarget(charityId);
        }

        address charityWallet = ICharityRegistry(charityRegistry).getCharityWallet(charityId);
        if (charityWallet == address(0)) revert InvalidCharityTarget(charityId);

        uint256 maxMintable = getMaxMintableCharityAmount();
        if (amount > maxMintable) revert CharityMintExceedsHeadroom(amount, maxMintable);

        uint256 reserveValue18 = getTotalReserveValue18();
        uint256 supplyBefore = getCurrentMrTcoinSupply();
        uint256 ratioBefore18 = supplyBefore == 0 ? type(uint256).max : (reserveValue18 * VALUE_SCALE) / supplyBefore;
        uint256 ratioAfter18 = (reserveValue18 * VALUE_SCALE) / (supplyBefore + amount);

        ITCOINToken(tcoinToken).mint(charityWallet, amount, "");
        totalCharityTcoinMinted += amount;

        emit CharityMintedFromExcess(charityId, charityWallet, amount, ratioBefore18, ratioAfter18);
    }

    function _ensureSufficientReserve(bytes32 assetId, uint256 assetOut) internal view {
        IReserveRegistry.ReserveAsset memory asset = IReserveRegistry(reserveRegistry).getReserveAsset(assetId);
        uint256 available = ITreasuryVault(treasury).reserveBalance(asset.token);
        if (available < assetOut) revert InsufficientReserveBalance(assetId, assetOut, available);
    }

    function _tcoinFromCad(uint256 cadValue18) internal view returns (uint256) {
        return (cadValue18 * VALUE_SCALE) / cadPeg18;
    }

    function _cadFromTcoin(uint256 tcoinAmount) internal view returns (uint256) {
        return (tcoinAmount * cadPeg18) / VALUE_SCALE;
    }

    function _setCadPeg(uint256 newCadPeg18, bool initialSet) internal {
        if (newCadPeg18 == 0) revert InvalidCadPeg();

        if (!initialSet) {
            uint256 oldPeg18 = cadPeg18;
            uint256 delta = oldPeg18 > newCadPeg18 ? oldPeg18 - newCadPeg18 : newCadPeg18 - oldPeg18;
            if ((delta * BPS_DENOMINATOR) / oldPeg18 > CAD_PEG_MAX_DELTA_BPS) {
                revert InvalidPegChange(oldPeg18, newCadPeg18);
            }
        }

        uint256 old = cadPeg18;
        cadPeg18 = newCadPeg18;
        emit CadPegUpdated(old, newCadPeg18);
    }

    function _setUserRedeemRate(uint256 newRateBps) internal {
        if (newRateBps == 0 || newRateBps > BPS_DENOMINATOR) revert InvalidRedeemRate();
        uint256 old = userRedeemRateBps;
        userRedeemRateBps = newRateBps;
        emit UserRedeemRateUpdated(old, newRateBps);
    }

    function _setMerchantRedeemRate(uint256 newRateBps) internal {
        if (newRateBps == 0 || newRateBps > BPS_DENOMINATOR) revert InvalidRedeemRate();
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

    function _setOvercollateralizationTarget(uint256 newTarget18) internal {
        if (newTarget18 < VALUE_SCALE) revert OvercollateralizationTargetTooLow();
        uint256 old = overcollateralizationTarget18;
        overcollateralizationTarget18 = newTarget18;
        emit OvercollateralizationTargetUpdated(old, newTarget18);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
