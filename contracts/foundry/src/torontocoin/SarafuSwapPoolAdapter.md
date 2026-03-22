# SarafuSwapPoolAdapter

## Purpose

`SarafuSwapPoolAdapter` is the thin runtime pool adapter intended for the Sarafu-aligned TorontoCoin retail path.

It does not own pool inventory.

Its role is to let `LiquidityRouter` keep one pool-execution interface while the real pool engine is a Sarafu `SwapPool`.

## Runtime Model

For each TorontoCoin-recognized `poolId`, the adapter:

- resolves the real Sarafu `SwapPool` address from `PoolRegistry`
- reads pool-side `mrTCOIN` and `cplTCOIN` balances directly from that pool address
- previews `mrTCOIN -> cplTCOIN` output by querying `SwapPool.getQuote(...)` and applying the pool fee
- executes buys by:
  - pulling `mrTCOIN` from the router
  - approving the Sarafu pool
  - calling `SwapPool.withdraw(cplTCOIN, mrTCOIN, mrTcoinAmountIn)`
  - forwarding the received `cplTCOIN` to the final recipient

This keeps TorontoCoin aligned with Sarafu pool custody, limits, and quoting instead of re-implementing them.

## Design Boundary

This adapter should:

- use real Sarafu `SwapPool` contracts as the execution backend
- use `PoolRegistry` only as a lightweight allowlist / identity directory
- stay stateless with respect to pool liquidity configuration

This adapter should not:

- deploy inventory sub-accounts
- own quote-bps settings
- own execution flags separate from pool identity
- duplicate Sarafu fee, limit, or quote logic

## Governance Posture

The intended deployment posture is:

- `Governance` owns `SarafuSwapPoolAdapter`
- `Governance` is also configured as the adapter’s `governance` address
- `LiquidityRouter` points to this adapter as its canonical `poolAdapter`

## Notes

- Merchant matching still comes from `PoolRegistry`, so acceptance-preference enforcement remains compatible with the existing TorontoCoin preference surfaces.
