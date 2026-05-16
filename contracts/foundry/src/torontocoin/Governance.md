# TCOIN Contract Design Spec — Governance

## Purpose

This document defines the design of the `Governance` contract as a standalone module within the TCOIN system.

`Governance` is responsible for:

* proposal creation
* weighted steward voting
* vote-weight snapshotting at proposal creation
* proposal approval / rejection
* permissionless execution of approved proposals
* routing successful proposals into the correct protocol modules

It must not hold reserve assets, mint tokens directly, or implement charity, steward, pool, oracle, or treasury business logic internally.

Its job is to make decisions, not to be the thing being governed.

Implementation note:

To stay deployable under the EIP-170 contract-size limit while preserving the explicit proposal surface at the governance address, the live system now splits runtime logic across:

* `Governance` core storage, voting, fallback dispatch, and deadline-gated execution entrypoint
* `GovernanceExecutionHelper` for delegatecalled proposal execution
* `GovernanceProposalHelper` for most explicit proposer wrappers
* `GovernanceRouterProposalHelper` for router-specific proposer wrappers

Operators still interact with the `Governance` address itself. The helper contracts are deployment dependencies, not separate governance entrypoints.

---

# 1. Role in the System

The TCOIN governance system is:

* **city-wide**
* **charity-rooted**
* **steward-operated**
* **weight-based, not token-based**

The flow is:

```text
Charities
  -> appoint stewards
StewardRegistry
  -> computes current weights
Governance
  -> snapshots weights at proposal creation
Stewards
  -> vote with snapshotted weights
Anyone
  -> executes approved proposals
Affected modules
  -> apply the approved action
```

This design ensures:

* charity assignments can change immediately
* those changes only affect **future** proposals
* active proposals remain stable because weights are snapshotted

---

# 2. Core Design Principles

## 2.1 Narrow explicit proposal methods

The protocol prefers explicit, purpose-built proposal entrypoints rather than generic arbitrary calldata proposals.

Examples:

* `proposeCharityAdd(...)`
* `proposeCharityRemove(...)`
* `proposeCadPegUpdate(...)`
* `proposeUserRedeemRateUpdate(...)`
* `proposeExpirePeriodUpdate(...)`
* `proposePoolAdd(...)`
* `proposeReserveAssetAdd(...)`
* `proposeLiquidityRouterSetScoringWeights(...)`

This makes the contract easier to audit and reduces proposal ambiguity.

---

## 2.2 Vote weights are snapshotted at proposal creation

This is fixed by design.

At proposal creation time, Governance should snapshot:

* total active steward voting weight
* each steward’s current voting weight

Votes on that proposal must use the snapshotted weights, not current live weights.

This ensures:

* a charity changing its steward does not affect already-open proposals
* steward suspensions/removals affect future proposals, not already-open ones unless explicitly designed otherwise

---

## 2.3 Simple weighted majority

The protocol requires:

* simple majority of weighted steward votes for approval

That means, for a given proposal:

```text
yesWeight > noWeight
```

Open design choice resolved here:

### Recommended additional participation condition

A proposal should not pass with zero or trivial participation.

Recommended approval rule:

```text
proposal approved if:
1. yesWeight > noWeight
2. yesWeight + noWeight >= minimumParticipationWeight
```

Recommended minimum participation threshold:

```text
minimumParticipationWeight = 1
```

If you want stricter quorum later, it can be added, but v1 can remain simple.

---

## 2.4 Permissionless execution

This is fixed by design.

Once a proposal is approved and executable, **anyone** may call `executeProposal(proposalId)` and pay the gas.

This reduces governance bottlenecks and avoids owner-mediated execution dependency.

---

## 2.5 Owner bootstrap and emergency powers remain outside normal voting flow

The multisig owner still matters for:

* bootstrap charity admission while active charity count < 7
* emergency pauses and emergency suspensions in other modules
* upgrade administration

But normal governance decisions after bootstrap should flow through this contract.

---

# 3. Scope

## In scope

* proposal storage
* proposal type handling
* proposal deadlines
* steward eligibility checks
* steward vote-weight snapshotting
* weighted yes/no voting
* proposal approval / rejection / cancellation
* permissionless execution of approved proposals
* routing execution into governed modules

