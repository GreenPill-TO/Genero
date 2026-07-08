# MentoBrokerSwapAdapter

## Purpose

`MentoBrokerSwapAdapter` is the concrete `ISwapAdapter` implementation for Mento broker routes.

It gives the TorontoCoin stack one configurable on-chain adapter for:

- `ReserveInputRouter` normalizing unsupported retail inputs into `mCAD`
- legacy `TcoinMintRouter` flows that still mint reserve-backed `TCOIN`

The adapter is intentionally narrow. It does not select pools, mint protocol tokens, or price reserves.

## Current Role

The adapter sits between the router/helper layer and the Mento broker:

1. caller approves the adapter for `tokenIn`
2. adapter resolves a configured Mento route
3. adapter pulls `tokenIn`
4. adapter approves the Mento broker
5. broker executes `swapIn(...)`
6. adapter transfers resulting `mCAD` back to the caller

This keeps Mento-specific broker wiring out of both `LiquidityRouter` and `ReserveInputRouter`.

## Configuration Model

The adapter stores one default route per input token:

- `tokenIn`
- `exchangeProvider`
- `exchangeId`

It can also store one default multihop route per input token:

- `tokenIn`
- `intermediateToken`
- `firstExchangeProvider`
- `firstExchangeId`
- `secondExchangeProvider`
- `secondExchangeId`

Owner methods:

- `setBroker(address broker_)`
- `setDefaultRoute(address tokenIn, address exchangeProvider, bytes32 exchangeId)`
- `setDefaultMultiHopRoute(address tokenIn, address intermediateToken, address firstExchangeProvider, bytes32 firstExchangeId, address secondExchangeProvider, bytes32 secondExchangeId)`
- `clearDefaultRoute(address tokenIn)`

View helper:

- `getDefaultRoute(address tokenIn)`
- `getDefaultRouteConfig(address tokenIn)`

## Swap Semantics

### `swapToCadm(...)`

- validates deadline and amount
- resolves route from:
  - `swapData` override, if present
  - otherwise the stored default route for `tokenIn`
- pulls `tokenIn` from caller
- executes either:
  - one direct `tokenIn -> mCAD` broker swap, or
  - two chained broker swaps `tokenIn -> intermediateToken -> mCAD`
- transfers observed `mCAD` output back to caller

The adapter uses actual `mCAD` balance delta as the source of truth for output delivery.

### `previewSwapToCadm(...)`

- resolves the same route selection logic
- calls `broker.getAmountOut(...)`

This keeps preview and execution aligned.

## `swapData` Override

For compatibility with legacy mint-router and backend flows, `swapData` may optionally encode:

Single-hop override:

```solidity
abi.encode(address exchangeProvider, bytes32 exchangeId)
```

Multihop override:

```solidity
abi.encode(
    address firstExchangeProvider,
    bytes32 firstExchangeId,
    address intermediateToken,
    address secondExchangeProvider,
    bytes32 secondExchangeId
)
```

If `swapData` is empty, the default on-chain route for `tokenIn` is used.

This means:

- `ReserveInputRouter` can rely on static configured routes and pass empty bytes
- older flows such as `TcoinMintRouter` can still supply a per-call route override when needed

## Trust Boundary

The adapter trusts:

- configured Mento broker address
- configured exchange provider / exchange id pairs

It does not trust broker return values alone; final output is checked against actual `mCAD` balance delta before forwarding funds back to caller.

## Operational Notes

- `ReserveInputRouter` should be the only component engaging this adapter for retail `cplTCOIN` acquisition.
- `LiquidityRouter` should never embed broker logic directly.
- `TcoinMintRouter` may also point at this adapter for the older `TCOIN` mint flow.
- The current recommended Celo mainnet posture is:
  - direct `USDm -> CADm` route configured as the base Mento leg
  - atomic `USDC -> USDm -> CADm` multihop route configured for the retail on-ramp
- Deployment should set the broker plus at least one route, then enable the matching input token on the calling router/helper.
