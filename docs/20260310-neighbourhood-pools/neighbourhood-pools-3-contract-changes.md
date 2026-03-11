# TCOIN PRD — Document 3

# On-Chain Capability Requirements for BIA Pools on Celo (Realigned Scope)

## 1. Purpose

This document defines the on-chain capability roadmap for supporting TCOIN’s BIA-based model on Celo, with an explicit split between **Required in v1** and **Optional / Future Phase**.

It is written against the current high-level contract family you described:

* an orchestrator contract
* a voting / governance contract
* an ERC-20-style TCOIN contract with demurrage
* related redemption assets and reserve-linked settlement logic

This document does **not** assume a specific refactor path from the current codebase. It does not try to redesign your existing contract suite line by line. Instead, it describes what the contract system must be capable of doing in order to support the BIA-segmented architecture defined in the earlier PRD documents.

This is therefore a capability specification for the on-chain layer, not a patch list.

### 1.1 Scope lock for the current release (v1)

Required in v1:

* Use existing Sarafu contracts as the pool system of record on-chain.
* Keep TCOIN/Orchestrator contracts focused on city-token and redemption primitives.
* Keep merchant redemption as app-orchestrated request/approval/settlement workflow.
* Keep event attribution derived through indexer + app tables where needed.

Optional / Future Phase:

* TCOIN-native on-chain BIA registry/state.
* Pool-tagged mint and redemption attribution in TCOIN contracts.
* On-chain pool-specific governance controls in TCOIN contracts.

---

## 2. Context

TCOIN is intended to function as a **localized flatcoin** that tracks the value of TTC Tokens through policy, minting parity, merchant redemption commitments, and partial reserve support.

The architectural requirement is that economic exposure be **localized by Business Improvement Area (BIA)** rather than pooled globally across all of Toronto.

That means the contract system must be able to represent and enforce:

* BIA-specific pool identity
* BIA-specific reserve attribution
* BIA-specific redemption attribution
* BIA-specific exposure and loss containment
* optional future BIA-specific governance and incentives

In v1, this is achieved operationally via Sarafu pool state plus off-chain attribution/indexing, while TCOIN contracts remain city-token focused.

---

## 3. Core Design Goal (Long-Term)

### The system must localize economic obligations to BIA pools.

The most important outcome is not cosmetic labeling. It is **risk partitioning**.

If a merchant, reserve bucket, or redemption path fails in one BIA, the system must be able to say on-chain or through on-chain-verifiable logic:

* this exposure belongs to BIA A
* it does not belong to BIA B
* losses or constraints can therefore be contained to BIA A

That is the point of the redesign.

---

## 4. Guiding Principles

### 4.1 TCOIN can remain one currency while pools are segmented

You do **not** necessarily need one token contract per BIA.

The preferred architectural assumption for now is:

* one city-wide TCOIN token
* multiple BIA-specific pool contexts tracked by the orchestration layer

This keeps the user-facing currency unified while localizing reserve and redemption accounting.

### 4.2 Pool segmentation should happen at the orchestration layer first

Because your current architecture already uses an orchestrator, the natural place to introduce BIA pool logic is the orchestration / policy / reserve-routing layer.

The token should remain as simple as possible unless there is a compelling reason to embed BIA state directly into token balances.

### 4.3 Redemption context matters more than transfer context

Ordinary peer-to-peer transfers of TCOIN do not necessarily need to be restricted by BIA.

The higher-priority requirement is that **minting, reserve routing, merchant redemption, and liability tracking** be attributable to a BIA pool.

### 4.4 The on-chain layer should support verifiable pool attribution even if some fiat handling remains off-chain

Early operational reality may involve bank accounts, treasury subledgers, or manual reserve handling off-chain. That is acceptable temporarily.

But the contract system should still make BIA attribution explicit enough that the application and treasury layers can reconcile to chain state.

---

## 5. Capability Areas by Phase

### 5.1 Required in v1

1. Sarafu pool compatibility and address/ABI integration.
2. Merchant eligibility and redemption approvals enforced through Sarafu + app controls.
3. City-token contract scope remains separate from BIA pool registry concerns.
4. Indexer-derived attribution and reconciliation for mint/redemption/pool risk analytics.

