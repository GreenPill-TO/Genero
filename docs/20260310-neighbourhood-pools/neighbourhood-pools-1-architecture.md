We’re building something closer to **community credit infrastructure** than a normal stablecoin. Which means the **system design has to make the social layer explicit**. We are introducing a neighbourhood-pool concept to localize risk and accountability.

This document is the first in a PRD series:

1. **Document 1 — Neightbourhood / BIA Pool Architecture (Core Concept & Risk Model)**
2. Document 2 — Data Model & Supabase Schema
3. Document 3 — On-Chain Contract Changes (Celo)
4. Document 4 — Wallet & UX Changes
5. Document 5 — Merchant Redemption & Liquidity Mechanics
6. Document 6 — Governance & Risk Controls

---

# TCOIN PRD — Document 1

# Neightbourhood / BIA Pool Architecture & Risk Containment Model

## 1. Overview

TCOIN is designed as a **local flatcoin** whose value tracks the purchasing power of **TTC tokens** rather than fiat currency or crypto market prices.

Unlike conventional stablecoins that maintain parity through **market liquidity pools and arbitrage**, TCOIN maintains its peg through **institutional commitment and community acceptance**.

The peg is supported through four mechanisms:

1. **Fiat Authority (“Fiat”)**
   The issuer defines the official exchange rate:
   **1 TCOIN = 1 TTC Token**

2. **Primary Minting at Parity**
   Users can mint TCOIN directly at the official exchange rate.

3. **Merchant Redemption Commitments**
   Participating merchants commit to accepting TCOIN at the same parity.

4. **Partial Redemption Liquidity**
   Some fiat reserves exist to redeem TCOIN from merchants when necessary.

This model is inspired by community currency systems such as:

* **Sarafu (Grassroots Economics)**
* **Mutual credit networks**
* **Local currency systems**

However, unlike Sarafu, TCOIN is implemented using **blockchain infrastructure (Celo)**.

---

# 2. Problem Statement

The largest systemic risk is **merchant default**.

Scenario:

1. Merchant accepts TCOIN from customers.
2. Merchant accumulates TCOIN obligations.
3. Merchant goes bankrupt or leaves the system.
4. Merchant never repays the obligation.

This creates a deficit in the backing pool.

If the system uses **one global reserve**, the entire network becomes exposed to local failures.

Therefore **risk must be geographically compartmentalized**.

---

# 3. Core Design Principle

### Risk must be localized to community pools.

Each **Business Improvement Area (Neightbourhood / BIA)** operates as a semi-independent economic zone.

Funds and redemption obligations are **segregated per Neightbourhood / BIA**.

If one Neightbourhood / BIA experiences merchant failures, the damage **does not propagate across the entire network**.

---

# 4. Neightbourhood / BIA Pools

Each Neightbourhood / BIA becomes a **local liquidity pool**.

A Neightbourhood / BIA pool contains:

* Users belonging to the Neightbourhood / BIA
* Merchants belonging to the Neightbourhood / BIA
* Fiat deposits associated with the Neightbourhood / BIA
* TCOIN liquidity associated with the Neightbourhood / BIA

Conceptually this mirrors **Sarafu pools**.

```
Toronto Network
   │
   ├── Neightbourhood / BIA Pool: Kensington Market
   │
   ├── Neightbourhood / BIA Pool: Queen West
   │
   ├── Neightbourhood / BIA Pool: Yorkville
   │
   └── Neightbourhood / BIA Pool: Danforth
```

Each pool is economically semi-isolated.

---

# 5. User Association with Neightbourhood / BIAs

Users select a **primary Neightbourhood / BIA affiliation**.

This association determines:

* Which pool receives their fiat when they mint TCOIN
* Which pool they primarily transact within
* Which merchant ecosystem they strengthen

### Neightbourhood / BIA Suggestion

The system will suggest Neightbourhood / BIAs based on **geographic proximity**.

Workflow:

1. User provides location (postal code or GPS)
2. System calculates distance to Neightbourhood / BIA centers
3. Closest Neightbourhood / BIAs are suggested

Users can override the suggestion.

Example:

