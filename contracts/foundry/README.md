# Foundry Workspace

This folder contains the Solidity workspace for this repository.

## Layout

```text
contracts/foundry/
├── src/
│   ├── errors/        # Custom errors
│   ├── interfaces/    # Protocol and contract interfaces
│   ├── libraries/     # Reusable pure/view library code
│   ├── mocks/         # Test doubles and mock contracts
│   └── types/         # Struct/enums/value types shared across contracts
├── test/
│   ├── unit/          # Fast isolated tests
│   ├── integration/   # Multi-contract and external dependency tests
│   ├── invariant/     # Invariant/property tests
│   └── helpers/       # Test utilities, fixtures, harnesses
├── script/            # Forge scripts (deploy, admin, migrations)
├── deploy-config.json # Checked-in public chain + protocol address config
├── deployments/       # Chain-specific deployment artifacts
├── lib/               # Dependencies (forge install)
└── foundry.toml
```

## Conventions

- Keep production contracts in `src/` and group by responsibility.
- Keep script logic deterministic and idempotent.
- Do not commit secrets; copy `.env.example` to `.env.local` or `.env` locally.
- Keep public chain and protocol addresses in `deploy-config.json`, not in env files.
- Treat `deployments/` as generated output from deployment scripts. Do not treat locally generated manifests as canonical chain state.

## Common Commands

```bash
forge build
forge test
forge fmt
forge snapshot
```

## Registry Scripts

```bash
# Public addresses come from deploy-config.json.
# Pass DEPLOY_TARGET_CHAIN as a runtime override when you want something other than the config default.

# Deploy registry on Celo mainnet (requires PRIVATE_KEY and a configured registry.initialOwner)
forge script script/deploy/DeployCityImplementationRegistry.s.sol:DeployCityImplementationRegistry --rpc-url celo-mainnet --broadcast

# Promote city version from the deployment file configured in deploy-config.json
forge script script/deploy/PromoteCityVersion.s.sol:PromoteCityVersion --rpc-url celo-mainnet --broadcast
```

## TorontoCoin Suite Profiles

The default TorontoCoin deployment target remains `celo-mainnet`, but the workspace now also ships two explicit limited smoke-test profiles:

- `ethereum-sepolia` for non-Mento retail routing smoke tests using a deployable test reserve token and the direct-only swap adapter.
- `celo-sepolia` for limited Mento-path validation without assuming a Transak-style on-ramp. The checked-in profile defaults Scenario B to preview-only because funded test input is not guaranteed.
- `celo-mainnet` for the real production posture, including the `USDC -> USDm -> CADm -> cplTCOIN` path.

Static public input comes from [deploy-config.json](/Users/botmaster/src/greenpill-TO/Genero/contracts/foundry/deploy-config.json):

- chain metadata
- public Celo/Mento addresses
- token metadata
- treasury/router policy defaults
- bootstrap charity, steward, pool, and merchant metadata

For TorontoCoin, newly deployed internal protocol tokens now default to `6` decimals:

- `mrTCOIN`
- `cplTCOIN`

That default is intentional. It avoids the practical single-account limit in the legacy Sarafu math used by `GeneroTokenV3` without changing reserve-side oracle precision or external reserve-token metadata.

The current TorontoCoin refactor now targets real Sarafu pool runtime:

- `SwapPool` is the canonical pool engine
- `SarafuSwapPoolAdapter` is the thin router-facing adapter
- `PoolRegistry` carries pool identity plus the real Sarafu pool address
- `ManagedPoolAdapter` is no longer the intended production pool backend

Generated runtime output is written under the selected target path:

- `contracts/foundry/deployments/torontocoin/<target>/suite.json`
- `contracts/foundry/deployments/torontocoin/<target>/wiring.json`
- `contracts/foundry/deployments/torontocoin/<target>/validation.json`
- `contracts/foundry/deployments/torontocoin/<target>/scenario-b-run.json`

Optional role overrides such as `vaultOwner`, `tokenAdmin`, `operationalIndexer`, and bootstrap wallet/account fields may be omitted from the config. When omitted, the deploy script uses the broadcasting deployer for that role.

### Main Suite Deployment

```bash
DEPLOY_TARGET_CHAIN=ethereum-sepolia forge script script/deploy/DeployTorontoCoinSuite.s.sol:DeployTorontoCoinSuite --rpc-url ethereum-sepolia --broadcast

DEPLOY_TARGET_CHAIN=celo-sepolia forge script script/deploy/DeployTorontoCoinSuite.s.sol:DeployTorontoCoinSuite --rpc-url celo-sepolia --broadcast

forge script script/deploy/DeployTorontoCoinSuite.s.sol:DeployTorontoCoinSuite --rpc-url celo-mainnet --broadcast
```