## Out of scope

* reserve asset storage
* charity storage
* steward weight calculation logic
* merchant allowance accounting
* reserve balances
* token minting / redemption
* oracle price querying

---

# 4. Dependencies

`Governance` depends on:

## `StewardRegistry`

For:

* checking whether an address is an active steward
* reading current steward weights at proposal creation
* reading total active steward weight at proposal creation

## `CharityRegistry`

For:

* bootstrap threshold checks if needed for charity-add proposal validation
* executing charity changes

## `PoolRegistry`

For:

* executing pool and merchant governance actions

## `ReserveRegistry`

For:

* executing reserve asset add/remove/pause/unpause and oracle-config actions

## `TreasuryController`

For:

* executing CAD peg changes
* executing redemption rate changes
* executing charity mint uplift changes
* executing finalized controller pointer/admin changes

## `LiquidityRouter`

For:

* executing finalized router pointer updates
* executing charity top-up policy updates
* executing pool scoring-weight updates

## `TCOINToken`

For:

* executing expiry-period updates on the finalized token surface

---

# Current Ownership Model

The finalized governance/admin posture is:

* `Governance` should become the `owner` of `TreasuryController`
* `Governance` should become the configured `governance` address of `TreasuryController`
* `Governance` should become the `owner` of `LiquidityRouter`
* `Governance` should become the configured `governance` address of `LiquidityRouter`
* if token admin proposal paths remain active, `Governance` should also own the token contract

This is necessary because proposal execution now targets a mix of:

* `onlyOwner`
* `onlyGovernance`
* `onlyGovernanceOrOwner`

surfaces on the finalized controller/router stack.

---

# 5. Proposal Types

Use a clear enum.

```solidity
enum ProposalType {
    CharityAdd,
    CharityRemove,
    CharitySuspend,
    CharityUnsuspend,
    SetDefaultCharity,
    PoolAdd,
    PoolRemove,
    PoolSuspend,
    PoolUnsuspend,
    MerchantApprove,
    MerchantRemove,
    MerchantSuspend,
    MerchantUnsuspend,
    MerchantPoolReassign,
    ReserveAssetAdd,
    ReserveAssetRemove,
    ReserveAssetPause,
    ReserveAssetUnpause,
    ReserveOracleUpdate,
    CadPegUpdate,
    UserRedeemRateUpdate,
    MerchantRedeemRateUpdate,
    CharityMintRateUpdate,
    ExpirePeriodUpdate
}
```

This is explicit, auditable, and extensible enough for v1.

---

# 6. Proposal Status Model

Recommended enum:

```solidity
enum ProposalStatus {
    None,
    Pending,
    Approved,
    Rejected,
    Executed,
    Cancelled
}
```

Meaning:

* `Pending`: open for voting
* `Approved`: passed and executable
* `Rejected`: failed or expired without approval
* `Executed`: action applied
* `Cancelled`: governance/admin cancellation path

---

# 7. Proposed Data Model

## 7.1 Core proposal struct

Because proposal types are explicit, use a common proposal shell plus typed payload fields.

Recommended:

```solidity
struct Proposal {
    uint256 proposalId;
    ProposalType proposalType;
    ProposalStatus status;
    address proposer;
    uint64 createdAt;
    uint64 deadline;
    uint256 yesWeight;
    uint256 noWeight;
    uint256 totalSnapshotWeight;
    uint256 participationWeight;
}
```

This is the common state for every proposal.

---

## 7.2 Payload storage strategy

There are two reasonable approaches:

### Option A — one giant union-like struct

Works, but gets messy.

### Option B — one payload mapping per proposal family

Cleaner.

I recommend **Option B**.

Examples:

```solidity
struct CharityAddPayload {
    string name;
    address wallet;
    string metadataRecordId;
}
```

```solidity
struct CharityIdPayload {
    uint256 charityId;
}
```

```solidity
struct PoolAddPayload {
    bytes32 poolId;
    string name;
    string metadataRecordId;
}
```

```solidity
struct MerchantApprovePayload {
    address merchant;
    bytes32 poolId;
    string metadataRecordId;
}
```

```solidity
struct MerchantPoolReassignPayload {
    address merchant;
    bytes32 newPoolId;
}
```

