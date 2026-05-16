# TCOIN PRD — Document 6

# Governance, Risk Controls, and System Safeguards

## 1. Purpose

This document defines the **governance structure and risk control mechanisms** required to operate the TCOIN system safely.

TCOIN is a community-backed flatcoin with partial reserves and localized BIA pools. Because it is not fully collateralized, the system requires **clear governance and operational safeguards** to manage risk and maintain trust.

---

## 1.1 Implementation Baseline (v1)

This governance document is aligned to the v1 delivery scope:

* Governance and risk controls are primarily enforced in app/data-layer operations.
* All privileged actions are auditable via governance action logs.
* Pool freeze/throttle and merchant suspension controls are operator/admin actions in v1.
* Steward/on-chain pool governance extensions are **Optional / Future Phase** unless already provided by Sarafu contracts.

---

# 2. Governance Objectives

Governance must ensure that:

* economic parameters remain stable
* risk is contained within BIA pools
* malicious or failing actors can be removed quickly
* the system can respond to emergencies

Governance should be **transparent but not slow**.

---

# 3. Governance Roles

The system supports several operational roles.

### Stewards

Stewards are responsible for **policy voting and parameter updates**.

Typical steward powers:

* vote on economic parameters
* approve system upgrades
* ratify BIA pool creation

In v1, steward/on-chain pool governance expansion is **Optional / Future Phase**.

### Operators

Operators manage day-to-day operations.

Typical operator powers:

* approve merchants
* manage BIA registry entries
* monitor system health

### Treasury

Treasury controls reserve funds and settlement flows.

Treasury powers include:

* managing reserve liquidity
* executing redemption settlements
* supporting stressed pools when authorized

### Emergency Admin

A restricted role that can trigger **emergency safety mechanisms**.

---

# 4. Governance Scope

Governance decisions fall into two categories.

### Global Decisions

These affect the entire TCOIN system.

Examples:

* demurrage rate
* redemption policy
* reserve policy
* contract upgrades

### Pool-Level Decisions

These affect a specific BIA pool.

Examples:

* activating or deactivating a pool
* pool-specific redemption limits
* temporary pool freeze

---

# 5. Parameter Governance

The governance system must support updating key economic parameters.

Examples include:

* demurrage rate
* reserve ratio targets
* redemption rates
* redemption limits

Parameter changes should follow a **structured voting process**.

In v1, structured operational approval workflows and audit logs satisfy this requirement even when changes are not finalized by on-chain steward vote.

---

# 6. Risk Monitoring

Operators must monitor indicators that signal economic stress.

Key indicators include:

* redemption pressure
* reserve coverage ratios
* merchant concentration risk
* pool-level imbalance

Monitoring should occur **per BIA pool** as well as system-wide.

---

# 7. Emergency Controls

The system must support rapid intervention when risks appear.

Emergency controls may include:

* pausing merchant redemptions
* freezing a BIA pool
* suspending specific merchants
* pausing minting operations

Emergency actions should be **visible and logged**.

---

# 8. Pool Freeze Mechanism

A BIA pool may be frozen if it becomes economically unstable.

A freeze may:

* halt new redemptions
* halt new minting
* allow investigation of merchant behavior

Freezing one pool must **not affect other pools**.

---

# 9. Merchant Suspension

Operators must be able to suspend merchants quickly.

Reasons may include:

* fraud
* insolvency
* policy violations

Suspended merchants cannot redeem TCOIN.

---

# 10. Incident Response

When a major issue occurs, the system should follow a structured response:

1. detect issue
2. isolate affected pool
3. suspend risky actors
4. investigate
5. restore operations

The goal is to **contain damage quickly**.

---

# 11. Transparency Requirements

Governance actions must be visible to participants.

Examples of transparent actions:

* pool freezes
* parameter changes
* merchant removals

This transparency builds trust in the system.

---

# 12. Upgrade Governance

Because the contract system is upgradeable, governance must control upgrades.

Upgrade process:

1. proposal
2. review
3. steward vote
4. execution

Upgrades should only occur after adequate testing.

Steward-governed on-chain upgrade workflows for pool-specific logic are **Optional / Future Phase**.

---

# 13. Gradual Decentralization

Early versions of the system may rely on a small governance group.

Over time, governance may expand to include:

* BIA representatives
* merchant representatives
* community stewards

This gradual decentralization increases legitimacy.

---

# 14. Acceptance Criteria

The governance and risk system is considered operational when it can:

1. update operational parameters through role-gated governance workflows with audit logs
2. freeze or throttle individual BIA pools
3. suspend merchants
4. enforce operator-mediated redemption controls when necessary
5. log governance actions transparently
6. preserve a clear roadmap for Optional / Future Phase steward/on-chain governance controls

---

# 15. Summary

The governance framework ensures that TCOIN can operate safely as a community-backed flatcoin.

By combining steward oversight, operator monitoring, and emergency safeguards, the system can respond quickly to risks while maintaining transparency and community trust.
