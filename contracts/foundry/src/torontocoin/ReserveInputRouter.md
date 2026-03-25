# ReserveInputRouter

## Purpose

`ReserveInputRouter` is the reserve-input normalization helper for `cplTCOIN` acquisition.

It is not a pool router, not a treasury, and not a minting policy layer.

Its only job is to turn a user-supplied input token into a reserve asset that `TreasuryController` already accepts.

## Responsibilities

`ReserveInputRouter` can:

- detect when an input token is already a directly accepted reserve asset
- leave directly accepted reserve input unchanged
- swap a helper-enabled token into `mCAD`
- support atomic multihop normalization such as `USDC -> USDm -> mCAD` through the configured swap adapter
- return the final accepted reserve asset id, token address, and amount to `LiquidityRouter`

It does not:

- select pools
- buy `cplTCOIN`
- mint `cplTCOIN`
- compute treasury pricing or collateralization
- route charity top-ups

## Current Flow

State-changing normalization is `LiquidityRouter`-only.

The current path is:

1. `LiquidityRouter` pulls `tokenIn` from the buyer
2. if `TreasuryController.resolveAcceptedReserveAsset(tokenIn)` succeeds, the token is already normalized
3. otherwise `LiquidityRouter` approves `ReserveInputRouter`
4. `ReserveInputRouter` pulls the unsupported input from `LiquidityRouter`
5. helper swaps either:
   - `tokenIn -> mCAD`, or
   - `tokenIn -> intermediateToken -> mCAD`
6. helper transfers normalized reserve tokens back to `LiquidityRouter`
7. `LiquidityRouter` deposits that reserve asset into `TreasuryController.depositAssetForLiquidityRoute(...)`

This keeps user approval surface on the main retail router while isolating Mento-specific normalization logic.

## Main Methods

### `normalizeReserveInput(address tokenIn, uint256 amountIn, uint256 minReserveOut, address payer)`

Callable only by `LiquidityRouter`.

Returns:

- `reserveAssetId`
- `reserveToken`
- `reserveAmountOut`

Behaviour:

- direct treasury-accepted input passes through unchanged
- unsupported-but-enabled input is swapped into `mCAD` through the configured adapter route, which may be single-hop or multihop
- unsupported input reverts
- helper should not retain idle balances after success

### `previewNormalizeReserveInput(address tokenIn, uint256 amountIn)`

Public preview helper.

Returns:

- whether the input is already directly accepted
- whether the helper route requires a swap
- the resolved reserve asset id and token
- the expected normalized reserve amount

## Dependencies

`ReserveInputRouter` depends on:

- `TreasuryController.resolveAcceptedReserveAsset(...)`
- `ISwapAdapter` for `tokenIn -> mCAD` normalization, including optional intermediate-hop paths
- `mCAD` token configuration

The helper assumes `mCAD` itself is an active reserve asset in treasury.

The recommended concrete adapter is `MentoBrokerSwapAdapter`, which stores default Mento broker routes on-chain and can still honour optional per-call route overrides for older flows that need them.

## Access Model

- `normalizeReserveInput(...)`: `LiquidityRouter` only
- `previewNormalizeReserveInput(...)`: public
- config setters: owner only

## Notes

- The helper engages the swap path only when the input token is not already treasury-accepted.
- The current recommended Celo on-ramp posture is to enable atomic `USDC -> USDm -> mCAD` normalization in the adapter while keeping the helper itself agnostic about Mento internals.
- This keeps the normalization boundary separate from retail `cplTCOIN` acquisition and from treasury economics.
- `TcoinMintRouter` may remain in the repo for older mrTCOIN mint flows, but `ReserveInputRouter` is the active normalization helper for `LiquidityRouter`.
- `LiquidityRouter` should keep passing empty swap-data and rely on admin-set Mento routes through the adapter; direct broker/exchange selection should stay outside the retail router.
