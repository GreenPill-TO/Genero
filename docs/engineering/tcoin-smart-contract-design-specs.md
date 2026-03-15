# TCOIN Contract Design Spec v1

## Purpose

This document translates the revised TCOIN PRD (Genero/docs/engineering/tcoin-smart-contract-prd.md) and Architecture (Genero/docs/engineering/tcoin-smart-contract-architecture.md) into a contract-by-contract design spec.

The goals are:

* keep contracts purpose-built and small enough to avoid size-limit pressure
* separate registry, governance, pricing, token logic, and treasury logic
* preserve clean interfaces for future upgrades
* ensure off-chain indexers can reconstruct all relevant state from events

This is not yet a Solidity implementation. It is the design boundary document that should guide implementation.

---

# 1. System Contract Map

## Core contracts

1. `TCOINToken`
2. `ReserveRegistry`
3. `CharityRegistry`
4. `StewardRegistry`
5. `PoolRegistry`
6. `OracleRouter`
7. `TreasuryController`
8. `Governance`

## Shared principles

* All major contracts should be upgradeable.
* Upgrade admin should be a multisig.
* Narrow explicit external methods are preferred over generic proposal payloads.
* Every state-changing action that matters operationally must emit structured events.
* Off-chain indexers should reconstruct complete state from events plus view calls.

---

# 2. TCOINToken

## Role

The TCOIN token contract is responsible only for:

* balances
* minting and burning
* demurrage mechanics
* routing demurrage value to protocol treasury
* token pause/unpause

It must not contain governance logic, reserve asset logic, charity logic, or redemption logic.

## Design intent

This contract should be based on the Sarafu `DemurrageTokenSingleNocap` model, but cleaned up and adapted for TCOIN’s architecture.

## State

### Core token state

* name
* symbol
* decimals
* total minted
* total burned
* base supply state required by the demurrage model
* demurrage parameters
* demurrage accumulator / timestamp cache

### Access control state

* controller address or role
* treasury address
* pause state

### Optional lifecycle state

* if expiry is retained from Sarafu, decide whether it is actually needed; default recommendation is to omit expiry in v1 unless it is a hard business requirement

## External methods

### Administrative

* `setController(address controller)`
* `setTreasury(address treasury)`
* `updateDemurrageRate(uint256 newRate)`
* `pause()`
* `unpause()`

### Token control

* `mint(address to, uint256 amount)`
* `burnFrom(address from, uint256 amount)`

### Views

* `getDemurrageRate()`
* `totalMinted()`
* `totalBurned()`
* any additional Sarafu-compatible balance and supply views needed for integrations

## Access rules

* only controller may mint
* only controller may burn from arbitrary accounts
* only governance-controlled admin path may update demurrage rate
* emergency pause should be owner/admin controlled

## Key events

* `ControllerUpdated(address oldController, address newController)`
* `TreasuryUpdated(address oldTreasury, address newTreasury)`
* `DemurrageRateUpdated(uint256 oldRate, uint256 newRate)`
* `DemurrageCaptured(uint256 amount, uint256 timestamp)`
* standard ERC20 `Transfer`
* pause/unpause events

## Notes

* Demurrage should apply only to TCOIN.
* Reserve assets must not inherit demurrage.
* Merchant vouchers should have zero demurrage directly and rely on their peg to TCOIN economically.

---

# 3. ReserveRegistry

## Role

The reserve registry is the source of truth for which assets may back TCOIN.

It should only store reserve asset metadata and state flags.

## State

Per reserve asset:

* `assetId` (recommended: bytes32 code)
* token address
* display code / symbol if needed
* token decimals
* primary oracle address or identifier
* fallback oracle address or identifier
* enabled flag
* paused flag
* staleness window

Supporting indexes:

* `assetId => ReserveAsset`
* `tokenAddress => assetId`
* list of assetIds

## External methods

### Admin/governance methods

