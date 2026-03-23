# TorontoCoin Ops Runbook

## Purpose

Use this runbook to confirm the live TorontoCoin Celo mainnet suite is healthy before or after operator actions.

## Current live suite

The canonical runtime addresses are the checked-in TorontoCoin runtime bridge at [torontocoinRuntime.ts](/Users/botmaster/src/greenpill-TO/Genero/shared/lib/contracts/torontocoinRuntime.ts). It mirrors the latest validated mainnet deployment artefacts.

## Read-only ops check

Run:

```bash
cd /Users/botmaster/src/greenpill-TO/Genero
node --experimental-strip-types scripts/torontocoin-ops-check.ts
```

The script prints:

- current live addresses
- governance ownership checks for `LiquidityRouter`, `TreasuryController`, `PoolRegistry`, and `SarafuSwapPoolAdapter`
- bootstrap pool `cplTCOIN` and `mrTCOIN` liquidity
- `previewBuyCplTcoin(...)` for the canonical `1 USDC` scenario
- reserve-route health, including reserve activation, Mento route configuration, and router/controller pointer checks
- a JSON payload suitable for automation

## Manual spot checks

1. Confirm the runtime bridge still matches the latest mainnet deployment artefacts.
2. Confirm the bootstrap pool retains enough `cplTCOIN` for the canonical preview amount.
3. Confirm governance still owns the governed router and registry contracts.
4. Confirm `previewBuyCplTcoin(...)` still returns the bootstrap pool id and a non-zero `cplTCOIN` out amount.
5. Confirm the reserve route remains active for the configured reserve asset and `USDC` Mento route.

## Admin UI

The wallet admin screen exposes the same read-only health summary through `/api/tcoin/ops/status`. Use it as the operator dashboard; use the script when you need CLI or automation output.
