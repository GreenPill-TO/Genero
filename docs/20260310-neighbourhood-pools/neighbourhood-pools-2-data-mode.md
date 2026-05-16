# TCOIN PRD — Document 2

# Supabase Capability Requirements for BIA-Based Pooling

## 1. Purpose

This document defines the **required backend capabilities** for supporting TCOIN’s BIA-based pool architecture.

It deliberately avoids prescribing a specific schema migration path or assuming the current database structure. The goal is to describe **what the Supabase-backed application layer must be able to do**, regardless of whether these capabilities are implemented through existing tables, new tables, views, functions, edge functions, storage objects, or external integrations.

This document should be read as a **capability specification**, not a low-level migration plan.

---

## 1.1 Implementation Baseline (v1)

This document is aligned to the v1 implementation scope:

* Supabase is the authoritative operational source for BIA metadata, affiliations, controls, and workflow state.
* Sarafu contracts are the on-chain pool system of record.
* TCOIN contracts remain city-token and governance primitives; no BIA-native pool state is required in TCOIN contracts for v1.
* Mint and liquidity attribution is derived through app/indexer data, not pool-tagged mint state in TCOIN contracts.
* Advanced polygon-based geospatial matching is **Optional / Future Phase**.

---

## 2. Context

TCOIN is organized around geographically localized community pools aligned to **Business Improvement Areas (BIAs)**.

To support this model, the backend must be able to:

* represent BIAs as first-class entities
* associate users and merchants with BIAs
* support proximity-based BIA suggestions
* track which fiat inflows and redemption obligations belong to which BIA
* expose these relationships cleanly to the wallet app, admin tools, and contract integration layer

The Supabase layer acts as the **operational source of truth** for application-facing BIA metadata and affiliation logic, while Sarafu contracts remain the source of truth for pool mechanics where applicable.

---

## 3. Design Principles

### 3.1 BIA must be a first-class domain object

A BIA cannot be treated as an incidental tag or freeform string. The system must support BIAs as structured entities with stable identifiers, metadata, and status.

### 3.2 Affiliation must be explicit

Users and merchants must have explicit BIA affiliation records, even if the system also derives suggestions automatically from geography.

### 3.3 Geography supports suggestion, not forced assignment

Location should help suggest likely BIAs, but the system must preserve human override and administrative correction.

### 3.4 Accounting linkage must be deterministic

Every reserve deposit, minting event, redemption event, and merchant obligation that depends on BIA segmentation must be traceable to a specific BIA or pool context.

### 3.5 On-chain and off-chain identifiers must be linkable

Where a BIA is represented on-chain as a unique pool, the backend must be able to map the application-level BIA record to its corresponding on-chain identity.

---

## 4. Required Capability Areas

The Supabase architecture must support the following capability areas:

1. **BIA registry management**
2. **Geospatial lookup and suggestion**
3. **User affiliation management**
4. **Merchant/store affiliation management**
5. **Pool and reserve attribution**
6. **Redemption and obligation attribution**
7. **Admin governance and review workflows**
8. **API/query surfaces for wallet and admin clients**
9. **Auditability and historical traceability**

Each area is described below.

---

## 5. BIA Registry Management

The system must support a structured registry of BIAs.

### 5.1 Required BIA properties

Each BIA record should be able to carry, at minimum:

* stable internal identifier
* display name
* short code or slug
* geographic center point
* optional geographic boundary or polygon reference
* city / region metadata
* active/inactive status
* optional descriptive metadata
* optional external references
* optional linkage to on-chain pool identity

### 5.2 Multiple geography representations

In v1, the system should support:

* a simple center coordinate for nearest-BIA suggestions
* optional storage hooks for a richer boundary representation when available (**Optional / Future Phase**)

This matters because v1 relies on “distance from center,” while later versions may need true “inside boundary” logic.

### 5.3 Lifecycle support

The registry must support:

* creating BIAs
* updating metadata
* deactivating BIAs
* preserving historical references to deactivated BIAs

