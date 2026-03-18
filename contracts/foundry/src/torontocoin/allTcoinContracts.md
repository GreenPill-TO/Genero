# TCOIN Treasury Split Mirror

This mirror tracks the live treasury-split source of truth for the TorontoCoin contracts that define reserve custody and reserve-backed settlement.

The core rule is:

- `Treasury` is the only reserve vault
- `TreasuryController` prices, mints/burns mrTCOIN, enforces policy, and instructs the vault

## `ITreasuryVault.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryVault {
    function depositReserveFrom(address from, address token, uint256 amount) external returns (bool);
    function withdrawReserveTo(address to, address token, uint256 amount) external returns (bool);
    function reserveBalance(address token) external view returns (uint256);
}
```

## `ITreasuryMinting.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasuryMinting {
    function depositAndMint(bytes32 assetId, uint256 assetAmount, uint256 requestedCharityId, uint256 minTcoinOut)
        external
        returns (uint256 userTcoinOut, uint256 charityTcoinOut);

    function previewMint(bytes32 assetId, uint256 assetAmount, uint256 requestedCharityId)
        external
        view
        returns (
            uint256 userTcoinOut,
            uint256 charityTcoinOut,
            uint256 resolvedCharityId,
            bool usedFallbackOracle,
            uint256 cadValue18
        );

    function tcoinToken() external view returns (address);
    function treasury() external view returns (address);
}
```

## `Treasury.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable {
    using SafeERC20 for IERC20;

    error ZeroAddressOwner();
    error ZeroAddressToken();
    error ZeroAddressTarget();
    error ZeroAddressCaller();
    error ZeroAmount();
    error Unauthorized();
    error InsufficientReserveBalance(address token, uint256 requested, uint256 available);
    error SameAuthorizationState(address caller, bool authorized);

    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event ReserveDeposited(address indexed actor, address indexed from, address indexed token, uint256 amount);
    event ReserveWithdrawn(address indexed actor, address indexed to, address indexed token, uint256 amount);
    event EmergencySweep(address indexed actor, address indexed token, address indexed to, uint256 amount);

    mapping(address => bool) public authorizedCallers;

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
    }

    modifier onlyAuthorizedCaller() {
        if (!authorizedCallers[msg.sender]) revert Unauthorized();
        _;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (caller == address(0)) revert ZeroAddressCaller();
        if (authorizedCallers[caller] == authorized) revert SameAuthorizationState(caller, authorized);

        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function depositReserveFrom(address from, address token, uint256 amount)
        external
        onlyAuthorizedCaller
        returns (bool)
    {
        if (from == address(0)) revert ZeroAddressTarget();
        if (token == address(0)) revert ZeroAddressToken();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(from, address(this), amount);
        emit ReserveDeposited(msg.sender, from, token, amount);
        return true;
    }

    function withdrawReserveTo(address to, address token, uint256 amount) external onlyAuthorizedCaller returns (bool) {
        if (to == address(0)) revert ZeroAddressTarget();
        if (token == address(0)) revert ZeroAddressToken();
        if (amount == 0) revert ZeroAmount();

        uint256 available = IERC20(token).balanceOf(address(this));
        if (available < amount) revert InsufficientReserveBalance(token, amount, available);

        IERC20(token).safeTransfer(to, amount);
        emit ReserveWithdrawn(msg.sender, to, token, amount);
        return true;
    }

    function reserveBalance(address token) external view returns (uint256) {
        if (token == address(0)) revert ZeroAddressToken();
        return IERC20(token).balanceOf(address(this));
    }

    function emergencySweep(address token, address to, uint256 amount) external onlyOwner returns (bool) {
        if (token == address(0)) revert ZeroAddressToken();
        if (to == address(0)) revert ZeroAddressTarget();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(to, amount);
        emit EmergencySweep(msg.sender, token, to, amount);
        return true;
    }
}
```

## `TreasuryController.sol`

Reserve custody notes:

- reserve deposits call `ITreasuryVault(treasury).depositReserveFrom(...)`
- reserve withdrawals call `ITreasuryVault(treasury).withdrawReserveTo(...)`
- reserve sufficiency and collateralization call `ITreasuryVault(treasury).reserveBalance(...)`
- `depositAssetForLiquidityRoute(...)` is still a controller entrypoint, but the reserve asset ends in `Treasury`

```solidity
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
    mapping(address => uint256) private merchantRedemptionAllowance;

    mapping(bytes32 => uint256) public totalDepositedByAsset;
    mapping(bytes32 => uint256) public totalRedeemedByAsset;
    uint256 public totalTcoinMintedViaDeposits;
    uint256 public totalTcoinBurnedViaRedemption;
    uint256 public totalCharityTcoinMinted;

    // See the live Solidity source for the full implementation.
    // This mirror intentionally highlights the treasury split surface and custody boundary.
}
```
