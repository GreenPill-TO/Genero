# PoolRegistry

## Role

The `PoolRegistry` is the source of truth for:

* which pools are approved by the protocol
* which pools are active, suspended, or removed
* which merchants are approved
* which pool each merchant belongs to
* whether a merchant is currently eligible for merchant-class redemption treatment

It should not store merchant redemption allowance balances, reserve asset state, governance proposal state, or token balances.

Its purpose is to cleanly separate **merchant/pool eligibility** from **merchant allowance economics**.

---

## Core rule

A merchant qualifies for merchant-class redemption only if:

1. the merchant is approved in the registry,
2. the merchant itself is not suspended or removed,
3. the merchant’s assigned pool is active.

That means `TreasuryController` should rely on `PoolRegistry` for merchant eligibility and on a separate allowance mapping for merchant redemption limits.

---

## Design boundary

### This contract should own

Per pool:

* pool id
* pool name
* pool metadata record id
* pool status
* timestamps if desired

Per merchant:

* merchant wallet
* assigned pool id
* merchant metadata record id
* merchant status
* timestamps if desired

Global:

* governance address

### This contract should not own

* merchant redemption allowances
* reserve asset pricing
* TCOIN mint/redeem logic
* charity or steward records
* governance vote state

---

## Recommended enums

```solidity
enum PoolStatus {
    None,
    Active,
    Suspended,
    Removed
}
```

```solidity
enum MerchantStatus {
    None,
    Approved,
    Suspended,
    Removed
}
```

Why separate enums:

* pool lifecycle and merchant lifecycle are related but distinct
* makes queries and event semantics cleaner

---

## Recommended structs

```solidity
struct Pool {
    bytes32 poolId;
    string name;
    string metadataRecordId;
    PoolStatus status;
    uint64 createdAt;
    uint64 updatedAt;
}
```

```solidity
struct Merchant {
    address wallet;
    bytes32 poolId;
    string metadataRecordId;
    MerchantStatus status;
    uint64 createdAt;
    uint64 updatedAt;
}
```

### Notes

* `poolId` should be the canonical identifier, likely a `bytes32` code/hash.
* `metadataRecordId` should point to richer off-chain merchant/pool metadata if needed.
* Merchant approval is address-based in v1. If later you need multi-location merchants with separate wallets, this model still works.

---

## Storage layout

```solidity
address public governance;
```

```solidity
mapping(bytes32 => Pool) private pools;
bytes32[] private poolIds;
mapping(bytes32 => bool) private poolExists;
```

```solidity
mapping(address => Merchant) private merchants;
address[] private merchantAddresses;
mapping(address => bool) private merchantExists;
```

### Why each is needed

* `governance`: authorized governance executor
* `pools`: primary pool storage
* `poolIds`: enumeration for views/indexers
* `poolExists`: cheap existence guard
* `merchants`: primary merchant storage keyed by wallet
* `merchantAddresses`: enumeration for views/indexers
* `merchantExists`: cheap existence guard

---

## Access model

Recommended modifiers:

```solidity
modifier onlyGovernanceOrOwner()
```

This keeps governance execution and emergency multisig paths simple.

All mutations to pools and merchants should be governance/admin controlled.

There should be no self-service merchant approval path in v1.

---

## Recommended errors

```solidity
error ZeroAddressOwner();
error ZeroAddressGovernance();
error ZeroAddressMerchant();
error ZeroPoolId();
error UnknownPool(bytes32 poolId);
error UnknownMerchant(address merchant);
error PoolAlreadyExists(bytes32 poolId);
error MerchantAlreadyExists(address merchant);
error InvalidPoolStatus(bytes32 poolId);
error InvalidMerchantStatus(address merchant);
error MerchantPoolInactive(bytes32 poolId);
error Unauthorized();
```

---

## External methods

### 1. Initialize

```solidity
function initialize(address owner_, address governance_) external initializer
```

### Behavior

* initialize ownership, upgradeability, and pause if included
* set governance address

### Rules

* owner must not be zero
* governance must not be zero

---

### 2. Set governance

```solidity
function setGovernance(address governance_) external onlyOwner
```

Allows multisig to rotate the governance executor address.

---

### 3. Add pool