Deactivation must not break historical transaction attribution.

---

## 6. Geospatial Lookup and Suggestion

A core product requirement is that users and merchants can be shown likely BIAs based on proximity.

### 6.1 Supported input types

The backend should be able to accept one or more of the following as geographic inputs:

* latitude/longitude
* postal code-derived coordinates
* address-derived coordinates
* place-derived coordinates

### 6.2 Required output behavior

Given a geographic point, the system must be able to return:

* the nearest BIAs in ranked order
* distance from the input point to each suggested BIA
* polygon-containment hints only if enabled later (**Optional / Future Phase**)

### 6.3 Suggestion logic

The v1 backend uses **distance-based ranking** for nearest suggestions.

Containment-based matching with polygon boundaries is **Optional / Future Phase**.

### 6.4 Manual override support

The suggestion engine must not auto-lock affiliation. Clients must be able to present suggestions while still allowing user choice or admin correction.

---

## 7. User Affiliation Management

The system must support explicit association between a user and a BIA.

### 7.1 Required capabilities

The backend must support:

* storing a user’s selected primary BIA
* storing how that affiliation was chosen
* storing when the affiliation became effective
* supporting future updates to affiliation
* preserving historical affiliation changes where needed

### 7.2 Affiliation source tracking

The source of affiliation should be attributable, such as:

* user selected
* system suggested and user accepted
* admin assigned
* imported / migrated
* contract-derived or wallet-derived in future cases

This matters for operational trust and dispute resolution.

### 7.3 Confidence / quality metadata

Where useful, the architecture should support metadata about confidence, such as:

* derived from exact GPS
* derived from postal code centroid
* merchant self-declared
* unverified

This becomes important when evaluating whether a BIA assignment is strong enough for governance, incentives, or localized risk analytics.

### 7.4 Effective-dating

If BIA affiliation affects reserve routing or eligibility logic, the system should support effective dates so that downstream processes know which BIA governed a given event at the time it occurred.

---

## 8. Merchant and Store Affiliation Management

Merchant participation is central to the TCOIN model. The backend must support BIA affiliation at the merchant or storefront level.

### 8.1 Merchant versus location

The architecture should distinguish between:

* a merchant organization
* one or more physical storefronts or redemption locations

A single merchant may operate multiple locations. Each location should be capable of carrying its own BIA affiliation.

### 8.2 Required capabilities

The system must support:

* storing a merchant’s affiliated BIA
* storing a storefront’s affiliated BIA
* linking redemption activity to the relevant storefront or BIA context
* supporting merchants with multiple storefronts in different BIAs

### 8.3 Merchant commitment metadata

The backend should be able to store merchant-specific participation data, such as:

* redemption commitment status
* onboarding date
* participation status
* risk tier or trust tier
* admin notes
* local BIA sponsorship or endorsement metadata

This is not just CRM fluff. It becomes operationally important when deciding whether a merchant can redeem freely, should be capped, or should require manual review.

---

## 9. Pool and Reserve Attribution

The architecture must support deterministic attribution of off-chain reserve activity to a specific BIA pool.

### 9.1 Pool context

Each BIA should have a resolvable pool context used by the application layer. This may map to:

* an on-chain pool identifier
* a banking sub-ledger
* a virtual reserve bucket
* a treasury account tag
* an accounting dimension

The implementation can vary. The capability cannot.

### 9.2 Minting flow requirements

When a user purchases or mints TCOIN, the backend must be able to determine and record:

* which user initiated the purchase
* which BIA the purchase is attributed to
* what basis was used for that attribution
* which reserve bucket or pool received the fiat-side credit
* which app/indexer event trail corresponds to the purchase attribution

In v1, mint is treated as city-wide token issuance; pool attribution is analytics/indexer-derived.

### 9.3 BIA attribution rules

The backend should support a configurable attribution rule for minting, likely defaulting to:

* user’s active primary BIA at time of purchase

But the architecture should leave room for alternatives later, such as:

* merchant’s BIA when purchase happens at merchant location
* event-specific or campaign-specific pool routing
* manual admin rerouting in exceptional cases

### 9.4 Segregated reporting

The system must be able to produce pool-specific views of:

* total inflows
* total outflows
* total merchant redemptions
* outstanding obligations
* net reserve position

Even if the cash is physically co-mingled in one bank account early on, the system must maintain **logical segregation** per BIA.

---

## 10. Redemption and Obligation Attribution

The system must support tracking which BIA is responsible for a redemption or merchant-facing liability.

### 10.1 Redemption requests

For every redemption event or request, the backend should be able to determine:

* which merchant/store initiated the redemption
* which BIA pool the redemption belongs to
* the amount requested
* the amount approved
* the amount settled
* status and timestamps
* settlement reference(s)

### 10.2 Outstanding obligation tracking

The system should support a view of outstanding BIA-linked obligations, including:

* merchant balances pending redemption
* unsettled reimbursements
* failed or reversed settlements
* bad debt or write-off cases

### 10.3 Failure containment

A core requirement is that losses, defaults, or insolvency events can be attributed to a single BIA context rather than smeared across the whole system.

The backend must therefore support reporting and flags that make it possible to say:

* this obligation belongs to BIA X
* this reserve shortfall belongs to BIA X
* this merchant risk belongs to BIA X

That is the whole point of the architecture.

---

## 11. On-Chain Mapping Support (Sarafu Pools in v1)

Because BIAs map to Sarafu pool infrastructure in v1, the backend must support mapping between off-chain BIA records and Sarafu pool contract tuples.

### 11.1 Required mapping capability

For each BIA, the system should be able to associate:

* application-level BIA identifier
* Sarafu pool identifier/address and related contract references
* relevant chain/network metadata
* status of synchronization and discovery validation

### 11.2 Contract registration state

The backend should be able to track whether a BIA mapping is:

* defined off-chain but not yet mapped to Sarafu
* mapped and valid against current Sarafu discovery
* mapped but stale/mismatched
* deprecated or migrated

This prevents operational ambiguity during rollout.

TCOIN-native on-chain BIA registration states are **Optional / Future Phase**.

---

## 12. Admin Governance and Review Workflows

Because affiliation and pool routing have economic consequences, the backend must support admin workflows around them.

### 12.1 Review capabilities

Admins should be able to:

* review BIA registry entries
* correct BIA metadata
* reassign affiliations when necessary
* review merchant/store BIA assignments
* freeze or deactivate problematic merchants or pools
* flag exceptions for manual handling
* manage BIA-to-Sarafu pool mappings from the city-manager interface
* approve/reject merchant redemption eligibility for pool participation

### 12.2 Guardrails

The architecture should make it possible to enforce guardrails such as:

* only active BIAs can receive new routing
* only approved merchants can redeem
* high-risk merchants require extra review
* affiliation changes do not silently rewrite historical accounting

### 12.3 Role separation

Where the broader architecture supports role-based access control, these BIA functions should align cleanly with it. At minimum, the system should distinguish:

* end-user actions
* merchant actions
* admin review actions
* system automation

---

## 13. API and Query Surface Requirements

The wallet app and admin surfaces need predictable access to BIA data.

### 13.1 Wallet-facing queries

The backend should support queries or RPC-style endpoints for:

* list active BIAs
* get nearest BIAs from a coordinate
* get current user’s BIA affiliation
* set or update current user’s BIA affiliation
* fetch merchant/store BIA details where relevant
* list "merchants available in my pool" as a discovery/filter view

### 13.2 Admin-facing queries

The backend should support queries for:

* BIA directory and status
* merchant/store affiliation lists
* users by BIA
* merchants by BIA
* reserve and redemption summaries by BIA
* outstanding obligations by BIA
* affiliation change history

### 13.3 Integration-facing queries

The backend should also expose enough structure for contract/indexer/integration layers to resolve:

* BIA ↔ Sarafu pool mapping
* BIA routing rules
* merchant redemption eligibility

---

## 14. Auditability and Historical Traceability

