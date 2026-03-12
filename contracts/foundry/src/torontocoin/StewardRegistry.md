# StewardRegistry

## Role

The `StewardRegistry` is the source of truth for:

* which steward addresses are recognized by the protocol
* whether a steward is active, suspended, or removed
* how much current voting weight each steward has
* what the total active voting weight is across all stewards

It should not store proposal records, reserve asset state, or redemption logic.

Its primary job is to turn charity appointments into a clean, queryable weighted voting surface for Governance.

## Core rule

A steward’s voting weight equals the number of **active charities** currently appointing that steward.

That means `StewardRegistry` must always reflect the current appointment state from `CharityRegistry`, but Governance must snapshot those weights at proposal creation so future reassignment only affects future proposals.

---

## Design boundary

### This contract should own

Per steward:

* steward address
* display name
* metadata record id / URI
* status
* current assigned charity count
* timestamps if desired

Global:

* total active steward weight
* governance address
* trusted charity registry address

### This contract should not own

* charity records themselves
* proposal/vote records
* reserve assets
* token balances
* mint/redeem parameters

---

## Recommended enums

```solidity
enum StewardStatus {
    None,
    Active,
    Suspended,
    Removed
}
```

`None` allows clean nonexistence checks.

---

## Recommended struct

```solidity
struct Steward {
    address stewardAddress;
    string name;
    string metadataRecordId;
    StewardStatus status;
    uint256 assignedCharityCount;
    uint64 createdAt;
    uint64 updatedAt;
}
```

### Notes

* `assignedCharityCount` is the current live voting weight if the steward is `Active`.
* Suspended or removed stewards should contribute zero active weight to governance even if charities still point to them.

---

## Storage layout

```solidity
address public governance;
address public charityRegistry;
uint256 public totalActiveStewardWeight;
```

```solidity
mapping(address => Steward) private stewards;
address[] private stewardAddresses;
mapping(address => bool) private stewardExists;
mapping(uint256 => address) private assignedStewardByCharity;
```

### Why each is needed

* `governance`: authorized governance executor
* `charityRegistry`: trusted source allowed to sync charity→steward assignment changes
* `totalActiveStewardWeight`: cached sum of all active steward weights
* `stewards`: main steward record storage
* `stewardAddresses`: enumeration for views/indexers
* `stewardExists`: cheap existence guard
* `assignedStewardByCharity`: current steward assignment mirror used for weight updates

This mirror is intentional. Even if `CharityRegistry` is the source of truth for charity appointments, `StewardRegistry` needs the previous assignment in order to efficiently decrement the old steward and increment the new steward.

---

## Access model

Recommended modifiers:

```solidity
modifier onlyGovernanceOrOwner()
modifier onlyCharityRegistry()
```

### `onlyGovernanceOrOwner`

Used for steward registration and status changes.

### `onlyCharityRegistry`

Used for assignment synchronization.

This keeps charity appointment authority in `CharityRegistry`, while keeping weight accounting in `StewardRegistry`.

---

## Recommended errors

```solidity
error ZeroAddressOwner();
error ZeroAddressGovernance();
error ZeroAddressCharityRegistry();
error ZeroAddressSteward();
error UnknownSteward(address steward);
error StewardAlreadyExists(address steward);
error InvalidStewardStatus(address steward);
error Unauthorized();
error CharityAlreadyAssigned(uint256 charityId, address steward);
```

---

## External methods

### 1. Initialize

```solidity
function initialize(address owner_, address governance_, address charityRegistry_) external initializer
```

### Behavior

* initialize ownership, upgradeability, pausable if included
* set governance
* set charity registry

### Rules

* none of the addresses may be zero

---

### 2. Set governance

```solidity
function setGovernance(address governance_) external onlyOwner
```

Owner/multisig should be able to rotate governance contract address.

---

### 3. Set charity registry

```solidity
function setCharityRegistry(address charityRegistry_) external onlyOwner
```

This is needed in an upgradeable modular system.

---

### 4. Register steward

```solidity
function registerSteward(
    address steward,
    string calldata name,
    string calldata metadataRecordId
) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* steward address must not be zero
* steward must not already exist

### Behavior

* create steward record
* status = `Active`
* assignedCharityCount = 0
* append to steward list
* emit `StewardRegistered`

### Notes

Registration does **not** give voting weight by itself. Weight only comes from charity appointments.

---

### 5. Suspend steward

```solidity
function suspendSteward(address steward) external onlyGovernanceOrOwner
```

### Rules

* steward must exist
* steward must currently be `Active`

### Behavior

* set status = `Suspended`
* subtract that steward’s current `assignedCharityCount` from `totalActiveStewardWeight`
* emit `StewardSuspended`
* emit `StewardWeightChanged` if useful

### Notes

The charity appointments remain intact. If later unsuspended, their weight returns automatically.

---

### 6. Unsuspend steward

```solidity
function unsuspendSteward(address steward) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* steward must exist
* steward must currently be `Suspended`

### Behavior

* set status = `Active`
* add current `assignedCharityCount` back into `totalActiveStewardWeight`
* emit `StewardUnsuspended`
* emit `StewardWeightChanged`

---

### 7. Remove steward

```solidity
function removeSteward(address steward) external onlyGovernanceOrOwner
```

### Rules

* steward must exist
* steward must not already be `Removed`

### Behavior

* if status is `Active`, subtract current `assignedCharityCount` from `totalActiveStewardWeight`
* set status = `Removed`
* keep record for history
* emit `StewardRemoved`
* emit `StewardWeightChanged`

### Important

Removing a steward does **not** rewrite charity assignments in `CharityRegistry`. Those charities will still point to that address until they reassign. But because the steward is removed, their effective governance weight becomes zero.

That is acceptable and keeps the contracts loosely coupled.

