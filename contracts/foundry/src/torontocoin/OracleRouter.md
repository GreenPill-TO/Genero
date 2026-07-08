# TCOIN Contract Design Spec — OracleRouter

## Purpose

This document defines the design of the `OracleRouter` contract as a standalone module within the TCOIN system.

The `OracleRouter` is responsible for turning approved reserve assets into a normalized **CAD-denominated value surface** for the rest of the protocol.

It should be purpose-built, narrow in scope, and easy to audit.

It must not hold reserves, manage governance proposals, or mint/burn tokens.

---

# 1. Role in the System

The `OracleRouter` exists to answer one question cleanly:

```text
What is the current CAD value of a given approved reserve asset amount?
```

It sits between:

* `ReserveRegistry`, which defines what reserve assets exist and what oracle configuration belongs to them
* `TreasuryController`, which needs fresh CAD values to mint and redeem TCOIN
* `Governance`, which may update oracle assignments through approved proposals

The `OracleRouter` should centralize:

* primary oracle lookup
* fallback oracle lookup
* staleness checks
* decimal normalization
* CAD-value conversion helpers

---

# 2. Core Design Principles

## 2.1 Price reserve assets directly to CAD

The protocol has chosen:

```text
reserve asset -> CAD
CAD -> TCOIN
```

So `OracleRouter` should not be responsible for peg logic.

It prices assets in CAD only.

The TCOIN peg is handled elsewhere, typically in `TreasuryController`.

---

## 2.2 Primary + fallback oracle model

Each reserve asset should support:

* one primary oracle
* one fallback oracle

If the primary fails or is stale, the router should try the fallback.

If both fail, the router should revert or return failure clearly.

---

## 2.3 Freshness is enforced on-chain

The protocol intends to query infrequently operationally, but the contract must still enforce freshness.

Default rule:

```text
price older than 1 hour = stale
```

Freshness should be configurable per asset.

---

## 2.4 Normalized output

Different reserve assets and oracle feeds may have different decimals.

The `OracleRouter` should return normalized values in a single protocol standard.

Recommended standard:

* CAD prices returned in **18-decimal fixed precision**
* CAD value calculations returned in **18-decimal fixed precision**

This makes downstream Treasury math cleaner.

---

## 2.5 No asset approval logic

`OracleRouter` should not decide whether an asset is approved.

That belongs to `ReserveRegistry`.

The router may assume the caller passes only assets known to the registry, or it may validate against `ReserveRegistry` directly.

Recommended approach:

* `OracleRouter` reads oracle configuration from `ReserveRegistry`
* `TreasuryController` separately checks asset eligibility in `ReserveRegistry`

This keeps boundaries clear.

---

# 3. Scope

## In scope

* read price from primary oracle
* detect stale or invalid data
* read price from fallback oracle if needed
* normalize asset and oracle decimals
* return CAD price per unit of reserve asset
* return CAD value for a specific reserve asset amount
* expose whether fallback was used

## Out of scope

* reserve asset registration
* reserve balances
* minting/redeeming
* peg conversion from CAD to TCOIN
* governance proposal storage
* emergency treasury actions

---

# 4. Dependencies

The `OracleRouter` depends on:

## `ReserveRegistry`

For:

* reserve asset existence
* token decimals
* primary oracle
* fallback oracle
* staleness threshold

## Oracle adapter interface(s)

For:

* latest price
* last updated timestamp
* oracle decimals

The router should be designed to work through a thin internal adapter interface rather than hardcoding a single oracle implementation style.

That makes it easier to support:

* Chainlink-like feeds
* custom oracle wrappers
* protocol-owned pricing adapters

---

# 5. Recommended Oracle Interface Boundary

Rather than hardcoding a specific oracle vendor, define a minimal interface expectation.

Recommended conceptual interface:

```solidity
interface ICadOracle {
    function latestAnswer() external view returns (int256);
    function latestTimestamp() external view returns (uint256);
    function decimals() external view returns (uint8);
}
```

If your actual feeds are Chainlink-style, you may instead use a dedicated adapter layer. But the `OracleRouter` itself should conceptually expect:

* price
* timestamp
* decimals

That is enough.

---

# 6. Recommended Data Model

The router should not duplicate large amounts of reserve state, but it may cache governance/admin pointers.

## State

```solidity
address public reserveRegistry;
address public governance;
```

Optional:

```solidity
bool public fallbackEventsEnabled;
```

The router should normally **read oracle configuration from `ReserveRegistry` on demand** rather than duplicating per-asset config in its own storage.

Why:

* one source of truth
* less sync risk
* easier upgrades

---

# 7. Access Model

Most router methods are read-only.

Configuration changes should be minimal.

Recommended modifiers:

