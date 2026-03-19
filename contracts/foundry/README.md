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
├── deployments/       # Chain-specific deployment artifacts
├── lib/               # Dependencies (forge install)
└── foundry.toml
```

## Conventions

- Keep production contracts in `src/` and group by responsibility.
- Keep script logic deterministic and idempotent.
- Do not commit secrets; copy `.env.example` to `.env` locally.
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
# Set DEPLOY_TARGET_CHAIN to either celo or sepolia before broadcasting.

# Deploy registry on Celo mainnet (requires PRIVATE_KEY, INITIAL_OWNER, DEPLOY_TARGET_CHAIN=celo)
forge script script/deploy/DeployCityImplementationRegistry.s.sol:DeployCityImplementationRegistry --rpc-url celo --broadcast

# Deploy registry on Sepolia (requires PRIVATE_KEY, INITIAL_OWNER, DEPLOY_TARGET_CHAIN=sepolia)
forge script script/deploy/DeployCityImplementationRegistry.s.sol:DeployCityImplementationRegistry --rpc-url sepolia --broadcast

# Promote city version from deployment JSON on the selected chain
forge script script/deploy/PromoteCityVersion.s.sol:PromoteCityVersion --rpc-url celo --broadcast
```

The deploy/admin scripts now validate `DEPLOY_TARGET_CHAIN` against the connected chain ID:

- `celo` => chain ID `42220`, RPC alias `celo`, explorer key env `CELOSCAN_API_KEY`
- `sepolia` => chain ID `11155111`, RPC alias `sepolia`, explorer key env `ETHERSCAN_API_KEY`