### 5.2 Optional / Future Phase

1. **BIA registry and pool identity** in TCOIN contract suite.
2. **BIA-aware mint routing** at TCOIN contract state/event level.
3. **BIA-aware redemption routing** at TCOIN contract state/event level.
4. **BIA-scoped reserve and liability accounting** on-chain in TCOIN contracts.
5. **Loss containment and pool health constraints** enforced by TCOIN contracts.
6. **Governance and parameter management for pool logic** in TCOIN governance contracts.
7. **Event emission for indexing and reconciliation** beyond Sarafu/app-derived model.
8. **Upgrade-safe extensibility for future BIA features** in TCOIN suite.

Sections 6 through 17 document this future-phase contract roadmap unless explicitly provided by Sarafu contracts today.

---

## 6. Optional / Future Phase — BIA Registry and Pool Identity

The contract system must be able to represent each BIA as a distinct on-chain pool context.

### 6.1 Required pool identity

Each BIA should have a stable on-chain identity that can be referenced by other contracts and off-chain indexers.

That identity may be represented as:

* a numeric pool ID
* a bytes32 key
* an address of a dedicated pool contract
* an entry in an orchestrator-managed registry

The exact implementation is flexible.

The required capability is not.

### 6.2 Required pool metadata linkage

For each BIA pool, the contract system should be able to associate at least:

* pool identifier
* active/inactive status
* reference to off-chain BIA metadata record
* reserve context identifier or treasury routing tag
* optional governance configuration

### 6.3 Pool lifecycle

The system must support:

* registering a new BIA pool
* activating a BIA pool
* deactivating a BIA pool
* preserving historical references to old or inactive pools

A deactivated pool must not disappear in a way that breaks historical attribution.

---

## 7. Optional / Future Phase — Relationship Between Token and Pools

The system should treat pools as **economic contexts**, not necessarily separate currencies.

### 7.1 One TCOIN, many pools

The base assumption for the next implementation stage should be:

* TCOIN remains fungible at the user level
* BIA identity attaches to mint/redemption/reserve events, not every wallet balance fragment

This is the least disruptive model and fits your current architecture best.

### 7.2 Do not overcomplicate user transfers early

The contract suite does not need to force every transfer to remain inside a BIA pool unless a later policy decision requires it.

Trying to make every transferred unit carry perfect pool provenance at the token balance level will likely create a lot of complexity, friction, and edge cases.

The first version should focus on:

* attribution at mint time
* attribution at redemption time
* attribution at reserve and liability level

That gives you most of the practical containment you need.

### 7.3 Future extensibility

The architecture should leave room for future variants such as:

* pool-weighted exposure tracking
* pool-tagged balance lots
* stricter intra-pool redemption rules
* pool-specific incentives or demurrage modifiers

But those should not be required in phase one.

---

## 8. Optional / Future Phase — BIA-Aware Mint Routing

When new TCOIN is minted through a purchase or issuance flow, the contract system must be able to attribute that mint to a BIA pool.

### 8.1 Required mint attribution

For each minting operation that matters economically, the on-chain system should be able to resolve or receive:

* recipient wallet
* amount minted
* BIA pool ID
* mint basis or mint reason
* reference to off-chain payment / reserve intake when applicable

### 8.2 Orchestrator responsibility

The orchestrator is the natural place to enforce that every reserve-backed mint includes a BIA context.

That means the system should support an orchestration flow conceptually like:

1. caller initiates purchase / mint flow
2. orchestrator resolves or is passed the BIA pool ID
3. orchestrator records the pool attribution
4. orchestrator triggers TCOIN minting
5. event log emits the pool-aware mint record

### 8.3 Sources of BIA routing

The contract system should be able to support mint routing based on one of several inputs:

* user’s selected BIA from the app layer
* merchant/store BIA for point-of-sale purchases
* explicit admin or treasury routing
* future campaign / program routing

The contracts do not need to know how the app chose the BIA, but they do need to receive and persist the result in a verifiable way.

### 8.4 Mint types

The system should distinguish among mint categories when useful, for example:

* reserve-backed user purchase
* merchant incentive distribution
* treasury / grant issuance
* charity or public-goods issuance
* adjustment / migration mint

This is important because not every mint should necessarily increase redeemable liability in the same way.

---

## 9. Optional / Future Phase — BIA-Aware Redemption Routing

Redemption is where BIA localization becomes economically decisive.

### 9.1 Required redemption attribution

For every redemption path, the contract system must be able to determine and record:

* who is redeeming
* whether they are redeeming as user, merchant, charity, or other role
* which BIA pool is responsible
* amount of TCOIN surrendered
* redemption asset or settlement type
* amount approved / settled
* reserve impact on that pool

### 9.2 Merchant redemptions are the priority case

The contract system especially needs strong support for merchant redemption flows because that is where insolvency and obligation risk sits.

A merchant redemption should never be treated as drawing from a city-wide undifferentiated reserve unless governance explicitly overrides it.

### 9.3 Pool resolution rules

The system should support a deterministic rule for redemption pool selection, likely defaulting to:

* merchant storefront’s affiliated BIA pool

Possible future alternatives might include:

* redemption against origin pool of a particular issuance batch
* redemption against an override pool approved by governance
* partial routing across reserve layers in exceptional cases

### 9.4 Settlement type flexibility

Your current suite supports multiple redemption assets and pathways. The BIA-aware design should preserve that flexibility.

The system should be able to support, depending on policy:

* redemption to TTC-like settlement asset
* redemption to CAD-like settlement asset
* redemption to fiat-linked treasury settlement
* partial reserve reimbursement
* charity-credit side allocations where relevant

But regardless of the asset used, the redemption must still be attributable to a BIA pool.

---

## 10. Optional / Future Phase — Reserve and Liability Accounting by Pool

The contract suite must support pool-scoped accounting, whether directly on-chain or via on-chain-verifiable event/state structures.

### 10.1 Minimum required tracked values

For each BIA pool, the system should be able to expose or derive values such as:

* cumulative mint volume attributed to pool
* cumulative redemption volume attributed to pool
* current outstanding redeemable exposure
* current reserve allocation or reserve credit assigned to pool
* failed / delayed settlement exposure if modeled on-chain
* pool health indicators or derived ratios

### 10.2 Logical segregation is mandatory

Even if actual cash reserves are operationally co-mingled off-chain during the early phase, the contract system must maintain **logical segregation** of pool liabilities.

That means the state model must be good enough to support statements like:

* Pool A has X attributed liabilities
* Pool B has Y attributed liabilities
* Pool A’s merchants are not entitled to draw from Pool B unless an explicit cross-pool rule exists

### 10.3 Exposure model

At the very least, the system should support a notion of **pool liability exposure**.

This does not require perfect actuarial accounting on day one. It does require a coherent ledger of which BIA has generated what obligation.

---

## 11. Optional / Future Phase — Merchant and Store Eligibility Binding

The contract system must support the concept that redemption rights are not open equally to everyone.

### 11.1 Merchant/store identity

The on-chain layer should be able to recognize or receive authenticated merchant/store identities, whether as:

* whitelisted addresses
* role-bearing addresses
* store IDs mapped to payout addresses
* signed claims relayed by the app/orchestrator

### 11.2 Required merchant-pool binding

A redeeming merchant or storefront must be bindable to a specific BIA pool.

That means the contract suite should be able to answer, directly or indirectly:

* is this address an authorized merchant/store?
* which pool does it belong to?
* is it currently active?
* is it currently allowed to redeem?

### 11.3 Multi-location merchants

The system should leave room for a merchant operator to manage multiple store locations in different BIAs.

That usually means the contract layer should not assume one merchant entity equals one pool forever.

The cleaner model is likely one of:

* store-level identifiers tied to redeeming wallets
* merchant wallets scoped per location
* signed redemption intents that specify location identity

### 11.4 Store onboarding and removal

The contract suite should support clean lifecycle operations for merchant/store status:

* approve store
* suspend store
* remove store
* reassign store payout address if necessary

This is especially important because bankruptcy, inactivity, or fraud will sometimes require rapid intervention.