```solidity
function addPool(
    bytes32 poolId,
    string calldata name,
    string calldata metadataRecordId
) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* `poolId != bytes32(0)`
* pool must not already exist
* name should not be empty

### Behavior

* create new pool record
* set status = `Active`
* append to `poolIds`
* emit `PoolAdded`

### Notes

Pools are protocol-level objects. They do not hold balances in this contract.

---

### 4. Remove pool

```solidity
function removePool(bytes32 poolId) external onlyGovernanceOrOwner
```

### Rules

* pool must exist
* pool must not already be `Removed`

### Behavior

* set status = `Removed`
* keep record for history
* do not delete merchant records pointing to this pool
* emit `PoolRemoved`

### Notes

Merchants assigned to a removed pool automatically become ineligible for merchant-class redemption because their pool is no longer active.

---

### 5. Suspend pool

```solidity
function suspendPool(bytes32 poolId) external onlyGovernanceOrOwner
```

### Rules

* pool must exist
* pool must currently be `Active`

### Behavior

* set status = `Suspended`
* emit `PoolSuspended`

### Notes

Suspending a pool should not rewrite merchant records. It should simply make them ineligible while the pool remains suspended.

---

### 6. Unsuspend pool

```solidity
function unsuspendPool(bytes32 poolId) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* pool must exist
* pool must currently be `Suspended`

### Behavior

* set status = `Active`
* emit `PoolUnsuspended`

---

### 7. Approve merchant

```solidity
function approveMerchant(
    address merchant,
    bytes32 poolId,
    string calldata metadataRecordId
) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* merchant address must not be zero
* pool must exist
* pool should ideally be `Active`
* merchant must not already exist

### Behavior

* create merchant record
* assign pool id
* set status = `Approved`
* append to `merchantAddresses`
* emit `MerchantApproved`

### Notes

I recommend requiring the target pool to be `Active` at approval time. That keeps operator behavior sane.

---

### 8. Remove merchant

```solidity
function removeMerchant(address merchant) external onlyGovernanceOrOwner
```

### Rules

* merchant must exist
* merchant must not already be `Removed`

### Behavior

* set status = `Removed`
* preserve historical record
* emit `MerchantRemoved`

---

### 9. Suspend merchant

```solidity
function suspendMerchant(address merchant) external onlyGovernanceOrOwner
```

### Rules

* merchant must exist
* merchant must currently be `Approved`

### Behavior

* set status = `Suspended`
* emit `MerchantSuspended`

---

### 10. Unsuspend merchant

```solidity
function unsuspendMerchant(address merchant) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* merchant must exist
* merchant must currently be `Suspended`
* assigned pool should still be active if you want to restore approval directly; recommendation: allow unsuspend regardless, but merchant still only qualifies if pool is active

### Behavior

* set status = `Approved`
* emit `MerchantUnsuspended`

---

### 11. Reassign merchant to a different pool

This is useful and should be explicit.

```solidity
function reassignMerchantPool(address merchant, bytes32 newPoolId) external onlyGovernanceOrOwner whenNotPaused
```

### Rules

* merchant must exist
* new pool must exist
* new pool should be `Active`

### Behavior

* update merchant’s poolId
* update timestamp
* emit `MerchantPoolReassigned`

### Notes

This matters operationally because real merchants can move between approved ecosystems.

---

## View methods

### 1. Get pool

```solidity
function getPool(bytes32 poolId) external view returns (Pool memory)
```

---

### 2. Get merchant

```solidity
function getMerchant(address merchant) external view returns (Merchant memory)
```

---

### 3. Check pool active state

```solidity
function isPoolActive(bytes32 poolId) external view returns (bool)
```

Recommended behavior: return true only if status == `Active`.

---

### 4. Check merchant approved state

```solidity
function isMerchantApproved(address merchant) external view returns (bool)
```

Recommended behavior: return true only if merchant status == `Approved`.

This does **not** by itself imply redemption eligibility, because the pool could be suspended.

---

### 5. Check merchant eligibility in active pool

```solidity
function isMerchantApprovedInActivePool(address merchant) external view returns (bool)
```

Recommended behavior:

* merchant exists
* merchant status == `Approved`
* assigned pool exists and pool status == `Active`

This is the key helper for TreasuryController.

---

### 6. Get merchant pool

```solidity
function getMerchantPool(address merchant) external view returns (bytes32)
```

---

### 7. List pool ids

