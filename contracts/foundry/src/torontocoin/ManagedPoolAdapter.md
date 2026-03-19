# ManagedPoolAdapter

## Purpose

`ManagedPoolAdapter` is the deployable pool-execution module used by `LiquidityRouter`.

It provides the concrete pool surface that the router needs in production:

- track a canonical settlement account per pool
- read current pool-side mrTCOIN and `cplTCOIN` liquidity
- quote `mrTCOIN -> cplTCOIN` execution using a simple `quoteBps` model
- execute the pool buy by moving mrTCOIN into the configured pool account and `cplTCOIN` out to the buyer
- resolve merchant-to-pool matching for acceptance-preference checks

`PoolRegistry` remains the source of truth for whether a pool and merchant are active. `ManagedPoolAdapter` owns execution configuration, not registry identity.

## Design Boundary

This contract should not:

- hold reserve assets
- price reserve deposits
- decide which pool a user should use
- own treasury policy logic
- duplicate merchant or pool identity data already stored in `PoolRegistry`

Its role is execution and liquidity accounting for `cplTCOIN` pool inventory.

## Managed Inventory Model

For managed pools, the adapter deploys one `ManagedPoolInventory` contract per pool via `createPoolAccount(...)`.

That inventory contract:

- only allows the adapter to move tokens out
- holds the pool’s `cplTCOIN` sell-side inventory
- receives mrTCOIN when a router purchase executes

This gives the deployer a canonical pool account address without requiring merchant wallets to pre-approve direct token pulls.

## Core Surface

### Admin / governance

- `setGovernance(address)`
- `setPoolRegistry(address)`
- `setPoolTokens(address mrTcoin_, address cplTcoin_)`
- `createPoolAccount(bytes32 poolId)`
- `setPoolAccount(bytes32 poolId, address poolAccount)`
- `setPoolQuoteBps(bytes32 poolId, uint256 quoteBps)`
- `setPoolExecutionEnabled(bytes32 poolId, bool enabled)`

### Router-facing reads

- `getPoolConfig(bytes32 poolId)`
- `getPoolLiquidityState(bytes32 poolId)`
- `previewBuyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn)`
- `poolMatchesAnyMerchantIds(bytes32 poolId, bytes32[] memory merchantIds)`
- `getPoolAccount(bytes32 poolId)`

### Router-facing execution

- `buyCplTcoinFromPool(bytes32 poolId, uint256 mrTcoinAmountIn, uint256 minCplTcoinOut, address recipient)`

## Current Quote Model

The adapter currently uses a simple basis-points quote:

```text
cplTcoinOut = mrTcoinAmountIn * quoteBps / 10_000
```

Execution is bounded by the available `cplTCOIN` balance in the pool account.

This is intentionally simple for the current phase. More advanced pricing can be added later without changing the router’s higher-level responsibility split.

## Merchant Matching

`poolMatchesAnyMerchantIds(...)` does not maintain its own merchant table.

Instead it:

- queries `PoolRegistry.getMerchant(...)`
- checks that the merchant is active
- confirms the merchant’s `poolId` matches the candidate pool

That keeps merchant identity canonical in `PoolRegistry` while still letting `LiquidityRouter` enforce denied and accepted merchant preferences.

## Deployment Posture

The intended production posture is:

- `Governance` owns `ManagedPoolAdapter`
- `Governance` is also configured as the adapter’s `governance` address
- `LiquidityRouter` points to `ManagedPoolAdapter` as its canonical `poolAdapter`

Bootstrap deploy scripts should:

- create at least one managed pool account
- set quote bps
- enable execution
- seed the pool account with `cplTCOIN`
