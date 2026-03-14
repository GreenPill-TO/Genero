# Smart Contract 1 — `ReserveRegistry`

## Purpose

`ReserveRegistry` is the on-chain source of truth for **which reserve assets are approved to back TCOIN**.

It is responsible for:

* registering reserve assets
* storing reserve asset metadata
* storing oracle configuration per asset
* tracking whether an asset is enabled / paused / removed
* exposing clean read methods for TreasuryController and Governance

It is **not** responsible for:

* holding reserve balances
* pricing assets directly
* minting or burning TCOIN
* redemption logic
* governance proposal storage

---

# Contract role in the system

`ReserveRegistry` sits between:

* **Governance**, which decides what assets are allowed
* **OracleRouter**, which prices those assets
* **TreasuryController**, which accepts and redeems them

So this contract answers questions like:

* Is `cUSD` approved?
* Is wrapped BTC currently paused?
* Which oracle should be used for CELO?
* What decimals does this reserve asset use?

---

# Upgradeability

This contract should be:

* **UUPS upgradeable**
* owned/administered by your multisig
* callable by governance-executed actions and emergency admin paths

Recommended inheritance:

```solidity
Initializable
OwnableUpgradeable
UUPSUpgradeable
PausableUpgradeable
```

You may or may not need full-contract `PausableUpgradeable`, but I recommend it for emergency admin symmetry.

---

# Core design choices

## 1. Asset identifier

Use:

```solidity
bytes32 assetId
```

Examples:

* `keccak256("gCAD")`
* `keccak256("cUSD")`
* `keccak256("WBTC")`
* `keccak256("WETH")`
* `keccak256("CELO")`

Why `bytes32` instead of string:

* cheaper
* easier to index
* safer for equality checks
* easier to pass around between contracts

You can still store a short display code if needed.

---

## 2. Asset status model

Use explicit booleans or a small enum.

I recommend enum:

```solidity
enum ReserveAssetStatus {
    None,
    Active,
    Paused,
    Removed
}
```

Why:

* more expressive than two booleans
* easier to reason about
* easier to audit

---

## 3. Oracle linkage

Each asset should store:

* primary oracle
* fallback oracle
* staleness window

Even if OracleRouter does the actual query logic, the registry should remain the authoritative metadata source for which oracle config belongs to which asset.

---

# Suggested struct

```solidity
struct ReserveAsset {
    bytes32 assetId;
    address token;
    string code;
    uint8 tokenDecimals;
    address primaryOracle;
    address fallbackOracle;
    uint256 staleAfter;
    ReserveAssetStatus status;
}
```

## Notes

### `token`

ERC20 address of the reserve asset.

### `code`

Human-readable short code like `"gCAD"` or `"cUSD"`.

You could omit this and keep only `assetId`, but keeping it helps operational clarity.

### `tokenDecimals`

Needed for value normalization.

### `primaryOracle`, `fallbackOracle`

Stored here, used later by OracleRouter/TreasuryController.

### `staleAfter`

Per-asset staleness threshold in seconds.
Default likely `3600`.

### `status`

`Active`, `Paused`, `Removed`.

---

# Storage layout

```solidity
mapping(bytes32 => ReserveAsset) private reserveAssets;
mapping(address => bytes32) private assetIdByToken;
bytes32[] private reserveAssetIds;
mapping(bytes32 => bool) private assetExists;
```

## Why each is needed

### `reserveAssets`

Primary lookup by asset id.

### `assetIdByToken`

Lets TreasuryController identify an asset from token address if needed.

### `reserveAssetIds`

Lets frontends/indexers enumerate current and historical asset ids.

### `assetExists`

Useful guard so `Removed` assets still remain historically queryable.

---

# Access control

You want both governance execution and emergency admin.

Simplest v1 approach:

* **owner** = multisig
* **governance** = separately set governance executor address

Recommended state:

```solidity
address public governance;
```

Recommended modifier:

```solidity
modifier onlyGovernanceOrOwner() {
    require(msg.sender == governance || msg.sender == owner(), "not governance/owner");
    _;
}
```