* `addReserveAsset(bytes32 assetId, address token, uint8 decimals, address primaryOracle, address fallbackOracle, uint256 staleAfter)`
* `removeReserveAsset(bytes32 assetId)`
* `pauseReserveAsset(bytes32 assetId)`
* `unpauseReserveAsset(bytes32 assetId)`
* `updateReserveAssetOracles(bytes32 assetId, address primaryOracle, address fallbackOracle)`
* `updateReserveAssetStaleness(bytes32 assetId, uint256 staleAfter)`

### Views

* `getReserveAsset(bytes32 assetId)`
* `getReserveAssetByToken(address token)`
* `isReserveAssetEnabled(bytes32 assetId)`
* `isReserveAssetActive(bytes32 assetId)`
* `listReserveAssetIds()`

## Access rules

* add/remove/pause/unpause/update should be governance or emergency admin controlled
* pure view methods open to all

## Key events

* `ReserveAssetAdded(bytes32 indexed assetId, address indexed token, uint8 decimals)`
* `ReserveAssetRemoved(bytes32 indexed assetId)`
* `ReserveAssetPaused(bytes32 indexed assetId, address indexed actor)`
* `ReserveAssetUnpaused(bytes32 indexed assetId, address indexed actor)`
* `ReserveAssetOracleUpdated(bytes32 indexed assetId, address indexed primaryOracle, address indexed fallbackOracle)`
* `ReserveAssetStalenessUpdated(bytes32 indexed assetId, uint256 staleAfter)`

## Notes

* This contract should not hold balances.
* It should not perform price lookups itself.
* It should not decide redemption rates.

---

# 4. CharityRegistry

## Role

The charity registry is the source of truth for active, suspended, and removed charities, plus default charity handling.

It should also be the root record of which charity currently appoints which steward.

## State

Per charity:

* charityId
* name
* wallet
* metadata record id / URI
* status enum: `Pending`, `Active`, `Suspended`, `Removed`
* current steward address
* createdAt / updatedAt if useful

Global state:

* default charity id (UBI)
* active charity count

Indexes:

* `charityId => Charity`
* `wallet => charityId`
* list of charityIds if needed

## External methods

### Admin/bootstrap

* `bootstrapAddCharity(...)`

### Governance paths

* `addCharity(...)`
* `removeCharity(uint256 charityId)`
* `suspendCharity(uint256 charityId)`
* `unsuspendCharity(uint256 charityId)`
* `setDefaultCharity(uint256 charityId)`

### Charity self-service

* `appointSteward(address steward)` or `appointSteward(uint256 charityId, address steward)`

### Views

* `getCharity(uint256 charityId)`
* `getCharityByWallet(address wallet)`
* `isActiveCharity(address wallet)`
* `getAssignedSteward(uint256 charityId)`
* `getDefaultCharityId()`
* `getActiveCharityCount()`

## Access rules

* multisig owner may add charities only while active charity count < 7
* once active charity count >= 7, new charity admission/removal/suspension should be governance-driven
* a charity wallet may reassign its steward for its own charity

## Recommended steward reassignment rule

### v1 recommendation

* reassignment allowed at any time by active charity wallet
* emits event immediately

### optional safety improvement

* one reassignment per charity every 24 hours

If governance weight snapshotting is implemented at proposal creation, immediate reassignment is acceptable.

## Key events

* `CharityAdded(uint256 indexed charityId, string name, address indexed wallet)`
* `CharityRemoved(uint256 indexed charityId, address indexed actor)`
* `CharitySuspended(uint256 indexed charityId, address indexed actor)`
* `CharityUnsuspended(uint256 indexed charityId, address indexed actor)`
* `DefaultCharitySet(uint256 indexed charityId)`
* `CharityStewardChanged(uint256 indexed charityId, address indexed oldSteward, address indexed newSteward)`

## Notes

* The registry should not calculate steward weights itself.
* It should emit enough events for indexers to reconstruct historical assignments.

---

# 5. StewardRegistry

## Role

The steward registry tracks the steward set and calculates steward vote weights from charity appointments.

This should be the single source of truth for weighted voting power.

## State

Per steward:

* steward address
* display name / metadata record id
* active/suspended flag
* current charity appointment count

Indexes:

* `stewardAddress => StewardRecord`
* `charityId => stewardAddress` (if not held in CharityRegistry, but recommended to mirror or read from CharityRegistry)
* total active steward weight

## External methods

### Admin or governance

* `registerSteward(address steward, string calldata name, string calldata metadata)`
* `suspendSteward(address steward)`
* `unsuspendSteward(address steward)`
* `removeSteward(address steward)`

### Assignment sync

* `syncCharityAppointment(uint256 charityId, address oldSteward, address newSteward)`

### Views

* `isSteward(address steward)`
* `getSteward(address steward)`
* `getStewardWeight(address steward)`
* `getTotalStewardWeight()`
* `getCharityAssignedSteward(uint256 charityId)`

## Access rules

* steward registration/removal/suspension should be governance or admin controlled
* appointment sync should be callable only by CharityRegistry or trusted controller path

## Key events

* `StewardRegistered(address indexed steward, string name)`
* `StewardSuspended(address indexed steward, address indexed actor)`
* `StewardUnsuspended(address indexed steward, address indexed actor)`
* `StewardRemoved(address indexed steward, address indexed actor)`
* `StewardWeightChanged(address indexed steward, uint256 oldWeight, uint256 newWeight)`

## Notes

* Governance should always query steward weights from here rather than maintaining duplicate vote-weight state.

---

# 6. PoolRegistry

## Role

The pool registry tracks approved pools and approved merchants. It determines who is eligible for merchant redemption treatment.

## State

Per pool:

* poolId
* name/code
* metadata record id
* status enum: `Active`, `Suspended`, `Removed`

Per merchant:

* merchant wallet
* poolId
* status enum: `Approved`, `Suspended`, `Removed`
* metadata record id if needed

Indexes:

* `poolId => Pool`
* `merchantWallet => Merchant`
* list of pool ids

## External methods

### Governance/admin

* `addPool(bytes32 poolId, string calldata name, string calldata metadata)`
* `removePool(bytes32 poolId)`
* `suspendPool(bytes32 poolId)`
* `unsuspendPool(bytes32 poolId)`
* `approveMerchant(address merchant, bytes32 poolId, string calldata metadata)`
* `removeMerchant(address merchant)`
* `suspendMerchant(address merchant)`
* `unsuspendMerchant(address merchant)`

### Views

* `getPool(bytes32 poolId)`
* `getMerchant(address merchant)`
* `isPoolActive(bytes32 poolId)`
* `isMerchantApproved(address merchant)`
* `isMerchantApprovedInActivePool(address merchant)`
* `getMerchantPool(address merchant)`

## Access rules

* governance/admin for all mutations
* open views for all

## Key events

* `PoolAdded(bytes32 indexed poolId, string name)`
* `PoolRemoved(bytes32 indexed poolId, address indexed actor)`
* `PoolSuspended(bytes32 indexed poolId, address indexed actor)`
* `PoolUnsuspended(bytes32 indexed poolId, address indexed actor)`
* `MerchantApproved(address indexed merchant, bytes32 indexed poolId)`
* `MerchantRemoved(address indexed merchant, address indexed actor)`
* `MerchantSuspended(address indexed merchant, address indexed actor)`
* `MerchantUnsuspended(address indexed merchant, address indexed actor)`

## Notes

* Merchant redemption allowance values should not live here.
* This contract only determines merchant eligibility class.

---

# 7. OracleRouter

## Role

The oracle router provides CAD prices for reserve assets.

It should centralize:

* primary oracle lookup
* fallback oracle lookup
* staleness validation
* normalized price output

## State

Per reserve asset:

* primary oracle
* fallback oracle
* staleness threshold
* optional last known good price cache

## External methods

### Views / reads

* `getCadPrice(bytes32 assetId) returns (uint256 price, uint256 updatedAt, bool usedFallback)`
* `isPriceFresh(bytes32 assetId) returns (bool)`
* `previewCadValue(bytes32 assetId, uint256 assetAmount) returns (uint256 cadValue)`

### Governance/admin

* `setPrimaryOracle(bytes32 assetId, address oracle)`
* `setFallbackOracle(bytes32 assetId, address oracle)`
* `setStalenessWindow(bytes32 assetId, uint256 staleAfter)`

