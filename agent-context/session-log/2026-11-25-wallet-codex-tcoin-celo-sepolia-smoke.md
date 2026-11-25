## 2026-11-25T21:32:49.000Z - Prepare isolated Celo Sepolia pay-link lane (#87)

- agent: Wriley #87 (Codex)
- branch: codex/tcoin-celo-sepolia-smoke
- head: d17ac498202435073499341dea601db8267744bc
- summary: Added the offline/source-only preparation lane for issue #87: a chain-locked, zero-seed Celo Sepolia pay-link deployment profile; actual GeneroTokenV3/Sarafu guards; a static reviewed-plan validator with source/config binding and exact 500/100-token calldata/readbacks; lazy fail-closed wallet runtime selection; shared balance/send/persistence/explorer targeting; bounded gas and RPC/signing-chain checks; explicit Preview Buy/voucher/indexer disablement; unchanged Edge pay-link URL handling tests; environment/spec/runbook updates; and a visible test-token warning. No hosted configuration, account creation, credential access, deployment, mint, funding, OTP, chain broadcast, payment, or GitHub mutation occurred.
- validation: `pnpm exec vitest run --maxWorkers=1 ...` (10 focused files, 79 tests passed); `pnpm exec tsc --noEmit --pretty false` passed; targeted ESLint passed with one pre-existing `useSendMoney.tsx` exhaustive-deps warning and no errors; `pnpm lint:edge-boundary` passed; targeted `forge fmt --check` passed; `PayLinkProfileGuard.t.sol` 4/4, `GeneroTokenV3.t.sol` 16/16, and `GeneroTokenV3SarafuCompatibility.t.sol` 1/1 passed offline with one thread; targeted deployment/validator `forge build --offline --threads 1` passed with existing unused-variable/import/cheatcode warnings.
- follow-ups: Independent risk/acceptance/full-scenario validation and normal PR/dev delivery remain. The issuer uses an operator-held encrypted Foundry keystore; payer and recipient must be created through the normal TCOIN/Cubid Preview wallet flow with app-managed passkeys/custody shares. Execution remains blocked on those two wallets, reviewed public role and contract addresses, bytecode/readback evidence, approved RPC/faucet source, separately bounded deployment and mint/payment native-gas budgets, authorised Preview runtime/Edge host configuration, and separate deployment/mint/funding/100-token payment approval. Do not treat source preparation as funded #87 or Goal #79 acceptance.

## 2026-11-25T21:47:39Z - Repair isolated Preview preparation guards (#87)

- agent: Wriley #87 (Codex)
- branch: codex/tcoin-celo-sepolia-smoke
- head: 32b76c88c92d60ee4ce12483402b5b1631c041eb
- summary: Restored the original full `celo-sepolia` profile unchanged and kept the pay-link profile additive; moved target/purpose/config validation ahead of signer access; strengthened post-deployment validation for live code, identity, ownership, zero supply, writer roles and empty Sarafu liquidity; required actual RPC/token bytecode-hash and metadata checks before balance reads or WebAuthn; bound the static post-deployment plan to four exact mint-authority calls plus the 100-token payment; disabled mainnet-shaped ops/stats/pool reads and fiat/voucher/merchant actions in Preview; added a visible no-real-value wallet warning; and included affected Edge bundles in the existing gated deployment workflow. No hosted configuration, deployment, mint, funding, chain transaction, credential access, or GitHub mutation occurred.
- validation: Focused Vitest run passed 17 files / 100 tests; TypeScript check passed; targeted ESLint and the app-facing Edge boundary guard passed; original `celo-sepolia` JSON object matched base commit `d17ac498202435073499341dea601db8267744bc`; JSON validation passed; `PayLinkProfileGuard.t.sol` passed 4/4, `GeneroTokenV3.t.sol` 16/16 and Sarafu compatibility 1/1; targeted deployment/validator Foundry build passed offline with existing warnings.
- follow-ups: Independent replacement-commit risk, acceptance and scenario validation remain. The public issuer receipt is held outside tracked source; payer/recipient app wallets, complete reviewed public roles/contracts, deployment artefact simulation and separate budgets/approvals remain required. The plan helper is static schema validation only and authorises neither deployment nor mint/payment execution.

## 2026-11-25T21:58:54Z - Require positive mainnet runtime admission (#87)