```solidity
struct ReserveAssetAddPayload {
    bytes32 assetId;
    address token;
    string code;
    uint8 tokenDecimals;
    address primaryOracle;
    address fallbackOracle;
    uint256 staleAfter;
}
```

```solidity
struct ReserveOracleUpdatePayload {
    bytes32 assetId;
    address primaryOracle;
    address fallbackOracle;
    uint256 staleAfter;
}
```

```solidity
struct UIntPayload {
    uint256 value;
}
```

These can be stored in separate mappings:

```solidity
mapping(uint256 => CharityAddPayload) private charityAddPayloads;
mapping(uint256 => CharityIdPayload) private charityIdPayloads;
mapping(uint256 => PoolAddPayload) private poolAddPayloads;
mapping(uint256 => MerchantApprovePayload) private merchantApprovePayloads;
mapping(uint256 => MerchantPoolReassignPayload) private merchantPoolReassignPayloads;
mapping(uint256 => ReserveAssetAddPayload) private reserveAssetAddPayloads;
mapping(uint256 => ReserveOracleUpdatePayload) private reserveOracleUpdatePayloads;
mapping(uint256 => UIntPayload) private uintPayloads;
```

This keeps execution logic readable.

---

## 7.3 Snapshot state

Because vote-weight snapshotting is required, Governance must record steward weights at proposal creation.

Recommended mapping:

```solidity
mapping(uint256 => mapping(address => uint256)) private stewardSnapshotWeight;
```

And:

```solidity
mapping(uint256 => mapping(address => bool)) public hasVoted;
```

### Important note

This approach means proposal creation needs to snapshot steward weights for all active stewards.

That requires `StewardRegistry` to expose `listStewardAddresses()`.

This is acceptable for v1 while the number of stewards is still modest.

If scale grows later, snapshot compression or Merkle-style patterns can be considered.

---

# 8. Recommended State

## Core pointers

```solidity
address public stewardRegistry;
address public charityRegistry;
address public poolRegistry;
address public reserveRegistry;
address public treasuryController;
address public tcoinToken;
```

## Proposal counters

```solidity
uint256 public proposalCount;
```

## Proposal storage

```solidity
mapping(uint256 => Proposal) private proposals;
```

## Snapshot / vote state

```solidity
mapping(uint256 => mapping(address => uint256)) private stewardSnapshotWeight;
mapping(uint256 => mapping(address => bool)) public hasVoted;
```

## Optional governance-wide settings

```solidity
uint64 public defaultVotingWindow;
```

This is useful and recommended.

---

# 9. Access Model

Recommended modifiers:

```solidity
modifier onlySteward()
modifier onlyOwnerOrGovernanceAdmin()
modifier onlyPendingProposal(uint256 proposalId)
```

## `onlySteward`

Checks against `StewardRegistry.isSteward(msg.sender)`.

This means only currently active stewards may create proposals or vote.

Even though vote weights are snapshotted, proposal creation and vote submission should still require the caller to be an active steward at the time of action.

That is the cleanest rule.

---

# 10. Recommended Errors

```solidity
error ZeroAddressOwner();
error ZeroAddressRegistry();
error ZeroAddressTarget();
error NotSteward(address caller);
error UnknownProposal(uint256 proposalId);
error ProposalNotPending(uint256 proposalId);
error ProposalNotApproved(uint256 proposalId);
error ProposalExpired(uint256 proposalId);
error ProposalAlreadyVoted(uint256 proposalId, address steward);
error InvalidVotingWindow();
error InvalidProposalValue();
error InvalidPegChange(uint256 oldPeg, uint256 newPeg);
error Unauthorized();
```

---

# 11. Proposal Creation Methods

Each method should:

1. require caller is active steward
2. validate payload
3. create proposal shell
4. snapshot steward weights
5. store payload
6. emit `ProposalCreated`

---

## 11.1 Charity add

```solidity
function proposeCharityAdd(
    string calldata name,
    address wallet,
    string calldata metadataRecordId,
    uint64 votingWindow
) external onlySteward returns (uint256 proposalId)
```

### Notes

* validate non-empty name
* validate nonzero wallet
* votingWindow > 0 or use default