This lets:

* governance execute approved additions/removals
* multisig perform emergency intervention or bootstrap actions

---

# State variables

Recommended full set:

```solidity
address public governance;
```

```solidity
mapping(bytes32 => ReserveAsset) private reserveAssets;
mapping(address => bytes32) private assetIdByToken;
bytes32[] private reserveAssetIds;
mapping(bytes32 => bool) private assetExists;
```

Optional:

```solidity
mapping(bytes32 => bool) private everAdded;
```

Not strictly needed if `assetExists` persists after removal.

---

# External methods

## Initialization

```solidity
function initialize(address owner_, address governance_) external initializer
```

### Behavior

* set owner
* set governance
* initialize upgradeability
* optionally initialize pause state machinery

### Guards

* owner must not be zero
* governance may be zero initially if you want staged bootstrap, but I’d prefer nonzero

---

## Governance / admin methods

### 1. Set governance address

```solidity
function setGovernance(address governance_) external onlyOwner
```

Use owner-only for changing governance pointer.

---

### 2. Add reserve asset

```solidity
function addReserveAsset(
    bytes32 assetId,
    address token,
    string calldata code,
    uint8 tokenDecimals,
    address primaryOracle,
    address fallbackOracle,
    uint256 staleAfter
) external onlyGovernanceOrOwner
```

### Rules

* `assetId != 0`
* `token != address(0)`
* asset must not already exist
* token must not already be mapped to another asset
* `staleAfter > 0`
* primary oracle should probably be nonzero
* fallback may be zero if not yet configured, depending on your preference

### Effect

* create new asset
* status = `Active`
* push into `reserveAssetIds`
* map token -> assetId
* emit `ReserveAssetAdded`

---

### 3. Pause reserve asset

```solidity
function pauseReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner
```

### Rules

* asset must exist
* status must currently be `Active`

### Effect

* status = `Paused`
* emit `ReserveAssetPaused`

---

### 4. Unpause reserve asset

```solidity
function unpauseReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner
```

### Rules

* asset must exist
* status must currently be `Paused`

### Effect

* status = `Active`
* emit `ReserveAssetUnpaused`

---

### 5. Remove reserve asset

```solidity
function removeReserveAsset(bytes32 assetId) external onlyGovernanceOrOwner
```

### Rules

* asset must exist
* status cannot already be `Removed`

### Effect

* status = `Removed`
* do **not** delete historical struct
* do **not** delete from `reserveAssetIds`
* clear `assetIdByToken[token]` if you want token reusability later
* emit `ReserveAssetRemoved`

I recommend clearing `assetIdByToken[token]` only if you want the same token re-added under a new asset id later. Usually I would **not** allow that. Keep mapping intact for historical consistency.

---

### 6. Update reserve asset oracles

```solidity
function updateReserveAssetOracles(
    bytes32 assetId,
    address primaryOracle,
    address fallbackOracle
) external onlyGovernanceOrOwner
```

### Rules

* asset must exist
* primary should not be zero
* fallback may be zero if optional

### Effect

* update oracle fields
* emit `ReserveAssetOracleUpdated`

---

### 7. Update reserve asset staleness

```solidity
function updateReserveAssetStaleness(
    bytes32 assetId,
    uint256 staleAfter
) external onlyGovernanceOrOwner
```

### Rules

* asset must exist
* staleAfter > 0

### Effect

* update staleness threshold
* emit `ReserveAssetStalenessUpdated`

---

## View methods

### 1. Get full asset record

```solidity
function getReserveAsset(bytes32 assetId) external view returns (ReserveAsset memory)
```

---

### 2. Get asset by token address

```solidity
function getReserveAssetByToken(address token) external view returns (ReserveAsset memory)
```

This should:

* look up `assetIdByToken[token]`
* revert if none

---

### 3. Get asset id by token address

```solidity
function getAssetIdByToken(address token) external view returns (bytes32)
```

Useful lightweight helper.

