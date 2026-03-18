The following document is based on Genero/docs/engineering/tcoin-smart-contract-prd.md. The main rule here is:

**separate registry/state from pricing from mint/redeem from governance from token math.**

That keeps interfaces smaller, easier to audit, and less likely to hit size limits.

# Recommended contract architecture

Let's split this into **8 main contracts/interfaces** plus a few shared structs/interfaces.

1. `TCOINToken`
2. `ReserveRegistry`
3. `CharityRegistry`
4. `StewardRegistry`
5. `PoolRegistry`
6. `OracleRouter`
7. `TreasuryController`
8. `Governance`

And 8 accompanying shared interfaces:

* `ITCOINToken`
* `IReserveRegistry`
* `ICharityRegistry`
* `IStewardRegistry`
* `IPoolRegistry`
* `IOracleRouter`
* `ITreasuryController`
* `IGovernance`

---

# 1. `TCOINToken`

## Responsibility

Only the token itself.

This contract should do one thing well:

* implement TCOIN balances
* implement Sarafu-style demurrage
* allow mint/burn only by authorized controller
* route demurrage value to protocol treasury

## It should own

* token balances
* demurrage parameters
* treasury sink address
* minter/burner/controller role
* rebase/decay mechanics if needed by chosen design

## It should not own

* reserve asset registry
* pricing
* charities
* stewards
* pools
* redemption logic
* governance proposal state

## Key surface

```solidity
mint(address to, uint256 amount)
burnFrom(address from, uint256 amount)
setTreasury(address treasury)
setController(address controller)
updateDemurrageRate(...)
pause()
unpause()
```

## Boundary

This contract should trust only a designated controller for mint/burn admin flow.

---

# 2. `ReserveRegistry`

## Responsibility

Source of truth for approved reserve assets.

## It should own

Per reserve asset:

* token address
* symbol/code
* decimals
* primary oracle id/address
* fallback oracle id/address
* enabled/disabled state
* paused/unpaused state

## It should not own

* actual reserve balances
* mint/redeem logic
* exchange rates
* charity rules
* governance vote logic

## Key surface

```solidity
addReserveAsset(...)
removeReserveAsset(...)
pauseReserveAsset(bytes32 assetId)
unpauseReserveAsset(bytes32 assetId)
getReserveAsset(bytes32 assetId)
getReserveAssetByToken(address token)
isReserveAssetEnabled(bytes32 assetId)
listReserveAssets()
```

## Boundary

Pure registry plus control flags. No money movement.

---

# 3. `CharityRegistry`

## Responsibility

Source of truth for charities.

## It should own

Per charity:

* charityId
* name
* wallet
* metadata URI / record id
* status: pending / active / suspended / removed
* whether it is default charity / UBI charity
* appointed steward
* timestamps

## It should not own

* vote counts
* reserve logic
* token pricing
* redemption allowances

## Key surface

```solidity
addCharity(...)
activateCharity(...)
suspendCharity(...)
removeCharity(...)
setDefaultCharity(uint256 charityId)
appointSteward(uint256 charityId, address steward)
getCharity(uint256 charityId)
getCharityByWallet(address wallet)
isActiveCharity(address wallet)
getDefaultCharity()
```

## Boundary

This contract is about charity membership and appointment state only.

---

# 4. `StewardRegistry`

## Responsibility

Track stewards and compute weighted voting power from charity appointments.

## It should own

Per steward:

* steward address
* name / metadata
* active/inactive
* current weight

It should also maintain:

* charityId -> steward address
* steward address -> assigned charity count

## It should not own

* proposal storage
* reserve asset logic
* pricing
* mint/redeem logic

## Key surface

```solidity
registerSteward(address steward, string calldata name, string calldata metadata)
deactivateSteward(address steward)
assignCharityToSteward(uint256 charityId, address steward)
getStewardWeight(address steward)
isSteward(address steward)
getTotalStewardWeight()
getAssignedSteward(uint256 charityId)
```

## Boundary