---

### 8. Sync charity appointment

```solidity
function syncCharityAppointment(
    uint256 charityId,
    address oldSteward,
    address newSteward
) external onlyCharityRegistry whenNotPaused
```

This is the most important function in the contract.

### Rules

* `newSteward` may be zero only if you want to support explicit “no steward assigned”; recommended: allow zero so a charity can temporarily have no steward if needed
* if `oldSteward == newSteward`, do nothing or revert; recommendation: no-op return

### Behavior

1. update `assignedStewardByCharity[charityId]`
2. if `oldSteward != address(0)` and steward exists:

   * decrement old steward `assignedCharityCount`
   * if old steward status is `Active`, decrement `totalActiveStewardWeight`
   * emit `StewardWeightChanged`
3. if `newSteward != address(0)`:

   * require new steward exists and is not `Removed`
   * increment new steward `assignedCharityCount`
   * if new steward status is `Active`, increment `totalActiveStewardWeight`
   * emit `StewardWeightChanged`
4. emit `CharityAppointmentSynced`

### Why this is correct

* immediate effect on live weights
* future proposals see the updated weight
* existing proposals are unaffected because Governance snapshots at proposal creation

---

## View methods

### 1. Get steward record

```solidity
function getSteward(address steward) external view returns (Steward memory)
```

---

### 2. Check if address is active steward

```solidity
function isSteward(address steward) external view returns (bool)
```

Recommended behavior: return true only if status == `Active`.

---

### 3. Get current steward weight

```solidity
function getStewardWeight(address steward) external view returns (uint256)
```

Recommended behavior:

* return `assignedCharityCount` if steward is `Active`
* otherwise return `0`

This gives Governance a clean interface.

---

### 4. Get raw assigned charity count

```solidity
function getAssignedCharityCount(address steward) external view returns (uint256)
```

This may differ from effective voting weight if status is suspended/removed.

---

### 5. Get total active steward weight

```solidity
function getTotalStewardWeight() external view returns (uint256)
```

This is the current total weight across active stewards.

---

### 6. Get charity’s currently assigned steward

```solidity
function getCharityAssignedSteward(uint256 charityId) external view returns (address)
```

---

### 7. Get steward count

```solidity
function getStewardCount() external view returns (uint256)
```

This is count of all steward records ever created, not total weight.

---

### 8. List steward addresses

```solidity
function listStewardAddresses() external view returns (address[] memory)
```

Good enough for v1.

---

## Events

These must be rich enough for indexers to reconstruct steward lifecycle and weight history.

Recommended:

```solidity
event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
```

```solidity
event CharityRegistryUpdated(address indexed oldCharityRegistry, address indexed newCharityRegistry);
```

```solidity
event StewardRegistered(
    address indexed steward,
    string name,
    string metadataRecordId,
    address indexed actor
);
```

```solidity
event StewardSuspended(address indexed steward, address indexed actor);
```

```solidity
event StewardUnsuspended(address indexed steward, address indexed actor);
```

```solidity
event StewardRemoved(address indexed steward, address indexed actor);
```

```solidity
event StewardWeightChanged(
    address indexed steward,
    uint256 oldWeight,
    uint256 newWeight
);
```

```solidity
event CharityAppointmentSynced(
    uint256 indexed charityId,
    address indexed oldSteward,
    address indexed newSteward
);
```

---

## Invariants

These should always hold:

1. `assignedCharityCount` for each steward equals the number of charities currently mirrored to that steward in `assignedStewardByCharity`.
2. `getStewardWeight(steward)` is zero unless steward status is `Active`.
3. `totalActiveStewardWeight` equals the sum of `assignedCharityCount` for all active stewards.
4. A removed steward can never regain weight unless re-registration is explicitly supported. Recommendation: do **not** support re-registering the same removed address in v1.
5. Charity appointment sync should never silently create a steward record. Stewards must be registered first.

---

## Interaction with CharityRegistry

Recommended operational flow:

1. Charity wallet calls `CharityRegistry.appointSteward(newSteward)`
2. `CharityRegistry` updates current steward assignment
3. `CharityRegistry` calls `StewardRegistry.syncCharityAppointment(charityId, oldSteward, newSteward)`
4. `StewardRegistry` updates weights
5. Governance uses snapshotting for future proposals only

This is the cleanest modular design.

---

## Interaction with Governance

Governance should query:

* `isSteward(address)`
* `getStewardWeight(address)`
* `getTotalStewardWeight()`

At proposal creation, Governance should snapshot:

* eligible steward set or steward weights
* total voting weight

That snapshoting logic belongs in Governance, not here.

---

## Recommended final external surface

### Admin / governance

* `initialize(address owner_, address governance_, address charityRegistry_)`
* `setGovernance(address governance_)`
* `setCharityRegistry(address charityRegistry_)`
* `registerSteward(address steward, string name, string metadataRecordId)`
* `suspendSteward(address steward)`
* `unsuspendSteward(address steward)`
* `removeSteward(address steward)`
* `pause()`
* `unpause()`

### Trusted sync

* `syncCharityAppointment(uint256 charityId, address oldSteward, address newSteward)`

### Views

* `getSteward(address steward)`
* `isSteward(address steward)`
* `getStewardWeight(address steward)`
* `getAssignedCharityCount(address steward)`
* `getTotalStewardWeight()`
* `getCharityAssignedSteward(uint256 charityId)`
* `getStewardCount()`
* `listStewardAddresses()`

---

## Summary

`StewardRegistry` should be the single purpose-built contract that turns charity appointments into live weighted governance power.

It should not know about proposals, reserve assets, or treasury logic. It should simply maintain a clean steward set, update weights when charity appointments change, and expose those weights to Governance.

That keeps the design modular, safe, and easy to reason about.

---
EOD