---

## 11.2 Charity remove / suspend / unsuspend

```solidity
function proposeCharityRemove(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256)
function proposeCharitySuspend(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256)
function proposeCharityUnsuspend(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256)
```

---

## 11.3 Set default charity

```solidity
function proposeSetDefaultCharity(uint256 charityId, uint64 votingWindow) external onlySteward returns (uint256)
```

---

## 11.4 Pool add/remove/suspend/unsuspend

```solidity
function proposePoolAdd(bytes32 poolId, string calldata name, string calldata metadataRecordId, uint64 votingWindow) external onlySteward returns (uint256)
function proposePoolRemove(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256)
function proposePoolSuspend(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256)
function proposePoolUnsuspend(bytes32 poolId, uint64 votingWindow) external onlySteward returns (uint256)
```

---

## 11.5 Merchant approval actions

```solidity
function proposeMerchantApprove(address merchant, bytes32 poolId, string calldata metadataRecordId, uint64 votingWindow) external onlySteward returns (uint256)
function proposeMerchantRemove(address merchant, uint64 votingWindow) external onlySteward returns (uint256)
function proposeMerchantSuspend(address merchant, uint64 votingWindow) external onlySteward returns (uint256)
function proposeMerchantUnsuspend(address merchant, uint64 votingWindow) external onlySteward returns (uint256)
function proposeMerchantPoolReassign(address merchant, bytes32 newPoolId, uint64 votingWindow) external onlySteward returns (uint256)
```

---

## 11.6 Reserve asset actions

```solidity
function proposeReserveAssetAdd(
    bytes32 assetId,
    address token,
    string calldata code,
    uint8 tokenDecimals,
    address primaryOracle,
    address fallbackOracle,
    uint256 staleAfter,
    uint64 votingWindow
) external onlySteward returns (uint256)
```

```solidity
function proposeReserveAssetRemove(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256)
function proposeReserveAssetPause(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256)
function proposeReserveAssetUnpause(bytes32 assetId, uint64 votingWindow) external onlySteward returns (uint256)
```

---

## 11.7 Reserve oracle update

```solidity
function proposeReserveOracleUpdate(
    bytes32 assetId,
    address primaryOracle,
    address fallbackOracle,
    uint256 staleAfter,
    uint64 votingWindow
) external onlySteward returns (uint256)
```

---

## 11.8 Parameter updates

```solidity
function proposeCadPegUpdate(uint256 newCadPeg18, uint64 votingWindow) external onlySteward returns (uint256)
function proposeUserRedeemRateUpdate(uint256 newRateBps, uint64 votingWindow) external onlySteward returns (uint256)
function proposeMerchantRedeemRateUpdate(uint256 newRateBps, uint64 votingWindow) external onlySteward returns (uint256)
function proposeCharityMintRateUpdate(uint256 newRateBps, uint64 votingWindow) external onlySteward returns (uint256)
function proposeExpirePeriodUpdate(uint256 newExpirePeriod, uint64 votingWindow) external onlySteward returns (uint256)
```

### Special rule for CAD peg

The new peg may not differ from current peg by more than 10%.

This should be validated at proposal creation and again at execution for defense in depth.

---

# 12. Snapshot Logic

At proposal creation:

1. read `listStewardAddresses()` from `StewardRegistry`
2. for each steward:

   * read `getStewardWeight(steward)`
   * if weight > 0, store in `stewardSnapshotWeight[proposalId][steward]`
   * accumulate into `totalSnapshotWeight`
3. store `totalSnapshotWeight` in proposal

This snapshot is then used permanently for that proposal.

### Important rule

Later steward assignment changes do not modify snapshot data.

That is how the “future proposals only” rule is enforced.

---

# 13. Voting

## 13.1 Vote proposal

```solidity
function voteProposal(uint256 proposalId, bool support) external onlySteward
```

### Behavior

1. proposal must exist and be `Pending`
2. proposal must not be expired
3. caller must not already have voted
4. read `weight = stewardSnapshotWeight[proposalId][msg.sender]`
5. require `weight > 0`
6. mark `hasVoted[proposalId][msg.sender] = true`
7. add `weight` to `yesWeight` or `noWeight`
8. increase `participationWeight` by `weight`
9. emit `ProposalVoted`
10. optionally auto-mark approved if conditions are already met

