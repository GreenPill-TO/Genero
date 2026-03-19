# LiquidityRouter

## Purpose

`LiquidityRouter` is the user-facing and admin-facing execution layer for `cplTCOIN` liquidity operations.

It is not a second treasury and not a second registry.

Its role is to:

- accept approved reserve-asset deposits from users
- orchestrate treasury-side settlement into mrTCOIN
- choose the best eligible `cplTCOIN` pool
- acquire `cplTCOIN` atomically for the user
- mint a configurable charity top-up in `cplTCOIN`
- expose governance-controlled pool-scoring parameters

## Non-custodial Posture

`LiquidityRouter` may transiently hold tokens during a transaction, but it should not retain idle balances intentionally.

Current flow:

1. pull reserve asset from the buyer
2. approve the `Treasury` vault address resolved through `TreasuryController`
3. call `TreasuryController.depositAssetForLiquidityRoute(...)`
4. receive mrTCOIN minted to the router
5. approve the pool adapter
6. buy `cplTCOIN` from the selected pool for the buyer
7. mint charity top-up `cplTCOIN` directly to the resolved charity wallet

If any downstream step fails, the whole transaction reverts.

## Dependencies

`LiquidityRouter` stores pointers to:

- `governance`
- `treasuryController`
- `cplTcoin`
- `charityPreferencesRegistry`
- `acceptancePreferencesRegistry`
- `poolRegistry`
- `poolAdapter`

## Canonical Preference Model

The router no longer treats user pool and merchant preferences as calldata.

Instead it reads canonical on-chain state from `UserAcceptancePreferencesRegistry`.

That registry provides:

- accepted and denied pools
- accepted and denied merchants
- ranked preferred merchants
- accepted and denied token addresses
- ranked preferred token addresses
- one global `strictAcceptedOnly` flag

For router purposes:

- denied pools hard-exclude a pool
- denied merchant matches hard-exclude a pool
- `cplTCOIN` token acceptance is an eligibility gate
- strict mode requires either:
  - the pool itself to be accepted, or
  - the pool to match an accepted merchant voucher
- preferred merchant order contributes a score bonus

## Public User Flow

### `buyCplTcoin(bytes32 reserveAssetId, uint256 reserveAssetAmount, uint256 minCplTcoinOut)`

Uses `msg.sender` as:

- reserve-asset payer
- acceptance-preference owner
- charity-resolution owner
- `cplTCOIN` recipient

It returns:

- selected pool id
- mrTCOIN used
- `cplTCOIN` output
- charity top-up output
- resolved charity id

### `previewBuyCplTcoin(address buyer, bytes32 reserveAssetId, uint256 reserveAssetAmount)`

Uses an explicit `buyer` address so preview logic can deterministically read:

- acceptance preferences
- charity resolution

without relying on `msg.sender` in `eth_call`.

## Pool Selection

Pool selection is deterministic and pool-based.

Hard filters:

- pool active in `PoolRegistry`
- pool active in `poolAdapter`
- enough `cplTCOIN` liquidity
- buyer must accept `cplTCOIN` under current preference rules
- pool must not be explicitly denied
- pool must not match any denied merchant id
- under strict mode, pool must be explicitly accepted or match an accepted merchant id

Score components:

- low mrTCOIN liquidity
- high `cplTCOIN` liquidity
- accepted-pool bonus
- ranked preferred-merchant bonus

Preferred-merchant scoring is rank-sensitive:

- highest-ranked matching merchant gets the largest bonus
- lower-ranked matches get smaller bonuses

If preferred or accepted candidates do not produce an eligible route, the router still falls back to the best remaining eligible pool.

## Charity Top-up

After the pool purchase succeeds:

- the router resolves charity through `UserCharityPreferencesRegistry`
- computes `charityTopupBps`
- mints `cplTCOIN` directly to the resolved charity wallet

This top-up is separate from the reserve-backed mrTCOIN settlement path in `TreasuryController`.

## Admin Surface

Governance or owner can:

- update dependency pointers
- update `charityTopupBps`
- update pool scoring weights
- seed pools with `cplTCOIN`
- top up pools with `cplTCOIN`

The intended deployment posture is that on-chain `Governance` owns `LiquidityRouter` and is also configured as its `governance` address.

## Notes

- The router is execution and orchestration, not a registry.
- The router is also not the source of truth for user acceptance preferences; `UserAcceptancePreferencesRegistry` is.
- The router still depends on `TreasuryController` for reserve-asset acceptance and mrTCOIN route pricing. It does not duplicate treasury economics.
