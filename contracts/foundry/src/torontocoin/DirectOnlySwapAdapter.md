# DirectOnlySwapAdapter

## Purpose

`DirectOnlySwapAdapter` is the non-Mento `ISwapAdapter` used by the limited `ethereum-sepolia` TorontoCoin smoke profile.

It exists to preserve the same `ReserveInputRouter` boundary used on Celo while making the profile's intent explicit:

- direct treasury-accepted reserve inputs are allowed
- swap-based normalization is disabled
- any attempt to use the swap path reverts deterministically

## Operational role

- Used only in profiles where Mento is unavailable or intentionally out of scope.
- Keeps `ReserveInputRouter` wired exactly as production expects, without embedding Mento-specific logic into `LiquidityRouter`.
- Makes "non-Mento smoke test" behaviour readable on-chain and in deployment manifests.

## Behaviour

- `previewSwapToCadm(...)` reverts with `SwapsDisabled(...)`
- `swapToCadm(...)` reverts with `SwapsDisabled(...)`

That means:

- if the incoming token is already an active treasury reserve asset, `ReserveInputRouter` can pass it through unchanged
- if a swap would be required, the flow fails immediately instead of pretending a route exists

## Scope

This contract is not part of the Celo production route. It is a profile helper for limited deployment and smoke-test environments.