---

### 4. Check existence

```solidity
function reserveAssetExists(bytes32 assetId) external view returns (bool)
```

---

### 5. Check active state

```solidity
function isReserveAssetActive(bytes32 assetId) external view returns (bool)
```

Meaning status == `Active`.

---

### 6. List asset ids

```solidity
function listReserveAssetIds() external view returns (bytes32[] memory)
```

Good enough for v1.
Full pagination can come later if needed.

---

### 7. Count assets

```solidity
function reserveAssetCount() external view returns (uint256)
```

Useful for indexers/frontends.

---

# Events

These matter because your Supabase/indexer should reconstruct state.

Recommended events:

```solidity
event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
```

```solidity
event ReserveAssetAdded(
    bytes32 indexed assetId,
    address indexed token,
    string code,
    uint8 tokenDecimals,
    address primaryOracle,
    address fallbackOracle,
    uint256 staleAfter
);
```

```solidity
event ReserveAssetPaused(bytes32 indexed assetId, address indexed actor);
```

```solidity
event ReserveAssetUnpaused(bytes32 indexed assetId, address indexed actor);
```

```solidity
event ReserveAssetRemoved(bytes32 indexed assetId, address indexed actor);
```

```solidity
event ReserveAssetOracleUpdated(
    bytes32 indexed assetId,
    address indexed primaryOracle,
    address indexed fallbackOracle
);
```

```solidity
event ReserveAssetStalenessUpdated(
    bytes32 indexed assetId,
    uint256 oldStaleAfter,
    uint256 newStaleAfter
);
```

---

# Recommended errors

Use custom errors, not strings.

```solidity
error ZeroAddressOwner();
error ZeroAddressGovernance();
error ZeroAddressToken();
error ZeroAssetId();
error AssetAlreadyExists(bytes32 assetId);
error TokenAlreadyRegistered(address token);
error UnknownAsset(bytes32 assetId);
error InvalidAssetStatus(bytes32 assetId);
error InvalidStaleness();
error ZeroPrimaryOracle();
```

Maybe also:

```solidity
error Unauthorized();
```

if you want a generic compact style.

---

# Invariants

These should always hold:

1. Every active/paused/removed asset has a unique `assetId`.
2. A token address maps to at most one reserve asset.
3. Removed assets remain queryable historically.
4. Only `Active` assets are considered mint/redeem eligible.
5. Oracle config exists for every active asset.
6. `staleAfter > 0` for all registered assets.

---

# Boundary with other contracts

## `TreasuryController` will use it for:

* validating allowed reserve assets
* getting token decimals
* getting oracle references
* checking paused/removed state

## `OracleRouter` may use it for:

* getting configured primary/fallback oracle and staleness

## `Governance` will use it for:

* executing approved reserve asset add/remove/pause/unpause/oracle update proposals

---

# Recommended implementation notes

## 1. Do not delete structs on removal

Set status to `Removed`, keep history intact.

## 2. Do not store balances here

TreasuryController handles balances; this contract is only metadata and state flags.

## 3. Keep asset addition narrow

Do not overload with collateral factors, allocation caps, or redemption rates. Those are intentionally out of scope.

## 4. Consider using `bytes32 codeHash` instead of `string code`

But for usability I’d keep `string code` in storage and `bytes32 assetId` as canonical identifier.

---

# Example lifecycle

## Add cUSD

Governance executes:

```text
addReserveAsset(
  assetId = keccak256("cUSD"),
  token = cUSD_address,
  code = "cUSD",
  decimals = 18,
  primaryOracle = oracle1,
  fallbackOracle = oracle2,
  staleAfter = 3600
)
```

Status becomes `Active`.

## Pause WBTC

Emergency multisig calls:

```text
pauseReserveAsset(keccak256("WBTC"))
```

Status becomes `Paused`.

## Remove deprecated asset

Governance calls:

```text
removeReserveAsset(keccak256("OLDCAD"))
```

Status becomes `Removed`, but state remains historically accessible.

---

EOD