- agent: Wriley #87 (Codex)
- branch: codex/tcoin-celo-sepolia-smoke
- head: 2fbbed5b408bd979a7b9913f5781eddadac15563
- summary: Repaired the remaining fail-closed gap by requiring the explicit Production, `celo-mainnet`, `tcoin` tuple before TorontoCoin legacy pool clients, ops, stats, and indexer reads can use the checked-in mainnet runtime. Missing and unknown targets, staging/development app environments, and the Vercel production deployment context used by the development alias now stop before client, auth, database RPC, or chain RPC creation. The Edge runtime uses the same positive admission rule, while generic non-TCOIN indexer scopes remain unchanged.
- validation: Focused Vitest passed 19 files / 118 tests, including staging-unset, invalid-target, development-mainnet, development alias with `VERCEL_ENV=production`, explicit Production mainnet, Edge/Deno, route, stats, ops, pool, and indexer matrices. TypeScript, targeted ESLint, the app-facing Edge boundary guard, and diff checks passed.
- follow-ups: Independent validation and full scenario QA remain. This source-only guard repair does not configure a hosted environment, create payer/recipient wallets, access credentials, query or mutate chain state, or authorise deployment/mint/payment execution.

## 2026-11-25T22:11:44Z - Align release workflow with isolated Preview profile (#87)

- agent: Wriley #87 (Codex)
- branch: codex/tcoin-celo-sepolia-smoke
- head: 053a979d1ed50019c028781b6ca761658fbc12a2
- summary: Added an offline release-profile validator and forwarded the public runtime target/manifest into both TCOIN release-alignment jobs. Preview now requires a valid non-production Celo Sepolia pay-link manifest with Buy disabled, skips mainnet-only ops/pool commands, and records full pool/Buy acceptance as unavailable rather than passed. Production requires the explicit Production/mainnet profile and retains the full operational checks. Clarified the runbook sequence and separated source preparation, authorised account onboarding, and funded/hosted acceptance evidence.
- validation: Focused Vitest passed 4/4 release-profile and workflow-contract tests (13/13 with the shared runtime tests); TypeScript no-emit, targeted ESLint, workflow YAML parsing, production CLI profile validation, and diff checks passed. No network, Supabase runtime, browser, or chain validation was run for this source-only workflow repair.
- follow-ups: The workflow has not been executed against hosted Preview or Production configuration. Preview full pool and Buy acceptance remain intentionally unavailable; Production retains those gates. Independent review and post-push CI/workflow evidence remain required.

## 2026-11-25T22:16:25Z - Repair release-profile workflow outputs (#87)

- agent: Wriley #87 (Codex)
- branch: codex/tcoin-celo-sepolia-smoke
- head: 17cc2b4f404545a42d4c137bcdd3b3eea4c101c6
- summary: Made GitHub output serialization unambiguous by joining actual newline-delimited records, and added real CLI regression coverage for Production `true`, Preview `false`, and invalid-profile/no-output branches. Labelled the retained Preview wallet preflight as legacy chain `42220` shared health evidence rather than Celo Sepolia indexer, funding, or acceptance proof; the broader T893/D70 queue/worker gate remains unchanged.
- validation: Focused CLI/unit Vitest passed 6/6, including temporary `GITHUB_OUTPUT` files with exact physical-line assertions and invalid-profile failure; TypeScript no-emit and diff checks passed. No hosted workflow, network, Supabase runtime, browser, or chain operation ran.
- follow-ups: The repaired output dispatch still needs independent review and post-push GitHub Actions evidence. Celo Sepolia `11142220` indexer/funded acceptance remains unestablished and outside this source-only repair.

## 2026-11-25T21:52:30.429747+00:00 - Prepare PR version metadata

- agent: Codex Tcoin HBIC
- branch: codex/tcoin-celo-sepolia-smoke
- head: fce3f9cf21d3ef952735ac8060a63f802188b093
- summary: Prepared the repository-required dev PR version0.1.3 as a separate metadata checkpoint after the source and repair commits.
- validation: Version helper compared origin/dev baseline; diff is package/version metadata only. Source repair reported100 focused Vitest tests, TypeScript/lint and21 Foundry checks; independent replacement validation and full scenarios are next.
- follow-ups: No chain broadcasts or mint; issuer encrypted-keystore creation is user-completed, payer app setup is at its user-controlled passkey step. Exact public-role/contracts/code hashes and gas review remain.