## Access rules

* read methods open
* configuration methods governance/admin controlled

## Key events

* `PrimaryOracleUpdated(bytes32 indexed assetId, address indexed oracle)`
* `FallbackOracleUpdated(bytes32 indexed assetId, address indexed oracle)`
* `StalenessWindowUpdated(bytes32 indexed assetId, uint256 staleAfter)`
* optional `FallbackOracleUsed(bytes32 indexed assetId, address indexed oracle, uint256 price)`

## Notes

* Querying an oracle “infrequently” should mostly be an off-chain operational concern, but on-chain logic should still enforce freshness.
* Price normalization should account for reserve asset decimals and oracle decimals.
* If both oracles fail or price is stale, TreasuryController should reject mint/redeem for that asset.

---

# 8. TreasuryController

## Role

This is the economic engine of the system.

It should handle:

* receiving reserve deposits
* minting TCOIN at par value
* minting charity uplift on deposit
* burning TCOIN on redemption
* transferring reserve assets on redemption
* applying different redemption rates by actor type
* enforcing merchant redemption allowance limits
* emergency pause controls for mint/redeem

## State

### Asset/accounting state

* optional internal accounting per reserve asset deposited and redeemed
* reserve balances may be derived from actual ERC20 balances, but evented accounting is still useful

### Parameter state

* CAD/TCOIN peg
* user redemption rate
* merchant redemption rate
* charity mint rate on deposit
* optional min redemption amount
* pause flags for mint and redemption

### Merchant allowance state

* `merchant => remainingRedemptionAllowance`

## External methods

### Minting

* `depositAndMint(bytes32 assetId, uint256 assetAmount, uint256 charityId, uint256 minTcoinOut)`
* `previewMint(bytes32 assetId, uint256 assetAmount, uint256 charityId)`

### Redemption

* `redeemAsUser(bytes32 assetId, uint256 tcoinAmount, uint256 minAssetOut)`
* `redeemAsMerchant(bytes32 assetId, uint256 tcoinAmount, uint256 minAssetOut)`
* `previewRedeemAsUser(bytes32 assetId, uint256 tcoinAmount)`
* `previewRedeemAsMerchant(bytes32 assetId, uint256 tcoinAmount)`

### Merchant allowance management

* `setMerchantRedemptionAllowance(address merchant, uint256 amount)`
* `increaseMerchantRedemptionAllowance(address merchant, uint256 amount)`
* `decreaseMerchantRedemptionAllowance(address merchant, uint256 amount)`
* `getMerchantRedemptionAllowance(address merchant)`

### Parameter management

* `setCadPeg(uint256 newPeg)`
* `setUserRedeemRate(uint256 newRate)`
* `setMerchantRedeemRate(uint256 newRate)`
* `setCharityMintRate(uint256 newRate)`

### Emergency / admin

* `pauseMinting()`
* `unpauseMinting()`
* `pauseRedemption()`
* `unpauseRedemption()`
* `pauseAssetForTreasury(bytes32 assetId)`
* `unpauseAssetForTreasury(bytes32 assetId)`

## Minting rules

* asset must be approved and active
* oracle price must be fresh
* reserve asset transferred into treasury/controller
* CAD value computed via oracle
* TCOIN minted at par using CAD→TCOIN peg
* charity uplift minted to selected charity or default charity, based on configured charity mint rate

## Redemption rules

### User redemption

* caller burns TCOIN
* receives reserve asset at user redemption rate
* first come, first serve subject to available reserve balance

### Merchant redemption

* merchant must be approved in active pool
* merchant allowance must be sufficient
* allowance decremented by redeemed TCOIN amount or CAD-equivalent amount depending on final design; recommendation: consume allowance in TCOIN value units for consistency
* reserve asset transferred at merchant redemption rate

## Access rules

* deposit/redeem methods open to permitted caller classes
* merchant allowance updates should be admin/indexer controlled
* parameter updates governance/admin controlled

## Key events

