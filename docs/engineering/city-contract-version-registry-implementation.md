# City Contract Version Registry + Promotion Workflow

## Summary
This implementation adds an on-chain registry for city contract bundles, a Foundry promotion workflow, and app-side runtime lookup so transaction hooks use registry-resolved chain/address config instead of hardcoded values.

The first city implementation is `tcoin` (Toronto). The bootstrap registry chain is Flow EVM testnet (`chainId: 545`).

## What Was Implemented

### 1) Solidity Registry
- Added `CityImplementationRegistry` at `contracts/foundry/src/registry/CityImplementationRegistry.sol`.
- Stores city version history plus active version pointers:
  - `currentVersionByCity`
  - `latestVersionByCity`
  - `versions[cityId][version]`
- Uses fixed contract bundle keys:
  - `tcoin`, `ttc`, `cad`, `orchestrator`, `voting`
- Exposes:
  - `registerVersion`
  - `promoteVersion`
  - `registerAndPromote`
  - `getCurrentVersion`
  - `getVersion`
  - `getActiveContracts`
- Validation rules implemented:
  - nonzero `chainId`
  - nonzero addresses for all required contract keys
  - promotion only for existing versions
- Ownership:
  - `Ownable` restricted writes (`onlyOwner`)
  - deploy script reads `registry.initialOwner` from the checked-in Foundry deploy config for multisig/admin ownership at deploy time
- Emits:
  - `VersionRegistered`
  - `VersionPromoted`

### 2) Foundry Deployment/Promotion Scripts
- Added `contracts/foundry/script/deploy/DeployCityImplementationRegistry.s.sol`
  - deploys registry with `registry.initialOwner` from `contracts/foundry/deploy-config.json`
  - writes deployment artifact to:
    - `contracts/foundry/deployments/registry/<chainId>/registry-deployment.json`
- Added `contracts/foundry/script/deploy/PromoteCityVersion.s.sol`
  - reads `registry.deploymentFile` plus `registry.registryAddress` from `contracts/foundry/deploy-config.json`
  - computes `cityId = keccak256(bytes(lowercase(citySlug)))`
  - validates fields and required addresses
  - executes `registerAndPromote`
  - writes promotion artifact to:
    - `contracts/foundry/deployments/registry/<chainId>/promotions/<timestamp>.json`
- Script runtime contract:
  - checked-in public values come from `contracts/foundry/deploy-config.json`
  - secrets come from local env (`DEPLOYER_KEY`, RPC URL, optional explorer key)

### 3) App Integration for Runtime Resolution
- Added shared registry modules:
  - `shared/lib/contracts/cityRegistryAbi.ts`
  - `shared/lib/contracts/cityRegistryClient.ts`
  - `shared/lib/contracts/cityContracts.ts`
- Added shared type:
  - `ActiveCityContracts`
- App lookup flow:
  - resolve city slug from env (`NEXT_PUBLIC_CITYCOIN`, default `tcoin`)
  - derive `cityId` from lowercase slug hash
  - call registry `getActiveContracts(cityId)`
  - use returned `chainId` and `contracts.TCOIN`
- Caching:
  - in-memory cache
  - localStorage cache
  - TTL: 60 seconds
- Bootstrap strategy implemented:
  - single code constant in `CITY_REGISTRY_BOOTSTRAP`
  - currently Flow EVM testnet RPC + placeholder address (must be updated after first deployment)

### 4) Hook Rewiring (No Hardcoded Token/RPC in Tx Paths)
- Updated `shared/hooks/useTokenBalance.ts`
  - token/RPC now resolved from registry at runtime
- Updated `shared/hooks/useSendMoney.tsx`
  - burn and transfer paths now resolve token/RPC from registry
  - added `resolveTokenRuntimeConfig()` helper

### 5) Foundry Dependency and Config Support
- Added OpenZeppelin libs under:
  - `contracts/foundry/lib/openzeppelin-contracts`
  - `contracts/foundry/lib/openzeppelin-contracts-upgradeable`
- Added remappings in `contracts/foundry/foundry.toml` for `@openzeppelin/...` imports.

## Testing and Verification

### Solidity
- Added `contracts/foundry/test/unit/CityImplementationRegistry.t.sol` covering:
  - first registration
  - zero-address rejection
  - promotion updates
  - rollback via re-promote old version
  - owner-only checks
  - event emission check
- `forge test` result:
  - 6 passed, 0 failed

### TypeScript/Frontend
- Added:
  - `shared/lib/contracts/cityContracts.test.ts`
  - `shared/hooks/useTokenBalance.test.tsx`
  - `shared/hooks/useSendMoney.test.ts`
- Tests validate:
  - registry decoding and cache behavior
  - balance hook uses registry-resolved token and chain
  - send hook runtime resolver returns registry-derived config
  - deterministic failure handling for registry lookup errors

## Deployment and Operations Runbook
1. Deploy registry:
   - update `contracts/foundry/deploy-config.json` for the target chain
   - pass `DEPLOY_TARGET_CHAIN=celo-mainnet`, `DEPLOY_TARGET_CHAIN=ethereum-sepolia`, or `DEPLOY_TARGET_CHAIN=celo-sepolia` at runtime
   - use the matching Foundry RPC alias with the repo-standard package manager: `pnpm forge:deploy:registry -- --rpc-url celo-mainnet`, `pnpm forge:deploy:registry -- --rpc-url ethereum-sepolia`, or `pnpm forge:deploy:registry -- --rpc-url celo-sepolia`
2. Update bootstrap constant with deployed registry address:
   - `shared/lib/contracts/cityRegistryClient.ts`
3. Promote initial `tcoin` version from deployment JSON:
   - `pnpm forge:promote:city -- --rpc-url celo-mainnet`, `pnpm forge:promote:city -- --rpc-url ethereum-sepolia`, or `pnpm forge:promote:city -- --rpc-url celo-sepolia`
4. For upgrades:
   - deploy new city contracts
   - produce deployment JSON artifact
   - run promotion script
5. For rollback:
   - call `promoteVersion(cityId, oldVersion)` as owner/multisig

## Known Follow-up
- Replace placeholder registry address in `CITY_REGISTRY_BOOTSTRAP` after first live registry deployment on the selected chain.
- Full repo `npm test` currently has unrelated existing Supabase-env failures outside this implementation area.