This is the weighted-vote oracle for governance. It should be the only place where steward weight is computed.

---

# 5. `PoolRegistry`

## Responsibility

Track approved pools and approved merchants.

You said pools are needed to infer approved merchants. Good — keep that separate.

## It should own

Per pool:

* poolId
* name/code
* status active/suspended/removed
* metadata

Per merchant:

* merchant wallet
* associated poolId
* active/suspended
* optional metadata

## It should not own

* merchant redemption allowance values
* pricing
* mint/redeem logic
* charity governance

## Key surface

```solidity
addPool(...)
removePool(...)
suspendPool(...)
unsuspendPool(...)
approveMerchant(address merchant, bytes32 poolId)
removeMerchant(address merchant)
suspendMerchant(address merchant)
getPool(bytes32 poolId)
getMerchant(address merchant)
isMerchantApproved(address merchant)
isMerchantApprovedInActivePool(address merchant)
```

## Boundary

Only merchant/pool eligibility state.

---

# 6. `OracleRouter`

## Responsibility

Return CAD prices for approved reserve assets.

## It should own

Per asset:

* primary oracle
* fallback oracle
* staleness window
* last good price optional cache

## It should not own

* governance proposal state
* reserve registry membership
* treasury balances
* token minting

## Key surface

```solidity
getCadPrice(bytes32 assetId) returns (uint256 price, uint256 updatedAt)
isPriceFresh(bytes32 assetId) returns (bool)
setPrimaryOracle(bytes32 assetId, address oracle)
setFallbackOracle(bytes32 assetId, address oracle)
setStalenessWindow(bytes32 assetId, uint256 seconds)
```

## Boundary

No asset approval decisions here. It only answers pricing for assets the rest of the system already knows about.

---

# 7. `Treasury`

## Responsibility

This is the pure reserve vault.

## It should own

* reserve ERC20 balances held by protocol
* authorized-caller deposit/withdraw permissions

## It should not own

* pricing
* mint/redeem policy
* collateralization logic
* charity mint policy
* governance proposal state

---

# 8. `TreasuryController`

## Responsibility

This is the main economic engine.

This is where most of the operational complexity belongs.

## It should own

* mint against deposit
* redeem into reserve assets
* merchant vs user redemption rates
* merchant redemption allowances set by admin/indexer
* charity mint uplift during deposit minting
* pause state for mint/redeem flows
* surplus accounting hooks
* collateralization and excess-charity-mint policy

## It should read from

* `TCOINToken`
* `Treasury`
* `ReserveRegistry`
* `OracleRouter`
* `CharityRegistry`
* `PoolRegistry`

## It should not own

* reserve ERC20 custody
* governance proposal machinery
* steward registry logic
* token demurrage internals

## Key surface

### Minting

```solidity
depositAndMint(bytes32 assetId, uint256 assetAmount, uint256 beneficiaryCharityId)
previewMint(bytes32 assetId, uint256 assetAmount)
```

### Redemption

```solidity
redeemAsUser(bytes32 assetId, uint256 tcoinAmount, uint256 minOut)
redeemAsMerchant(bytes32 assetId, uint256 tcoinAmount, uint256 minOut)
previewRedeemAsUser(bytes32 assetId, uint256 tcoinAmount)
previewRedeemAsMerchant(bytes32 assetId, uint256 tcoinAmount)
```

### Merchant allowance

```solidity
increaseMerchantRedemptionAllowance(address merchant, uint256 amount)
decreaseMerchantRedemptionAllowance(address merchant, uint256 amount)
setMerchantRedemptionAllowance(address merchant, uint256 amount)
getMerchantRedemptionAllowance(address merchant)
```

### Admin safety

```solidity
pauseMinting()
unpauseMinting()
pauseRedemption()
unpauseRedemption()
pauseReserveAssetForTreasury(bytes32 assetId)
unpauseReserveAssetForTreasury(bytes32 assetId)
```

### Parameters