```solidity
modifier onlyGovernanceOrOwner()
```

Used only for:

* updating `reserveRegistry` pointer
* updating governance pointer
* optional emergency router-wide pause if included

---

# 8. Recommended Errors

Use custom errors.

```solidity
error ZeroAddressOwner();
error ZeroAddressGovernance();
error ZeroAddressReserveRegistry();
error UnknownAsset(bytes32 assetId);
error MissingPrimaryOracle(bytes32 assetId);
error MissingFallbackOracle(bytes32 assetId);
error InvalidOraclePrice(bytes32 assetId, address oracle);
error StaleOraclePrice(bytes32 assetId, address oracle, uint256 updatedAt, uint256 staleAfter);
error OracleLookupFailed(bytes32 assetId, address oracle);
error NoFreshOraclePrice(bytes32 assetId);
error Unauthorized();
```

---

# 9. Normalization Standard

## Recommended standard output

The router should expose prices as:

```text
CAD per 1 whole asset unit, normalized to 18 decimals
```

Example:

* if 1 CELO = 0.95 CAD
* returned price = `0.95 * 1e18`

For value conversion:

* if user deposits `assetAmount`
* router converts that token amount using token decimals + price decimals
* returns CAD value in 18-decimal precision

This should be explicitly documented, because TreasuryController depends on it.

---

# 10. External Methods

## 10.1 Initialize

```solidity
function initialize(address owner_, address governance_, address reserveRegistry_) external initializer
```

### Behavior

* initialize ownership and upgradeability
* set governance pointer
* set reserve registry pointer

### Rules

* none of the addresses may be zero

---

## 10.2 Set governance

```solidity
function setGovernance(address governance_) external onlyOwner
```

### Purpose

Allows multisig to rotate governance address.

---

## 10.3 Set reserve registry

```solidity
function setReserveRegistry(address reserveRegistry_) external onlyOwner
```

### Purpose

Allows multisig to rotate registry pointer during upgrades.

---

## 10.4 Get CAD price for asset

```solidity
function getCadPrice(bytes32 assetId)
    external
    view
    returns (uint256 price18, uint256 updatedAt, bool usedFallback)
```

### Purpose

Returns the current normalized CAD price for one whole asset unit.

### Behavior

1. read reserve asset config from `ReserveRegistry`
2. attempt primary oracle lookup
3. validate price and staleness
4. if invalid/stale, attempt fallback
5. if fallback valid, return fallback result with `usedFallback = true`
6. otherwise revert

### Validation rules

* oracle price must be positive
* oracle timestamp must be nonzero
* `block.timestamp - updatedAt <= staleAfter`

---

## 10.5 Preview CAD value for asset amount

```solidity
function previewCadValue(bytes32 assetId, uint256 assetAmount)
    external
    view
    returns (uint256 cadValue18, uint256 updatedAt, bool usedFallback)
```

### Purpose

Returns the normalized CAD value of a specific reserve asset amount.

### Behavior

1. get normalized CAD price per unit
2. fetch asset token decimals from `ReserveRegistry`
3. compute:

```text
cadValue18 = assetAmount * price18 / (10 ** tokenDecimals)
```

### Notes

This is the key helper for TreasuryController mint previews.

---

## 10.6 Check price freshness only

```solidity
function isPriceFresh(bytes32 assetId) external view returns (bool fresh, bool wouldUseFallback)
```

### Purpose

Lets frontends and monitoring systems quickly inspect whether a usable oracle value exists.

### Behavior

* returns true if either primary or fallback would produce a valid fresh value
* indicates whether fallback would be required

This is a convenience helper, not strictly required, but operationally useful.

---

## 10.7 Optional debug/introspection method

```solidity
function getOracleStatus(bytes32 assetId)
    external
    view
    returns (
        address primaryOracle,
        address fallbackOracle,
        bool primaryUsable,
        bool fallbackUsable,
        uint256 primaryUpdatedAt,
        uint256 fallbackUpdatedAt
    )
```

### Purpose

Useful for ops dashboards and incident investigation.

Not strictly required, but very practical.

---

# 11. Internal Logic

## 11.1 Read reserve asset config

The router should read from `ReserveRegistry`:

* token decimals
* primary oracle
* fallback oracle
* staleAfter

Recommended assumption:

* `ReserveRegistry` exposes a compact getter for exactly these fields
* do not force the router to load giant structs if avoidable

---

## 11.2 Validate oracle response

Internal helper concept:

```solidity
function _readAndValidateOracle(
    bytes32 assetId,
    address oracle,
    uint256 staleAfter
) internal view returns (bool ok, uint256 price18, uint256 updatedAt)
```

### Steps

