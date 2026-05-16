This document attempts to describe something **far clearer and safer than the current codebase**. The key shift is that the system becomes:

* **TCOIN = the only demurraging token**
* **Reserve assets = simple backing layer**
* **Governance = steward-weighted but charity-rooted**
* **Oracle = responsible for volatile asset pricing**
* **Minting = simple**
* **Redemption = where complexity lives**

Below is the **Product Requirements Document (PRD)** rewritten based on a refactoring session in March 11, 2026. It expands and structures our architectural design such that it can later be handed to devs, auditors, or AI coding agents.

---

# TCOIN System — Product Requirements Document

## 1. System Overview

The TCOIN protocol issues a **demurraging asset-backed token** backed by a basket of approved reserve assets.

The system operates under **charity-rooted governance** where:

* **Charities appoint stewards**
* **Stewards hold weighted voting power**
* **Governance controls protocol parameters and registry membership**

Reserve asset pricing is **oracle-based**, not governance-based.

TCOIN minting is **simple and permissionless**, while redemption introduces **differentiated economic behavior** for different participant classes.

The system operates at the **city level**, with one governance system per city.

---

# 2. Core Design Principles

### 2.1 Simple Minting

Minting TCOIN should be straightforward:

* Deposit approved reserve asset
* Mint TCOIN at par value
* Additional mint percentage goes to charity

There is **no bonding curve** or price discovery mechanism.

---

### 2.2 Controlled Redemption

Redemption is where the protocol manages economic incentives:

Different redemption rates apply depending on who redeems:

| Actor             | Redemption Rate                        |
| ----------------- | -------------------------------------- |
| Regular user      | Reduced rate (example 80%)             |
| Approved merchant | Higher rate (example 97%)              |
| Merchant limit    | Subject to off-chain indexer allowance |

Redemption occurs **directly into reserve assets**.

---

### 2.3 Charity-Based Governance

Governance is rooted in charities rather than token voting.

Key structure:

```
Charities
   ↓ appoint
Stewards
   ↓ vote
Protocol Governance
```

Stewards hold **weighted votes** equal to the number of charities that appoint them.

---

### 2.4 Oracle-Based Asset Valuation

Reserve asset value is determined via **oracles**, not governance votes.

Valuation path:

```
Reserve Asset → CAD → TCOIN
```

Oracle rules:

* One primary oracle
* Optional fallback oracle(s)
* Maximum staleness window: **1 hour**
* If stale or unavailable → asset temporarily disabled for mint/redemption

---

### 2.5 Demurrage

TCOIN implements **continuous demurrage**, based on the Sarafu model:

Reference model:

```
DemurrageTokenSingleNocap
```

Properties:

* Applied by minute
* Applies **only to TCOIN**
* Reserve assets are unaffected
* Demurrage proceeds go to **protocol treasury**

Treasury surplus may later be directed to charities.

---

# 3. Governance System

## 3.1 Charities

Charities represent community constituencies.

Responsibilities:

* appoint stewards
* receive charity mint allocations
* participate in ecosystem governance indirectly

Rules:

* Each charity may appoint **exactly one steward**
* A charity may **change steward**

Proposed steward change mechanism:

```
charity → appointSteward(newSteward)

rules:
- change allowed anytime
- change becomes effective immediately
- event emitted
```

To prevent abuse we may later introduce a **cooldown (e.g. 24 hours)**.

---

## 3.2 Steward Voting Power

Voting power is calculated as:

```
stewardVoteWeight = number_of_charities_that_appoint_steward
```

Example:

```
Charity A → Steward X
Charity B → Steward X
Charity C → Steward Y
```

Vote weights:

```
X = 2 votes
Y = 1 vote
```

---

## 3.3 Steward Quorum

Steward quorum is based on **weighted majority**.

Rules:

```
proposal passes if:

yesVotes > noVotes
```

Votes are weighted by steward vote weight.

---

## 3.4 Charity Admission

Two mechanisms exist for admitting charities.

### Owner Admission

Owner (multisig) may admit charities if:

```
charityCount < 7
```

Purpose:

* bootstrap governance

---

### Steward Admission

Once charity count ≥ 7:

New charities must be admitted through **steward vote**.

Voting rule:

```
simple majority weighted vote
```

---

### Charity Removal

Stewards may remove charities via weighted vote.

Removal effects:

* charity removed
* steward weight recalculated
* steward may lose votes if charities removed

---

# 4. Steward Appointment

Each charity appoints **one steward**.

Rules:

```
appointSteward(stewardAddress)
```

Behavior:

* replaces previous steward
* updates steward vote weights
* emits event

---

# 5. Reserve Asset System

Reserve assets are ERC20 tokens that back TCOIN.

Examples in scope:

* CAD stablecoin (GeneroAssetToken)
* cUSD (Celo)
* wrapped BTC (Celo)
* wrapped ETH (Celo)
* CELO
* other stablecoins on Celo

---

## 5.1 Reserve Asset Registry

Governance may:

```
addReserveAsset
removeReserveAsset
pauseReserveAsset
unpauseReserveAsset
```

Properties stored per asset:

```
tokenAddress
oracleAddress
fallbackOracleAddress
enabled
paused
```

---

## 5.2 Oracle Requirements

Oracle must return:

```
asset → CAD price
```

Oracle data must include:

```
price
timestamp
```

Validation rules:

```
timestamp <= 1 hour old
```

If stale:

```
asset paused automatically
```

Fallback oracle may be queried if primary fails.

---

# 6. Minting

Minting TCOIN occurs when a user deposits reserve assets.

Flow:

```
User deposits reserve asset
→ reserve contract receives asset
→ oracle determines CAD value
→ TCOIN minted to user
→ charity percentage minted to treasury/charity
```

Minting properties:

```
permissionless
par value
no bonding curve
```

---

## 6.1 Charity Mint Allocation

When minting occurs:

```
userMint = reserveValue
charityMint = reserveValue × charityRate
```

Charity mint applies **only during minting**, not retroactively.

---

# 7. Redemption

Redemption burns TCOIN and releases reserve assets.

Users may redeem into **any available reserve asset**.

---

## 7.1 User Redemption

Regular users redeem at a reduced rate.

Example:

```
userRedeemRate = 80%
```

---

## 7.2 Merchant Redemption

Approved merchants receive better redemption rates.

Example:

```
merchantRedeemRate = 97%
```

But only up to a **lifetime redemption allowance**.

Allowance is updated off-chain by the **indexer**.

---

## 7.3 Merchant Allowance System

Merchant redemption allowances are determined by a centralized indexer.

Indexer monitors:

```
real-world merchant transactions
```

Based on these observations, the indexer updates:

```
merchantRedemptionAllowance
```

Stored on-chain.

---

# 8. Pools and Merchant Approval

The system introduces **pools**.

Pools represent merchant ecosystems.

Example:

```
Food pool
Retail pool
Transport pool
```

Merchants approved in a pool are eligible for higher redemption rates.

---

## Pool Governance

Stewards may:

```
addPool
removePool
pausePool
unpausePool
```

---

# 9. Demurrage

Demurrage applies only to TCOIN.

Reference implementation:

```
Sarafu DemurrageTokenSingleNocap
```

Properties:

```
continuous decay
minute-level precision
```

Effects:

```
balances decay over time
```

Demurrage proceeds accumulate in the **protocol treasury**.

---

# 10. Treasury

Treasury receives:

* demurrage
* charity mint share
* protocol surplus

Treasury may distribute funds to:

* charities
* UBI programs
* community pools

---

## Default Charity

The protocol includes a **default charity**:

```
UBI for all citizens
```

This acts as fallback charity.

---

# 11. Emergency Powers

The multisig owner has emergency authority.

Possible actions:

```
pauseProtocol
unpauseProtocol
pauseReserveAsset
unpauseReserveAsset
suspendCharity
suspendPool
```

---

# 12. Upgradeability

Contracts will use **upgradeable proxies**.

Admin:

```
Gnosis SAFE multisig
```

---

# 13. Indexer Integration

The protocol relies on an off-chain indexer (Supabase).

Events emitted must allow full reconstruction of:

* charity registry
* steward assignments
* governance outcomes
* merchant pools
* merchant allowances

---

# 14. Required On-Chain Features (v1)

Must exist at launch:

* charity registry
* steward appointment system
* weighted governance
* reserve asset registry
* oracle pricing
* mint logic
* redemption logic
* demurrage engine

---

# 15. Non-Goals (v1)

Not required initially:

* fully decentralized oracle network
* dynamic collateral factors
* reserve asset allocation limits
* automated charity distributions

---

# 16. Security Goals

Protocol must ensure:

* no minting without reserve deposit
* demurrage cannot be bypassed
* redemption cannot drain treasury unfairly
* stale oracle data cannot be used
* governance voting cannot be spoofed
* steward weights remain accurate

---
EOD