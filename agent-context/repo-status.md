| Requirement | Status |
| --- | --- |
| Repo shape | `Pass` - Mixed multi-frontend Next.js repo with wallet, sparechange, contracts, Supabase functions, and on-chain services. |
| README quality | `Pass` - Updated to match the real scripts, env profile model, CI/database delivery flow, and current Supabase runtime boundary. |
| Licence | `Pass` - `LICENSE` now contains the MIT licence text referenced by the README. |
| Session log discipline | `Pass` - `agent-context/session-log.md` is active, append-only, and current through `v1.229`. |
| AGENTS alignment | `Pass` - Updated to reflect Next.js 14.2.x, Node 20 CI, the actual lint/CI contract, the deployed Next.js service-role boundary, and the stricter multi-frontend Supabase boundary expectation. |
| Docs placement and current-state accuracy | `Partial` - Engineering docs are consolidated under `docs/engineering/`, and the top-level runtime/CI contract is now aligned; deeper architecture docs may still need future consolidation. |
| Cubid architecture coverage | `Partial` - Cubid remains materially used in wallet/sparechange code, but there is no single dedicated current-state Cubid architecture doc beyond focused notes like `webauthn-passkey-storage.md`. |
| Testing strategy | `Partial` - Unit/integration test coverage is real and active via Vitest, but there is no checked-in local end-to-end acceptance harness or explicit coverage-governance setup. |
| Local acceptance harness | `Missing` - No repo-owned Playwright/Cypress e2e harness or equivalent scripted smoke path was found. |
| CI coverage | `Pass` - Frontend CI, secret scanning, and Supabase migration validation/deploy workflows are present, meaningful, and now reflected in README/AGENTS/technical spec. |
| Supabase direct-access rule | `Partial` - The stricter multi-frontend boundary expectation is now documented, but some app/shared compatibility paths still use direct table access. Related open item: `P1 Reduce production service-role dependency` in `agent-context/todo.md`. |
| Environment and script conventions | `Pass` - Local/remote Supabase profile scripts are in place and now reflected in the canonical README and AGENTS guidance. |
| Git and artefact hygiene | `Pass` - Common build artefacts and `.DS_Store` are ignored, and the stray local `.DS_Store` files found during cleanup were removed from the checkout. |
