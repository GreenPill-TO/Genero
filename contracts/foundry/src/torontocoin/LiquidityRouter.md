# LiquidityRouter

## Purpose

`LiquidityRouter` is the user-facing and admin-facing execution layer for `cplTCOIN` liquidity operations.

It is not a second treasury and not a second registry.

Its role is to:

- accept user purchase intent for `cplTCOIN`
- normalize input tokens into treasury-accepted reserve assets
- orchestrate treasury-side settlement into mrTCOIN
- validate one off-chain-selected Sarafu pool
- acquire `cplTCOIN` atomically for the user
- mint a configurable charity top-up in `cplTCOIN`
- expose governance-controlled routing and top-up parameters

## Non-custodial Posture

`LiquidityRouter` may transiently hold tokens during a transaction, but it should not retain idle balances intentionally.

Current flow:

1. pull `inputToken` from the buyer
2. check whether the input token is already treasury-accepted
3. if direct, keep it unchanged
4. if not direct, delegate normalization to `ReserveInputRouter`
5. approve the `Treasury` vault address resolved through `TreasuryController`
6. call `TreasuryController.depositAssetForLiquidityRoute(...)`
7. receive mrTCOIN minted to the router
8. approve the pool adapter
9. buy `cplTCOIN` from the selected Sarafu `SwapPool` for the buyer
10. mint charity top-up `cplTCOIN` directly to the resolved charity wallet

If any downstream step fails, the whole transaction reverts.

## Dependencies

`LiquidityRouter` stores pointers to:

- `governance`
- `treasuryController`
- `reserveInputRouter`
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

Pool ranking is now primarily off-chain. Sarafu indexers/UI/pathfinding choose the candidate pool, and the router only validates and executes it.

## Public User Flow

### `buyCplTcoin(bytes32 targetPoolId, address inputToken, uint256 inputAmount, uint256 minReserveOut, uint256 minCplTcoinOut)`

Uses `msg.sender` as:

- input-token payer
- acceptance-preference owner
- charity-resolution owner
- `cplTCOIN` recipient

It returns:

- selected pool id
- normalized reserve asset id
- normalized reserve amount used
- mrTCOIN used
- `cplTCOIN` output
- charity top-up output
- resolved charity id

### `previewBuyCplTcoin(bytes32 targetPoolId, address buyer, address inputToken, uint256 inputAmount)`

Uses an explicit `buyer` address so preview logic can deterministically read:

- acceptance preferences
- charity resolution
- reserve-input normalization

without relying on `msg.sender` in `eth_call`.

## Input Normalization

`LiquidityRouter` does not embed Mento swap internals.

Instead:

- direct reserve-accepted tokens skip the helper entirely
- unsupported direct tokens are delegated to `ReserveInputRouter`
- helper-enabled tokens are normalized into `mCAD`
- treasury settlement always happens after normalization

Users always receive `cplTCOIN`, never mrTCOIN.

## Pool Execution

`LiquidityRouter` no longer discovers the best pool on-chain.

Instead:

- Sarafu indexers/UI/pathfinding pick `targetPoolId` off-chain
- router validates that the pool is approved and preference-compatible
- `poolAdapter` translates that `poolId` into a real Sarafu `SwapPool` execution

That keeps pool discovery in the existing Sarafu off-chain stack while keeping acceptance and treasury settlement on-chain.

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
- seed pools with `cplTCOIN`
- top up pools with `cplTCOIN`

The intended deployment posture is that on-chain `Governance` owns `LiquidityRouter` and is also configured as its `governance` address.

## Notes

- The router is execution and orchestration, not a registry.
- The router is also not the source of truth for user acceptance preferences; `UserAcceptancePreferencesRegistry` is.
- The router still depends on `TreasuryController` for reserve-asset acceptance and mrTCOIN route pricing. It does not duplicate treasury economics.
- `ReserveInputRouter` is the only helper that should engage the Mento-style swap path, and only when the input token is not already treasury-accepted.
- The intended production pool backend is now a Sarafu `SwapPool`, typically reached through `SarafuSwapPoolAdapter`.