---

## 12. Optional / Future Phase — Loss Containment and Pool Health Constraints

This section matters more than it may look. Without it, BIA pools are mostly labels.

### 12.1 Required containment capability

The contract system should make it possible to prevent or constrain redemptions based on **pool-specific conditions**, not just global system conditions.

Examples:

* pool inactive
* pool reserve coverage below threshold
* store suspended
* pool in manual-review mode
* daily outflow cap reached

### 12.2 Pool-specific guardrails

The architecture should support rules such as:

* only active pools may receive new reserve-backed minting
* only healthy pools may allow automatic merchant redemption
* redemptions may be throttled when a pool breaches risk parameters
* governance may freeze a single pool without freezing the entire currency

### 12.3 Escalation instead of silent failure

Where possible, the system should support moving a redemption from automatic execution into a flagged or pending state rather than blindly reverting everything or silently allowing insolvency.

Depending on how much of settlement stays off-chain, this may be implemented through:

* event emission for manual treasury review
* state flags indicating pending approval
* two-step redemption claims
* capped immediate settlement with queued remainder

The exact mechanism can vary. The requirement is that the system support **localized intervention**.

---

## 13. Optional / Future Phase — Governance and Parameter Management

Your current suite already includes a voting / steward governance layer. The BIA architecture requires that governance be able to manage pool-related policy as well.

### 13.1 System-wide versus pool-specific governance

The contract system should distinguish between:

* global parameters that affect all TCOIN
* pool-specific parameters that affect one BIA

Examples of likely global parameters:

* baseline demurrage logic
* system-wide token policy
* global reserve policy bounds

Examples of likely pool-specific parameters:

* pool active status
* pool-specific redemption caps
* pool-specific reserve coverage thresholds
* pool-specific incentive or subsidy flags

### 13.2 Governance responsibilities

The system should support governance actions such as:

* registering and activating BIA pools
* changing pool status
* assigning or updating pool risk parameters
* authorizing exceptional cross-pool support if ever allowed
* pausing a single pool
* reviewing and ratifying pool migration or deprecation

### 13.3 Avoid unnecessary governance coupling

Not every operational change should require a full steward vote.

The architecture should allow a split between:

* governance-level decisions
* owner / admin / operator actions within bounded authority

Otherwise you will create operational paralysis.

---

## 14. Optional / Future Phase — Event Emission and Indexing Requirements

If you want BIA pools to be auditable, the chain layer must emit the right data.

### 14.1 Required event categories

The contract suite should emit structured events for at least:

* pool registration
* pool activation / deactivation
* merchant/store assignment to pool
* mint attributed to pool
* redemption attributed to pool
* pool status changes
* pool parameter changes
* pool freeze / suspension actions

### 14.2 Why events matter

Events are critical for:

* indexers
* Supabase synchronization
* analytics dashboards
* dispute review
* treasury reconciliation
* proving that exposure was attributed to the correct BIA

### 14.3 Event design discipline

Do not skimp here.

Poor event design will force you into expensive, fragile off-chain reconstruction later.

Each economically relevant pool action should emit enough context to answer:

* who acted
* which pool was involved
* what amount was involved
* what category of action it was
* what status change occurred

---

## 15. Optional / Future Phase — Upgradeability and Extensibility

Your current architecture already leans upgradeable. The BIA model increases the need for careful extension.

### 15.1 Backward-compatible growth path

The contract suite should be structured so that BIA functionality can evolve without forcing a token migration every time you add a new pool feature.

That argues for keeping most pool logic outside the core TCOIN accounting where feasible.

### 15.2 Storage discipline

If upgradeable contracts remain part of the system, pool-related state must be introduced with clean storage planning so future changes do not create slot collision or migration pain.

### 15.3 Future features to leave room for

The architecture should be able to grow toward features such as:

* BIA-level incentive budgets
* pool-specific reserve escrows
* pool-specific merchant staking or bonding
* cross-pool backstop mechanisms
* BIA-level governance councils
* richer claim / settlement workflows

The first implementation should not hardcode assumptions that make these impossible.

---

## 16. Optional / Future Phase — Recommended Functional Partitioning

