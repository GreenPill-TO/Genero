This **CharityRegistry** has been designed cleanly as:

* the source of truth for charities
* the source of truth for each charity’s currently assigned steward
* the place that enforces the bootstrap rule for charity admission
* the place that defines the default UBI charity
* a contract that emits enough events for Supabase/indexers to fully reconstruct charity and appointment history

It should **not** calculate steward weights itself. That belongs in `StewardRegistry`.

---

# Smart Contract 2 — `CharityRegistry`

## Purpose

`CharityRegistry` is the on-chain source of truth for:

* which charities exist
* whether they are active, suspended, or removed
* which charity is the default UBI charity
* which steward each charity currently appoints

It should support both:

* **bootstrap owner admissions** while active charity count is below 7
* **governance-driven admissions/removals** once the system has matured

It should also support immediate steward reassignment by the charity itself, with the rule that reassignment affects **future proposals only** because governance vote-weight is snapshotted at proposal creation.

---

# Core responsibilities

## This contract should own

Per charity:

* charity id
* name
* wallet
* metadata record id / URI
* status
* currently assigned steward
* timestamps if desired

Global:

* default charity id
* active charity count
* governance address
* owner/bootstrap admin path

## This contract should not own

* steward vote weights
* proposal storage
* reserve assets
* oracle pricing
* mint/redeem logic
* merchant pools
* charity mint balances

---

# Key design decisions baked in

## 1. One charity, one steward

Each charity may appoint **exactly one steward at a time**.

## 2. Immediate steward changes

Charity can change steward at any time.

## 3. Future proposals only

That is not enforced inside `CharityRegistry` itself. Instead, Governance must snapshot weights at proposal creation.

So `CharityRegistry` just updates the current assignment immediately and emits the event.

## 4. Bootstrap rule

Owner/multisig may add charities directly only while:

```text
activeCharityCount < 7
```

After that, admissions/removals should come through governance.

## 5. Default charity

There is always one designated default charity:

* used when a user does not specify a charity on mint
* intended to represent UBI for all citizens

---

# Recommended inheritance

This should be upgradeable and pausible enough for emergencies.

Recommended:

```solidity
Initializable
OwnableUpgradeable
UUPSUpgradeable
PausableUpgradeable
```

I do **not** think it needs `AccessControl` if owner + governance address split is enough.

---

# Recommended enums

## Charity status

```solidity
enum CharityStatus {
    None,
    Active,
    Suspended,
    Removed
}
```

Why:

* `None` lets you detect nonexistence cleanly
* `Removed` preserves history
* `Suspended` supports emergency and governance suspensions without deleting the charity

---

# Recommended struct

```solidity
struct Charity {
    uint256 charityId;
    string name;
    address wallet;
    string metadataRecordId;
    CharityStatus status;
    address steward;
    uint64 createdAt;
    uint64 updatedAt;
}
```

## Notes

### `charityId`

Protocol-level stable identifier.

### `name`

Human-readable label.

### `wallet`

The charity’s operational on-chain wallet.

### `metadataRecordId`

Off-chain reference for richer metadata.

### `status`

Active / Suspended / Removed.

### `steward`

Current steward appointed by this charity.

### timestamps

Not strictly necessary, but useful and cheap enough.

---

# Storage layout

```solidity
address public governance;
uint256 public defaultCharityId;
uint256 public activeCharityCount;
uint256 public charityCount;
```

```solidity
mapping(uint256 => Charity) private charities;
mapping(address => uint256) private charityIdByWallet;
uint256[] private charityIds;
```

## Why each is needed

### `governance`

Contract allowed to perform governance-driven changes.

### `defaultCharityId`

The fallback UBI charity.

### `activeCharityCount`

Used to enforce the bootstrap threshold and to avoid expensive recounting.

### `charityCount`

Monotonic total ever created. Good for ids and enumeration.

### `charities`

Primary storage by id.

### `charityIdByWallet`

Allows wallet lookup and self-service actions.

### `charityIds`

Enumeration for views/indexers.

---

# Access model

Recommended modifiers:

```solidity
modifier onlyGovernanceOrOwner()
modifier onlyBootstrapOwner()
modifier onlyActiveCharityWallet(uint256 charityId)
```

## `onlyGovernanceOrOwner`