1. ensure oracle address != zero
2. query oracle price, timestamp, decimals
3. require price > 0
4. require timestamp != 0
5. require freshness
6. normalize price to 18 decimals
7. return normalized result

### Failure behavior

Recommended: return `(false, 0, 0)` from helper and let outer function decide whether to try fallback or revert.

That makes fallback logic cleaner.

---

## 11.3 Normalize oracle decimals

If oracle returns price in `oracleDecimals`, normalize to 18:

### If oracle decimals < 18

scale up.

### If oracle decimals > 18

scale down.

This should be explicit and carefully tested.

---

# 12. Fallback Logic

## Required behavior

When primary oracle is:

* missing
* reverting
* stale
* non-positive

then the router should try fallback.

If fallback succeeds:

* return the fallback price
* set `usedFallback = true`

If fallback also fails:

* revert with `NoFreshOraclePrice(assetId)`

---

# 13. Event Design

Because most router methods are views, eventing is limited.

Recommended events:

```solidity
event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
```

```solidity
event ReserveRegistryUpdated(address indexed oldReserveRegistry, address indexed newReserveRegistry);
```

Optional event if you later add a state-changing cache or emergency marking mechanism:

```solidity
event FallbackOracleObserved(bytes32 indexed assetId, address indexed oracle, uint256 price18, uint256 updatedAt);
```

For a purely view-based router, this event would not normally fire because views do not emit events. So by default, keep the router stateless and event-light.

---

# 14. Invariants

These should always hold:

1. Returned CAD prices are normalized to 18 decimals.
2. Returned CAD values are normalized to 18 decimals.
3. Only fresh, positive oracle data may be returned.
4. If primary oracle is unusable and fallback is usable, fallback must be returned.
5. If both are unusable, the call must revert.
6. The router does not mutate reserve asset approval state.

---

# 15. Interaction with Other Contracts

## ReserveRegistry

The router reads:

* token decimals
* primary oracle
* fallback oracle
* staleAfter

## TreasuryController

The controller reads:

* `getCadPrice(assetId)`
* `previewCadValue(assetId, assetAmount)`

This lets TreasuryController:

* mint TCOIN against deposit
* quote redemption values
* reject stale oracle states

## Governance

Governance does not need to interact with OracleRouter frequently.

Most oracle configuration changes should occur through `ReserveRegistry` governance actions, not router-local storage.

---

# 16. Recommended Boundary with ReserveRegistry

For cleaner interfaces, `ReserveRegistry` should expose a focused getter like:

```solidity
function getOracleConfig(bytes32 assetId)
    external
    view
    returns (
        address token,
        uint8 tokenDecimals,
        address primaryOracle,
        address fallbackOracle,
        uint256 staleAfter
    )
```

This is preferable to forcing `OracleRouter` to read a full reserve asset struct if that struct later grows.

---

# 17. Security Considerations

## 17.1 Stale price usage

The router must never return stale values.

## 17.2 Zero / negative prices

Any non-positive price should be treated as invalid.

## 17.3 Decimal mismatch bugs

Normalization errors are among the highest-risk bugs here.

This contract needs thorough tests for:

* 6-decimal oracle feeds
* 8-decimal oracle feeds
* 18-decimal feeds
* token decimals 6, 8, 18

## 17.4 Oracle revert handling

The fallback logic must gracefully handle primary oracle reverts.

## 17.5 Registry pointer risk

If `reserveRegistry` is changed incorrectly, pricing may break for the whole system.

That is why registry pointer updates should remain owner-only.

---

# 18. Suggested External Surface

## Admin

* `initialize(address owner_, address governance_, address reserveRegistry_)`
* `setGovernance(address governance_)`
* `setReserveRegistry(address reserveRegistry_)`

## Views

* `getCadPrice(bytes32 assetId)`
* `previewCadValue(bytes32 assetId, uint256 assetAmount)`
* `isPriceFresh(bytes32 assetId)`
* optional `getOracleStatus(bytes32 assetId)`

That is enough.

---

# 19. What OracleRouter Should Not Do

To keep the surface clean, do **not** add these here:

* asset approval / removal methods
* reserve balance accounting
* TCOIN peg logic
* redemption rate logic
* governance proposal logic
* merchant rules
* treasury token transfers

Those belong elsewhere.

---

# 20. Summary

`OracleRouter` should be a narrow, stateless-ish pricing module that:

* reads reserve oracle configuration from `ReserveRegistry`
* reads primary and fallback oracle feeds
* rejects stale or invalid data
* normalizes prices to 18-decimal CAD values
* exposes clean helpers for TreasuryController

It should be one of the smallest and easiest-to-audit contracts in the system.

That is exactly what you want, because if pricing is wrong, the entire mint/redeem flow becomes unsafe.

---

EOD