# TorontoCoin Contracts (Refactor Baseline)

This folder is the hardened TorontoCoin contract suite aligned to the Sarafu read-only contracts in `/contracts/foundry/src/sarafu-read-only`.

## Resolved Decisions (Current Baseline)

### Governance lifecycle
- Early approval is allowed once weighted majority and participation are met.
- Execution is deadline-gated.
- `executeProposal` reverts before `proposal.deadline`, even if status is already `Approved`.
- `cancelProposal` remains owner-only.

### Canonical coupling model
- `CharityRegistry` is canonical for charity assignment intent.
- `StewardRegistry` is canonical for steward weight computation.
- Steward assignment transitions are synchronized via:
  - `syncCharityAppointment(uint256 charityId, address oldSteward, address newSteward)`.

### Shared interface model
- Cross-contract assumptions are explicit under `/interfaces`:
  - `ICharityRegistry`
  - `IStewardRegistry`
  - `IPoolRegistry`
  - `IReserveRegistry`
  - `IOracleRouter`
  - `ITreasuryController`
  - `ITCOINToken`
  - `IGovernance`

### Treasury helper expectations
`CharityRegistry` now exposes the helper surface expected by treasury flows:
- `getDefaultCharityId()`
- `getCharityWallet(uint256)`
- `isActiveCharity(uint256)`
- `resolveActiveCharityOrDefault(uint256)` — resolves a requested charity ID or falls back to the active default; reverts if no active default exists

### User charity preferences
`UserCharityPreferencesRegistry` stores per-user charity preferences and voluntary fee settings, decoupled from the global `CharityRegistry`:
- Users may elect a preferred charity and a voluntary fee in basis points (capped by `maxVoluntaryFeeBps`).
- `resolveFeePreferences(address)` is the canonical function consumed by `cplTCOIN` at payment time; it returns the resolved charity ID, wallet, and voluntary fee bps.
- If a user's preferred charity becomes inactive, resolution automatically falls back to the `CharityRegistry` default; reverts if no active default exists.
- `previewResolvedCharity(address)` is a UI/preview helper that also indicates whether fallback occurred.
- Fees are attributed to the **payer** (`from`) address, not `msg.sender`, to prevent relayer hijacking of charity routing.

### User acceptance preferences
`UserAcceptancePreferencesRegistry` is now the canonical user-managed acceptance and preference layer for voucher routing:
- Pools are allow/deny only and are not ranked on-chain.
- Merchant vouchers and token addresses can be accepted, denied, and ranked.
- `strictAcceptedOnly` is one global per-user mode; when enabled, unlisted items are unacceptable unless preferred.
- Preferred merchants and preferred tokens are implicitly accepted.
- Denied items override accepted or preferred status.
- `LiquidityRouter` now reads these stored preferences on-chain instead of taking pool and merchant preference vectors as user calldata.

### Reserve-input normalization
`ReserveInputRouter` is now the canonical helper for retail `cplTCOIN` acquisition input normalization:
- `LiquidityRouter` remains the main user entrypoint.
- Direct treasury-accepted reserve inputs bypass the helper.
- Unsupported direct inputs can be normalized into `mCAD` through the helper when explicitly enabled.
- `TreasuryController` stays narrow and only resolves accepted reserve assets plus liquidity-route settlement capacity.
- `MentoBrokerSwapAdapter` is the concrete `ISwapAdapter` implementation for Mento broker routes, with admin-set default routes plus optional per-call route overrides for older mint-router flows.

### Build compatibility hardening
- OpenZeppelin imports are aligned to installed v4 layout (`security/*` and upgradeable `security/*`).
- `GeneroToken` uses v4 transfer hooks (`_beforeTokenTransfer`) instead of v5-style `_update`.
- Non-upgradeable `Ownable` patterns use explicit ownership transfer in constructors.
- Upgradeable `OwnableUpgradeable` initializers use `__Ownable_init()` then `_transferOwnership(owner_)`.
- Stale legacy v2 unit test imports were removed from active build.

## Line-by-Line Closure of Prior Outstanding Comments

1. Payload naming normalized.
- Closed: the generic bytes32 payload type in `Governance` is now `Bytes32IdPayload`.

2. Governance execution timing clarified.
- Closed: proposal approval may occur before deadline, but execution is blocked until deadline.

3. Downstream interface assumptions made explicit.
- Closed: shared interfaces are now first-class contracts in `/interfaces`, and core modules import them.

4. Charity/Steward contract mismatch resolved.
- Closed: assignment calls now use `syncCharityAppointment(...)` instead of ad hoc methods.

5. Treasury helper assumptions resolved.
- Closed: charity helper methods expected by treasury are implemented and consumed through `ICharityRegistry`.

## Future-Phase Items (Not Required for Current Baseline)
- Additional NatSpec expansion across all external/public functions.
- Broader governance regression suite for payload routing edge cases.
- Optional richer debug telemetry for oracle fallback reasons.
- Optional registry/indexing convenience functions for large data pagination and analytics.
