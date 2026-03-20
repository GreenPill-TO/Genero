# GeneroTokenV3

## Role

`GeneroTokenV3` is the `cplTCOIN` demurrage token.

It keeps the Sarafu `DemurrageTokenSingleNocap` base-balance model and admin knobs, while hardening merchant POS fee routing for ordinary `transfer` and `transferFrom`.

## Key Behaviour

- Demurrage remains base-balance driven.
- `account[...]` and internal allowances are stored in base units.
- User-facing transfer amounts, previews, balances, allowances, and events use visible units.
- Merchant fees only apply when the recipient is an active merchant POS fee target resolved through `PoolRegistry`.
- The transfer `amount` is interpreted as the displayed sticker price on merchant transfers.
- Charity routing uses `UserCharityPreferencesRegistry.resolveFeePreferences(payer)`.
- For `transferFrom`, the payer is `from`.
- `owner` remains the policy/admin authority, but mint and burn authority now require explicit writer assignment.

## Preview Surfaces

Use the preview helpers before signing or forwarding transfers:

- `previewTransfer(...)` gives the generic payer debit / recipient credit / charity credit split.
- `previewMerchantTransfer(...)` keeps the legacy merchant-oriented view.
- `previewAllowanceRequired(...)` returns both the visible allowance requirement and the exact base allowance that `transferFrom` will consume.
- `getMerchantFeeConfig(...)` resolves the merchant id and fee override state for dashboards and ops tooling.
- `canResolveCharityFor(...)` is a quick dependency-health check for payer charity resolution.

## Merchant Transfer Semantics

For a merchant fee-target transfer of displayed amount `A`:

- merchant receives `A - baseFee`
- charity receives `baseFee + voluntaryFee`
- payer is debited `A + voluntaryFee`

The split is computed in visible units first, then converted into base units for internal accounting.

The charity base credit is derived as the base-unit remainder:

- `payerDebitBase - recipientCreditBase`

That preserves exact base-unit conservation under flooring and should not be “simplified” into three independent visible-to-base conversions.

## Allowance Semantics

Merchant-target transfers are intentionally non-vanilla ERC20:

- `transferFrom(from, merchant, amount)` can consume allowance greater than `amount`
- because allowance is reduced by the payer’s actual debit, not just the sticker price

Allowance is stored internally in base units, but:

- `allowance(owner, spender)` returns visible units
- `Approval` events emit visible units
- `transferFrom` emits an updated visible allowance after spend

Wallets, routers, and indexers should use `previewAllowanceRequired(...)` when preparing merchant transfers.

## Event Semantics

Merchant-target transfers emit recipient-credit events, not one single payer-debit event:

- one `Transfer(payer, merchant, merchantCredit)`
- one optional `Transfer(payer, charityWallet, charityCredit)`
- `MerchantTransferCharged(...)` as the authoritative logical payment summary
- `CharityFeeRouted(...)` when charity credit is nonzero

Integrators must not assume one `Transfer` event equals the payer’s total debit for merchant payments.

## Registry Dependencies

Minimal external surfaces used by the token:

- `IPoolRegistryForCplTCOIN`
- `IUserCharityPreferencesRegistryForCplTCOIN`

## Operational Notes

- Routers, pool seeders, and any other minting actors must be explicitly added as writers after deployment.
- `feeExempt` remains the operational mechanism for exempting routers, treasury contracts, adapters, or migration tooling.
- `supportsInterface()` is unchanged and should not be treated as a full description of merchant-transfer semantics.
- Registry-pointer sealing is intentionally deferred; treat `poolRegistry` and `charityPreferencesRegistry` updates as privileged launch-stage operations.
- Future TorontoCoin deployments should instantiate this token at `6` decimals, not `18`, because the inherited Sarafu math has a smallest-unit ceiling near `2^63 - 1`. At `6` decimals that ceiling is operationally safe; at `18` decimals it is not.