```solidity
setUserRedeemRate(uint256 bpsOrPpm)
setMerchantRedeemRate(uint256 bpsOrPpm)
setCharityMintRate(uint256 bpsOrPpm)
setCadPeg(uint256 newPeg)
```

## Boundary

This is the only contract that should:

* receive reserve assets
* mint TCOIN on deposit
* burn TCOIN on redemption
* transfer reserve assets out

If you keep that true, the money movement remains centralized in one auditable surface.

---

# 8. `Governance`

## Responsibility

Proposal creation, voting, quorum, execution routing.

Because you prefer narrow explicit proposal methods, this contract should expose explicit proposal flows rather than one generic payload blob.

## It should own

* proposal records
* proposal deadlines
* weighted yes/no votes
* steward-voted outcomes
* execution status

## It should read from

* `StewardRegistry` for vote weight
* possibly `CharityRegistry` for bootstrap thresholds

## It should execute against

* `CharityRegistry`
* `PoolRegistry`
* `ReserveRegistry`
* `TreasuryController`
* maybe `OracleRouter` for oracle replacements
* maybe `StewardRegistry` only if steward registration itself is governance-managed

## Narrow explicit surfaces

### Charity proposals

```solidity
proposeCharityAdd(...)
proposeCharityRemove(uint256 charityId)
proposeCharitySuspend(uint256 charityId)
proposeCharityUnsuspend(uint256 charityId)
```

### Pool proposals

```solidity
proposePoolAdd(...)
proposePoolRemove(bytes32 poolId)
proposePoolSuspend(bytes32 poolId)
proposePoolUnsuspend(bytes32 poolId)
```

### Reserve asset proposals

```solidity
proposeReserveAssetAdd(...)
proposeReserveAssetRemove(bytes32 assetId)
proposeReserveAssetPause(bytes32 assetId)
proposeReserveAssetUnpause(bytes32 assetId)
```

### Parameter proposals

```solidity
proposeCadPegUpdate(uint256 newPeg)
proposeUserRedeemRateUpdate(uint256 newRate)
proposeMerchantRedeemRateUpdate(uint256 newRate)
proposeCharitySurplusMintRateUpdate(uint256 newRate)
proposeExpirePeriodUpdate(uint256 newExpirePeriod)
```

### Oracle administration proposals

```solidity
proposeReserveOracleUpdate(bytes32 assetId, address primary, address fallback)
```

### Voting

```solidity
voteProposal(uint256 proposalId, bool support)
executeProposal(uint256 proposalId)
cancelProposal(uint256 proposalId)
getProposal(uint256 proposalId)
```

## Boundary

Governance should not directly hold operational reserve balances or token balances. It should only decide and execute state changes into the specialized registries/controllers.

---

# Recommended dependency graph

This is the clean dependency direction:

```text
Governance
  -> CharityRegistry
  -> StewardRegistry
  -> PoolRegistry
  -> ReserveRegistry
  -> TreasuryController
  -> OracleRouter

TreasuryController
  -> TCOINToken
  -> ReserveRegistry
  -> OracleRouter
  -> CharityRegistry
  -> PoolRegistry

StewardRegistry
  -> CharityRegistry   (or shared coordination)

TCOINToken
  -> no business registries
```

Important principle:

**`TCOINToken` should not import governance or treasury-heavy contracts.**
Keep it as isolated as possible.

---

# Where each current concern should move

## Current orchestrator responsibilities

Split them like this:

### Move to `TreasuryController`

* minting against deposited reserve assets
* redemption
* merchant redemption limits
* reserve holding
* charity mint uplift
* peg-aware conversion logic

### Move to `ReserveRegistry`

* supported reserve asset list
* enabled/paused reserve asset status

### Move to `CharityRegistry`

* charity add/remove/suspend/default UBI

### Move to `StewardRegistry`

* steward registration
* charity-to-steward assignment
* steward weight calculation

### Move to `PoolRegistry`

* approved pools
* approved merchants
* pool suspension

### Move to `Governance`

* proposal lifecycle
* weighted voting
* execution of approved actions

