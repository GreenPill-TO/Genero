Here’s a clean, product + dev-facing markdown you can drop straight into your docs:

---

# UserCharityPreferencesRegistry

## Overview

The `UserCharityPreferencesRegistry` is the contract responsible for storing and resolving **per-user charity preferences and voluntary fee settings**.

It works alongside the `CharityRegistry` and is used by `cplTCOIN` to determine:

* Which charity should receive fees for a given payment
* How much additional voluntary fee a user has chosen to contribute

This contract **does not manage charities themselves**. It only manages **user preferences**.

---

## Why This Contract Exists

We separate concerns into two layers:

### 1. CharityRegistry (global state)

* Defines valid charities
* Tracks active/suspended/removed status
* Stores charity wallets
* Defines the default charity

### 2. UserCharityPreferencesRegistry (user state)

* Stores each user’s:

  * preferred charity
  * voluntary fee %
* Resolves the **actual charity destination at payment time**

---

## Core Concept

Each user can configure:

* A **preferred charity** (optional)
* A **voluntary fee** (in basis points)

If no preference is set — or if the selected charity becomes inactive — the system automatically falls back to the **default charity**.

---

## Data Model

```solidity
struct UserCharityPreferences {
    uint256 preferredCharityId; // 0 = no preference
    uint16 voluntaryFeeBps;     // extra fee on top of base fee
}
```

### Key Properties

* `preferredCharityId = 0` → use default charity
* `voluntaryFeeBps` is capped by `maxVoluntaryFeeBps`
* Preferences are stored per wallet address

---

## How It’s Used in Payments

When a user pays a merchant using `cplTCOIN`:

1. Token calls:

   ```solidity
   resolveFeePreferences(payer)
   ```

2. Registry returns:

   * resolved charity ID
   * charity wallet
   * voluntary fee bps

3. Token calculates:

   * base fee (protocol-defined)
   * voluntary fee (user-defined)

4. Fees are sent to the resolved charity wallet

---

## Resolution Logic

```text
IF user.preferredCharityId is set AND active:
    use it
ELSE:
    use default charity
```

If neither is valid → revert (this should never happen in a healthy system)

---

## Public Functions

### User Functions

#### Set preferred charity

```solidity
setPreferredCharity(uint256 charityId)
```

* Requires charity to be active
* Use `0` to clear preference

#### Set voluntary fee

```solidity
setVoluntaryFeeBps(uint16 feeBps)
```

* Must be ≤ `maxVoluntaryFeeBps`

#### Set both at once

```solidity
setPreferences(uint256 charityId, uint16 feeBps)
```

#### Clear settings

```solidity
clearPreferredCharity()
clearVoluntaryFeeBps()
```

---

### View Functions

#### Get raw preferences

```solidity
getPreferences(address user)
```

Returns:

* preferred charity (may be inactive)
* voluntary fee

---

#### Resolve fee destination (IMPORTANT)

```solidity
resolveFeePreferences(address user)
```

Returns:

* resolved charity ID (active)
* charity wallet
* voluntary fee bps

This is the **canonical function used by cplTCOIN**.

---

#### Preview resolution (for UI)

```solidity
previewResolvedCharity(address user)
```

Returns:

* requested charity
* resolved charity
* wallet
* whether fallback occurred

Used for:

* UI warnings
* transparency to users

---

## Fee Model Integration

Example:

| Component          | Value |
| ------------------ | ----- |
| Merchant price     | $100  |
| Base fee           | 1%    |
| User voluntary fee | 5%    |

### Result

* User pays: **$105**
* Merchant receives: **$99**
* Charity receives: **$6**

Where:

* $1 = base fee
* $5 = voluntary fee

---

## Important Design Decisions

### 1. No per-transaction charity selection

All payments use:

* the user’s **stored default preference**

This allows:

* standard ERC20-style `transfer()` usage
* no custom payment function required

---

### 2. Strict write, flexible read

* Users can only select **active charities**
* If a charity later becomes inactive:

  * system automatically falls back to default

---

### 3. Token reads from payer, not sender

For `transferFrom()`:

* fees are based on `from` (payer)
* NOT `msg.sender`

This prevents:

* relayers or apps from hijacking charity routing

---

### 4. Bounded voluntary fees

`maxVoluntaryFeeBps` ensures:

* users cannot accidentally set extreme fees
* predictable UX

Recommended:

* 500 bps (5%) or 1000 bps (10%)

---

## Security Considerations

* No external calls except to `CharityRegistry`
* No fund custody
* No reentrancy surface
* Minimal attack surface

Primary risks:

* misconfigured `CharityRegistry`
* incorrect default charity setup

---

## UX Implications

Users should be able to:

* Choose a preferred charity
* Set a default donation percentage
* See:

  * where their fees go
  * how much they contribute

UI should also:

* warn if their selected charity is no longer active
* show fallback behavior clearly

---

## Summary

`UserCharityPreferencesRegistry` enables:

* **personalized fee routing**
* **user-controlled charitable contributions**
* **clean separation of global vs user state**

It is a critical component for:

* aligning incentives
* increasing user engagement
* enabling programmable philanthropy at the transaction layer

---

EOD
