# TCOIN Contract Design Spec — TreasuryController

## Purpose

This document defines the design of the `TreasuryController` contract as a standalone module within the TCOIN system.

`TreasuryController` is the economic engine of the protocol.

It is responsible for:

* receiving approved reserve assets
* valuing deposits via oracle-routed CAD pricing
* minting TCOIN at par against reserve deposits
* minting the charity uplift on deposit
* burning TCOIN on redemption
* redeeming reserve assets out to users and approved merchants
* applying different redemption rates to users and merchants
* enforcing merchant redemption allowances
* exposing clean previews for minting and redemption
* providing emergency pause controls for minting and redemption

It should be one of the most carefully designed and audited contracts in the system.

It must not implement governance proposal state, steward voting logic, or charity membership logic.

---

# 1. Role in the System

`TreasuryController` sits at the center of protocol economics.

It composes:

* `TCOINToken`
* `ReserveRegistry`
* `CharityRegistry`
* `PoolRegistry`
* `OracleRouter`

It answers these core questions:

```text
If someone deposits reserve asset X, how much TCOIN should be minted?
```

```text
If someone redeems Y TCOIN into reserve asset X, how much reserve asset should they receive?
```

```text
Is this address eligible for merchant redemption treatment?
```

```text
Does this merchant still have enough redemption allowance left?
```

This contract should be the only place where reserve assets actually move in and out of the protocol.

---

# 2. Core Design Principles

## 2.1 Minting is simple

Minting is intentionally simple:

* user deposits approved reserve asset
* oracle gives CAD value
* CAD value converts to TCOIN at current peg
* user receives TCOIN at par
* charity uplift is minted on top

There is:

* no bonding curve
* no collateral factor
* no asset-specific haircut
* no mint queue

---

## 2.2 Redemption is where incentives differ

Redemption is intentionally asymmetric.

### User redemption

Users redeem at a discounted rate.

Example:

* `8000` bps = 80%

### Merchant redemption

Approved merchants redeem at a better rate.

Example:

* `9700` bps = 97%

But merchant redemption is limited by a merchant-specific allowance maintained by a centralized off-chain indexer and written on-chain.

---

## 2.3 Merchant allowance is consumed in TCOIN units

This decision is now fixed.

When a merchant redeems:

* allowance consumption is measured in **TCOIN units**, not CAD-equivalent units

That means if a merchant redeems `100 TCOIN`, their allowance is reduced by `100 TCOIN`, regardless of which reserve asset they choose.

This is cleaner and avoids oracle-dependent allowance drift.

---

## 2.4 Charity uplift goes to selected charity, else default UBI charity

Minting against reserve deposits should always mint the uplift to:

1. the user-selected charity if it is active
2. otherwise the default charity from `CharityRegistry`

This should be resolved inside `TreasuryController` through `CharityRegistry.resolveMintCharity(...)` or an equivalent helper.

---

## 2.5 Reserve assets are held on-chain

Reserve assets are actually held by the treasury/controller on-chain.

If off-chain fiat backing exists, it must still be represented on-chain through a reserve asset token such as:

* protocol CAD token
* protocol TTC accounting token

So the controller does not distinguish between “real on-chain assets” and “off-chain-backed accounting assets.”

It only handles ERC20 reserve tokens.

---

## 2.6 Direct redemption into reserve assets

Users and merchants redeem directly into any active reserve asset.

There is no requirement in v1 to redeem through CAD only.

The selected reserve asset must:

* be active in `ReserveRegistry`
* have a fresh oracle price
* have sufficient balance available in the treasury/controller

---

# 3. Scope

## In scope

* deposit reserve assets
* mint TCOIN against deposit
* mint charity uplift
* preview mint results
* redeem TCOIN into reserve assets
* preview user redemption
* preview merchant redemption
* enforce user redemption rate
* enforce merchant redemption rate
* enforce merchant redemption allowance
* maintain protocol-level redemption parameters
* emergency pause of minting/redemption
* per-asset treasury pause flags if desired

## Out of scope

* reserve asset approval itself
* oracle assignment itself
* charity/steward governance
* proposal creation and voting
* off-chain indexer logic
* merchant trade detection

---

# 4. Dependencies

`TreasuryController` depends on:

## `TCOINToken`

For:

* minting user TCOIN
* minting charity uplift
* burning TCOIN on redemption

## `ReserveRegistry`

For:

* checking whether reserve asset is active
* getting reserve token address
* getting token decimals

## `OracleRouter`

For:

* normalized CAD price per reserve asset
* normalized CAD value for deposit/redemption calculations

## `CharityRegistry`

