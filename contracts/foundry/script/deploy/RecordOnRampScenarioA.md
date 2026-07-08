# Scenario A: On-Ramp Readiness

This runbook validates the first half of the retail acquisition journey on Celo mainnet:

1. user completes a Transak purchase into a Celo wallet
2. user receives Celo-native USDC in that wallet
3. the same wallet can later call `LiquidityRouter`

## Inputs

- chain: `celo-mainnet`
- token expected: Celo USDC at `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
- wallet: the wallet that will later be used for Scenario B

## Evidence To Record

- wallet address used
- timestamp of the balance check
- on-ramp transaction hash or explorer link
- post-on-ramp USDC balance
- confirmation that the token contract matches the Celo USDC address in `deploy-config.json`

## Verification Commands

Example `cast` commands:

```bash
cast balance <WALLET> --erc20 0xcebA9300f2b948710d2653dD7B07f33A8B32118C --rpc-url celo-mainnet
cast call 0xcebA9300f2b948710d2653dD7B07f33A8B32118C "symbol()(string)" --rpc-url celo-mainnet
cast call 0xcebA9300f2b948710d2653dD7B07f33A8B32118C "decimals()(uint8)" --rpc-url celo-mainnet
```

## Acceptance

Scenario A passes when:

- the wallet holds nonzero Celo USDC
- the token address is the expected Celo USDC contract
- the operator records wallet, timestamp, and transaction reference for handoff into Scenario B