Allows governance-executed changes and emergency multisig action.

## `onlyBootstrapOwner`

Owner may bootstrap add charities only while `activeCharityCount < 7`.

## `onlyActiveCharityWallet`

Ensures only the charity’s own wallet may change its steward.

---

# Recommended errors

Use custom errors.

```solidity
error ZeroAddressOwner();
error ZeroAddressGovernance();
error ZeroAddressWallet();
error ZeroAddressSteward();
error UnknownCharity(uint256 charityId);
error CharityAlreadyExists(uint256 charityId);
error WalletAlreadyRegistered(address wallet);
error CharityNotActive(uint256 charityId);
error CharityNotCallableByWallet(uint256 charityId, address caller);
error BootstrapClosed();
error BootstrapOnlyOwner();
error InvalidDefaultCharity(uint256 charityId);
error CharityAlreadyRemoved(uint256 charityId);
error CharityAlreadySuspended(uint256 charityId);
error CharityNotSuspended(uint256 charityId);
error Unauthorized();
```

---

# External methods

## 1. Initialize

```solidity
function initialize(address owner_, address governance_) external initializer
```

### Behavior

* initialize ownership
* initialize upgradeability and pausable
* set governance

### Rules

* owner must not be zero
* governance should probably not be zero, though you could allow staged deployment if needed

---

## 2. Set governance

```solidity
function setGovernance(address governance_) external onlyOwner
```

### Purpose

Allows owner/multisig to update governance contract address.

### Rules

* nonzero address

### Event

* `GovernanceUpdated(oldGovernance, newGovernance)`

---

## 3. Bootstrap add charity

```solidity
function bootstrapAddCharity(
    string calldata name,
    address wallet,
    string calldata metadataRecordId
) external onlyOwner whenNotPaused returns (uint256 charityId)
```

### Rules

* only while `activeCharityCount < 7`
* wallet != zero
* wallet not already registered
* name not empty

### Behavior

* increments `charityCount`
* creates new charity
* status = `Active`
* steward = zero initially
* increments `activeCharityCount`
* stores wallet lookup
* appends to `charityIds`
* emits `CharityAdded`

### Why separate from normal `addCharity`

Because the bootstrap rule is special and should be obvious in the interface.

---

## 4. Governance add charity

```solidity
function addCharity(
    string calldata name,
    address wallet,
    string calldata metadataRecordId
) external onlyGovernanceOrOwner whenNotPaused returns (uint256 charityId)
```

### Rules

* same data validation as bootstrap
* owner should only be allowed here for emergency override if you want; otherwise restrict to governance only once bootstrap closes

### Recommended enforcement

If you want the rule to be very clean:

* `bootstrapAddCharity()` = owner only, only when active count < 7
* `addCharity()` = governance only

That is my recommendation.

---

## 5. Remove charity

```solidity
function removeCharity(uint256 charityId) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* charity must exist
* status cannot already be `Removed`

### Behavior

* if currently `Active`, decrement `activeCharityCount`
* set status = `Removed`
* keep wallet mapping intact for history, or optionally clear it depending on whether you ever want same wallet reused

### Recommendation

Do **not** clear wallet mapping in v1. Preserve historical uniqueness.

### Event

* `CharityRemoved`

---

## 6. Suspend charity

```solidity
function suspendCharity(uint256 charityId) external onlyGovernanceOrOwner
```

### Rules

* charity must exist
* status must be `Active`

### Behavior

* set status = `Suspended`
* decrement `activeCharityCount`

### Event

* `CharitySuspended`

---

## 7. Unsuspend charity

```solidity
function unsuspendCharity(uint256 charityId) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* charity must exist
* status must be `Suspended`

### Behavior

* set status = `Active`
* increment `activeCharityCount`

### Event

* `CharityUnsuspended`

---

## 8. Set default charity

```solidity
function setDefaultCharity(uint256 charityId) external onlyGovernanceOrOwner
```

### Rules

* charity must exist
* charity must be `Active`

### Behavior

* set `defaultCharityId`
* emit event

### Important

There should always be a valid default charity after this is set. You may want to enforce that default charity cannot be removed unless another default is set first, but that can also be handled operationally.

---

## 9. Appoint steward

There are two possible interface shapes.

## Recommended shape

```solidity
function appointSteward(address steward) external whenNotPaused
```