For:

* resolving selected charity vs default charity fallback
* checking charity status if needed

## `PoolRegistry`

For:

* determining whether caller qualifies as approved merchant in active pool

---

# 5. Units and Precision

## 5.1 Redemption rates

Store user and merchant redemption rates in **basis points**.

Examples:

* `8000` = 80%
* `9700` = 97%
* `10000` = 100%

This is now fixed.

## 5.2 Charity mint rate

Also store charity mint uplift rate in **basis points**.

Example:

* `500` = 5% uplift

## 5.3 CAD peg

The CAD→TCOIN peg should be stored in a clearly documented normalized format.

Recommended approach:

```text
cadPerTcoin in 2 decimals or 18 decimals?
```

For implementation cleanliness, I recommend **18-decimal normalized precision**.

Example:

* if 1 TCOIN = 3.30 CAD
* peg = `3.30 * 1e18`

This avoids mixed precision with oracle outputs.

If you insist on legacy-style 2-decimal peg storage, that is workable, but 18-decimal precision is cleaner.

## 5.4 Merchant redemption allowance

Merchant allowance should be stored in **TCOIN token units**, using the token’s standard decimals.

---

# 6. Recommended State

## Core pointers

```solidity
address public governance;
address public tcoinToken;
address public reserveRegistry;
address public charityRegistry;
address public poolRegistry;
address public oracleRouter;
```

## Parameters

```solidity
uint256 public cadPeg18;
uint256 public userRedeemRateBps;
uint256 public merchantRedeemRateBps;
uint256 public charityMintRateBps;
```

## Pause state

```solidity
bool public mintingPaused;
bool public redemptionPaused;
```

Optional per-asset treasury pause:

```solidity
mapping(bytes32 => bool) public assetTreasuryPaused;
```

## Merchant allowance

```solidity
mapping(address => uint256) private merchantRedemptionAllowance;
```

## Optional accounting counters

These are not strictly required but are useful:

```solidity
mapping(bytes32 => uint256) public totalDepositedByAsset;
mapping(bytes32 => uint256) public totalRedeemedByAsset;
uint256 public totalTcoinMintedViaDeposits;
uint256 public totalTcoinBurnedViaRedemption;
uint256 public totalCharityTcoinMinted;
```

These improve reporting and auditability.

---

# 7. Access Model

Recommended modifiers:

```solidity
modifier onlyGovernanceOrOwner()
modifier onlyIndexerOrOwner()
modifier whenMintingNotPaused()
modifier whenRedemptionNotPaused()
```

## `onlyGovernanceOrOwner`

Used for parameter updates and emergency controls.

## `onlyIndexerOrOwner`

Used for merchant allowance updates.

You will likely want a dedicated state variable:

```solidity
address public indexer;
```

so the centralized indexer can update merchant allowances directly.

---

# 8. Recommended Errors

```solidity
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
```

---

# 9. External Methods

## 9.1 Initialize

```solidity
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
) external initializer
```

### Behavior

* initialize ownership and upgradeability
* set all module pointers
* set peg and rates

### Validation

* no critical pointer may be zero
* rates should be bounded appropriately
* peg must be nonzero

### Suggested guards

* `userRedeemRateBps_ <= 10000`
* `merchantRedeemRateBps_ <= 10000`
* `charityMintRateBps_ <= some sensible max` (e.g. <= 10000, though operationally much lower)

---

## 9.2 Set governance

```solidity
function setGovernance(address governance_) external onlyOwner
```

---

## 9.3 Set indexer

```solidity
function setIndexer(address indexer_) external onlyOwner
```

---

## 9.4 Set module pointers

You may want separate owner-only setters for:

* `setTcoinToken(address)`
* `setReserveRegistry(address)`
* `setCharityRegistry(address)`
* `setPoolRegistry(address)`
* `setOracleRouter(address)`

These are useful in an upgradeable modular system.

---

# 10. Minting Flow

## 10.1 Deposit and mint

```solidity
function depositAndMint(
    bytes32 assetId,
    uint256 assetAmount,
    uint256 requestedCharityId,
    uint256 minTcoinOut
) external whenMintingNotPaused returns (uint256 userTcoinOut, uint256 charityTcoinOut)
```

## Purpose

Accept reserve asset deposit and mint TCOIN.

## Required behavior

1. require `assetAmount > 0`
2. check reserve asset is active in `ReserveRegistry`
3. check asset not treasury-paused
4. use `OracleRouter.previewCadValue(assetId, assetAmount)` to obtain CAD value in 18 decimals
5. convert CAD value to TCOIN amount using current peg
6. require resulting TCOIN amount >= `minTcoinOut`
7. resolve charity via `CharityRegistry`
8. compute charity uplift:

```text
charityTcoinOut = userTcoinOut * charityMintRateBps / 10000
```

9. transfer reserve asset from caller into controller
10. mint `userTcoinOut` to caller
11. mint `charityTcoinOut` to resolved charity wallet
12. update accounting counters
13. emit event

## Conversion formula

If:

* `cadValue18` = CAD value in 18 decimals
* `cadPeg18` = CAD per 1 TCOIN in 18 decimals

Then:

```text
userTcoinOut = cadValue18 * 1e18 / cadPeg18
```

assuming TCOIN uses 18 decimals.

This should be carefully documented and tested.

---

## 10.2 Preview mint

```solidity
function previewMint(
    bytes32 assetId,
    uint256 assetAmount,
    uint256 requestedCharityId
) external view returns (
    uint256 userTcoinOut,
    uint256 charityTcoinOut,
    uint256 resolvedCharityId,
    bool usedFallbackOracle,
    uint256 cadValue18
)
```

## Purpose

Frontend and integration helper.

### Behavior

Performs the same math as `depositAndMint` but without moving funds.

---

# 11. Redemption Flow

Redemption splits into user and merchant paths.

---

## 11.1 Redeem as user

```solidity
function redeemAsUser(
    bytes32 assetId,
    uint256 tcoinAmount,
    uint256 minAssetOut
) external whenRedemptionNotPaused returns (uint256 assetOut)
```

## Required behavior

1. require `tcoinAmount > 0`
2. check reserve asset active and not treasury-paused
3. get CAD value of `tcoinAmount` using peg
4. apply user redemption rate:

```text
redeemableCad18 = grossCad18 * userRedeemRateBps / 10000
```

5. convert CAD value into reserve asset amount using current oracle price
6. require `assetOut >= minAssetOut`
7. require controller has enough reserve asset balance
8. burn `tcoinAmount` from caller via `TCOINToken`
9. transfer `assetOut` reserve asset to caller
10. update accounting counters
11. emit event

---

## 11.2 Redeem as merchant

```solidity
function redeemAsMerchant(
    bytes32 assetId,
    uint256 tcoinAmount,
    uint256 minAssetOut
) external whenRedemptionNotPaused returns (uint256 assetOut)
```

## Required behavior

1. require `tcoinAmount > 0`
2. require `PoolRegistry.isMerchantApprovedInActivePool(msg.sender) == true`
3. require merchant redemption allowance >= `tcoinAmount`
4. check reserve asset active and not treasury-paused
5. get CAD value of `tcoinAmount` using peg
6. apply merchant redemption rate:

```text
redeemableCad18 = grossCad18 * merchantRedeemRateBps / 10000
```

7. convert CAD value into reserve asset amount using current oracle price
8. require `assetOut >= minAssetOut`
9. require controller has enough reserve asset balance
10. decrement merchant redemption allowance by `tcoinAmount`
11. burn `tcoinAmount` from caller
12. transfer reserve asset out
13. update accounting counters
14. emit event with remaining allowance

---

# 12. Preview Redemption

## 12.1 Preview user redemption

```solidity
function previewRedeemAsUser(
    bytes32 assetId,
    uint256 tcoinAmount
) external view returns (
    uint256 assetOut,
    bool usedFallbackOracle,
    uint256 grossCad18,
    uint256 redeemableCad18
)
```

## 12.2 Preview merchant redemption

```solidity
function previewRedeemAsMerchant(
    bytes32 assetId,
    uint256 tcoinAmount,
    address merchant
) external view returns (
    uint256 assetOut,
    bool eligible,
    uint256 allowanceRemaining,
    bool usedFallbackOracle,
    uint256 grossCad18,
    uint256 redeemableCad18
)
```

### Why include merchant address?

Useful for UI and off-chain quoting. It does not have to be `msg.sender` in a view helper.

---

# 13. Merchant Allowance Management

## 13.1 Set allowance

```solidity
function setMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner
```

## 13.2 Increase allowance

```solidity
function increaseMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner
```

## 13.3 Decrease allowance

```solidity
function decreaseMerchantRedemptionAllowance(address merchant, uint256 amount) external onlyIndexerOrOwner
```

## 13.4 Get allowance

```solidity
function getMerchantRedemptionAllowance(address merchant) external view returns (uint256)
```

### Important design rule

Allowance is tracked in **TCOIN units**, not CAD-equivalent and not reserve-asset units.

This should be clearly documented in the interface comments.

---

# 14. Parameter Management

