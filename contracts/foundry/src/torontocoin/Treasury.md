# Treasury

## Purpose

`Treasury` is the pure reserve vault for the TCOIN system.

It is intentionally simple:

- non-upgradeable
- reserve-custody only
- no pricing logic
- no oracle logic
- no collateralization math
- no redemption-rate policy
- no charity mint logic

Its job is to hold reserve ERC20 balances and move them only for authorized callers.

## Design Rules

The vault should remain dumb.

It only enforces:

- caller authorization
- nonzero addresses and amounts
- sufficient reserve balance on withdrawal

It does not know:

- what a reserve asset is worth
- which caller is a merchant
- which redemption rate applies
- whether a charity mint is safe
- which pool should receive liquidity

Those decisions belong to `TreasuryController` and higher-level orchestration contracts.

## Stored State

`Treasury` stores one policy mapping:

- `authorizedCallers[address] => bool`

That allows multiple protocol actors to move reserve assets without turning the vault into a policy engine.

Typical authorized callers are:

- `TreasuryController`
- governance-admin migration or operational paths if explicitly enabled

## External Surface

### `setAuthorizedCaller(address caller, bool authorized)`

Owner-only.

Adds or removes an address from the vault’s reserve-movement allowlist.

### `depositReserveFrom(address from, address token, uint256 amount)`

Authorized-caller only.

Pulls reserve ERC20 from `from` into the vault using `safeTransferFrom`.

This is the canonical reserve deposit primitive used by reserve-backed minting and router settlement flows.

### `withdrawReserveTo(address to, address token, uint256 amount)`

Authorized-caller only.

Sends reserve ERC20 from the vault to `to` after confirming the vault has enough balance.

This is the canonical reserve withdrawal primitive used by redemption flows.

### `reserveBalance(address token)`

Read-only helper returning the live ERC20 balance held by the vault.

`TreasuryController` uses this directly for:

- reserve sufficiency checks
- collateralization math

### `emergencySweep(address token, address to, uint256 amount)`

Owner-only emergency and migration escape hatch.

This is intentionally strong and should be reserved for exceptional operational recovery.

## Relationship to TreasuryController

The split is:

- `Treasury` holds reserve assets
- `TreasuryController` decides when reserve assets should move

Examples:

- reserve-backed mrTCOIN minting:
  - `TreasuryController` computes output
  - `Treasury` receives the reserve asset
- user redemption:
  - `TreasuryController` computes output and burns mrTCOIN
  - `Treasury` sends the reserve asset
- router settlement:
  - `TreasuryController` validates and prices the route deposit
  - `Treasury` receives the reserve asset from the router flow

At no point should downstream code assume the controller itself is the reserve holder.

## Notes

- The vault uses `SafeERC20` for all token movement.
- The intended deployment pattern is to deploy `Treasury` first, then explicitly authorize `TreasuryController` as a caller.
- The pure-vault posture is deliberate: it makes reserve custody easier to audit and harder to accidentally overload with policy state.