* `ReserveDeposited(address indexed depositor, bytes32 indexed assetId, uint256 assetAmount, uint256 cadValue, uint256 tcoinMinted, uint256 charityMinted, uint256 charityId)`
* `RedeemedAsUser(address indexed user, bytes32 indexed assetId, uint256 tcoinBurned, uint256 assetOut)`
* `RedeemedAsMerchant(address indexed merchant, bytes32 indexed assetId, uint256 tcoinBurned, uint256 assetOut, uint256 allowanceRemaining)`
* `MerchantAllowanceUpdated(address indexed merchant, uint256 oldAmount, uint256 newAmount)`
* `CadPegUpdated(uint256 oldPeg, uint256 newPeg)`
* `UserRedeemRateUpdated(uint256 oldRate, uint256 newRate)`
* `MerchantRedeemRateUpdated(uint256 oldRate, uint256 newRate)`
* `CharityMintRateUpdated(uint256 oldRate, uint256 newRate)`
* pause/unpause events

## Notes

* This should be the only contract that actually moves reserve assets in and out.
* This should also be the only contract allowed to mint/burn TCOIN.

---

# 9. Governance

## Role

The governance contract manages proposals, weighted votes, quorum, and execution.

It should not hold reserve assets or token balances.

## Proposal model

Use narrow explicit proposal-creation methods rather than generic free-form payloads.

## Proposal types in v1

* charity add
* charity remove
* charity suspend
* charity unsuspend
* pool add
* pool remove
* pool suspend
* pool unsuspend
* reserve asset add
* reserve asset remove
* reserve asset pause
* reserve asset unpause
* reserve oracle update
* CAD peg update
* user redeem rate update
* merchant redeem rate update
* charity mint rate update
* demurrage rate update

## State

Per proposal:

* proposalId
* proposalType
* createdAt
* deadline
* proposer
* status enum: `Pending`, `Approved`, `Rejected`, `Executed`, `Cancelled`
* typed parameters for the relevant action
* yes weighted votes
* no weighted votes
* snapshot total voting weight, if snapshotting is implemented

Voting state:

* `proposalId => steward => voted`
* optional `proposalId => steward => weightAtVote`

## External methods

### Proposal creation

* `proposeCharityAdd(...)`
* `proposeCharityRemove(uint256 charityId)`
* `proposeCharitySuspend(uint256 charityId)`
* `proposeCharityUnsuspend(uint256 charityId)`
* `proposePoolAdd(...)`
* `proposePoolRemove(bytes32 poolId)`
* `proposePoolSuspend(bytes32 poolId)`
* `proposePoolUnsuspend(bytes32 poolId)`
* `proposeReserveAssetAdd(...)`
* `proposeReserveAssetRemove(bytes32 assetId)`
* `proposeReserveAssetPause(bytes32 assetId)`
* `proposeReserveAssetUnpause(bytes32 assetId)`
* `proposeReserveOracleUpdate(bytes32 assetId, address primary, address fallback, uint256 staleness)`
* `proposeCadPegUpdate(uint256 newPeg)`
* `proposeUserRedeemRateUpdate(uint256 newRate)`
* `proposeMerchantRedeemRateUpdate(uint256 newRate)`
* `proposeCharityMintRateUpdate(uint256 newRate)`
* `proposeDemurrageRateUpdate(uint256 newRate)`

### Voting and execution

* `voteProposal(uint256 proposalId, bool support)`
* `executeProposal(uint256 proposalId)`
* `cancelProposal(uint256 proposalId)`
* `getProposal(uint256 proposalId)`

## Governance rules

### Voting power

* steward vote weight = number of active charities appointing that steward

### Quorum / passing rule

* proposal passes by simple majority of weighted votes
* exact quorum math should be made explicit in implementation; recommended approach:

  * proposal is approved if yesWeight > noWeight and yesWeight >= minimumParticipationThreshold
  * if you truly want simple majority only, document whether proposals with very low participation can still pass

### Bootstrap rule

* owner can admit charities directly only while active charity count < 7
* after active charity count >= 7, charity admission/removal should be governance driven

### Peg update guardrail

* CAD peg updates may not exceed ±10% from current peg in one proposal

## Access rules