These methods should be governance/admin controlled.

## 14.1 Set CAD peg

```solidity
function setCadPeg(uint256 newCadPeg18) external onlyGovernanceOrOwner
```

### Guardrail

The protocol requirement says CAD/TCOIN peg may move by no more than 10% per governance vote.

That bound may be enforced in Governance proposal creation/execution, but for defense-in-depth it is reasonable to enforce here too if the change path is governance-driven.

Recommended:

* this contract validates that any new peg is within ±10% of current peg
* owner emergency override, if desired, should be explicit rather than silent

---

## 14.2 Set user redeem rate

```solidity
function setUserRedeemRate(uint256 newRateBps) external onlyGovernanceOrOwner
```

### Guard

* `newRateBps <= 10000`

---

## 14.3 Set merchant redeem rate

```solidity
function setMerchantRedeemRate(uint256 newRateBps) external onlyGovernanceOrOwner
```

### Guard

* `newRateBps <= 10000`

---

## 14.4 Set charity mint rate

```solidity
function setCharityMintRate(uint256 newRateBps) external onlyGovernanceOrOwner
```

### Guard

* `newRateBps <= 10000`

---

# 15. Emergency Controls

## 15.1 Pause minting

```solidity
function pauseMinting() external onlyGovernanceOrOwner
```

## 15.2 Unpause minting

```solidity
function unpauseMinting() external onlyGovernanceOrOwner
```

## 15.3 Pause redemption

```solidity
function pauseRedemption() external onlyGovernanceOrOwner
```

## 15.4 Unpause redemption

```solidity
function unpauseRedemption() external onlyGovernanceOrOwner
```

## 15.5 Pause treasury use of a reserve asset

```solidity
function pauseAssetForTreasury(bytes32 assetId) external onlyGovernanceOrOwner
```

## 15.6 Unpause treasury use of a reserve asset

```solidity
function unpauseAssetForTreasury(bytes32 assetId) external onlyGovernanceOrOwner
```

### Why separate treasury pause from registry pause?

Because:

* `ReserveRegistry` pause means asset is protocol-inactive globally
* treasury pause means this controller refuses to use the asset economically even if registry metadata still exists

This gives finer operational control.

---

# 16. View Helpers

Recommended additional views:

```solidity
function isMintingPaused() external view returns (bool)
function isRedemptionPaused() external view returns (bool)
function isTreasuryAssetPaused(bytes32 assetId) external view returns (bool)
function getCadPeg() external view returns (uint256)
function getUserRedeemRate() external view returns (uint256)
function getMerchantRedeemRate() external view returns (uint256)
function getCharityMintRate() external view returns (uint256)
```

---

# 17. Internal Helpers

Recommended internal helpers:

```solidity
function _resolveActiveAsset(bytes32 assetId) internal view returns (...)
function _resolveMintCharity(uint256 requestedCharityId) internal view returns (uint256 charityId, address charityWallet)
function _grossCadValueFromTcoin(uint256 tcoinAmount) internal view returns (uint256 grossCad18)
function _tcoinFromCad(uint256 cadValue18) internal view returns (uint256 tcoinAmount)
function _assetAmountFromCad(bytes32 assetId, uint256 cadValue18) internal view returns (uint256 assetAmount, bool usedFallback)
```

These keep the main flows readable and testable.

---

# 18. Events

These events are critical for indexers and accounting.

```solidity
event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
```

```solidity
event IndexerUpdated(address indexed oldIndexer, address indexed newIndexer);
```

```solidity
event TcoinTokenUpdated(address indexed oldToken, address indexed newToken);
```

```solidity
event ReserveRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
```

```solidity
event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
```

```solidity
event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
```

```solidity
event OracleRouterUpdated(address indexed oldRouter, address indexed newRouter);
```

```solidity
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
```

```solidity
event RedeemedAsUser(
    address indexed user,
    bytes32 indexed assetId,
    uint256 tcoinBurned,
    uint256 assetOut,
    uint256 grossCad18,
    uint256 redeemableCad18,
    bool usedFallbackOracle
);
```

```solidity
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
```

```solidity
event MerchantAllowanceUpdated(address indexed merchant, uint256 oldAmount, uint256 newAmount, address indexed actor);
```

```solidity
event CadPegUpdated(uint256 oldPeg18, uint256 newPeg18);
```

```solidity
event UserRedeemRateUpdated(uint256 oldRateBps, uint256 newRateBps);
```

```solidity
event MerchantRedeemRateUpdated(uint256 oldRateBps, uint256 newRateBps);
```