This is not optional. If money routing and risk segmentation depend on BIA affiliation, then historical state matters.

### 14.1 Historical requirements

The architecture should support reconstructing:

* what a BIA record looked like at a given time
* which BIA a user or merchant was affiliated with at a given time
* which BIA a minting or redemption event was attributed to at a given time
* who changed an affiliation or record
* why it changed, when possible

### 14.2 Non-destructive change patterns

Whether implemented through audit logs, append-only records, event tables, or temporal models, the system should avoid destructive overwrites for economically relevant data.

### 14.3 Reconciliation support

The backend should support reconciliation between:

* wallet app activity
* fiat-side records
* reserve accounting
* merchant redemption records
* on-chain pool activity

That reconciliation must remain possible per BIA.

---

## 15. Privacy and Data Handling Considerations

The product wants to suggest BIAs based on where users live or are located. That creates privacy risk.

### 15.1 Minimize precise location retention

The architecture should support deriving BIA suggestions from location without unnecessarily retaining exact home coordinates longer than needed.

### 15.2 Support coarse location when sufficient

In many cases, postal code centroid or neighborhood-level approximation may be sufficient for BIA suggestion.

### 15.3 Separate operational need from surveillance temptation

The system should collect only the location precision actually needed for:

* suggesting likely BIAs
* supporting local incentives
* managing pool attribution where relevant

This should not quietly turn into generalized location tracking.

---

## 16. Reporting Requirements

The architecture should support reporting at both network and BIA level.

### 16.1 BIA-level reports

Examples include:

* users per BIA
* merchants per BIA
* mint volume per BIA
* redemption volume per BIA
* reserve inflow/outflow per BIA
* outstanding liability per BIA
* merchant concentration risk per BIA
* inactive versus active pool status

### 16.2 Network-level rollups

The system should also support aggregated city-wide views across all BIAs while preserving drill-down capability.

### 16.3 Risk reporting

A particularly important capability is identifying when one BIA is becoming unsafe, for example:

* redemptions outpacing inflows
* reserve coverage ratio deteriorating
* excessive exposure to one merchant
* growing unsettled redemption backlog

---

## 17. Non-Goals for This Document

This document does **not** define:

* the exact Supabase schema
* exact table names
* exact SQL migrations
* exact RLS policies
* exact Edge Function implementation
* exact contract ABI or indexing strategy

Those belong in later implementation design documents.

---

## 18. Acceptance Criteria

The Supabase architecture should be considered capable of supporting the BIA model when it can demonstrably do all of the following:

1. Represent BIAs as structured, queryable entities.
2. Suggest likely BIAs from a geographic input.
3. Store and retrieve explicit user-to-BIA affiliations.
4. Store and retrieve merchant/store-to-BIA affiliations.
5. Map each BIA to a pool/reserve context.
6. Attribute minting and reserve inflow events to a BIA through app/indexer-derived attribution.
7. Attribute merchant redemption events and liabilities to a BIA.
8. Expose BIA-aware data cleanly to wallet and admin clients.
9. Preserve historical traceability of affiliation and attribution changes.
10. Support BIA-level reporting and risk analysis.
11. Support city-manager management of Sarafu pool mappings and merchant approval workflows.
12. Support center-point proximity suggestions with manual override (polygon containment is Optional / Future Phase).

---

## 19. Implementation Notes for the Next Document

The next document should translate these capabilities into a proposed implementation shape, likely including:

* candidate domain entities
* suggested relationship model
* location and geospatial strategy
* effective-dated affiliation model
* reserve attribution model
* reporting model
* admin workflow patterns
* indexing and performance considerations

---

## 20. Summary

To support TCOIN’s localized flatcoin architecture, the Supabase layer must do more than store users and merchants. It must provide a robust operational model for:

* defining BIAs
* suggesting and managing affiliation
* routing economic activity into local pool contexts
* preserving auditability
* making localized risk visible

That capability is what turns the BIA concept from a branding layer into an actual containment mechanism for network risk.
