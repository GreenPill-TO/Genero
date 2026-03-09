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
# Deploy registry (requires PRIVATE_KEY and INITIAL_OWNER)
forge script script/deploy/DeployCityImplementationRegistry.s.sol:DeployCityImplementationRegistry --rpc-url "$FLOW_EVM_TESTNET_RPC_URL" --broadcast

# Promote city version from deployment JSON (requires PRIVATE_KEY, REGISTRY_ADDRESS, DEPLOYMENT_FILE)
forge script script/deploy/PromoteCityVersion.s.sol:PromoteCityVersion --rpc-url "$FLOW_EVM_TESTNET_RPC_URL" --broadcast
```