```
User location: M5V 2T6

Suggested Neightbourhood / BIAs:
1. Queen West
2. Kensington Market
3. King West
```

---

# 6. Merchant Association with Neightbourhood / BIAs

Each merchant must be associated with a **single Neightbourhood / BIA**.

This determines:

* Which pool their redemptions come from
* Which community they participate in

Merchants can optionally operate in **multiple Neightbourhood / BIAs**, but each storefront belongs to one.

---

# 7. Fiat Inflow Routing

When a user purchases TCOIN:

```
User → buys TCOIN → funds routed to Neightbourhood / BIA pool
```

Example:

User belongs to **Queen West Neightbourhood / BIA**

```
User deposits $20
↓
20 TCOIN minted
↓
$20 routed to Queen West pool
```

This creates **pool-specific reserves**.

---

# 8. Redemption Mechanics

When merchants redeem TCOIN:

```
Merchant → Redeem TCOIN
↓
Funds drawn from merchant’s Neightbourhood / BIA pool
```

Example:

```
Merchant: Queen West Café
Redeems: 50 TCOIN

Funds come from:
Queen West pool only
```

No other Neightbourhood / BIA is affected.

---

# 9. Merchant Failure Scenario

Example failure:

```
Merchant accepted: 2,000 TCOIN
Merchant bankrupt
Merchant never redeems
```

Impact:

```
Queen West pool deficit
```

But:

```
Kensington Market pool unaffected
Danforth pool unaffected
Yorkville pool unaffected
```

This isolates the failure.

---

# 10. Incentive Model

In the early growth phase:

Reserves will be **intentionally thin**.

Capital is instead used to **bootstrap merchant adoption** through incentives.

Examples:

* Merchant onboarding grants
* Loyalty bonuses
* Cashback rewards

The system therefore relies heavily on **community accountability**.

This is where **Neightbourhood / BIAs become essential**.

---

# 11. Role of Neightbourhood / BIAs

Business Improvement Areas provide:

* Local governance
* Merchant networks
* Community accountability

They already exist as **economic clusters**.

By aligning TCOIN pools with Neightbourhood / BIAs:

* merchants know each other
* reputational risk is higher
* local coordination becomes easier

---

# 12. Sarafu Inspiration

Sarafu networks operate as **community pools**.

Key similarity:

```
Pool = Local economic network
```

TCOIN pools replicate this structure but with:

* blockchain ledger
* tokenized currency
* automated redemption tracking

---

# 13. Key Design Benefits

### Risk Isolation

Merchant failure affects **only one Neightbourhood / BIA**.

---

### Community Alignment

Economic responsibility is shared locally.

---

### Growth Scalability

New Neightbourhood / BIAs can be added easily.

---

### Network Resilience

Failures do not cascade.

---

# 14. High-Level Architecture

```
Wallet App (Next.js)
        │
        │
Supabase
(Neightbourhood / BIA registry + user affiliation)
        │
        │
Celo Smart Contracts
(TCOIN + pool contracts)
        │
        │
Banking Layer / Fiat Vaults
(pool-aligned reserves)
```

---

# 15. Key Components Introduced

### New Concepts

* Neightbourhood / BIA registry
* Neightbourhood / BIA pool accounting
* User Neightbourhood / BIA affiliation
* Merchant Neightbourhood / BIA affiliation

### Infrastructure Changes

Supabase:

* Neightbourhood / BIA table
* Neightbourhood / BIA membership logic

Celo:

* Neightbourhood / BIA pool tracking

Wallet:

* Neightbourhood / BIA selection UX

---

# 16. Future Extensions

Possible upgrades later:

* Inter-Neightbourhood / BIA liquidity transfers
* Neightbourhood / BIA governance voting
* Neightbourhood / BIA-specific incentives
* Neightbourhood / BIA reputation scoring

---

# 17. Summary

TCOIN introduces **Neightbourhood / BIA-segmented liquidity pools** to localize economic risk and strengthen community participation.

This structure ensures that:

* merchant defaults are contained
* local economies remain accountable
* the system scales city-by-city

The result is a **blockchain-based community currency network aligned with real-world local economic clusters**.

---

