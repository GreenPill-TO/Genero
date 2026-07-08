# MintableTestReserveToken

## Purpose

`MintableTestReserveToken` is a simple ownable ERC-20 used by the limited `ethereum-sepolia` TorontoCoin smoke profile.

It lets the deployment script mint a treasury-accepted reserve token directly to the scenario wallet so the retail half of the stack can be exercised without:

- Mento
- fiat on-ramp infrastructure
- external reserve-token dependencies

## Behaviour

- constructor sets name, symbol, decimals, and initial owner
- `mint(address,uint256)` is `onlyOwner`
- `decimals()` returns the configured token decimals

## Operational role

- Used only for non-production smoke profiles
- deployed by `DeployTorontoCoinSuite.s.sol` when the profile marks the reserve asset with `deployToken: true`
- paired with `StaticCadOracle` and the direct-only swap adapter so `LiquidityRouter` can still complete a reserve deposit and pool buy flow

## Scope

This contract is not intended to be a production reserve asset. It is a deterministic deploy-time helper for limited test profiles.