```solidity
function listPoolIds() external view returns (bytes32[] memory)
```

---

### 8. Get pool count

```solidity
function getPoolCount() external view returns (uint256)
```

---

### 9. List merchant addresses

```solidity
function listMerchantAddresses() external view returns (address[] memory)
```

---

### 10. Get merchant count

```solidity
function getMerchantCount() external view returns (uint256)
```

---

## Events

These must allow indexers to reconstruct pool and merchant lifecycle.

Recommended:

```solidity
event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
```

```solidity
event PoolAdded(
    bytes32 indexed poolId,
    string name,
    string metadataRecordId,
    address indexed actor
);
```

```solidity
event PoolRemoved(bytes32 indexed poolId, address indexed actor);
```

```solidity
event PoolSuspended(bytes32 indexed poolId, address indexed actor);
```

```solidity
event PoolUnsuspended(bytes32 indexed poolId, address indexed actor);
```

```solidity
event MerchantApproved(
    address indexed merchant,
    bytes32 indexed poolId,
    string metadataRecordId,
    address indexed actor
);
```

```solidity
event MerchantRemoved(address indexed merchant, bytes32 indexed poolId, address indexed actor);
```

```solidity
event MerchantSuspended(address indexed merchant, bytes32 indexed poolId, address indexed actor);
```

```solidity
event MerchantUnsuspended(address indexed merchant, bytes32 indexed poolId, address indexed actor);
```

```solidity
event MerchantPoolReassigned(
    address indexed merchant,
    bytes32 indexed oldPoolId,
    bytes32 indexed newPoolId,
    address actor
);
```

---

## Invariants

These should always hold:

1. Each merchant address maps to at most one merchant record.
2. Each merchant belongs to exactly one current pool if not removed.
3. `isMerchantApprovedInActivePool(merchant)` is true if and only if merchant status is `Approved` and pool status is `Active`.
4. Removed pools and removed merchants remain queryable historically.
5. Pool suspension should not mutate merchant records.
6. Merchant suspension should not mutate pool records.

---

## Interaction with TreasuryController

TreasuryController should read:

* `isMerchantApprovedInActivePool(address merchant)`
* `getMerchantPool(address merchant)`

TreasuryController should **not** care about merchant metadata, list enumeration, or pool lifecycle history.

Its only question is:

```text
Does this address currently qualify for merchant redemption treatment?
```

`PoolRegistry` should answer that cleanly.

---

## Interaction with Governance

Governance should execute approved proposals into:

* `addPool`
* `removePool`
* `suspendPool`
* `unsuspendPool`
* `approveMerchant`
* `removeMerchant`
* `suspendMerchant`
* `unsuspendMerchant`
* `reassignMerchantPool`

That means Governance does not need to understand pool/merchant storage internals.

---

## Recommended final external surface

### Admin / governance

* `initialize(address owner_, address governance_)`
* `setGovernance(address governance_)`
* `addPool(bytes32 poolId, string name, string metadataRecordId)`
* `removePool(bytes32 poolId)`
* `suspendPool(bytes32 poolId)`
* `unsuspendPool(bytes32 poolId)`
* `approveMerchant(address merchant, bytes32 poolId, string metadataRecordId)`
* `removeMerchant(address merchant)`
* `suspendMerchant(address merchant)`
* `unsuspendMerchant(address merchant)`
* `reassignMerchantPool(address merchant, bytes32 newPoolId)`
* `pause()`
* `unpause()`

### Views

* `getPool(bytes32 poolId)`
* `getMerchant(address merchant)`
* `isPoolActive(bytes32 poolId)`
* `isMerchantApproved(address merchant)`
* `isMerchantApprovedInActivePool(address merchant)`
* `getMerchantPool(address merchant)`
* `listPoolIds()`
* `getPoolCount()`
* `listMerchantAddresses()`
* `getMerchantCount()`

---

## Summary

`PoolRegistry` should be the single purpose-built contract that defines which pools and merchants are eligible for merchant-class treatment.

It should remain entirely separate from merchant redemption allowances, which belong in `TreasuryController` or a dedicated allowance component.

That separation keeps the business rules clean:

* `PoolRegistry` answers **who qualifies**
* `TreasuryController` answers **how much they may redeem**

This is the right split for auditability, clean interfaces, and future upgrades.

---

EOD