This script deploys and wires:

- `ReserveRegistry` proxy
- `PoolRegistry`
- `Treasury`
- `CharityRegistry`
- `StewardRegistry` proxy
- `UserCharityPreferencesRegistry`
- `UserAcceptancePreferencesRegistry`
- `OracleRouter`
- `StaticCadOracle`
- `mrTCOIN`
- `cplTCOIN`
- `TreasuryController` proxy
- `TokenUniqueSymbolIndex`
- `Limiter`
- `PriceIndexQuoter`
- bootstrap `SwapPool`
- `SarafuSwapPoolAdapter`
- `MentoBrokerSwapAdapter`
- `ReserveInputRouter`
- `LiquidityRouter`
- `GovernanceExecutionHelper`
- `GovernanceProposalHelper`
- `GovernanceRouterProposalHelper`
- `Governance`

Profile-specific behaviour:

- `ethereum-sepolia` deploys `DirectOnlySwapAdapter` and a mintable `sCAD` reserve token so `LiquidityRouter` can be smoke-tested without Mento.
- `celo-sepolia` deploys `MentoBrokerSwapAdapter`, seeds `USDm -> CADm` plus `USDC -> USDm -> CADm`, and expects an already funded on-chain input token rather than a fiat on-ramp.
- `celo-mainnet` uses the real Celo/Mento production config and the split Scenario A / Scenario B validation model.

The deploy order also bootstraps:

- `CADm` as an active reserve asset
- one charity and default-steward linkage
- one pool and one bootstrap merchant
- Sarafu token registration, pool limits, and quoter wiring for TCOIN
- default Mento routes for `USDm -> CADm` and `USDC -> USDm -> CADm`
- `ReserveInputRouter` input-token enablement
- `LiquidityRouter` charity-topup parameters
- initial `cplTCOIN` liquidity deposited into the real Sarafu pool

### Post-Deploy Validation

```bash
DEPLOY_TARGET_CHAIN=ethereum-sepolia forge script script/deploy/ValidateTorontoCoinDeployment.s.sol:ValidateTorontoCoinDeployment --rpc-url ethereum-sepolia

DEPLOY_TARGET_CHAIN=celo-sepolia forge script script/deploy/ValidateTorontoCoinDeployment.s.sol:ValidateTorontoCoinDeployment --rpc-url celo-sepolia

forge script script/deploy/ValidateTorontoCoinDeployment.s.sol:ValidateTorontoCoinDeployment --rpc-url celo-mainnet
```

The validator checks:

- all core addresses are nonzero
- treasury/controller/router/pool-adapter wiring
- governance pointers and helper pointers
- token writer roles
- treasury authorized caller posture
- reserve activation
- bootstrap Sarafu pool readiness
- configured Mento `USDC -> USDm -> CADm` route presence

### Six-Decimal Migration Tooling

For the already-deployed Celo mainnet TorontoCoin stack, the workspace now also ships a targeted staged migration flow:

```bash
forge script script/deploy/StageTorontoCoinSixDecimalMigration.s.sol:StageTorontoCoinSixDecimalMigration --rpc-url celo-mainnet --broadcast

forge script script/deploy/ProposeTorontoCoinSixDecimalMigration.s.sol:ProposeTorontoCoinSixDecimalMigration --rpc-url celo-mainnet --broadcast

forge script script/deploy/FinalizeTorontoCoinSixDecimalMigration.s.sol:FinalizeTorontoCoinSixDecimalMigration --rpc-url celo-mainnet

forge script script/deploy/AbortTorontoCoinSixDecimalMigration.s.sol:AbortTorontoCoinSixDecimalMigration --rpc-url celo-mainnet --broadcast
```

Those scripts:

- stage fresh `6`-decimal `mrTCOIN` and `cplTCOIN` deployments
- stage a fresh `ManagedPoolAdapter`
- record the staged addresses in `contracts/foundry/deployments/torontocoin/celo-mainnet/six-decimal-migration.json`
- propose controller/router rewiring through governance
- either finalize the cutover or cancel the proposals cleanly

Important live result:

- the first real mainnet run proved that the current live `TreasuryController` and retail-routing path still scale internal token amounts as if `mrTCOIN` and `cplTCOIN` were `18` decimals
- because of that, a pure token-address swap to `6`-decimal deployments fails pool-liquidity checks before cutover
- proposals `17`, `18`, and `19` from the first staged migration were cancelled, and the live TorontoCoin mainnet pointers remain unchanged

