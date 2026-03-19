# TreasuryController

## Purpose

`TreasuryController` is the upgradeable economic policy and settlement layer for reserve-backed mrTCOIN.

It does not hold reserve assets.

Its responsibilities are:

- validate active reserve assets
- price reserve deposits and redemptions through `OracleRouter`
- mint mrTCOIN on reserve-backed deposits
- burn mrTCOIN on redemption
- apply user and merchant redemption rates
- enforce merchant redemption allowances
- compute collateralization from live `Treasury` balances
- mint excess-capacity charity mrTCOIN within overcollateralization headroom
- authorize the router-only reserve deposit path used by `LiquidityRouter`
- pause minting, redemption, or specific reserve assets in emergencies

## Split Architecture

The treasury split is now fixed:

- `Treasury` is the only reserve vault
- `TreasuryController` is the economic engine

That means:

- reserve deposits call `ITreasuryVault(treasury).depositReserveFrom(...)`
- reserve withdrawals call `ITreasuryVault(treasury).withdrawReserveTo(...)`
- reserve sufficiency and collateralization read `ITreasuryVault(treasury).reserveBalance(...)`
- the controller must never be treated as the reserve ERC20 holder

Temporary controller custody of mrTCOIN during redemption burn flow is acceptable.
Reserve ERC20 custody is not.

## Core Dependencies

`TreasuryController` depends on:

- `Treasury`
- `ITCOINToken` for mrTCOIN mint and burn
- `ReserveRegistry`
- `CharityRegistry`
- `PoolRegistry`
- `OracleRouter`

It also stores an authorized `liquidityRouter` pointer for the router-only reserve deposit path.

It also exposes `resolveAcceptedReserveAsset(address token)` so upstream routers can detect whether an input token is already an active treasury reserve asset before attempting any normalization.

## Main Flows

### Reserve-backed minting

`depositAndMint(...)`:

1. validates the reserve asset and pause state
2. resolves CAD value through `OracleRouter`
3. converts CAD value to mrTCOIN at the current peg
4. resolves the requested charity or default charity
5. instructs `Treasury` to pull the reserve token from the payer
6. mints mrTCOIN to the user
7. mints charity uplift mrTCOIN to the resolved charity wallet

The controller never keeps reserve inventory on its own balance sheet.

### Router settlement

`depositAssetForLiquidityRoute(...)` is router-only.

It:

1. validates the reserve asset and pause state
2. computes CAD value and mrTCOIN output
3. instructs `Treasury` to pull the reserve token from the payer provided by `LiquidityRouter`
4. mints mrTCOIN to the router caller

This path does not mint charity uplift, because the charity top-up for `cplTCOIN` liquidity purchases happens in `LiquidityRouter`.

### Reserve-input resolution

`resolveAcceptedReserveAsset(address token)` is a view helper for routers and normalization helpers.

It returns whether the token is:

- registered in `ReserveRegistry`
- still active
- not paused on the treasury side

This keeps reserve-acceptance detection in the policy layer without moving swap logic into `TreasuryController`.

### User redemption

`redeemAsUser(...)`:

1. validates the reserve asset and pause state
2. computes the discounted user redemption output
3. transfers mrTCOIN from the redeemer into the controller
4. burns the redeemed mrTCOIN
5. instructs `Treasury` to withdraw the reserve asset to the redeemer

### Merchant redemption

`redeemAsMerchant(...)` follows the same pattern, but additionally:

- checks `PoolRegistry.isMerchantApprovedInActivePool(msg.sender)`
- applies the merchant redemption rate
- consumes merchant redemption allowance in mrTCOIN units

Allowance writes are controlled by the `indexer` or the owner.

## Collateralization and Charity Minting

Collateralization is computed in the controller, not in the vault.

The controller exposes:

- `getTotalReserveValue18()`
- `getCurrentMrTcoinSupply()`
- `getCurrentCollateralizationRatio18()`
- `getMaxMintableCharityAmount()`

`overcollateralizationTarget18` is governance-controlled.

`mintToCharity(...)` can mint unbacked mrTCOIN only within current overcollateralization headroom:

- governance can always call it
- the owner/admin can also call it while `adminCanMintToCharity == true`
- governance or owner can disable that admin override with `setAdminCanMintToCharity(false)`

## Access Control

### Owner-only

- pointer setters such as `setTreasury(...)`, `setLiquidityRouter(...)`, `setOracleRouter(...)`
- upgrade authorization

### Governance-or-owner

- peg updates
- user and merchant redeem-rate updates
- charity mint-rate updates
- minting pause and unpause
- redemption pause and unpause
- per-asset treasury pause and unpause
- `setAdminCanMintToCharity(...)`

### Governance-only

- `setOvercollateralizationTarget(...)`

### Router-only

- `depositAssetForLiquidityRoute(...)`

### Indexer-or-owner

- merchant redemption allowance writes

## Notes

- `TreasuryController` should be the source of truth for reserve economics, not reserve custody.
- `TreasuryController` should also be the source of truth for whether a token is currently an acceptable reserve input.
- Emergency pause powers intentionally remain on the admin/governance path because steward voting is too slow for operational incidents.
- The intended deployment posture is that on-chain `Governance` owns `TreasuryController` and is also configured as its `governance` address.
