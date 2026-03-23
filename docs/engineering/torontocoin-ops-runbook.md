# TorontoCoin Ops Runbook

## Purpose

Use this runbook to confirm the live TorontoCoin Celo mainnet suite is healthy before or after operator actions, including the broader Sarafu compatibility set beyond the bootstrap pool.

## Current live suite

The canonical runtime addresses are the checked-in TorontoCoin runtime bridge at [torontocoinRuntime.ts](/Users/botmaster/src/greenpill-TO/Genero/shared/lib/contracts/torontocoinRuntime.ts). It mirrors the latest validated mainnet deployment artefacts.

## Read-only ops check

Run the baseline ops summary:

```bash
cd /Users/botmaster/src/greenpill-TO/Genero
pnpm ops:torontocoin
```

The script prints:

- current live addresses
- governance ownership checks for `LiquidityRouter`, `TreasuryController`, `PoolRegistry`, and `SarafuSwapPoolAdapter`
- a pool-by-pool TorontoCoin compatibility matrix for every registered Sarafu pool the runtime can resolve
- per-pool `cplTCOIN` / `mrTCOIN` liquidity plus any additional voucher tokens found in the pool token registry
- per-pool limiter health, quoter output checks, and `previewBuyCplTcoin(...)` readiness
- reserve-route health, including reserve activation, Mento route configuration, and router/controller pointer checks
- a JSON payload suitable for automation

Run the focused compatibility matrix:

```bash
cd /Users/botmaster/src/greenpill-TO/Genero
pnpm ops:torontocoin:pools
```

That script emits a concise pass/fail summary per registered Sarafu pool for:

- `PoolRegistry` registration and active status
- fee-bypass eligibility through registered-pool treatment
- limiter health
- quoter health
- scenario-preview readiness
- indexer visibility when Supabase env is available locally

Run bounded previews or an optional live acceptance buy:

```bash
cd /Users/botmaster/src/greenpill-TO/Genero
pnpm ops:torontocoin:acceptance
```

Optional env for that script:

- `TORONTOCOIN_ACCEPTANCE_POOL_IDS=0x...[,0x...]` to target specific pool ids
- `TORONTOCOIN_LIVE_BUY_ENABLED=true` to execute one real buy instead of preview-only
- `PRIVATE_KEY=...` required only when live buy is enabled

## Manual spot checks

1. Confirm the runtime bridge still matches the latest mainnet deployment artefacts.
2. Confirm every target Sarafu pool is registered in TorontoCoin `PoolRegistry` and resolves to the intended `SwapPool` address.
3. Confirm governance still owns the governed router and registry contracts.
4. Confirm each tracked pool still returns usable quotes and a non-zero preview where preview is expected.
5. Confirm the reserve route remains active for the configured reserve asset and `USDC` Mento route.
6. Confirm the indexer status route is surfacing each expected pool individually instead of only the bootstrap pool.

## Admin UI

The wallet admin screen exposes the same read-only health summary through `/api/tcoin/ops/status`. Use it as the operator dashboard when you need:

- current live addresses
- ownership checks
- pool-by-pool liquidity
- per-pool limiter/quoter/preview status
- per-pool indexer visibility

Use the scripts when you need CLI or automation output.