So the checked-in `6`-decimal default is safe for fresh deployments, but a real live migration still requires code-level amount-scaling fixes before `FinalizeTorontoCoinSixDecimalMigration.s.sol` can succeed on mainnet.

### Scenario A

Scenario A is an operational runbook, not a protocol deploy step:

- [RecordOnRampScenarioA.md](/Users/botmaster/src/greenpill-TO/Genero/contracts/foundry/script/deploy/RecordOnRampScenarioA.md)

Its purpose is to verify that a user can complete the fiat on-ramp and receive spendable Celo USDC in the same wallet that will later call `LiquidityRouter`.

### Scenario B

```bash
DEPLOY_TARGET_CHAIN=ethereum-sepolia forge script script/deploy/RunTorontoCoinScenarioB.s.sol:RunTorontoCoinScenarioB --rpc-url ethereum-sepolia --broadcast

DEPLOY_TARGET_CHAIN=celo-sepolia forge script script/deploy/RunTorontoCoinScenarioB.s.sol:RunTorontoCoinScenarioB --rpc-url celo-sepolia --broadcast

forge script script/deploy/RunTorontoCoinScenarioB.s.sol:RunTorontoCoinScenarioB --rpc-url celo-mainnet --broadcast
```

This script uses a funded wallet to:

- preview `USDC -> USDm -> CADm -> mrTCOIN -> SwapPool -> cplTCOIN`
- approve `LiquidityRouter`
- execute `buyCplTcoin(...)`
- record the resulting pool choice and `cplTCOIN` balance delta

By default it uses `SCENARIO_B_PRIVATE_KEY` when present, otherwise it falls back to `PRIVATE_KEY`.

For limited profiles:

- `ethereum-sepolia` uses the deployer-funded test reserve token directly, so Scenario B executes end to end without Mento.
- `celo-sepolia` defaults `executeBuy` to `false` in the checked-in config. Change that only after funding the scenario wallet with a supported test token and enough CELO gas.

## Chain Selection

The deploy/admin scripts validate `DEPLOY_TARGET_CHAIN` against the connected chain ID. The checked-in profiles are:

- `ethereum-sepolia` => chain ID `11155111`, RPC alias `ethereum-sepolia`, explorer key env `ETHERSCAN_API_KEY`
- `celo-sepolia` => chain ID `11142220`, RPC alias `celo-sepolia`, explorer key env `CELOSCAN_API_KEY`
- `celo-mainnet` => chain ID `42220`, RPC alias `celo-mainnet`, explorer key env `CELOSCAN_API_KEY`

## Public Deploy Config

The checked-in [deploy-config.json](/Users/botmaster/src/greenpill-TO/Genero/contracts/foundry/deploy-config.json) is the source of truth for:

- chain IDs and RPC/explorer env names
- TorontoCoin token, treasury, router, and governance defaults
- public Celo/Mento addresses and route metadata
- bootstrap seed metadata for charities, stewards, pools, and merchants

Only secrets stay in `.env.example`:

- `SEPOLIA_RPC_URL`
- `CELO_SEPOLIA_RPC_URL`
- `CELO_MAINNET_RPC_URL`
- `PRIVATE_KEY`
- `SCENARIO_B_PRIVATE_KEY`
- `ETHERSCAN_API_KEY`
- `CELOSCAN_API_KEY`

## Mento Exchange Discovery

To discover the configured route exchange ID for a Mento-enabled chain profile, use:

```bash
DEPLOY_TARGET_CHAIN=celo-sepolia forge script script/helpers/DiscoverMentoExchangeIds.s.sol:DiscoverMentoExchangeIds --rpc-url celo-sepolia

forge script script/helpers/DiscoverMentoExchangeIds.s.sol:DiscoverMentoExchangeIds --rpc-url celo-mainnet
```

The script queries `Broker.getExchangeProviders()` and then `provider.getExchanges()` to print matching exchange IDs from live chain state.

For Celo mainnet, the checked-in config currently records:

- `USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- `USDm = 0x765DE816845861e75A25fCA122bb6898B8B1282a`
- `CADm = 0xff4Ab19391af240c311c54200a492233052B6325`
- `USDC -> USDm exchangeId = 0xacc988382b66ee5456086643dcfd9a5ca43dd8f428f6ef22503d8b8013bcffd7`
- `USDm -> CADm exchangeId = 0x517ccc3bcab9f35e2e24143a0c1809068efc649f740846cfb6a1c5703735c1ee`

The current adapter deploy path now seeds both:

- direct `USDm -> CADm`
- atomic `USDC -> USDm -> CADm`
