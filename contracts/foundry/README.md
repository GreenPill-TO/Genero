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
- Treat `deployments/` as generated output from deployment scripts.

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

# Set DEPLOY_TARGET_CHAIN to either celo or sepolia before broadcasting.

# Deploy registry on Celo mainnet (requires PRIVATE_KEY and a configured registry.initialOwner)
DEPLOY_TARGET_CHAIN=celo forge script script/deploy/DeployCityImplementationRegistry.s.sol:DeployCityImplementationRegistry --rpc-url celo --broadcast

# Deploy registry on Sepolia
DEPLOY_TARGET_CHAIN=sepolia forge script script/deploy/DeployCityImplementationRegistry.s.sol:DeployCityImplementationRegistry --rpc-url sepolia --broadcast

# Promote city version from the deployment file configured in deploy-config.json
DEPLOY_TARGET_CHAIN=celo forge script script/deploy/PromoteCityVersion.s.sol:PromoteCityVersion --rpc-url celo --broadcast

# Deploy the TorontoCoin liquidity-routing stack from the configured public addresses
DEPLOY_TARGET_CHAIN=celo forge script script/deploy/DeployLiquidityRoutingStack.s.sol:DeployLiquidityRoutingStack --rpc-url celo --broadcast
```

The deploy/admin scripts now validate `DEPLOY_TARGET_CHAIN` against the connected chain ID:

- `celo` => chain ID `42220`, RPC alias `celo`, explorer key env `CELOSCAN_API_KEY`
- `sepolia` => chain ID `11155111`, RPC alias `sepolia`, explorer key env `ETHERSCAN_API_KEY`

## Public Deploy Config

The checked-in [deploy-config.json](/Users/botmaster/src/greenpill-TO/Genero/contracts/foundry/deploy-config.json) is the source of truth for:

- chain IDs and RPC/explorer env names
- public registry addresses
- public TorontoCoin dependency addresses
- public Mento addresses and recommended route metadata

Only secrets stay in `.env.example`:

- `MAINNET_RPC_URL`
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY`
- `CELOSCAN_API_KEY`

## Mento Exchange Discovery

To discover the configured route exchange ID for the active chain in `deploy-config.json`, use:

```bash
DEPLOY_TARGET_CHAIN=celo forge script script/helpers/DiscoverMentoExchangeIds.s.sol:DiscoverMentoExchangeIds --rpc-url celo
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