### Why require snapshot weight > 0?

This ensures only stewards who had weight at proposal creation influence that proposal.

A newly appointed steward after proposal creation may be active today, but should have zero influence on old proposals.

---

# 14. Approval, Expiry, and Rejection

## Recommended rule

A proposal is approved if:

```text
yesWeight > noWeight
and participationWeight >= 1
```

This is effectively simple majority of participating snapshot weight.

If you later want stricter quorum, this rule can be upgraded.

## Expiry

When the deadline passes:

* if not already approved/executed/cancelled, mark as `Rejected`

Recommended helper:

```solidity
function refreshProposalStatus(uint256 proposalId) public
```

This should:

* if pending and expired, set rejected and emit event

---

# 15. Permissionless Execution

## Execute proposal

```solidity
function executeProposal(uint256 proposalId) external
```

### Rules

* proposal must exist
* proposal must be `Approved`
* proposal must not already be `Executed`
* execution is open to anyone

### Behavior

Dispatch by proposal type to the appropriate governed contract.

Examples:

### Charity actions

* `CharityRegistry.addCharity(...)`
* `CharityRegistry.removeCharity(...)`
* `CharityRegistry.suspendCharity(...)`
* `CharityRegistry.unsuspendCharity(...)`
* `CharityRegistry.setDefaultCharity(...)`

### Pool actions

* `PoolRegistry.addPool(...)`
* `PoolRegistry.removePool(...)`
* `PoolRegistry.suspendPool(...)`
* `PoolRegistry.unsuspendPool(...)`
* `PoolRegistry.approveMerchant(...)`
* `PoolRegistry.removeMerchant(...)`
* `PoolRegistry.suspendMerchant(...)`
* `PoolRegistry.unsuspendMerchant(...)`
* `PoolRegistry.reassignMerchantPool(...)`

### Reserve asset actions

* `ReserveRegistry.addReserveAsset(...)`
* `ReserveRegistry.removeReserveAsset(...)`
* `ReserveRegistry.pauseReserveAsset(...)`
* `ReserveRegistry.unpauseReserveAsset(...)`
* `ReserveRegistry.updateReserveAssetOracles(...)`
* `ReserveRegistry.updateReserveAssetStaleness(...)`

### Parameter actions

* `TreasuryController.setCadPeg(...)`
* `TreasuryController.setUserRedeemRate(...)`
* `TreasuryController.setMerchantRedeemRate(...)`
* `TreasuryController.setCharityMintRate(...)`
* `TCOINToken.updateDemurrageRate(...)`

### After successful dispatch

* set status = `Executed`
* emit `ProposalExecuted`

---

# 16. Cancellation

## Optional cancellation path

Recommended:

```solidity
function cancelProposal(uint256 proposalId) external onlyOwnerOrGovernanceAdmin
```

This should be reserved for:

* malformed proposal
* emergency intervention
* protocol halt scenario

Use sparingly.

---

# 17. View Methods

Recommended public views:

```solidity
function getProposal(uint256 proposalId) external view returns (Proposal memory)
```

```solidity
function getSnapshotWeight(uint256 proposalId, address steward) external view returns (uint256)
```

```solidity
function getProposalCount() external view returns (uint256)
```

```solidity
function listProposalIds(uint256 cursor, uint256 size) external view returns (uint256[] memory ids, uint256 nextCursor)
```

Optional filtered listings by status / type can be done off-chain by indexer rather than on-chain to keep the contract smaller.

---

# 18. Recommended Events

These events are critical for indexers and governance UX.

```solidity
event StewardRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
```

```solidity
event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
```

```solidity
event PoolRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
```

```solidity
event ReserveRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
```

```solidity
event TreasuryControllerUpdated(address indexed oldController, address indexed newController);
```

```solidity
event TcoinTokenUpdated(address indexed oldToken, address indexed newToken);
```

```solidity
event ProposalCreated(
    uint256 indexed proposalId,
    ProposalType indexed proposalType,
    address indexed proposer,
    uint64 deadline,
    uint256 totalSnapshotWeight
);
```