### Keep in `TCOINToken`

* demurrage
* balances
* mint/burn restricted to treasury controller

---

# Bootstrap and authority model

## Multisig powers

Your Safe should initially control:

* upgrade rights
* emergency pause rights
* initial charity admissions while count < 7
* maybe oracle override / emergency fallback actions

## After charity count >= 7

Governance takes over admissions/removals for charities.

That logic should probably live in `Governance`, but `CharityRegistry` can expose an admin path restricted by a rule like:

* owner can add charity only if active charity count < 7

That keeps the bootstrap rule enforceable on-chain.

---

# Steward reassignment proposal

You asked me to propose when/how a charity can change steward.

I recommend:

## v1 rule

* an active charity may reassign its steward at any time
* reassignment becomes effective immediately
* emit explicit event:

  * `CharityStewardChanged(charityId, oldSteward, newSteward)`

## Optional safety improvement

Add a cooldown:

* one reassignment per charity every 24 hours

Why:

* prevents frantic governance manipulation during an active vote

If you want the cleanest governance integrity, I would actually recommend:

* **reassignment is blocked while the charity is involved in an active vote snapshot**, or
* votes use steward weights snapshotted at proposal creation time

That second approach is better but more complex.

For v1, simplest workable path:

* immediate reassignment
* proposal voting weight snapshot at time of first vote or proposal creation

---

# Contract size and simplicity guidance

To stay away from size limits:

## Keep structs tight

Do not store giant metadata strings everywhere on-chain if not necessary. Prefer:

* ids
* hashes
* short codes
* off-chain metadata record ids

## Avoid giant all-in-one proposal unions if possible

Even with narrow methods, governance storage can grow. You can either:

* use one generic `Proposal` struct with typed fields, or
* use multiple proposal mappings by type

I would still use one generic proposal shell plus explicit proposal creation methods.

## Avoid on-chain enumeration where not needed

Use events + Supabase/indexer for:

* full charity list
* full steward history
* full merchant list

On-chain should support enough getters for direct verification, but not necessarily every searchable list.

---

# Suggested minimal interface set

If I were writing interfaces first, I’d define these surfaces:

## `ITCOINToken`

```solidity
mint(address to, uint256 amount)
burnFrom(address from, uint256 amount)
getDemurrageRate()
updateDemurrageRate(uint256)
pause()
unpause()
```

## `IReserveRegistry`

```solidity
getReserveAsset(bytes32 assetId)
getReserveAssetByToken(address token)
isReserveAssetEnabled(bytes32 assetId)
```

## `ICharityRegistry`

```solidity
getCharity(uint256 charityId)
isActiveCharity(address wallet)
getDefaultCharityId()
getAssignedSteward(uint256 charityId)
```

## `IStewardRegistry`

```solidity
isSteward(address steward)
getStewardWeight(address steward)
getTotalStewardWeight()
```

## `IPoolRegistry`

```solidity
isMerchantApprovedInActivePool(address merchant)
getMerchantPool(address merchant)
```

## `IOracleRouter`

```solidity
getCadPrice(bytes32 assetId)
isPriceFresh(bytes32 assetId)
```

## `ITreasuryController`

```solidity
depositAndMint(bytes32 assetId, uint256 amount, uint256 charityId)
redeemAsUser(bytes32 assetId, uint256 tcoinAmount, uint256 minOut)
redeemAsMerchant(bytes32 assetId, uint256 tcoinAmount, uint256 minOut)
setMerchantRedemptionAllowance(address merchant, uint256 amount)
```

## `IGovernance`

```solidity
voteProposal(uint256 proposalId, bool support)
executeProposal(uint256 proposalId)
getProposal(uint256 proposalId)
```

---

# Final Recommendation

Do **not** build another monolithic orchestrator.

Build a **TreasuryController** instead, and let it be only the economic controller.
Everything else should be registry or governance modules.

That will make this system much easier to:

* audit
* upgrade
* test
* reason about
* hand off to multiple developers

---

EOD
