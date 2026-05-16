# TCOIN PRD — Document 5

# Merchant Economics & Redemption Mechanics

## 1. Purpose

This document defines the **economic rules and operational mechanics** governing merchant participation and redemption in the TCOIN system.

The goal is to:

* make merchant participation attractive
* ensure redemption remains manageable during growth
* contain risk locally within BIA pools

This document focuses on **economic behavior**, not technical implementation.

---

## 1.1 Implementation Baseline (v1)

This document is aligned to the v1 operating model:

* User payments are city-wide and cross-pool permissive.
* Merchant redemption rights are approval-gated.
* Redemption settlement is request-based and operator-mediated (queued flow).
* Pool attribution is maintained in app/indexer data tied to Sarafu pool mappings.
* TCOIN-native on-chain BIA pool governance is **Optional / Future Phase**.

---

# 2. Merchant Role in the System

Merchants are the primary source of real-world utility for TCOIN.

They:

* accept TCOIN as payment
* circulate TCOIN through local spending
* optionally redeem TCOIN for settlement assets

Merchants therefore create the **convertibility layer** of the currency.

---

# 3. Redemption Philosophy

TCOIN is **not designed as a fully reserved stablecoin**.

Instead, redemption operates under a hybrid model:

1. **Community circulation first**
2. **Redemption second**
3. **Reserve support as a safety valve**

The system works best when merchants **spend TCOIN locally** rather than redeeming immediately.

---

# 4. Redemption Assets

Merchants may redeem TCOIN into settlement assets supported by the system.

Current architecture supports:

* TTC-like redemption tokens
* CAD-like redemption tokens

Future versions may support:

* direct fiat settlement
* treasury payouts
* local credit settlement

The redemption asset type does not change the BIA attribution of the liability.

---

# 5. BIA Pool Responsibility

Each BIA pool is responsible for the economic activity generated within it.

This includes:

* TCOIN purchases routed to the pool
* merchant redemptions originating from the pool
* reserve backing allocated to the pool

Redemption requests must therefore reference a **specific BIA pool**.

---

# 6. Merchant Redemption Flow

Typical redemption flow:

1. Merchant accumulates TCOIN
2. Merchant submits redemption request
3. Operator reviews request and approves/rejects
4. System identifies merchant BIA/pool attribution
5. Approved requests enter settlement queue and are settled

This attribution ensures pool-level accounting remains accurate.

Cross-pool user purchases do not grant unrestricted merchant redemption rights. Merchant redemption still depends on explicit approval and pool eligibility.

---

# 7. Early Phase Liquidity Strategy

During early network growth, reserves will be intentionally limited.

Instead of maintaining large reserves, the system prioritizes:

* merchant onboarding incentives
* ecosystem growth
* community participation

This means redemption liquidity may initially be **partial rather than instant**.

---

# 8. Merchant Incentives

To encourage participation, merchants may receive incentives such as:

* onboarding bonuses
* promotional grants
* TCOIN rewards
* visibility within the wallet app

These incentives help bootstrap acceptance during the early phase.

---

# 9. Redemption Constraints

The system must support mechanisms that limit excessive redemption pressure.

Possible constraints include:

* daily redemption limits
* pool-level liquidity caps
* merchant redemption tiers
* queued settlement when liquidity is insufficient

These constraints should operate **per BIA pool**, not globally.

---

# 10. Merchant Default Risk

The primary systemic risk occurs when:

* merchants accept TCOIN
* merchants fail before circulating or redeeming it responsibly

This can create economic imbalance within a pool.

The BIA architecture localizes this risk.

Only the affected BIA pool experiences the imbalance.

---

# 11. Bankruptcy Scenario

If a merchant goes bankrupt:

1. their redemption privileges are suspended
2. their outstanding obligations remain attributed to their BIA
3. the BIA pool absorbs the economic impact

Other BIA pools remain unaffected.

---

# 12. Pool Health Monitoring

Each BIA pool should track key health indicators such as:

* mint volume
* redemption volume
* reserve coverage
* merchant concentration risk

These metrics allow operators to identify stressed pools early.

---

# 13. Reserve Usage Policy

Reserves are used primarily for:

* merchant redemption support
* emergency liquidity

Reserves should **not be treated as guaranteed full backing**.

The system relies on circulation and merchant participation first.

---

# 14. Escalation Procedures

If a BIA pool becomes unhealthy, the system should allow intervention such as:

* temporary redemption throttling
* merchant redemption review
* pool-level freeze

These actions should affect only the relevant pool.

---

# 15. Community Governance Role

BIAs provide the social layer supporting the currency.

Local merchant networks can help:

* enforce redemption discipline
* identify bad actors
* promote local circulation

This social governance complements the technical system.

---

# 16. Acceptance Criteria

The merchant economics model is considered implemented when:

1. Merchants can accept TCOIN and redeem it through defined flows.
2. Redemptions are attributed to BIA pools.
3. Merchant redemption requests follow request -> manual approval -> queued settlement.
4. Redemption limits can be applied per BIA.
5. Merchant defaults affect only their BIA pool.
6. Cross-pool user spending is permitted while merchant redemption remains approval-gated.
7. Operators can monitor pool health metrics.

---

# 17. Summary

Merchants are the backbone of the TCOIN economy.

The system prioritizes **local circulation**, with redemption supported by reserves when needed.

BIA pools localize economic exposure so that failures in one neighborhood do not threaten the entire network.

This approach allows TCOIN to scale as a **community-backed flatcoin** rather than a fully collateralized stablecoin.