```solidity
event CharityMintRateUpdated(uint256 oldRateBps, uint256 newRateBps);
```

```solidity
event MintingPaused(address indexed actor);
event MintingUnpaused(address indexed actor);
event RedemptionPaused(address indexed actor);
event RedemptionUnpaused(address indexed actor);
```

```solidity
event TreasuryAssetPaused(bytes32 indexed assetId, address indexed actor);
event TreasuryAssetUnpaused(bytes32 indexed assetId, address indexed actor);
```

---

# 19. Invariants

These should always hold:

1. `depositAndMint` only succeeds for reserve assets that are active and fresh-priced.
2. `redeemAsUser` and `redeemAsMerchant` only succeed for reserve assets that are active and fresh-priced.
3. Merchant redemption allowance is always consumed in TCOIN units.
4. Merchant-class redemption is only available to merchants approved in active pools.
5. Charity uplift always goes to selected active charity, else default UBI charity.
6. `userRedeemRateBps`, `merchantRedeemRateBps`, and `charityMintRateBps` are all bounded and well-defined.
7. The controller never transfers out more reserve asset than it holds.
8. TCOIN mint and burn authority is restricted to this controller or another explicitly approved controller role.

---

# 20. Security Considerations

## 20.1 Oracle freshness risk

This contract must never use stale oracle data.

## 20.2 Decimal normalization risk

Conversions across:

* token decimals
* oracle price decimals
* CAD peg precision
* TCOIN decimals

must be tested heavily.

## 20.3 Reentrancy risk

Because this contract moves ERC20 tokens in and out, reentrancy protections should be considered.

Recommended:

* use `ReentrancyGuardUpgradeable`
* apply `nonReentrant` to deposit and redemption entrypoints

## 20.4 ERC20 transfer assumptions

Reserve asset transfers should use `SafeERC20` wrappers rather than raw `transfer` and `transferFrom`.

## 20.5 Peg update guardrail

The ±10% peg change limit should not live only in Governance. It should be defended here too.

## 20.6 Merchant allowance race conditions

Because allowance is updated by a centralized indexer, the system must tolerate timing mismatches. On-chain enforcement remains straightforward: current on-chain allowance is the source of truth.

---

# 21. Suggested External Surface

## Admin

* `initialize(...)`
* `setGovernance(address)`
* `setIndexer(address)`
* `setTcoinToken(address)`
* `setReserveRegistry(address)`
* `setCharityRegistry(address)`
* `setPoolRegistry(address)`
* `setOracleRouter(address)`

## User-facing

* `depositAndMint(bytes32 assetId, uint256 assetAmount, uint256 requestedCharityId, uint256 minTcoinOut)`
* `redeemAsUser(bytes32 assetId, uint256 tcoinAmount, uint256 minAssetOut)`
* `redeemAsMerchant(bytes32 assetId, uint256 tcoinAmount, uint256 minAssetOut)`

## Preview helpers

* `previewMint(...)`
* `previewRedeemAsUser(...)`
* `previewRedeemAsMerchant(...)`

## Merchant allowance admin

* `setMerchantRedemptionAllowance(address merchant, uint256 amount)`
* `increaseMerchantRedemptionAllowance(address merchant, uint256 amount)`
* `decreaseMerchantRedemptionAllowance(address merchant, uint256 amount)`
* `getMerchantRedemptionAllowance(address merchant)`

## Parameter admin

* `setCadPeg(uint256 newCadPeg18)`
* `setUserRedeemRate(uint256 newRateBps)`
* `setMerchantRedeemRate(uint256 newRateBps)`
* `setCharityMintRate(uint256 newRateBps)`

## Emergency

* `pauseMinting()`
* `unpauseMinting()`
* `pauseRedemption()`
* `unpauseRedemption()`
* `pauseAssetForTreasury(bytes32 assetId)`
* `unpauseAssetForTreasury(bytes32 assetId)`

---

# 22. What TreasuryController Should Not Do

To keep the contract manageable, do **not** add these here:

* proposal storage
* charity or steward registry mutation logic
* reserve asset approval logic
* oracle assignment logic
* vote snapshotting logic
* merchant trade-observation logic

Those belong elsewhere.

---

# 23. Summary

`TreasuryController` should be the single purpose-built contract that handles protocol economics.

It should:

* accept reserve deposits
* mint TCOIN at par
* mint charity uplift
* redeem reserve assets out
* distinguish user and merchant redemption terms
* enforce merchant redemption allowance in TCOIN units
* rely on registries and router contracts for state and pricing

It should not become a second governance contract or a second registry.

That separation is what keeps the system clean, auditable, and maintainable.

---

EOD