### Why this shape is better

The caller is the charity wallet, so the contract can infer the charity.

### Rules

* caller must map to a charity id
* charity must be `Active`
* steward must not be zero

### Behavior

* read charity by wallet
* store old steward
* update current steward
* update `updatedAt`
* emit `CharityStewardChanged`

This is the cleanest self-service API.

---

## 10. Optional governance steward override

You may want an emergency override path:

```solidity
function forceSetSteward(uint256 charityId, address steward) external onlyGovernanceOrOwner
```

I would **not** include this by default unless you have a clear use case, because charity autonomy is important here.

---

# View methods

## 1. Get charity by id

```solidity
function getCharity(uint256 charityId) external view returns (Charity memory)
```

---

## 2. Get charity id by wallet

```solidity
function getCharityIdByWallet(address wallet) external view returns (uint256)
```

---

## 3. Get charity by wallet

```solidity
function getCharityByWallet(address wallet) external view returns (Charity memory)
```

---

## 4. Check active charity by wallet

```solidity
function isActiveCharity(address wallet) external view returns (bool)
```

---

## 5. Get assigned steward

```solidity
function getAssignedSteward(uint256 charityId) external view returns (address)
```

---

## 6. Get default charity id

```solidity
function getDefaultCharityId() external view returns (uint256)
```

---

## 7. Get active charity count

```solidity
function getActiveCharityCount() external view returns (uint256)
```

---

## 8. Get charity count

```solidity
function getCharityCount() external view returns (uint256)
```

---

## 9. List charity ids

```solidity
function listCharityIds() external view returns (uint256[] memory)
```

Good enough for v1 unless you expect huge scale immediately.

---

# Events

These must be strong enough for indexers to reconstruct state.

Recommended:

```solidity
event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
```

```solidity
event CharityAdded(
    uint256 indexed charityId,
    string name,
    address indexed wallet,
    string metadataRecordId,
    address indexed actor
);
```

```solidity
event CharityRemoved(
    uint256 indexed charityId,
    address indexed wallet,
    address indexed actor
);
```

```solidity
event CharitySuspended(
    uint256 indexed charityId,
    address indexed wallet,
    address indexed actor
);
```

```solidity
event CharityUnsuspended(
    uint256 indexed charityId,
    address indexed wallet,
    address indexed actor
);
```

```solidity
event DefaultCharitySet(
    uint256 indexed oldCharityId,
    uint256 indexed newCharityId,
    address indexed actor
);
```

```solidity
event CharityStewardChanged(
    uint256 indexed charityId,
    address indexed charityWallet,
    address indexed oldSteward,
    address newSteward
);
```

You could index both old and new steward, but Solidity only allows up to 3 indexed parameters besides topic0, so I would prioritize:

* charityId
* charityWallet
* oldSteward
  and leave newSteward non-indexed, or choose old/new depending on expected query pattern.

Actually, more practical would be:

```solidity
event CharityStewardChanged(
    uint256 indexed charityId,
    address indexed charityWallet,
    address indexed newSteward,
    address oldSteward
);
```

because consumers are more likely to ask “which charities now point to steward X?”

---

# Invariants

These should always hold:

1. Each wallet maps to at most one charity.
2. Each charity has exactly one current wallet.
3. Each active charity may have zero or one appointed steward.
4. `activeCharityCount` equals number of charities in `Active` status.
5. `defaultCharityId`, if nonzero, must refer to an `Active` charity.
6. Bootstrap owner admissions are only allowed while `activeCharityCount < 7`.

---

# Interactions with other contracts

## `StewardRegistry`

This contract will either:

* read current steward assignments from `CharityRegistry`, or
* be notified by event/indexer/off-chain sync, or
* receive explicit sync calls if you want tighter on-chain coordination

I recommend the cleaner on-chain path later:

* `CharityRegistry` emits assignment event
* `StewardRegistry` gets updated via explicit call from Governance/admin or via a trusted sync path

We’ll define that more precisely when designing `StewardRegistry`.

## `Governance`

Will use this contract for:

* charity admissions/removals
* default charity management
* reading current charity assignment state

## `TreasuryController`

Will use this contract for:

* determining whether a selected charity is active
* getting default charity when none is selected

---

# Behavior around mint charity selection

Your rule was:

> Always to the user's selected charity, if assigned, else to the default UBI charity.

That means `CharityRegistry` should support a clean validation path for TreasuryController:

TreasuryController logic can be:

1. if user-specified `charityId != 0` and charity is active → use it
2. else use `defaultCharityId`

So `CharityRegistry` doesn’t need a special method for this, but it may be useful to add:

```solidity
function resolveMintCharity(uint256 requestedCharityId) external view returns (uint256 resolvedCharityId)
```

## Recommended?

Yes, actually. That gives TreasuryController one clean call and avoids duplicated charity-selection logic.

### Method

```solidity
function resolveMintCharity(uint256 requestedCharityId) external view returns (uint256)
```

### Behavior

* if requested charity exists and is active → return it
* else return default charity id
* revert if default charity is unset or inactive

This is a nice, clean helper.

---

# Recommended final external surface

## Admin / governance

* `initialize(address owner_, address governance_)`
* `setGovernance(address governance_)`
* `bootstrapAddCharity(string name, address wallet, string metadataRecordId) returns (uint256)`
* `addCharity(string name, address wallet, string metadataRecordId) returns (uint256)`
* `removeCharity(uint256 charityId)`
* `suspendCharity(uint256 charityId)`
* `unsuspendCharity(uint256 charityId)`
* `setDefaultCharity(uint256 charityId)`
* `pause()`
* `unpause()`

## Charity self-service

* `appointSteward(address steward)`

## Views

* `getCharity(uint256 charityId)`
* `getCharityByWallet(address wallet)`
* `getCharityIdByWallet(address wallet)`
* `isActiveCharity(address wallet)`
* `getAssignedSteward(uint256 charityId)`
* `getDefaultCharityId()`
* `getActiveCharityCount()`
* `getCharityCount()`
* `listCharityIds()`
* `resolveMintCharity(uint256 requestedCharityId)`

---

# My recommendation for one subtle implementation choice

For `appointSteward(address steward)`, do **not** require the steward to already be registered in `StewardRegistry`.

Why:

* it couples contracts too tightly
* it introduces circular dependency too early

Better:

* CharityRegistry records the chosen steward address
* StewardRegistry later decides whether that address is an active steward for vote-weight purposes

That gives you more modularity.

---

**`CharityRegistry` should be the canonical source of charity ↔ steward assignment updates.**

That is the cleaner design.

## Why

Because the assignment is fundamentally a **charity action**, not a steward action.

The rule is:

* a charity appoints exactly one steward
* a charity can change its steward
* steward voting power is derived from those appointments

So the source of truth should live with the object being exercised: **the charity record**.

## Clean split

### `CharityRegistry` owns:

* which steward a charity currently appoints
* whether the charity is active/suspended/removed
* the default charity
* bootstrap and governance-managed charity lifecycle

### `StewardRegistry` derives from that:

* steward weight
* active steward set
* total active steward weight

So:

```text
CharityRegistry = canonical assignment state
StewardRegistry = derived voting-weight state
```

## Practical flow

The clean flow is:

1. charity wallet calls `CharityRegistry.appointSteward(newSteward)`
2. `CharityRegistry` updates the charity’s assigned steward
3. `CharityRegistry` emits `CharityStewardChanged(...)`
4. `CharityRegistry` calls `StewardRegistry.syncCharityAppointment(charityId, oldSteward, newSteward)`
5. `StewardRegistry` updates steward counts / weights

That keeps responsibility clean:

* **assignment truth** lives in one place
* **weight math** lives in another

## Why not make `StewardRegistry` canonical?

Because then it would need to answer questions like:

* which steward does charity X currently appoint?
* is charity X even active?
* can charity X self-update this assignment?

That drags charity business logic into the steward module and muddies the boundary.

## Governance implication

Since you decided:

* steward reassignment is immediate
* but only affects future proposals

that also fits this model perfectly:

* `CharityRegistry` updates current assignment immediately
* `StewardRegistry` updates current live weight immediately
* `Governance` snapshots current weight when a proposal is created

So old proposals stay stable without forcing assignment complexity into Governance or StewardRegistry.

## Bottom line

Use:

* **canonical assignment state:** `CharityRegistry`
* **derived weight/accounting state:** `StewardRegistry`

That is the architecture I would stick with.


EOD