This section is not a mandatory design, but it is the most natural direction given your current contract family.

### 16.1 TCOIN contract responsibilities

TCOIN should remain primarily responsible for:

* fungible token balances
* demurrage / rebase behavior
* controlled mint / burn surface
* basic token-level authorization gates

TCOIN should ideally **not** become the place where complex BIA logic lives, unless there is a strong reason.

### 16.2 Orchestrator responsibilities

Future-phase direction:

* BIA registry linkage
* pool state
* pool-aware mint/redemption routing
* store / merchant eligibility checks
* reserve exposure attribution
* policy guardrails for pools

v1 release baseline:

* Orchestrator remains a city-token policy/redemption primitive.
* It is not the BIA pool manager in this release.

### 16.3 Voting / governance responsibilities

The voting contract or governance layer should manage:

* approval or ratification of policy changes
* pool-level and global parameter updates where governance is required
* steward / governance visibility into pool health

### 16.4 Optional helper modules

Depending on how large this gets, it may be cleaner to split some logic into dedicated helper modules rather than bloating the orchestrator indefinitely.

Examples:

* pool registry module
* merchant registry module
* reserve accounting module
* redemption policy module

You do not need to decide that in this PRD, but you should leave room for it.

---

## 17. Optional / Future Phase — Security and Abuse Considerations

A BIA architecture changes attack surfaces.

### 17.1 Merchant abuse risk

The contract system should assume that some merchants may try to:

* redeem more than they should
* route through the wrong pool
* use old or inactive store identities
* exploit weak whitelist assumptions

Pool identity and merchant eligibility must therefore be explicit and difficult to spoof.

### 17.2 Governance abuse risk

If governance can arbitrarily reassign liabilities or move exposure between pools without clear rules, the whole BIA containment story becomes weak.

The system should therefore make such actions explicit, rare, and well-logged.

### 17.3 Admin override risk

You need admin overrides for emergencies, but they should not become invisible backdoors that erase accountability.

Override actions should be:

* limited
* clearly scoped
* evented
* reviewable later

---

## 18. Non-Goals for This Document

This document does **not** define:

* the exact solidity storage layout
* the final ABI
* exact event signatures
* exact access-control role names
* the deployment script sequence
* the cleanup steps required to fix the current codebase
* the math formulas for demurrage or reserve ratios

Those belong in implementation design and engineering specs.

---

## 19. Acceptance Criteria

### 19.1 Required in v1

The v1 on-chain integration scope is considered complete when it can demonstrably do all of the following:

1. Resolve and use Sarafu pool contracts as the on-chain pool system of record.
2. Keep TCOIN/orchestrator responsibilities scoped to city-token policy/redemption primitives.
3. Support merchant redemption requests through manual approval/settlement workflows backed by Sarafu/app controls.
4. Preserve indexer-derived attribution and reconciliation for pool-linked activity.
5. Allow city-wide user payments across pools while keeping merchant redemption rights approval-gated.

### 19.2 Optional / Future Phase

The future-phase TCOIN contract roadmap may later include:

1. Native on-chain BIA pool identity and lifecycle in TCOIN contracts.
2. Pool-tagged mint/redeem attribution in TCOIN contracts.
3. Pool-specific governance and guardrails enforced on-chain in TCOIN suite.
4. Expanded event coverage in TCOIN contracts for pool accounting and audit.

---

## 20. Recommended Next Document

The next document should translate these on-chain capabilities into a more concrete implementation design, likely covering:

* candidate contract responsibilities by module
* suggested state model for pool IDs and affiliations
* event model
* role model
* redemption state machine
* store identity model
* interaction with Supabase / indexer / treasury systems
* whether pool accounting should be direct state or primarily event-derived

---

## 21. Summary

For v1, BIA pool mechanics are implemented through Sarafu contracts plus off-chain app/indexer attribution, while TCOIN contracts remain city-token focused.

This achieves immediate delivery goals without requiring a TCOIN-native on-chain BIA pool layer in the same release.

The contract sections in this document remain a structured **Optional / Future Phase** roadmap for deeper on-chain BIA-native controls if needed later.
