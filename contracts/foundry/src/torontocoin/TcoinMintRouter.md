# TcoinMintRouter

## Purpose
`TcoinMintRouter` provides a single user-facing mint action that hides the reserve asset hop:
- Product abstraction: `USDC -> TCOIN`
- On-chain path: `tokenIn -> CADm -> TreasuryController.depositAndMint(...) -> TCOIN`

For `cplTCOIN` acquisition, this router is no longer the primary normalization path.
`ReserveInputRouter` now handles reserve-input normalization for `LiquidityRouter`, while `TcoinMintRouter` remains the older mrTCOIN/TCOIN mint abstraction.

Reserve custody does not end in `TreasuryController`.
The router approves the vault address returned by `ITreasuryMinting(treasury).treasury()`, and the controller entrypoint causes the dedicated `Treasury` vault to receive the reserve asset.

This removes multi-step wallet UX where users would otherwise execute separate swaps and minting interactions.

## Dependencies and Trust Boundaries
The router depends on three external surfaces:
1. `ISwapAdapter` (`swapAdapter`) for input token to CADm conversion.
2. `ITreasuryMinting` (`treasury`) for reserve-backed TCOIN minting.
3. ERC20 tokens (`tokenIn`, `CADm`, `TCOIN`) for transfers and approvals.

The recommended concrete adapter is now `MentoBrokerSwapAdapter`, which supports admin-set default Mento routes and optional per-call route overrides through `swapData`.

Trust model:
- Router is the orchestration boundary.
- Swap routing quality/liquidity is delegated to the adapter.
- Pricing and issuance rules remain in treasury/oracle/registry stack.

## Function Behavior
### `mintTcoinWithToken(...)`
Main entrypoint for any enabled input token.

Flow:
1. Validate deadline, amount, recipient, and token enablement.
2. Pull `tokenIn` from caller.
3. Swap `tokenIn -> CADm` using adapter (or direct CADm pass-through if `tokenIn == CADm`).
4. Enforce `minCadmOut` using CADm balance delta.
5. Call treasury `depositAndMint(cadmAssetId, cadmOut, requestedCharityId, minTcoinOut)`.
6. Enforce `minTcoinOut` using TCOIN balance delta.
7. Transfer minted TCOIN to recipient.
8. Refund any per-call leftover `tokenIn` and `CADm`.

Implementation note:
- the router should approve the `Treasury` vault returned by `ITreasuryMinting(treasury).treasury()`
- reserve custody ends in the vault, not the controller
- `TreasuryController` remains the issuance-policy layer and preview/mint authority

### `mintTcoinWithUSDC(...)`
Convenience wrapper that forwards to `mintTcoinWithToken` with `tokenIn = usdcToken`.

### `previewMintTcoinWithToken(...)`
Read-only estimate path:
1. Calls adapter preview for `tokenIn -> CADm`.
2. Calls treasury preview for `CADm -> TCOIN`.

Returns `(cadmOut, tcoinOut)` for off-chain quote assembly.

## Slippage, Deadline, and Refund Semantics
- `deadline`: transaction reverts if expired.
- `minCadmOut`: enforced by router against observed CADm balance increase.
- `minTcoinOut`: enforced by router against observed TCOIN balance increase.
- Refunds: any per-call leftover `tokenIn` or `CADm` is sent back to caller.

## Invariants
1. No partial completion: failures in swap or mint revert atomically.
2. Router does not retain per-call leftovers for successful paths.
3. Output checks are balance-delta based to reduce reliance on untrusted adapter return values.
4. Treasury remains canonical issuance authority; router does not mint directly.
5. Reserve ERC20 balances are not held on the controller; they end each successful call in the `Treasury` vault.

## Threat Model and Mitigations
1. Adapter over-reporting output:
- Mitigated by CADm balance-delta check.

2. Adapter callback/reentrancy attempt:
- Mitigated by `ReentrancyGuard` on mint entrypoints.

3. Misconfiguration risk:
- Mitigated by owner-only config setters and config-change events.

4. Swap liquidity/price instability:
- Mitigated by on-chain min-output guards and off-chain quoting.

## Operational Controls
Owner-managed configuration:
- `setSwapAdapter`
- `setTreasury`
- `setCadmConfig`
- `setInputTokenEnabled`
- `setUsdcToken`
- `pause` / `unpause`

## Integration Notes (Wallet/Backend)
1. Backend/UI should quote using:
- `previewSwapToCadm`
- `previewMint`

2. UI should always submit conservative:
- `minCadmOut`
- `minTcoinOut`
- `deadline`

3. Permit support is intentionally deferred in v1; approval handling remains in wallet flow.