* stewards create and vote on proposals
* owner/multisig may retain emergency cancellation/execution rights if desired, but this should be explicitly limited and documented

## Key events

* `ProposalCreated(uint256 indexed proposalId, uint8 indexed proposalType, address indexed proposer, uint64 deadline)`
* `ProposalVoted(uint256 indexed proposalId, address indexed steward, bool support, uint256 weight)`
* `ProposalApproved(uint256 indexed proposalId)`
* `ProposalRejected(uint256 indexed proposalId)`
* `ProposalExecuted(uint256 indexed proposalId, address indexed actor)`
* `ProposalCancelled(uint256 indexed proposalId, address indexed actor)`

## Notes

* Governance should read steward weights from StewardRegistry, not maintain them independently.
* Consider vote-weight snapshotting at proposal creation to avoid governance manipulation via rapid steward reassignment.

---

# 10. Cross-Contract Access Matrix

## TCOINToken

* callable by TreasuryController for mint/burn
* callable by governance/admin for demurrage parameter updates and pause

## ReserveRegistry

* callable by Governance or emergency admin
* readable by TreasuryController and OracleRouter

## CharityRegistry

* callable by Governance for membership changes
* callable by charity wallet for steward appointment
* readable by Governance, TreasuryController, StewardRegistry

## StewardRegistry

* callable by Governance/admin for steward registration changes
* callable by CharityRegistry or trusted controller to sync charity appointments
* readable by Governance

## PoolRegistry

* callable by Governance/admin
* readable by TreasuryController

## OracleRouter

* callable by Governance/admin for oracle configuration
* readable by TreasuryController

## TreasuryController

* callable by users/merchants for deposit/redeem
* callable by Governance/admin for parameter changes and pause controls
* callable by admin/indexer for merchant allowance updates

## Governance

* callable by stewards for proposals and votes
* callable by owner/admin for limited bootstrap or emergency paths if retained

---

# 11. Event Requirements for Indexing

The event set across contracts must be sufficient for Supabase/indexers to reconstruct:

* active charities and history
* active steward set and weight changes
* which charity appoints which steward
* active pools and merchants
* reserve asset set and oracle config
* parameter updates
* mint/redeem activity
* merchant redemption allowance changes
* governance proposal lifecycle

This means every mutating action in registries and TreasuryController must emit events with indexed identifiers.

---

# 12. Suggested Implementation Order

1. `ReserveRegistry`
2. `CharityRegistry`
3. `StewardRegistry`
4. `PoolRegistry`
5. `OracleRouter`
6. `TCOINToken`
7. `TreasuryController`
8. `Governance`

Reason:

* registries first establish clean interfaces
* token and pricing next
* TreasuryController then composes them
* Governance comes last once callable surfaces are stable

---

# 13. Open Questions to Resolve Before Solidity Implementation

1. Should governance use vote-weight snapshotting at proposal creation?- Answer: Yes

2. Should steward reassignment have a cooldown in v1? - Answer: No, immediate effect, but for future proposals only.

3. Should proposal execution be permissionless after approval, or restricted to governance/owner? - Answer: Permissionless, can be executed by anyone willing to pay the associated gas.

4. Should user and merchant redemption rates be stored as basis points, ppm, or another normalized precision? - Answer: As basis points.

5. Should merchant redemption allowance be consumed in TCOIN units or CAD-equivalent units? - Answer: In TCOIN units.

6. Should the charity mint uplift always go to the selected charity, or to selected charity with fallback to default UBI charity? - Answer: Always to the user's selected charity, if assigned, else to the default UBI charity.

7. Should TCOINToken include explicit treasury sink accounting, or should TreasuryController collect demurrage indirectly? - Answer: TreasuryController to collect demurrage indirectly.

---

# 14. Summary

This architecture replaces the monolithic orchestrator pattern with a modular system:

* `TCOINToken` handles token math
* registries handle membership/state
* `OracleRouter` handles valuation
* `TreasuryController` handles economics
* `Governance` handles steward-weighted decision making

That separation should produce a cleaner, safer, and more manageable implementation path for TCOIN v1.
