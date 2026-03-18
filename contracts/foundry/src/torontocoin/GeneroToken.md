# GeneroTokenV3

## Role

`GeneroTokenV3` is the `cplTCOIN` demurrage token.

It keeps the Sarafu `DemurrageTokenSingleNocap` balance model and admin knobs, while adding merchant POS fee routing for ordinary `transfer` and `transferFrom`.

## Key Behaviour

- Demurrage remains base-balance driven.
- `mintTo`, writer controls, `seal`, `expiry`, `maxSupply`, `sinkAddress`, and `supportsInterface` are retained.
- Merchant fees only apply when the recipient is an active merchant POS fee target resolved through `PoolRegistry`.
- The transfer `amount` is interpreted as the displayed sticker price on merchant transfers.
- Charity routing uses `UserCharityPreferencesRegistry.resolveFeePreferences(payer)`.
- For `transferFrom`, the payer is `from`.

## Merchant Transfer Semantics

For a merchant fee-target transfer of displayed amount `A`:

- merchant receives `A - baseFee`
- charity receives `baseFee + voluntaryFee`
- payer is debited `A + voluntaryFee`

The split is computed in visible units first, then converted into base units for internal accounting.

## Registry Dependencies

Minimal external surfaces used by the token:

- `IPoolRegistryForCplTCOIN`
- `IUserCharityPreferencesRegistryForCplTCOIN`

## Important Compatibility Note

Merchant-target transfers are intentionally non-vanilla ERC20:

- `transferFrom(from, merchant, amount)` can consume allowance greater than `amount`
- because allowance is reduced by the payer’s actual debit, not just the sticker price

Use `previewMerchantTransfer(...)` before signing merchant payments.