```solidity
event ProposalVoted(
    uint256 indexed proposalId,
    address indexed steward,
    bool support,
    uint256 weight,
    uint256 yesWeight,
    uint256 noWeight
);
```

```solidity
event ProposalApproved(uint256 indexed proposalId);
```

```solidity
event ProposalRejected(uint256 indexed proposalId);
```

```solidity
event ProposalExecuted(uint256 indexed proposalId, address indexed actor);
```

```solidity
event ProposalCancelled(uint256 indexed proposalId, address indexed actor);
```

---

# 19. Invariants

These should always hold:

1. Proposal snapshot weights never change after proposal creation.
2. A steward may vote at most once per proposal.
3. Only stewards with positive snapshot weight for that proposal may influence it.
4. Approved proposals may be executed by anyone.
5. Executed proposals cannot be executed again.
6. Expired pending proposals eventually become rejected.
7. CAD peg proposals may not exceed the ±10% change rule.

---

# 20. Security Considerations

## 20.1 Snapshot correctness

This is the most important governance-specific requirement.

If snapshotting is wrong, governance can be manipulated by rapid steward reassignment.

## 20.2 Proposal replay

Execution must mark status before or atomically with completion so proposals cannot be replayed.

## 20.3 External call ordering

Execution dispatches into other contracts. This needs careful state ordering and reentrancy awareness.

Recommended:

* use `nonReentrant` if needed
* set executed state only once action succeeds
* do not leave partial execution paths

## 20.4 Parameter bounds

Some proposals need hard bounds:

* CAD peg update ±10%
* rates <= 10000 bps
* demurrage rate within safe token-defined range

## 20.5 Contract size

Because Governance touches many proposal types, avoid bloating with unnecessary list/filter functions or giant generic payloads.

Use compact payload mappings and off-chain indexing for rich UX.

---

# 21. Suggested External Surface

## Admin

* `initialize(...)`
* pointer setters for governed modules
* optional `cancelProposal(uint256 proposalId)`

## Proposal creation

* `proposeCharityAdd(...)`
* `proposeCharityRemove(...)`
* `proposeCharitySuspend(...)`
* `proposeCharityUnsuspend(...)`
* `proposeSetDefaultCharity(...)`
* `proposePoolAdd(...)`
* `proposePoolRemove(...)`
* `proposePoolSuspend(...)`
* `proposePoolUnsuspend(...)`
* `proposeMerchantApprove(...)`
* `proposeMerchantRemove(...)`
* `proposeMerchantSuspend(...)`
* `proposeMerchantUnsuspend(...)`
* `proposeMerchantPoolReassign(...)`
* `proposeReserveAssetAdd(...)`
* `proposeReserveAssetRemove(...)`
* `proposeReserveAssetPause(...)`
* `proposeReserveAssetUnpause(...)`
* `proposeReserveOracleUpdate(...)`
* `proposeCadPegUpdate(...)`
* `proposeUserRedeemRateUpdate(...)`
* `proposeMerchantRedeemRateUpdate(...)`
* `proposeCharityMintRateUpdate(...)`
* `proposeExpirePeriodUpdate(...)`

## Voting and execution

* `voteProposal(uint256 proposalId, bool support)`
* `executeProposal(uint256 proposalId)`
* `refreshProposalStatus(uint256 proposalId)`

## Views

* `getProposal(uint256 proposalId)`
* `getSnapshotWeight(uint256 proposalId, address steward)`
* `getProposalCount()`
* `listProposalIds(...)`

---

# 22. What Governance Should Not Do

To keep the contract manageable, do **not** add these here:

* reserve balance accounting
* direct token minting or burning
* oracle feed reading
* charity appointment logic
* steward weight calculation logic
* merchant allowance logic

Those belong in their dedicated modules.

---

# 23. Summary

`Governance` should be the single purpose-built contract that turns charity-rooted steward representation into protocol decisions.

It should:

* let active stewards create proposals
* snapshot vote weights at proposal creation
* accept weighted yes/no votes
* approve or reject proposals by simple weighted majority
* allow anyone to execute approved proposals
* dispatch execution into the appropriate governed modules

It should not become a monolithic orchestrator.

That separation is what keeps the TCOIN governance system safe, modular, and understandable.
