## v1.19
### Timestamp
- 2026-03-13 23:38:00 EDT

### Objective
- Add an explicit repository guardrail preventing agents from changing the linked Supabase database without human approval.

### What Changed
- Updated `AGENTS.md` to state that agents must never directly modify the linked Supabase database.
- Added a second explicit instruction requiring agents to stop and ask for human permission before any Supabase command that could change the linked database, including `supabase db push`, `supabase migration up`, `supabase db reset --linked`, `supabase link`, and other `supabase --linked` write operations.

### Files Edited
- `AGENTS.md`
- `agent-context/session-log.md`
- `agent-context/technical-spec.md`

## v1.18
### Timestamp
- 2026-03-13 23:33:00 EDT

### Objective
- Align `/admin` and `/city-manager` UI access with the same app-scoped API role checks, and diagnose the failing legacy ramp-request loader on `/admin`.

### What Changed
- Added a shared control-plane access API (`/api/control-plane/access`) that resolves the active app instance and checks `roles` for `admin`/`operator`.
- Updated wallet More-tab shortcuts so the City Admin and Admin Dashboard buttons only render when that API confirms access, instead of relying on the local `is_admin` profile flag.
- Updated `/admin` and `/city-manager` pages to wait for the same server-side access decision before loading protected data and to redirect back to `/dashboard` when the user lacks the required role.
- Moved `/admin` legacy ramp-request reads behind a new server route (`/api/admin/ramp-requests`) so the browser no longer queries protected legacy tables directly.
- Added explicit diagnostics for missing legacy ramp schema so admin users now see the actual missing table/column/relationship failure instead of the previous generic load error.
- Confirmed the repository migrations do not fully describe the legacy ramp-request schema currently queried by `/admin`:
- `interac_transfer` and `off_ramp_req` are only minimally defined in-repo, while the UI expects additional legacy columns.
- `ref_request_statuses` is referenced by the UI but is not created anywhere under `supabase/migrations/`.
- Added targeted Vitest coverage for More-tab access gating, admin access gating plus ramp-request loading, and direct city-manager redirect behavior.

### Files Edited
- `app/api/control-plane/access/route.ts`
- `app/api/admin/ramp-requests/route.ts`
- `shared/api/hooks/useControlPlaneAccess.ts`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/admin/page.test.tsx`
- `app/tcoin/wallet/city-manager/page.tsx`
- `app/tcoin/wallet/city-manager/page.test.tsx`
- `agent-context/session-log.md`
- `agent-context/technical-spec.md`
- `agent-context/functional-spec.md`

## v1.17
### Timestamp
- 2026-03-12 11:10:00 EDT

### Objective
- Implement the new one-transaction reserve mint router flow (`mintTcoinWithUSDC`) in the TorontoCoin contract suite, including interfaces, tests, and architecture/spec documentation.

### What Changed
- Added `TcoinMintRouter` with:
- generic input-token mint path (`mintTcoinWithToken`) and USDC convenience wrapper (`mintTcoinWithUSDC`),
- adapter + treasury wiring via dedicated interfaces,
- on-chain safety controls: deadline, token allowlist, slippage checks (`minCadmOut`, `minTcoinOut`), `Pausable`, and `ReentrancyGuard`,
- balance-delta enforcement for swap and mint outputs,
- refund handling for per-call residual `tokenIn`/`CADm`,
- owner-managed runtime configuration for adapter, treasury, CADm config, USDC token, and enabled input tokens.
- Added dedicated interfaces:
- `ISwapAdapter` for token-in -> CADm swap abstraction and previewing.
- `ITreasuryMinting` for treasury minting/preview calls used by the router.
- Added new Foundry unit tests and mocks covering:
- happy paths (USDC + generic token),
- deadline/amount/recipient/allowlist validation failures,
- slippage guard failures for swap and mint outputs,
- pausable/owner-only behavior,
- refund behavior,
- malicious adapter reported-output mismatch,
- adapter callback reentrancy attempt handling.
- Added contract-level and architecture documentation for the router design and rollout assumptions.
- Verified implementation with `forge build` and router-focused tests (`14 passed, 0 failed`).

### Files Edited
- `contracts/foundry/src/torontocoin/TcoinMintRouter.sol`
- `contracts/foundry/src/torontocoin/TcoinMintRouter.md`
- `contracts/foundry/src/torontocoin/interfaces/ISwapAdapter.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryMinting.sol`
- `contracts/foundry/test/unit/torontocoin/TcoinMintRouter.t.sol`
- `contracts/foundry/test/unit/torontocoin/mocks/MockERC20.sol`
- `contracts/foundry/test/unit/torontocoin/mocks/MockSwapAdapter.sol`
- `contracts/foundry/test/unit/torontocoin/mocks/MockTreasuryMinting.sol`
- `docs/mintTcoinWithUSDC-architecture.md`
- `agent-context/session-log.md`

## v1.16
### Timestamp
- 2026-03-12 03:25:00 EDT

### Objective
- Implement the TorontoCoin hardening + Sarafu-accurate integration pass: close outstanding torontocoin README items first, then align indexer/API/wallet behavior to the real Sarafu contract ABI semantics.

### What Changed
- Hardened and reconciled the new `torontocoin` contract suite to compile and test together under one shared interface model (`interfaces/*`).
- Enforced deadline-gated governance execution while preserving early approval semantics.
- Reconciled Charity/Steward coupling onto canonical `syncCharityAppointment(...)` flow and added treasury-required charity helper methods.
- Fixed OZ v4 compatibility and compile blockers across contracts/scripts/tests (Ownable initializer patterns, token transfer hooks, script stack-depth, legacy test removal).
- Replaced guessed Sarafu ABI usage with pinned semantics:
- quote path now prefers pool `getQuote(out,in,amount)` and falls back to quoter `valueFor(out,in,amount)`.
- execution path now uses pool `withdraw(out,in,amount)` (not `swap(...)`).
- limiter reads now use canonical `limitOf(token,pool)` for voucher credit limits.
- Updated voucher routing API/contracts integration:
- `/api/vouchers/route` now resolves TCOIN decimals and returns quote-derived `expectedVoucherOut`, `minVoucherOut`, `quoteSource`, and `feePpm`.
- fallback behavior is deterministic when quote paths are unavailable.
- Updated wallet send flow to honor ABI-accurate route metadata and prevent silent fallback when a swap succeeded but transfer/slippage failed; errors now surface explicitly with swap tx context.
- Extended indexer BIA diagnostics with explicit component mismatch counts (`componentMismatches`) for DB mapping vs on-chain pool tuple divergence.
- Updated architecture docs with ABI-accurate Sarafu routing/limit semantics and mismatch diagnostics.

### Files Edited
- `contracts/foundry/src/torontocoin/README.md`
- `contracts/foundry/src/torontocoin/GeneroToken.sol`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/CharityRegistry.sol`
- `contracts/foundry/src/torontocoin/StewardRegistry.sol`
- `contracts/foundry/src/torontocoin/PoolRegistry.sol`
- `contracts/foundry/src/torontocoin/ReserveRegistry.sol`
- `contracts/foundry/src/torontocoin/OracleRouter.sol`
- `contracts/foundry/src/torontocoin/TreasuryController.sol`
- `contracts/foundry/src/torontocoin/interfaces/ICharityRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IStewardRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IPoolRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IReserveRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IOracleRouter.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITCOINToken.sol`
- `contracts/foundry/src/torontocoin/interfaces/IGovernance.sol`
- `contracts/foundry/script/deploy/PromoteCityVersion.s.sol`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `contracts/foundry/test/unit/torontocoin/StewardSync.t.sol`
- `contracts/foundry/test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `contracts/foundry/test/unit/torontocoin-v2/VotingV2.t.sol`
- `services/indexer/src/discovery/abis.ts`
- `services/indexer/src/vouchers.ts`
- `services/indexer/src/normalize/persist.ts`
- `services/indexer/src/bia.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/types.ts`
- `shared/lib/sarafu/abis.ts`
- `shared/lib/sarafu/client.ts`
- `shared/lib/vouchers/types.ts`
- `shared/lib/vouchers/routing.ts`
- `shared/lib/vouchers/onchain.ts`
- `shared/hooks/useSendMoney.tsx`
- `shared/lib/indexer/types.ts`
- `app/api/vouchers/route/route.ts`
- `app/api/vouchers/route/route.test.ts`
- `app/api/vouchers/merchants/route.ts`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `docs/indexer-architecture.md`
- `docs/bia-pools-indexer-architecture.md`
- `agent-context/session-log.md`
## v1.15
### Timestamp
- 2026-03-11 19:33:00 EDT

### Objective
- Record the latest state after voucher-layer integration work and prepare a commit while explicitly excluding Sarafu read-only reference docs under `contracts/foundry/src/registry/sarafu-read-only`.

### What Changed
- Confirmed there are no new code changes pending after `v1.14`.
- Kept `contracts/foundry/src/registry/sarafu-read-only/` out of commit scope as requested.
- Added this log entry to document the exclusion and repository state.

### Files Edited
- `agent-context/session-log.md`

## v1.14
### Timestamp
- 2026-03-11 15:07:04 EDT

### Objective
- Implement Merchant Liquidity Layer (Doc 7) on top of the existing BIA/indexer architecture: add voucher data model and APIs, extend indexer for voucher/credit state, wire wallet/admin/merchant UX, and reflect that merchant credit limits/liquidity requirements are sourced from Sarafu on-chain contracts (read-only in Genero UI, no new Genero smart-contract logic).

### What Changed
- Added `v0.97` Supabase migration for voucher-layer entities and views:
- secondary BIA affiliations for users,
- voucher token catalog and wallet voucher balance snapshots,
- merchant credit/liquidity state mirror,
- voucher compatibility rules and user voucher preferences,
- voucher payment records,
- wallet total-value view including voucher 1:1 equivalent rollup.
- Added voucher API surface:
- `GET /api/vouchers/portfolio`,
- `GET /api/vouchers/merchants`,
- `GET /api/vouchers/route`,
- `GET|POST /api/vouchers/preferences`,
- `GET|POST /api/vouchers/compatibility`,
- `POST /api/vouchers/payment-record`.
- Extended BIA endpoints for hybrid affiliation model:
- `GET /api/bias/list` now returns secondary affiliations,
- `POST /api/bias/select` now supports `secondaryBiaIds[]`.
- Added shared voucher library (`shared/lib/vouchers`) with typed models, preference precedence, deterministic route resolution, valuation, and on-chain execution wrappers.
- Extended indexer voucher pipeline:
- classify voucher tokens from discovered pools excluding city core tokens,
- compute wallet voucher + TCOIN snapshots,
- derive merchant credit state and persist voucher summary metrics,
- extend indexer status summary/types with voucher dimensions.
- Updated wallet UX:
- total balance now supports voucher-equivalent portfolio display,
- merchant send flow can resolve voucher route, execute swap+transfer path, and deterministically fallback to TCOIN transfer,
- `More` tab includes secondary BIA selection and voucher preference controls,
- wallet home shows “Merchants in My Pool” data.
- Updated admin and merchant dashboards:
- voucher compatibility rule management in admin,
- merchant voucher liquidity panels in admin/merchant,
- explicit UI copy and source labels clarifying voucher issue limits and liquidity requirements are read from Sarafu on-chain contracts and shown read-only in Genero.
- Added/updated test coverage:
- voucher route API tests,
- indexer status tests for voucher summary payload,
- voucher preference precedence unit test.

### Files Edited
- `supabase/migrations/20260311130000_v0.97_merchant_liquidity_layer.sql`
- `app/api/vouchers/portfolio/route.ts`
- `app/api/vouchers/merchants/route.ts`
- `app/api/vouchers/route/route.ts`
- `app/api/vouchers/route/route.test.ts`
- `app/api/vouchers/preferences/route.ts`
- `app/api/vouchers/compatibility/route.ts`
- `app/api/vouchers/payment-record/route.ts`
- `app/api/bias/list/route.ts`
- `app/api/bias/select/route.ts`
- `shared/lib/vouchers/index.ts`
- `shared/lib/vouchers/onchain.ts`
- `shared/lib/vouchers/preferences.ts`
- `shared/lib/vouchers/preferences.test.ts`
- `shared/lib/vouchers/routing.ts`
- `shared/lib/vouchers/types.ts`
- `shared/lib/vouchers/valuation.ts`
- `shared/hooks/useVoucherPortfolio.ts`
- `shared/hooks/useSendMoney.tsx`
- `shared/lib/indexer/types.ts`
- `services/indexer/src/vouchers.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/state/runControl.ts`
- `services/indexer/src/types.ts`
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `app/api/indexer/status/route.test.ts`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-7-merchant-liquidity-layer.md`
- `agent-context/session-log.md`

## v1.13
### Timestamp
- 2026-03-11 01:43:49 EDT

### Objective
- Realign the Neighbourhood/BIA PRD and alignment docs to the locked v1 scope: off-chain BIA operations with Sarafu on-chain pools, permissive cross-pool user spend, manual merchant approval/settlement, and explicit future-phase labeling for deferred on-chain TCOIN pool features.

### What Changed
- Added explicit v1 implementation baseline sections across PRD documents 1, 2, 4, 5, and 6.
- Re-scoped PRD document 3 (`contract changes`) to a phased model:
- `Required in v1`: Sarafu pool compatibility + app/indexer-derived attribution model.
- `Optional / Future Phase`: TCOIN-native on-chain BIA registry, pool-tagged mint/redeem attribution, and on-chain pool governance controls.
- Updated wallet/merchant/governance requirements to codify:
- cross-pool permissive user payments city-wide,
- wallet discovery/filter requirement for "merchants in my pool",
- merchant redemption flow as request -> manual approval -> queued settlement.
- Updated data-model requirements to mark center-point geospatial as v1 baseline and polygon containment as optional future phase.
- Added a `Decision Lock (v1)` section to the BIA/indexer architecture doc reflecting all locked decisions and current operational limits.
- Added TorontoCoin alignment note clarifying P0/P1 contract fixes remain important but are not a hard release gate for BIA v1 (off-chain + Sarafu model).

### Files Edited
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-1-architecture.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-2-data-mode.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-3-contract-changes.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-4-wallet-us.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-5-merchants.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-6-governance.md`
- `docs/bia-pools-indexer-architecture.md`
- `docs/torontocoin-contracts-current-state.md`
- `agent-context/session-log.md`

## v1.12
### Timestamp
- 2026-03-10 23:54:38 EDT

### Objective
- Complete BIA/redeem/governance control-plane integration in wallet admin/merchant UI, fix dynamic API routing in local dev, add route integration tests, and validate local Supabase + API smoke paths.

### What Changed
- Extended wallet admin UI to call the new BIA/redeem/governance endpoints directly for BIA creation, pool mapping, BIA controls, redemption approve/settle actions, and governance feed visibility.
- Added a new merchant dashboard at `/merchant` for store profile/BIA assignment and redemption request workflows powered by `/api/stores*`, `/api/redemptions/*`, and `/api/governance/actions`.
- Added merchant navigation entry from wallet `More` tab.
- Fixed dynamic API route resolution by narrowing app rewrites to non-API paths, preventing the catch-all rewrite from swallowing `app/api` dynamic routes.
- Added route integration tests for:
- `POST /api/pools/buy`
- `/api/redemptions/*` (request, list validation, approve, settle)
- `GET /api/indexer/status` including `biaSummary`
- Hardened the `v0.91` share-credential migration to be backward compatible with legacy schemas by adding missing columns (`user_share_encrypted.created_at`, `wallet_keys.user_share_encrypted`) when absent.
- Added neighbourhood/BIA architecture and runbook documents under `/docs`.
- Re-ran local Supabase reset and dynamic API smoke checks; dynamic endpoints now resolve (method/auth responses instead of 404).

### Files Edited
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `next.config.js`
- `app/api/pools/buy/route.test.ts`
- `app/api/redemptions/routes.test.ts`
- `app/api/indexer/status/route.test.ts`
- `supabase/migrations/20260212150000_v0.91_user_share_credentials.sql`
- `docs/bia-pools-indexer-architecture.md`
- `docs/bia-pools-runbook.md`
- `agent-context/session-log.md`

## v1.11
### Timestamp
- 2026-03-10 21:39:19 EDT

### Objective
- Implement the Neighbourhood/BIA Pools + Indexer tandem release foundations across Supabase schema, backend APIs, indexer BIA attribution/health, and wallet buy/redeem integration points.

### What Changed
- Added the BIA/pool operational migration (`v0.96`) with BIA registry/mappings/affiliations, store profile and affiliation tables, purchase/redemption workflow tables, risk-control and governance audit tables, BIA rollup/risk indexer tables, and analytics views.
- Added shared BIA + Sarafu server modules for auth context, app/city resolution, role/store guards, pool routing, pool/token validation, and redemption risk checks.
- Added new API routes for BIA and operations workflows:
- `POST /api/bias/create`
- `GET|POST /api/bias/mappings`
- `GET|POST /api/bias/controls`
- `POST /api/stores`, `POST /api/stores/[id]/bia`, `POST /api/stores/risk`
- `POST /api/pools/buy`
- `POST /api/redemptions/request`, `GET /api/redemptions/list`, `POST /api/redemptions/[id]/approve`, `POST /api/redemptions/[id]/settle`
- `GET /api/governance/actions`
- Extended indexer service with BIA tandem logic:
- mapping validation sync (`valid/stale/mismatch`) against discovery outputs,
- per-range BIA rollup derivation from indexed raw events,
- BIA risk signal upserts (`pending_redemption`, `redemption_pressure`, `stress_level`),
- status summary expansion with `biaSummary` (active BIAs, mapped/unmapped pools, stale mappings, per-BIA activity).
- Extended shared/client-facing indexer response types to include BIA summary and BIA ingestion payloads.
- Wired wallet buy/redeem entry points to the new BIA APIs:
- Top-up confirmation now triggers `/api/pools/buy` to create BIA-attributed purchase requests.
- Off-ramp flow now creates `/api/redemptions/request` for store owners after burn/accounting operations.
- Applied app-instance scoping fixes to new store/BIA endpoints so role/store checks and inserts are isolated per app instance.
- Verified indexer unit tests still pass:
- `services/indexer/src/state/cooldown.test.ts`
- `services/indexer/src/discovery/pools.test.ts`
- `services/indexer/src/normalize/fingerprint.test.ts`

### Files Edited
- `supabase/migrations/20260311110000_v0.96_bia_pools.sql`
- `shared/lib/bia/apiAuth.ts`
- `shared/lib/bia/server.ts`
- `shared/lib/bia/types.ts`
- `shared/lib/bia/index.ts`
- `shared/lib/sarafu/abis.ts`
- `shared/lib/sarafu/client.ts`
- `shared/lib/sarafu/routing.ts`
- `shared/lib/sarafu/guards.ts`
- `shared/lib/sarafu/index.ts`
- `app/api/bias/list/route.ts`
- `app/api/bias/suggest/route.ts`
- `app/api/bias/select/route.ts`
- `app/api/bias/create/route.ts`
- `app/api/bias/mappings/route.ts`
- `app/api/bias/controls/route.ts`
- `app/api/stores/route.ts`
- `app/api/stores/[id]/bia/route.ts`
- `app/api/stores/risk/route.ts`
- `app/api/pools/buy/route.ts`
- `app/api/redemptions/request/route.ts`
- `app/api/redemptions/list/route.ts`
- `app/api/redemptions/[id]/approve/route.ts`
- `app/api/redemptions/[id]/settle/route.ts`
- `app/api/governance/actions/route.ts`
- `services/indexer/src/bia.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/state/runControl.ts`
- `services/indexer/src/types.ts`
- `shared/lib/indexer/types.ts`
- `app/tcoin/wallet/components/modals/TopUpModal.tsx`
- `app/tcoin/wallet/components/modals/OffRampModal.tsx`
- `agent-context/session-log.md`

## v0.92
- Hardened `v0.91` passkey migration by inferring `app_instance_id` from each user’s latest `app_user_profiles` row before falling back to wallet/tcoin, preserving legacy app context where possible.
- Added deterministic legacy credential backfill tokens plus a `credential_id NOT NULL` enforcement, deduplicated `user_encrypted_share` rows by `(wallet_key_id, app_instance_id, credential_id)`, and kept only the most recent record before the unique constraint is applied.
- Updated `useSendMoney` credential selection to support legacy cross-app share fallback when app-scoped lookups are empty and to fallback to the most recent share when a stored active credential no longer matches.
- Added unit tests for share selection logic covering active credential matching, fallback selection, app-scoped no-share errors, and candidate list normalisation.

## v0.91
- Added a reversible Supabase migration expanding `user_encrypted_share` with app/credential/device/audit metadata (`credential_id`, `app_instance_id`, `device_info`, `last_used_at`, `revoked_at`), plus backfills for credential IDs and the default Wallet app instance.
- Updated Wallet and SpareChange onboarding wallet callbacks to persist decoded credential IDs, resolved app instance IDs, and device metadata alongside encrypted user shares.
- Updated send-money key reconstruction to resolve encrypted shares by `wallet_key_id` + active credential/app context, falling back to most recent usage while exposing available credential candidates when no active match exists.
- Extended shared Supabase service helper tests for credential and device metadata serialisation utilities.

## v1.10
### Timestamp
- 2026-03-10 00:36:07 EDT

### Objective
- Finalize wallet UX/runtime fixes after local validation: resolve hydration and dark-mode behavior, unify footer behavior across public pages, fix contact form submission UX/backend compatibility, and ensure auth redirects land on `/dashboard`.

### What Changed
- Reworked wallet layout font loading to avoid SSR/CSR text mismatch and added an early theme bootstrap script so first paint honors saved/system dark mode.
- Updated dark-mode hook persistence semantics (`theme_user_set`) so system preference is used until the user explicitly toggles theme.
- Added footer theme toggle text link (`Dark Mode`/`Light Mode`), updated GitHub link to open in a new tab safely, and expanded footer tests.
- Updated contact page UX: submit loading/error states, deterministic feedback, aligned `Return Home` + `Send` row, and shared footer render.
- Hardened `/api/user_requests` insertion to attach `app_instance_id` when resolvable and gracefully proceed on older schemas without app-instance tables.
- Added migration to create/backfill `public.user_requests` for environments missing that table.
- Unified footer usage across `/contact`, `/resources`, and `/ecosystem`; updated ecosystem tests accordingly.
- Changed sign-in OTP success flow to immediately route new and existing users to `/dashboard` (removed delayed timeout behavior), with corresponding test updates.
- Updated home dark-mode background gradient to black top/bottom with darker center gray.

### Files Edited
- `app/tcoin/wallet/layout.tsx`
- `shared/hooks/useDarkMode.tsx`
- `app/tcoin/wallet/components/footer/Footer.tsx`
- `app/tcoin/wallet/components/footer/Footer.test.tsx`
- `app/tcoin/wallet/contact/page.tsx`
- `app/api/user_requests/route.ts`
- `supabase/migrations/20260309233800_create_user_requests_if_missing.sql`
- `app/tcoin/wallet/resources/page.tsx`
- `app/tcoin/wallet/ecosystem/page.tsx`
- `app/tcoin/wallet/ecosystem/page.test.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.test.tsx`
- `app/tcoin/wallet/page.tsx`
- `agent-context/session-log.md`

## v1.09
### Timestamp
- 2026-03-10 00:31:40 EDT

### Objective
- Recover from a wrong-project Supabase push by resetting the linked `GeneroDev` remote (`uyopiuwmlhbevoxmfvfx`) and making the migration chain runnable from a true empty database.

### What Changed
- Stopped a local Docker Postgres container that was occupying port `54322` and interfering with Supabase CLI workflows.
- Added an idempotent `cron_logs` baseline migration and fixed UUID default resolution for Supabase extension schema usage.
- Added a legacy bootstrap migration (`v0.66`) to create required pre-existing tables/types/seed records that later ALTER-based migrations assume.
- Removed embedded `-- migrate:down` sections from SQL migration files so Supabase applies forward-only SQL cleanly during `db reset`.
- Fixed `auth.uid()` type mismatch in app-user-profile RLS policies by casting to text where `users.auth_user_id` is compared.
- Successfully ran `supabase db reset --linked --yes` against `uyopiuwmlhbevoxmfvfx` through all migrations.
- Verified with `supabase db push --linked --yes` returning `Remote database is up to date.`

### Files Edited
- `supabase/migrations/20250718111419_remote_schema.sql`
- `supabase/migrations/20260114000000_v0.66_legacy_bootstrap.sql`
- `supabase/migrations/20260120093000_v0.67_app_user_profiles.sql`
- `supabase/migrations/20260125094500_v0.68_app_registry.sql`
- `supabase/migrations/20260130100000_v0.69_app_user_profiles_rls.sql`
- `supabase/migrations/20260201101500_v0.70_connections_profile_fks.sql`
- `supabase/migrations/20260211180453_v0.72_connections_profile_fks.sql`
- `supabase/migrations/20260212123000_v0.89_wallet_keys.sql`
- `agent-context/session-log.md`

## v1.08
### Timestamp
- 2026-03-09 22:47:55 EDT

### Objective
- Replace remaining hardcoded Supabase runtime parameters with environment variables, remove legacy Supabase local config artifacts, and document the updated env setup.

### What Changed
- Replaced `NEXT_PUBLIC_SUPABASE_ANON_KEY` usage with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` across browser, server, and middleware Supabase client initialization.
- Added shared Supabase asset env helpers and removed hardcoded Supabase storage URLs from wallet landing banners and wallet welcome funding video.
- Updated Next.js remote image host configuration to derive allowed hostnames from environment-provided Supabase URLs instead of hardcoded project hostnames.
- Expanded `.env.local.example` with grouped explanatory comments and concrete examples for Supabase, Cubid, wallet assets, app runtime, and indexer variables.
- Added explicit `.env.local` ignore entry in `.gitignore`.
- Removed legacy `supabase/config.toml` and `supabase/sql-schema.sql` files per updated repo direction, and updated workflow guidance to rely on migration files only.

### Files Edited
- `.env.local.example`
- `.gitignore`
- `next.config.js`
- `shared/lib/supabase/client.ts`
- `shared/lib/supabase/server.ts`
- `shared/lib/supabase/middleware.ts`
- `shared/lib/supabase/assets.ts`
- `app/tcoin/wallet/components/landing-header/LandingHeader.tsx`
- `app/tcoin/wallet/welcome/page.tsx`
- `agent-context/workflow.md`
- `supabase/config.toml` (deleted)
- `supabase/sql-schema.sql` (deleted)
- `agent-context/session-log.md`

## v1.07
### Timestamp
- 2026-03-09 20:04:28 EDT

### Objective
- Implement a user-triggered Genero contract indexer with 5-minute start/complete cooldowns, Sarafu pool overlap discovery, tracker-first ingestion with RPC fallback, and app/login trigger wiring.

### What Changed
- Added a new Supabase migration that creates the `indexer` and `chain_data` schemas, run-control/checkpoint tables, pool link/token discovery tables, idempotent raw event storage, normalized chain-data tables, RLS policies, authenticated grants, and RPC helpers `indexer_try_start_run` + `indexer_complete_run`.
- Added a new TypeScript indexer service under `services/indexer` covering run lifecycle control, city contract resolution (registry-first with DB override fallback), Sarafu pool discovery by token overlap, tracker pull ingestion, RPC log fallback ingestion, event fingerprinting, and normalized/idempotent persistence.
- Added new API endpoints `POST /api/indexer/touch` and `GET /api/indexer/status` with authenticated access and scope-key execution.
- Added shared indexer client utilities and a `useIndexerTrigger` hook with local dedupe TTL; wired triggers into login (`SIGNED_IN`) and app-use surfaces for wallet, sparechange, and contracts flows.
- Added focused tests for cooldown logic, overlap detection, fingerprint stability, and updated auth-hook tests for login-trigger behavior.
- Added indexer environment variable examples and TypeScript path alias for `@services/*`.

### Files Edited
- `supabase/migrations/20260309191000_v0.95_user_triggered_indexer.sql`
- `services/indexer/src/config.ts`
- `services/indexer/src/types.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/state/cooldown.ts`
- `services/indexer/src/state/runControl.ts`
- `services/indexer/src/discovery/abis.ts`
- `services/indexer/src/discovery/cityContracts.ts`
- `services/indexer/src/discovery/pools.ts`
- `services/indexer/src/ingest/trackerClient.ts`
- `services/indexer/src/ingest/rpcFallback.ts`
- `services/indexer/src/normalize/fingerprint.ts`
- `services/indexer/src/normalize/persist.ts`
- `services/indexer/src/state/cooldown.test.ts`
- `services/indexer/src/discovery/pools.test.ts`
- `services/indexer/src/normalize/fingerprint.test.ts`
- `app/api/indexer/touch/route.ts`
- `app/api/indexer/status/route.ts`
- `shared/lib/indexer/types.ts`
- `shared/lib/indexer/trigger.ts`
- `shared/lib/indexer/index.ts`
- `shared/hooks/useIndexerTrigger.ts`
- `shared/api/hooks/useAuth.ts`
- `shared/api/hooks/useAuth.test.tsx`
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/sparechange/ContentLayout.tsx`
- `app/tcoin/contracts/hooks/useManagementContext.ts`
- `.env.local.example`
- `tsconfig.json`
- `agent-context/session-log.md`

## v1.06
### Timestamp
- 2026-03-09 16:29:49 EDT

### Objective
- Record the current implementation state in the session log and commit all pending contract-management and supporting changes.

### What Changed
- Added this `v96` session-log entry with timestamp, objective, and change summary headings.
- Prepared the repository for a single commit that captures the full pending implementation set plus updated session documentation.

### Files Edited
- `agent-context/session-log.md`

## v1.05
### Timestamp
- 2026-03-09 16:28:46 EDT

### Objective
- Implement the new `app/tcoin/contracts` contract-management app with role-based interfaces, add required V2 governance/orchestrator Solidity functionality for charity and reserve-currency proposals, wire shared contract-management clients, and add Supabase metadata storage for proposal UX.

### What Changed
- Added `VotingV2` and `OrchestratorV2` contracts with steward voting, owner-executed proposal lifecycle, reserve-currency management, governance value application, and role/management helper methods.
- Added V2 Solidity unit tests covering charity proposal lifecycle, reserve proposal lifecycle, quorum behavior, one-vote enforcement, expiry handling, owner-only execute/cancel, peg vote behavior, and status pagination.
- Patched `TCOIN` correctness issues (`transfer` semantics and `balanceOf` recursion) and added `pause/unpause` controls to `CAD`.
- Added a new contract-management app at `app/tcoin/contracts` with pages for governance, city-manager proposals, steward nomination, charity-operator minting, treasury controls, token-admin controls, registry operations, and proposal detail actions.
- Added shared management contract modules (ABIs, city context/client helpers, role resolution, Cubid signer transaction path, proposal and registry operation clients, and shared management types).
- Added Supabase service methods for creating/listing proposal metadata, linking on-chain proposal IDs, and uploading images for proposal content.
- Added a new Supabase migration to create contract-management metadata/link tables with RLS policies, seed the `contracts` app registry entry, and provision a public `contract-management` storage bucket.
- Added a new TypeScript alias for `@tcoin/contracts/*`.

### Files Edited
- `contracts/foundry/src/torontocoin/v2/OrchestratorV2.sol`
- `contracts/foundry/src/torontocoin/v2/VotingV2.sol`
- `contracts/foundry/src/torontocoin/v2/interfaces/IOrchestratorV2.sol`
- `contracts/foundry/src/torontocoin/v2/interfaces/IVotingV2.sol`
- `contracts/foundry/test/unit/torontocoin-v2/VotingV2.t.sol`
- `contracts/foundry/src/torontocoin/TCOIN.sol`
- `contracts/foundry/src/torontocoin/CADCOIN.sol`
- `app/tcoin/contracts/layout.tsx`
- `app/tcoin/contracts/page.tsx`
- `app/tcoin/contracts/governance/page.tsx`
- `app/tcoin/contracts/city-manager/page.tsx`
- `app/tcoin/contracts/stewards/page.tsx`
- `app/tcoin/contracts/charity-operator/page.tsx`
- `app/tcoin/contracts/treasury/page.tsx`
- `app/tcoin/contracts/token-admin/page.tsx`
- `app/tcoin/contracts/registry/page.tsx`
- `app/tcoin/contracts/proposals/[id]/page.tsx`
- `app/tcoin/contracts/hooks/useManagementContext.ts`
- `app/tcoin/contracts/styles/app.scss`
- `shared/lib/contracts/management/abis/orchestratorV2Abi.ts`
- `shared/lib/contracts/management/abis/votingV2Abi.ts`
- `shared/lib/contracts/management/abis/accessControlTokenAbi.ts`
- `shared/lib/contracts/management/abis/cityImplementationRegistryAbi.ts`
- `shared/lib/contracts/management/abis/index.ts`
- `shared/lib/contracts/management/types.ts`
- `shared/lib/contracts/management/clients.ts`
- `shared/lib/contracts/management/cubidSigner.ts`
- `shared/lib/contracts/management/proposals.ts`
- `shared/lib/contracts/management/registryOps.ts`
- `shared/lib/contracts/management/roles.ts`
- `shared/lib/contracts/management/index.ts`
- `shared/lib/contracts/management/proposals.test.ts`
- `shared/api/services/contractManagementService.ts`
- `supabase/migrations/20260309163000_v0.94_contract_management.sql`
- `tsconfig.json`

## v1.04
### Timestamp
- 2026-03-09 15:28:22 EDT

### Objective
- Implement the City Contract Version Registry + promotion workflow plan end-to-end, wire app transaction hooks to on-chain registry resolution, document the implementation, and validate with targeted Solidity/TypeScript tests.

### What Changed
- Implemented `CityImplementationRegistry` with version history, active promotion, owner-only mutation, required-address validation, and registration/promotion events.
- Added Foundry deploy and promotion scripts to deploy the registry, parse deployment JSON artifacts, derive lowercase `cityId`, call `registerAndPromote`, and persist promotion outputs.
- Added OpenZeppelin Foundry dependencies and remappings to support reliable local `forge build/test` for current sources and new registry tests.
- Added app-side shared registry ABI/client/resolver modules and `ActiveCityContracts` lookup flow with 60-second memory/localStorage caching.
- Rewired `useTokenBalance` and `useSendMoney` to resolve token/RPC at runtime from the on-chain registry instead of hardcoded token address and RPC constants.
- Added/updated unit tests for registry resolver modules and hooks; fixed Vitest hoisted mock usage and excluded Foundry lib tests from repo Vitest discovery.
- Added implementation documentation with architecture, runbook, verification, and follow-up notes.

### Files Edited
- `contracts/foundry/src/registry/CityImplementationRegistry.sol`
- `contracts/foundry/script/deploy/DeployCityImplementationRegistry.s.sol`
- `contracts/foundry/script/deploy/PromoteCityVersion.s.sol`
- `contracts/foundry/test/unit/CityImplementationRegistry.t.sol`
- `contracts/foundry/foundry.toml`
- `contracts/foundry/.env.example`
- `contracts/foundry/README.md`
- `contracts/foundry/lib/openzeppelin-contracts/` (added)
- `contracts/foundry/lib/openzeppelin-contracts-upgradeable/` (added)
- `shared/lib/contracts/cityRegistryAbi.ts`
- `shared/lib/contracts/cityRegistryClient.ts`
- `shared/lib/contracts/cityContracts.ts`
- `shared/lib/contracts/cityContracts.test.ts`
- `shared/hooks/useTokenBalance.ts`
- `shared/hooks/useTokenBalance.test.tsx`
- `shared/hooks/useSendMoney.tsx`
- `shared/hooks/useSendMoney.test.ts`
- `vitest.config.ts`
- `vitest.setup.ts`
- `package.json`
- `contracts/foundry/src/torontocoin/TCOIN.sol`
- `contracts/foundry/src/torontocoin/sampleERC20.sol`
- `contracts/foundry/src/torontocoin/Voting.sol`
- `contracts/foundry/src/torontocoin/Orchestration.sol`
- `contracts/foundry/src/torontocoin/PlainERC20.sol`
- `docs/city-contract-version-registry-implementation.md`

## v1.03
### Timestamp
- 2026-03-09 14:18:24 EDT

### Objective
- Document the current TorontoCoin Solidity system state, provide a corrected interaction diagram, and define a concrete patch list to make deployment possible end-to-end.

### What Changed
- Added a new architecture and deployability document for the imported TorontoCoin contracts.
- Documented current non-deployable status and root causes (dependency/import blockers + critical contract logic issues).
- Added a corrected Mermaid interaction diagram for user/store redemption, governance flow, and charity mint-credit loop.
- Added a prioritized patch list (`P0`, `P1`, `P2`) covering correctness fixes, bootstrap/roles/deployability fixes, and hardening tasks.
- Added a suggested deployment sequence after fixes are applied.

### Files Edited
- `docs/torontocoin-contracts-current-state.md`

## v1.02
### Timestamp
- 2026-03-09 13:53:31 EDT

### Objective
- Import TorontoCoin contract artifacts into the Foundry workspace and place the TorontoCoin README and whitepaper in `app/tcoin/`.

### What Changed
- Imported TorontoCoin Solidity and ABI artifacts into `contracts/foundry/src/torontocoin/` (copy-only, no git history).
- Moved the imported TorontoCoin `README.md` from the Foundry source folder to `app/tcoin/README.md`.
- Moved the TorontoCoin whitepaper PDF from `docs/torontocoin/` to `app/tcoin/T-Coin Whitepaper.pdf`.

### Files Edited
- `contracts/foundry/src/torontocoin/CADCOIN.sol`
- `contracts/foundry/src/torontocoin/Orchestration.sol`
- `contracts/foundry/src/torontocoin/PlainERC20.abi`
- `contracts/foundry/src/torontocoin/PlainERC20.sol`
- `contracts/foundry/src/torontocoin/TCOIN.sol`
- `contracts/foundry/src/torontocoin/TTCCOIN.sol`
- `contracts/foundry/src/torontocoin/Voting.sol`
- `contracts/foundry/src/torontocoin/sampleERC20.sol`
- `app/tcoin/README.md`
- `app/tcoin/T-Coin Whitepaper.pdf`

## v1.01
### Timestamp
- 2026-03-09 13:29:44 EDT

### Objective
- Scaffold a Foundry workspace in this repository with a clean, production-oriented folder layout and baseline configuration.

### What Changed
- Initialized a new Forge project at `contracts/foundry`.
- Removed default sample files (`Counter.sol`, `Counter.t.sol`, `Counter.s.sol`) to avoid placeholder code in mainline.
- Added Solidity source subfolders for common separation of concerns: `errors`, `interfaces`, `libraries`, `mocks`, and `types`.
- Added test subfolders for `unit`, `integration`, `invariant`, and shared `helpers`.
- Added script subfolders (`script/deploy`, `script/helpers`) and a `deployments` directory for deployment artifacts.
- Updated Foundry config to include explicit `test` and `script` paths, optimizer settings, cache path, remapping detection, and filesystem permission for deployment outputs.
- Added local workspace helpers: `.gitignore`, `.env.example`, and a workspace README documenting layout and conventions.

### Files Edited
- `contracts/foundry/foundry.toml`
- `contracts/foundry/README.md`
- `contracts/foundry/.gitignore`
- `contracts/foundry/.env.example`
- `contracts/foundry/src/Counter.sol` (deleted)
- `contracts/foundry/test/Counter.t.sol` (deleted)
- `contracts/foundry/script/Counter.s.sol` (deleted)
- `contracts/foundry/src/errors/.gitkeep`
- `contracts/foundry/src/interfaces/.gitkeep`
- `contracts/foundry/src/libraries/.gitkeep`
- `contracts/foundry/src/mocks/.gitkeep`
- `contracts/foundry/src/types/.gitkeep`
- `contracts/foundry/test/unit/.gitkeep`
- `contracts/foundry/test/integration/.gitkeep`
- `contracts/foundry/test/invariant/.gitkeep`
- `contracts/foundry/test/helpers/.gitkeep`
- `contracts/foundry/script/deploy/.gitkeep`
- `contracts/foundry/script/helpers/.gitkeep`
- `contracts/foundry/deployments/.gitkeep`


## v0.90
- Fixed `v0.89` migration to support legacy `wallet_list` rows with `user_id IS NULL` by replacing a full-table `wallet_key_id NOT NULL` constraint with a conditional check (`user_id IS NULL OR wallet_key_id IS NOT NULL`), while preserving foreign-key integrity.
- Updated the SQL schema snapshot to keep `wallet_list.wallet_key_id` nullable for non-user rows.

## v0.89
- Added a reversible Supabase migration introducing `wallet_keys`, migrating `wallet_list.app_share` into per-user wallet keys, linking both `wallet_list` and `user_encrypted_share` via `wallet_key_id`, and refreshing the SQL schema snapshot.
- Updated wallet and SpareChange welcome wallet-connect flows to upsert/reuse `wallet_keys` before writing `wallet_list` and `user_encrypted_share` rows.
- Updated send-money share retrieval to resolve `app_share` from `wallet_keys` plus encrypted shares by `wallet_key_id`, and refreshed/extended Supabase service tests with a shared-key regression fixture.

## v0.88
- Made wallet landing dark mode changes significantly more visible by deepening the page gradient, making main/intro sections transparent in dark mode so the gradient actually shows through, and strengthening CTA button contrast with a brighter light-grey gradient plus border.

## v0.87
- Softened wallet landing dark mode by applying a near-black to charcoal background gradient, differentiating headings to white against light-grey body copy, and switching wallet CTA buttons to a light-grey gradient fill in dark mode.

## v0.86
- Tuned wallet landing header breakpoints by capping banner growth between 535-767px (`max-w-[535px]`) and reducing tagline size with nowrap between 1023-1163px to prevent multi-line overflow.

## v0.85
- Centred the tablet-portrait header CTA by switching it to a portrait-only block element with fit-content width and auto margins, preventing left alignment drift.

## v0.84
- Updated tablet portrait wallet header layout to center-align the tagline and place the wallet CTA in a third row below it, while keeping side-column CTA behaviour for larger desktop layouts.

## v0.83
- Increased wallet landing midsize banner prominence by widening the header middle column (`15/70/15`) and setting banner width to `md:w-[75%]`, keeping it narrower than the body text column but above half-width.

## v0.82
- Eliminated initial large-screen fade-gap drift by recalculating wallet header height with `ResizeObserver`, `requestAnimationFrame`, and load/resize hooks, then offsetting the fade strip by 1px so no fully visible band appears between the fixed header and gradient.

## v0.81
- Kept the wallet landing header and fade overlay stationary during scroll by splitting them into separate `fixed` layers and positioning the gradient strip using measured header height.

## v0.80
- Fixed the wallet landing header fade effect by moving the gradient strip to an absolute overlay below the fixed header (`top-full`) with stronger height/opacity ramp so body content visibly fades while scrolling upward.

## v0.79
- Refined wallet landing presentation by setting footer links to body-sized text, adding a header fade gradient for scroll transitions, and increasing heading spacing so pre-heading whitespace is about 50% larger than post-heading whitespace.

## v0.78
- Updated the wallet landing responsiveness: banner images now always render fully on small screens, unauthenticated tagline + CTA stack moves into the scrollable body on small screens and tablet landscape, and the footer switches to a one-column portrait-mobile layout with right-aligned links above left-aligned branding.

## v0.77
- Updated the wallet landing header for small screens by removing the hamburger drawer, surfacing its copy and CTA inline under the banner for unauthenticated users, and tightening mobile banner height and section widths for portrait and landscape readability.

## v0.76
- Hardened `20260211180453_v0.72_connections_profile_fks.sql` to follow idempotency guard-rails (`ALTER TABLE IF EXISTS` plus constraint existence checks before adds) and renamed legacy Supabase migration files to timestamp-prefixed names for Supabase ordering compatibility.

## v0.75
- Hardened `v0.72` migration idempotency by dropping existing `connections_*_profile_fkey` constraints before re-adding them, preventing duplicate-constraint failures on already-migrated databases.

## v0.74
- Reverted the `public.interac_transfer` app-profile foreign-key experiment so transfer records continue referencing `public.users(id)` and follow the user across app profiles.

## v0.73
- Added a Supabase migration to move `public.interac_transfer` user relationships from `public.users(id)` to app-scoped composite foreign keys on `public.app_user_profiles(user_id, app_instance_id)`, with a reversible rollback path.

## v0.72
- Added a new Supabase migration that reaffirms `public.connections` composite foreign keys to `public.app_user_profiles` and includes a reversible down migration back to `public.users(id)`.

## v0.71
- Added `docs/webauthn-passkey-storage.md` documenting how WebAuthn passkeys are created and stored, including that `rp.id` is sourced from `window.location.hostname`.

## v0.70
- Refreshed the Supabase SQL snapshot to include the app instance foreign key on `interac_transfer` and the new `app_user_profiles` security policies.

## v0.69
- Added a dedicated Supabase migration enabling row-level security on `app_user_profiles` with self-service select/insert/update policies tied to the owning auth user.

## v0.68
- Updated Supabase app registry migrations, profile backfill, shared Supabase helpers, and specs to use `ref_apps`, `ref_citycoins`, and `ref_app_instances` table names.

## v0.67
- Normalised Cubid data around per-app profiles by adding a reversible Supabase migration, updating shared typings/service helpers, and wiring wallet and SpareChange flows to read and write the scoped profile payloads.

## v0.66
- Added Supabase migrations for `apps`, `citycoins`, and `app_instances`, seeded wallet/sparechange pairings, refreshed the SQL schema snapshot, and exposed a cached helper to resolve the active app instance by environment variables.

## v0.65
- Styled the incoming request modal with a pink Pay button and white Ignore button, renamed outgoing requests to "Payment requests I have sent" with delete actions, and routed new users to `/welcome` with username availability checks, clearer continue guidance, and phone verification feedback.

## v0.64
- Finalised the `/admin` wallet dashboard by fixing the ramp request save test with explicit DOM cleanup and ensuring admin-only routing remains enforced.

## v0.63
- Pulled the Supabase OpenAPI metadata and generated `sql-schema-v0.sql` capturing tables, enums, and exposed RPC signatures.

## v0.62
- Secured Ecosystem links with `rel="noopener noreferrer"` and added tests.

## v0.61
- Added public Ecosystem page listing related projects and linked it from resources and the landing footer for SEO.

## v0.60
- OTP form auto-submits once all six digits are entered, removing the need for a Verify button.
- Send tab opens the shared QR scan modal instead of embedding a scanner, and the amount input is borderless with oversized text and two-decimal conversions.

## v0.59
- Converted Send tab token balances from strings to numbers and added a unit test confirming `SendCard` receives a numeric `userBalance` prop.

## v0.58
- Parsed token balance strings before arithmetic to avoid `toFixed` runtime errors and added a unit test ensuring `SendCard` receives a numeric balance.

## v0.57
- Manual Send flow shows an oversized amount input with available balance, Use Max shortcut and reveals contact or scan options only after amount entry.

## v0.56
- Restored Send tab to include QR camera plus options to select a contact or paste a link, with amount entry and send button available on the page.

## v0.55
- Refined sign-in modal to show a spam warning with a hyperlink for resending codes.

## v0.54
- Guarded dashboard send flows against null recipient data, hardened Supabase fetches, and wrapped the page in an error boundary.

## v0.53
- Ensured contact selection passes full recipient data to send flow and added unit test covering the behaviour.

## v0.52
- Refined wallet dashboard footer and send flow: centered tab icons, inline QR scanner with contact option, white receive QR background and persistent dark mode.

## v0.51
- Guarded wallet dashboard deep-link scans to run only when the URL includes a `pay` payload and trigger success toasts after user lookup and connection insertion.

## v0.50
- Ensured Send tab supplies sender and receiver IDs to `useSendMoney` and added a unit test to prevent regressions.

## v0.49
- Deferred browser storage access like localStorage to `useEffect` hooks to silence build-time warnings in Node.

## v0.48
- Configured Vitest to run tests in a jsdom environment for DOM APIs.

## v0.47
- Switched wallet dashboard to system fonts and added functional tabs for contacts, sending, and receiving.

## v0.46
- Replaced custom 48% slide animations with built-in half-screen variants and cleared Tailwind's ambiguous class warnings.

## v0.45
- Established a Tailwind preset and per-app configs to remove ambiguous class warnings for wallet and sparechange builds.

## v0.44
- Refactored wallet dashboard into reusable components with a dedicated footer navigation and added unit tests.

## v0.43
- Added React imports and escape-key handling to wallet modals and wrapped modal tests with a QueryClient provider so unit tests pass.

## v0.42
- Replaced single verification field with six auto-advancing inputs in sign-in modals and added a unit test.

## v0.41
- Closed modals with the Escape key and confirmed missing request amounts with a follow-up modal.
- Restored camera access for QR payments and ensured top ups display their modal again.

## v0.40
- Added Vitest testing framework with path alias support and a script to run unit tests.

## v0.39
- Made `/dashboard` a public wallet route so it no longer requires authentication.

## v0.38
- Removed '/tcoin/wallet' prefix from wallet links so routes serve from the domain root.

## v0.37
- Capitalised wallet dashboard branding to TCOIN and added optional QR padding.

## v0.36
- Locked wallet dashboard QR code colours to black on white.

## v0.35
- Lightened dark-mode highlight backgrounds to Tailwind gray-700 on landing, resources and contact pages.

## v0.34
- Corrected Tailwind dark mode configuration so highlight and banner styles switch properly.

## v0.33
- Swapped landing page highlights for light grey in light mode and dark grey in dark mode.

## v0.32
- Added a cache-busting query to the dark-mode banner image so the updated asset renders correctly.

## v0.31
- Routed main panels to theme background and applied the dark class to the root element so dark mode renders panels black.

## v0.30
- Switched highlighted phrases on the landing page to a very light teal in light mode and #05656F in dark mode.

## v0.29
- Shifted "<open my wallet>" buttons to #05656F in light mode, teal send buttons on the contact page and teal hamburger icons.
- Ensured landing, resources and contact panels darken in dark mode.

## v0.28
- Styled "<open my wallet>" links as rectangular buttons with inverted colours for light and dark modes.
- Switched themed backgrounds to pure white or black and set landing, resources and contact panels to black in dark mode.

## v0.27
- CI workflow installs dependencies without enforcing the lockfile.

## v0.26
- Widened landing, resources and contact pages to 60% width and trimmed top spacing on the landing page.
- Added return-home links and extra spacing on Resources and Contact pages.
- Fixed dark mode by attaching the `dark` class to the body so backgrounds and banner images toggle correctly.

## v0.25
- Switched landing header to light and dark banner images and updated image host configuration.

## v0.24
- Set page backgrounds to white or black according to theme while panels use themed background colour.
- Centred the top-right call-to-action with the banner and duplicated the "<open my wallet>" link beneath the closing copy.

## v0.23
- Hid landing page tagline on small screens and replaced the open-wallet link with a hamburger menu that reveals a slide-out panel containing the tagline and "<open my wallet>" link.

## v0.22
- Applied system-preferring dark mode hook and extended theme across landing, resources and contact pages.
- Centralised footer rendering in layout to avoid duplication and ensure consistent theming.
- Dashboard background now follows the selected theme.

## v0.21
- Made Resources and Contact pages public with landing page styling and shared header and footer.
- Fixed landing page links to point to the whitepaper, Telegram chat, presentation and source code.
- Footer now links to Resources and GitHub repo; Twilio routes initialise clients only when env vars exist.

## v0.20
- Added Resources page linking to external project materials and open source repository.
- Expanded Contact page with WhatsApp invite and submission form saving requests and IP addresses to Supabase.

## v0.19
- Split the fixed header into three columns with empty left area.
- Centre column matches body width and holds the banner and right-aligned tagline.
- Right column shows "<open my wallet>" left aligned at the top.
- Minimized bottom padding of the header.

## v0.18
- Aligned the "<open my wallet>" link within the right margin.
- Tagline changed to plain text with margin underneath.
- Added padding before the first section and updated copy on how to get involved.
- Footer now links to Whitepaper, Github and Contact, with a new contact page.

## v0.17
- Placed tagline beneath the banner image in the fixed header.
- Positioned the "<open my wallet>" link at the far right of the page.

## v0.16

- Narrowed body text and banner to 40% width on large screens.
- Updated tagline: "Local Currency. Value = $3.35. Proceeds to charity." and right-aligned it below the banner.
- Headings now use extra-bold styling.

## v0.15

- Moved banner image and "Local Currency, Global Example." tagline into the fixed header so content scrolls underneath.
- Removed the dark top border by clearing shadow styles.
- Footer now displays white background with black text.

## v0.14

- Trimmed section padding on wallet homepage so headings have exactly one blank line above and below.
- Updated functional and technical specs to reflect the refined spacing.

## v0.13

- Added equal spacing above and below each heading on TCOIN wallet homepage.
- Documented heading spacing in functional and technical specs.

## v0.12

- Updated home page copy with regular dashes and revised closing line.

## v0.11

- Imported Special Elite via style tag with system-ui fallback, ensuring font loads without monospace fallback.
- Updated functional and technical specs to reflect new font approach.

## v0.10

- Ensured Special Elite font falls back only to typewriter fonts and updated nav link text to "<open my wallet>".
- Reduced spacing around headings for a cleaner layout.
- Updated functional and technical specs to match.

## v0.8

- Switched wallet homepage font to Special Elite for a typewriter feel.

## v0.9

- Applied Special Elite using next/font and global styles in wallet layout.
- Simplified ContentLayout for landing page without navbar or footer.
- Updated nav text to "/open your wallet/" linking to dashboard.

## v0.7

- Replaced Michroma with Courier New and added underline styling.
- Removed "A project by Toronto DAO" text and dark top line.
- Updated copy to use TCOIN wording and darker highlight.

## v0.6

- Applied Michroma font across new wallet homepage and unified text size.
- Slimmed spacing and limited banner width to match content.
- Simplified navbar to single "open your wallet" link and removed blue top line.

## v0.5

- Refined wallet homepage design with white background, dark text, and centered headings.
- Converted bullet lists to prose and highlighted first sentences.
- Adjusted layout to 50% width with 25% margins and fixed banner path.

## v0.4

- Added remote banner image and allowed domain in Next.js config.

## v0.3

- Adjusted ESLint rules to silence quote errors so build passes.

## v0.2

- Redesigned wallet home page using mission-driven copy and Thinking Machines layout.

## v0.1

- Initial bootstrap: added agent-context folder and CI workflow.

## v1.18
### Timestamp
- 2026-03-12 12:45:00 EDT

### Objective
- Implement the Buy TCOIN checkout orchestrator flow in wallet + backend (Transak sessioning, managed deposit wallets, webhook ingestion, auto-mint via `TcoinMintRouter`, session status APIs, and admin retry visibility), with new persistence schema and feature-flagged UI entry points.

### What Changed
- Added Supabase migration `v0.98` for onramp orchestration:
- `onramp_deposit_wallets`, `onramp_checkout_sessions`, `onramp_settlement_attempts`, `onramp_provider_events`, and `onramp_operation_locks`.
- lock RPCs: `onramp_try_acquire_lock(...)`, `onramp_release_lock(...)`.
- admin projection view: `v_onramp_checkout_admin`.
- RLS/grants for user-scoped session visibility and service-role settlement writes.
- Added new onramp service module under `services/onramp/src`:
- env/config resolver for provider/chain/router/gas/HD settings.
- deterministic per-user deposit wallet derivation + allocation.
- Transak session builder + webhook signature validation + event normalization.
- settlement runner with idempotent lock, USDC detection, quote/min-output guards, gas top-up, router mint execution, attempt/session persistence, and manual-review fallback.
- status projection helpers for timeline rendering.
- Added wallet-facing and ops-facing API routes:
- `POST /api/onramp/session`
- `GET|POST /api/onramp/session/[id]`
- `POST /api/onramp/session/[id]/retry`
- `POST /api/onramp/webhooks/transak`
- `POST /api/onramp/touch`
- `GET /api/onramp/admin/sessions`
- Added shared onramp types/feature flag helpers in `shared/lib/onramp/*`.
- Added new wallet modal `BuyTcoinModal` with checkout session creation, embedded widget frame, timeline polling, and deterministic status toasts.
- Wired Buy TCOIN entry points into `WalletHome` and `MoreTab` behind `NEXT_PUBLIC_BUY_TCOIN_CHECKOUT_V1` while preserving Interac top-up/off-ramp actions.
- Extended admin dashboard with a new Buy TCOIN checkout sessions panel and manual retry action.
- Updated `.env.local.example` with all required onramp env variables and examples.
- Corrected a critical provider-status mapping bug so provider `completed/success` maps to `crypto_sent` (not `mint_complete`), preventing premature terminal session status.
- Ran targeted verification:
- `npm run test -- app/api/onramp/session/route.test.ts app/api/onramp/webhooks/transak/route.test.ts app/tcoin/wallet/components/dashboard/MoreTab.test.tsx` (all passing).
- `npx tsc --noEmit` checked for touched-file regressions (resolved for changed files).

### Files Edited
- `supabase/migrations/20260312113000_v0.98_onramp_checkout.sql`
- `services/onramp/src/config.ts`
- `services/onramp/src/depositWallets.ts`
- `services/onramp/src/index.ts`
- `services/onramp/src/provider/transak.ts`
- `services/onramp/src/settlement.ts`
- `services/onramp/src/status.ts`
- `services/onramp/src/types.ts`
- `shared/lib/onramp/feature.ts`
- `shared/lib/onramp/types.ts`
- `app/api/onramp/session/route.ts`
- `app/api/onramp/session/route.test.ts`
- `app/api/onramp/session/[id]/route.ts`
- `app/api/onramp/session/[id]/retry/route.ts`
- `app/api/onramp/webhooks/transak/route.ts`
- `app/api/onramp/webhooks/transak/route.test.ts`
- `app/api/onramp/touch/route.ts`
- `app/api/onramp/admin/sessions/route.ts`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/tcoin/wallet/components/modals/index.ts`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.19
### Timestamp
- 2026-03-12 12:58:00 EDT

### Objective
- Add a detailed architecture writeup for the Buy TCOIN checkout orchestrator and document this documentation pass in session-log.

### What Changed
- Added a dedicated architecture document for the implemented onramp checkout stack:
- component model (wallet, API routes, service layer, chain execution, persistence),
- sequence and state-machine flows,
- settlement algorithm and guard rails,
- webhook/idempotency/security controls,
- API/data contracts,
- operations/SLA/failure-mode handling,
- deferred hardening and next-phase items.
- Captured this documentation-only update as a new log entry.

### Files Edited
- `docs/buy-tcoin-checkout-orchestrator-architecture.md`
- `agent-context/session-log.md`

## v1.20
### Timestamp
- 2026-03-12 13:08:00 EDT

### Objective
- Reduce hyperlink visual intensity in wallet light/dark themes.

### What Changed
- Updated wallet link color token to match requested values:
- light mode link color set to `#4d004d`.
- dark mode link color set to `#ffe6ff`.
- Updated base link styling so anchors and `.link-btn` use `--link-color` instead of `--primary`, preventing bright-pink primary color from overriding hyperlink tone.

### Files Edited
- `app/tcoin/wallet/styles/app.scss`
- `agent-context/session-log.md`

## v1.21
### Timestamp
- 2026-03-12 13:11:00 EDT

### Objective
- Adjust wallet dark-mode hyperlink color to the requested softer pink.

### What Changed
- Updated wallet dark-mode `--link-color` from `#ffe6ff` to `#ffccff`.

### Files Edited
- `app/tcoin/wallet/styles/app.scss`
- `agent-context/session-log.md`

## v1.22
### Timestamp
- 2026-03-12 19:23:00 EDT

### Objective
- Align Buy TCOIN onramp with Transak’s secure backend widget URL generation requirement.

### What Changed
- Refactored Transak session creation to call the secure backend endpoint (`/api/v2/auth/session`) instead of building public query-string widget URLs.
- Added backend request with required secure headers:
- `access-token` (partner access token)
- `authorization` (user auth token)
- Added robust response parsing and failure handling for missing/invalid `widgetUrl` from provider response.
- Updated session creation route to await async secure widget generation.
- Extended onramp config/env requirements with new Transak secure widget settings.
- Updated `.env.local.example` with new variables and staging/production endpoint examples.
- Verified with targeted API tests and touched-file TypeScript checks.

### Files Edited
- `services/onramp/src/provider/transak.ts`
- `services/onramp/src/config.ts`
- `app/api/onramp/session/route.ts`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.23
### Timestamp
- 2026-03-12 19:41:00 EDT

### Objective
- Make Transak user authorization token optional for secure widget URL generation while preserving partner-token security flow.

### What Changed
- Updated onramp config type and parsing so `ONRAMP_TRANSAK_USER_AUTH_TOKEN` is optional (`string | null`) instead of required.
- Updated Transak secure widget request headers to include `authorization` only when `ONRAMP_TRANSAK_USER_AUTH_TOKEN` is present.
- Updated `.env.local.example` docs to clarify user auth token is optional unless user-authenticated Transak sessions are being used.
- Verified with targeted onramp API tests.

### Files Edited
- `services/onramp/src/config.ts`
- `services/onramp/src/provider/transak.ts`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.24
### Timestamp
- 2026-03-12 19:42:00 EDT

### Objective
- Migrate Transak webhook verification from required webhook secret to access-token/JWT verification, while keeping legacy HMAC as optional fallback.

### What Changed
- Made `ONRAMP_TRANSAK_WEBHOOK_SECRET` optional in onramp config.
- Added JWT webhook verification path using `ONRAMP_TRANSAK_ACCESS_TOKEN` (HS256 verify + payload decode).
- Updated webhook route to use unified verification+decode function:
- accepts JWT payload verification via access token,
- supports legacy signature mode if webhook secret is configured,
- rejects unverifiable payloads with 401.
- Updated service exports and webhook tests for new verification API.
- Updated `.env.local.example` to mark webhook secret as optional legacy input.

### Files Edited
- `services/onramp/src/config.ts`
- `services/onramp/src/provider/transak.ts`
- `services/onramp/src/index.ts`
- `app/api/onramp/webhooks/transak/route.ts`
- `app/api/onramp/webhooks/transak/route.test.ts`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.25
### Timestamp
- 2026-03-12 19:50:00 EDT

### Objective
- Bypass authentication requirements in local/development environments for faster wallet/onramp iteration.

### What Changed
- Added environment-gated auth bypass support when `NEXT_PUBLIC_APP_ENVIRONMENT` is `local` or `development`.
- Updated shared API auth resolver to:
- return normal auth context when Supabase session exists,
- fallback to a service-role resolved user row when unauthenticated in local/dev,
- optionally honor `AUTH_BYPASS_USER_ID` to pin bypass identity,
- otherwise fallback to the first user in `public.users`.
- Updated wallet content layout to skip non-public redirect-to-home for unauthenticated users in local/dev.
- Updated indexer touch/status endpoints to allow unauthenticated invocation in local/dev only.
- Added env template documentation for `AUTH_BYPASS_USER_ID`.
- Verified touched files with TypeScript and reran onramp route tests.

### Files Edited
- `shared/lib/bia/apiAuth.ts`
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/api/indexer/touch/route.ts`
- `app/api/indexer/status/route.ts`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.26
### Timestamp
- 2026-03-12 19:55:00 EDT

### Objective
- Reorganize `/dashboard` actions so Interac top-up appears under Buy TCOIN, and remove the Other panel from dashboard while keeping off-ramp in More.

### What Changed
- Updated `WalletHome` to remove `OtherCard` from both mobile and desktop dashboard layouts.
- Added `Top Up with Interac eTransfer` button into the `Buy TCOIN` panel in `WalletHome`.
- Kept `Buy TCOIN` checkout button in the same panel (feature-flagged behavior unchanged).
- Left `Convert to CAD and Cash Out` untouched in the More tab flow.
- Verified with `WalletHome` component test.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `agent-context/session-log.md`

## v1.27
### Timestamp
- 2026-03-12 20:07:00 EDT

### Objective
- Simplify `/dashboard` so initial view emphasizes balance and clearly separates user intent flows: pay, top-up/buy, and request.

### What Changed
- Refactored `WalletHome` to remove the always-visible send amount form from initial load.
- New default dashboard home now shows:
- balance-first account surface,
- explicit intent actions (`Pay To`, `Request`),
- dedicated `Top Up / Buy` panel with Buy TCOIN + Interac top-up actions.
- Added intent gating so `SendCard` only appears after user explicitly chooses `Pay To` (or deep-link scan intent), eliminating the ambiguous `Amount` panel at initial load.
- Wired `Request` intent to switch to the Receive tab from dashboard parent.
- Removed off-ramp as a dashboard-home action (off-ramp remains in More tab).
- Updated `WalletHome` tests to match the new intent-driven behavior and verify send flow appears only after selecting Pay To.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `agent-context/session-log.md`

## v1.28
### Timestamp
- 2026-03-12 20:31:10 EDT

### Objective
- Revert the dashboard to the previous layout and keep only one UX adjustment: merge the separate `Amount` section into the `Send To` panel.

### What Changed
- Restored dashboard files from the pre-redesign state so `/dashboard` behavior and structure match the prior layout.
- Removed the standalone `Amount` card section in `SendCard` and embedded its amount input/conversion block directly inside the `Send To` card.
- Kept all other dashboard behavior unchanged relative to the pre-redesign baseline.
- Re-ran focused dashboard tests to confirm no regressions in restored layout and send flow interactions.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendCard.tsx`
- `agent-context/session-log.md`

## v1.29
### Timestamp
- 2026-03-12 20:32:55 EDT

### Objective
- Increase contrast of the dashboard header `TCOIN` logo in both light and dark mode.

### What Changed
- Added a dedicated navbar brand-logo class (`wallet-brand-logo`) so the header logo is not constrained by generic link colors.
- Applied theme-specific logo color tokens:
- light mode: white logo on teal navbar.
- dark mode: deep purple logo on white navbar.
- Forced the brand logo to full opacity in navbar (`!opacity-100`) so non-active route dimming does not reduce readability.
- Verified with targeted navbar tests.

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/styles/app.scss`
- `agent-context/session-log.md`

## v1.30
### Timestamp
- 2026-03-12 20:37:51 EDT

### Objective
- Improve Buy TCOIN modal UX clarity and error handling for checkout startup failures.

### What Changed
- Removed duplicate modal heading text (`Buy TCOIN`) from modal body so the modal title is shown only once.
- Switched modal content typography to dashboard style via `font-sans` (instead of inheriting homepage-style font).
- Replaced fiat-first amount fields with a send-style dual-currency amount flow:
- default editable input is `TCOIN`.
- live preview shows equivalent `CAD`.
- toggle lets user switch to editing `CAD` with equivalent `TCOIN` preview.
- Added clearer checkout locale fields:
- fixed checkout currency display (`CAD`),
- country code field with explicit explanation (`CA` default used by Transak for compliance/payment methods).
- Improved checkout startup error UX:
- user-facing, non-technical error toast/message,
- optional “Show technical details” expansion for debugging.
- Hardened `POST /api/onramp/session` error responses:
- classify config/auth/wallet/not-found session errors,
- return user-safe error message + `errorCode`,
- include `technicalError` only in `local/development` environments for debug UI.
- Verified with targeted tests:
- `app/api/onramp/session/route.test.ts`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/api/onramp/session/route.ts`
- `agent-context/session-log.md`

## v1.31
### Timestamp
- 2026-03-12 20:40:25 EDT

### Objective
- Move BIA and Voucher Routing preference editors off the More tab surface into dedicated modals with user-facing explanatory preambles.

### What Changed
- Added two new dedicated modal components:
- `BiaPreferencesModal` with preamble explaining primary vs secondary BIAs, personalization impact, and non-restrictive spending behavior.
- `VoucherRoutingPreferencesModal` with preamble explaining trust/default/blocked routing behavior and merchant/token scope.
- Updated More tab actions:
- removed inline `BIA Preferences` and `Voucher Routing Preferences` detail panels,
- added button actions that open each preference flow in its own modal.
- Wired modal exports through the shared modal barrel.
- Expanded MoreTab tests to verify both new modal entry points open correctly.

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/components/modals/BiaPreferencesModal.tsx`
- `app/tcoin/wallet/components/modals/VoucherRoutingPreferencesModal.tsx`
- `app/tcoin/wallet/components/modals/index.ts`
- `agent-context/session-log.md`

## v1.32
### Timestamp
- 2026-03-12 20:41:32 EDT

### Objective
- Increase horizontal margins and center the Contacts tab content to match the spacing style of other dashboard tabs.

### What Changed
- Updated the Contacts tab root container to use desktop-centered padding (`lg:px-[25vw]`), aligning it with Send/Receive/More layout patterns.
- Preserved existing mobile behavior and all contact interactions.
- Verified with focused Contacts tab tests.

### Files Edited
- `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
- `agent-context/session-log.md`

## v1.33
### Timestamp
- 2026-03-12 20:43:04 EDT

### Objective
- Move the dashboard send action button into the `Send To` panel so action placement matches panel context.

### What Changed
- Relocated the primary send CTA (`Send...` / `Pay this request`) from below the card to inside the `Send To` section in `SendCard`.
- Kept existing validation, modal confirmation, and disabled-state behavior unchanged.
- Added top margin to maintain spacing inside the panel.
- Verified with focused send-flow tests.

### Files Edited
- `app/tcoin/wallet/components/dashboard/SendCard.tsx`
- `agent-context/session-log.md`

## v1.34
### Timestamp
- 2026-03-12 20:52:27 EDT

### Objective
- Add dashboard Recents panel and a dedicated contact profile page with send/request actions and transaction history.

### What Changed
- Added a new `Recents` panel to `/dashboard` home (mobile + desktop cards).
- Recents logic now resolves up to 4 most recent interaction users by combining:
- contact recency (`connections` via `fetchContactsForOwner`),
- recent transfer counterparties (`act_transaction_entries` + wallet/user joins),
- request counterparties (`invoice_pay_request`).
- Recents avatars now navigate to a new contact profile route: `/dashboard/contacts/[id]`.
- Added new contact profile page at `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx` with:
- public profile details (name, username, avatar, bio/country/address when available, wallet),
- transaction history between current user and contact,
- inline amount input + `Send` button for direct payment,
- `Request money from [user]` button opening a separate amount-entry modal that creates `invoice_pay_request`.
- Updated WalletHome tests to support new recents data loading and routing behavior.
- Added test coverage for opening a contact profile from the Recents panel.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx`
- `agent-context/session-log.md`

## v1.35
### Timestamp
- 2026-03-12 20:53:34 EDT

### Objective
- Simplify Receive tab caption copy by removing the token suffix from the default “any amount” state.

### What Changed
- Updated Receive QR caption fallback text from `Receive any amount TCOIN` to `Receive any amount`.
- Kept amount-specific caption behavior unchanged (`Receive {amount} TCOIN`).
- Verified with focused ReceiveCard tests.

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `agent-context/session-log.md`

## v1.36
### Timestamp
- 2026-03-12 20:59:23 EDT

### Objective
- Improve dashboard navigation responsiveness and refactor Send tab action modes into inline, panel-based flows.

### What Changed
- Updated dashboard navigation behavior:
- kept the bottom footer for phone/tablet (`lg:hidden`).
- added a desktop left sidebar (`lg:block`) with `Home` pinned to top, `More` pinned to bottom, and middle tabs (`Receive`, `Send`, `Contacts`) vertically centered.
- adjusted dashboard page spacing to avoid sidebar overlap on large screens (`lg:pl-28`, `lg:pb-8`).
- Refactored Send tab mode controls:
- moved `Manual / Scan QR Code / Pay Link / Requests` into a dedicated tab row above the main panel.
- changed `Scan QR Code` to render inline in-panel using `QrScanModal` (no modal launch).
- changed `Requests` to render inline as an `Incoming Requests To Pay` panel (no modal launch), including refresh and pay/ignore actions.
- kept request-to-send flow intact by switching back to the manual send card after selecting a request.
- preserved pay-link sending behavior by showing link input first, then rendering the locked send card once recipient/amount are loaded.
- Updated Send tab tests for inline QR/requests behavior and validated both affected suites.

### Files Edited
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.test.tsx`
- `agent-context/session-log.md`

## v1.37
### Timestamp
- 2026-03-12 21:01:00 EDT

### Objective
- Enlarge the header camera QR scanner modal so the camera feed has enough space on open.

### What Changed
- Updated the header camera button modal config to open the QR scanner with:
- `elSize: "4xl"` for a larger modal width.
- `isResponsive: true` so layout adapts better across viewport sizes.
- Added an explicit camera button accessibility label (`aria-label="Open QR scanner"`).
- Added navbar test coverage verifying the camera button opens a large, responsive QR modal with expected modal options.

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `agent-context/session-log.md`

## v1.38
### Timestamp
- 2026-03-13 12:18:51 EDT

### Objective
- Prevent wallet/dashboard crashes caused by unhandled WalletConnect disconnect errors (`this.provider.disconnect is not a function`).

### What Changed
- Added a new client-side runtime guard provider that listens to `error` and `unhandledrejection` events and suppresses only the known WalletConnect disconnect error signature.
- Guard matching is narrow and requires both:
- message containing `this.provider.disconnect is not a function`
- WalletConnect markers in stack trace.
- Mounted this guard in both app shells that include Cubid providers:
- wallet layout
- contracts layout
- Verified no regressions with focused wallet/nav test runs.

### Files Edited
- `shared/providers/walletconnect-error-guard.tsx`
- `app/tcoin/wallet/layout.tsx`
- `app/tcoin/contracts/layout.tsx`
- `agent-context/session-log.md`

## v1.39
### Timestamp
- 2026-03-13 12:52:07 EDT

### Objective
- Split dashboard cleanup into smaller changes: simplify `My Account`, move experimental graphs to a modal in `More`, and introduce a dedicated `Transaction History` dashboard tab.

### What Changed
- Simplified `My Account` panel:
- removed the four internal tab buttons.
- removed in-panel graph views and in-panel transaction history.
- kept balance summary and wallet/explorer details.
- added a new `View transaction history` button.
- Added `Future app features` modal:
- created `FutureAppFeaturesModal` containing the two existing experimental charts.
- added `Future app features` button to `More` tab to open that modal.
- Added a dedicated `Transaction History` dashboard tab:
- new `TransactionHistoryTab` component fetches and displays recent `TCOIN` transfers from `act_transaction_entries` using the current user’s wallets.
- wired dashboard state so `My Account` button opens this tab.
- added a top-right back arrow button on small/medium screens only (`lg:hidden`) to return to main dashboard home.
- Updated dashboard navigation:
- desktop left sidebar now includes `History`.
- mobile/tablet bottom footer remains unchanged (no `History` tab added there).
- Updated/added tests for the modified dashboard/footer/more/account behavior.

### Files Edited
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `app/tcoin/wallet/components/dashboard/TransactionHistoryTab.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/components/modals/FutureAppFeaturesModal.tsx`
- `app/tcoin/wallet/components/modals/index.ts`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/index.ts`
- `app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `app/tcoin/wallet/components/dashboard/AccountCard.test.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `agent-context/session-log.md`

## v1.40
### Timestamp
- 2026-03-13 13:12:27 EDT

### Objective
- Eliminate recurring dashboard crash caused by WalletConnect runtime disconnect errors (`this.provider.disconnect is not a function`).

### What Changed
- Updated wallet layout provider bootstrapping to make Cubid WalletConnect provider stack opt-in instead of always-on.
- Added env-controlled switch:
- `NEXT_PUBLIC_ENABLE_CUBID_WALLET_PROVIDERS=true` to explicitly enable `cubid-sdk` + `cubid-wallet` providers.
- default behavior is now disabled (`false`) to avoid initializing the problematic WalletConnect path in normal wallet/dashboard usage.
- Preserved all existing app providers and rendering flow when Cubid providers are disabled.
- Kept existing `WalletConnectErrorGuard` in place for defense-in-depth.
- Verified no regressions on focused wallet tests (`wallet page`, `navbar`, `wallet home`).

### Files Edited
- `app/tcoin/wallet/layout.tsx`
- `agent-context/session-log.md`

## v1.41
### Timestamp
- 2026-03-13 13:39:05 EDT

### Objective
- Stop stale local dev instance on `3000` and swap `My Account` / `Charitable Contributions` panel positions on dashboard.

### What Changed
- Stopped the old server still listening on `:3000` so only the current app instance remains active.
- Updated `WalletHome` card order for both mobile and desktop dashboard grids:
- `My Account` now appears before `Charitable Contributions`.
- `Charitable Contributions` now appears where `My Account` previously appeared.
- Verified with focused dashboard home tests.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `agent-context/session-log.md`

## v1.42
### Timestamp
- 2026-03-13 13:41:23 EDT

### Objective
- Adjust large-screen left sidebar grouping so `Home` appears with the central nav button stack (above `Receive`).

### What Changed
- Updated desktop sidebar composition in `DashboardFooter`:
- removed the separate top-pinned `Home` item.
- included `Home` in the centered middle group and kept button order so it appears directly above `Receive`.
- kept `More` pinned at the bottom.
- Verified with focused footer tests.

### Files Edited
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `agent-context/session-log.md`

## v1.43
### Timestamp
- 2026-03-13 15:27:57 EDT

### Objective
- Simplify `More` actions and add explicit system-theme fallback in theme settings, then fix merchant dashboard redirect behavior in local/development environments.

### What Changed
- Removed `Buy TCOIN` and `Top Up with Interac eTransfer` actions from the wallet `More` tab.
- Added a third theme option in `Select Theme`:
- `Remove theme override` now clears local theme preference and follows system light/dark mode again.
- Extended dark-mode hook capabilities:
- added explicit theme override setter.
- added override-clear method.
- tracked whether current mode is following system preference.
- Updated merchant dashboard local-dev access guard:
- `/merchant` no longer redirects to `/` in `NEXT_PUBLIC_APP_ENVIRONMENT=local|development` when profile name is absent.
- data loading on `/merchant` is allowed in local/dev bypass mode.
- Updated `MoreTab` tests to reflect removed actions.
- Ran focused wallet tests for modified areas.

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/components/modals/ThemeSelectModal.tsx`
- `shared/hooks/useDarkMode.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.44
### Timestamp
- 2026-03-13 19:05:37 EDT

### Objective
- Implement merchant signup workflow with draft/pending/live/rejected lifecycle, per-city slug uniqueness, and city-manager approval APIs/UI in wallet app.

### What Changed
- Added new merchant signup schema migration (`v0.99`) with:
- store lifecycle + signup progression fields on `stores`.
- app-scoped slug/media/profile fields on `store_profiles`.
- `is_admin` on `store_employees`.
- `store_signup_events` audit table.
- Added merchant signup backend APIs:
- `GET /api/merchant/application/status`
- `POST /api/merchant/application/start`
- `POST /api/merchant/application/restart`
- `POST /api/merchant/application/step`
- `POST /api/merchant/application/submit`
- `GET /api/merchant/slug-availability`
- `POST /api/merchant/geocode` (Nominatim)
- Added city-manager backend APIs:
- `GET /api/city-manager/stores`
- `POST /api/city-manager/stores/:id/approve`
- `POST /api/city-manager/stores/:id/reject`
- Added shared merchant-signup server/types helpers.
- Updated store mutation APIs to require store-admin access for sensitive updates and seed first employee as admin.
- Updated wallet More tab merchant CTA to dynamic label based on merchant application state:
- `Sign up as Merchant`
- `Continue Merchant Application`
- `Open Merchant Dashboard`
- Added admin shortcut to wallet `/city-manager`.
- Refactored wallet merchant route:
- moved existing live merchant workspace into `LiveMerchantDashboard`.
- new `merchant/page.tsx` now orchestrates lifecycle states and guided 5-step signup flow with continue/restart draft handling.
- Added wallet city-manager page at `app/tcoin/wallet/city-manager/page.tsx` with pending/live/rejected filters and approve/reject actions.
- Extended `.env.local.example` with merchant signup feature flag and Nominatim user-agent configuration.

### Verification
- Ran `pnpm test app/tcoin/wallet/components/dashboard/MoreTab.test.tsx` (pass).
- Ran `pnpm exec tsc --noEmit` (fails due pre-existing unrelated TS issues outside this feature scope; no filtered errors from new merchant/city-manager files).

### Files Edited
- `supabase/migrations/20260313161000_v0.99_merchant_signup_city_manager.sql`
- `shared/lib/bia/server.ts`
- `shared/lib/merchantSignup/types.ts`
- `shared/lib/merchantSignup/server.ts`
- `shared/lib/merchantSignup/application.ts`
- `app/api/stores/route.ts`
- `app/api/stores/[id]/bia/route.ts`
- `app/api/merchant/application/status/route.ts`
- `app/api/merchant/application/start/route.ts`
- `app/api/merchant/application/restart/route.ts`
- `app/api/merchant/application/step/route.ts`
- `app/api/merchant/application/submit/route.ts`
- `app/api/merchant/slug-availability/route.ts`
- `app/api/merchant/geocode/route.ts`
- `app/api/city-manager/stores/route.ts`
- `app/api/city-manager/stores/[id]/approve/route.ts`
- `app/api/city-manager/stores/[id]/reject/route.ts`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/merchant/LiveMerchantDashboard.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `app/tcoin/wallet/city-manager/page.tsx`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.45
### Timestamp
- 2026-03-13 20:28:59 EDT

### Objective
- Apply the new merchant-signup migration to the linked Supabase DB, document the architecture in `/docs`, and prepare a follow-up commit.

### What Changed
- Applied linked DB migration with `supabase db push --linked`:
- `20260313161000_v0.99_merchant_signup_city_manager.sql`.
- Added architecture write-up for the implemented merchant signup + city-manager solution:
- `docs/merchant-signup-city-manager-architecture.md`.
- Updated session log with this follow-up execution record.

### Verification
- `supabase db push --linked` completed with migration applied.

### Files Edited
- `docs/merchant-signup-city-manager-architecture.md`
- `agent-context/session-log.md`

## v1.46
### Timestamp
- 2026-03-13 20:45:52 EDT

### Objective
- Improve merchant signup step-1 UX content and controls.

### What Changed
- Updated merchant signup step-1 introduction copy to clearly explain:
- merchants accept TCOIN (including partial payments),
- each merchant belongs to one neighbourhood/BIA,
- payments may arrive as TCOIN or local merchant tokens within the same BIA,
- only TCOIN is redeemable to CADm on CELO,
- redemptions are at 97% of par (3% below par), with 3% retained for charitable donations.
- Added a `Cancel` button on step 1 of the signup wizard.
- Step-1 cancel now closes the wizard and returns the user to the draft-application state view.

### Verification
- Reviewed rendered diff for `merchant/page.tsx` to confirm updated copy and step-1 cancel/back behavior.

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.47
### Timestamp
- 2026-03-13 21:01:56 EDT

### Objective
- Upgrade merchant signup UX with image uploads, live store preview, strict per-step completion gating, and clearer geocode/map behavior.

### What Changed
- Replaced step-2 image URL inputs with image upload functionality supporting both:
- file browsing,
- drag-and-drop upload.
- Added Supabase storage upload flow for step-2 logo/banner assets (`profile_pictures` bucket, `merchant_assets/...` paths).
- Added immediate visual preview handling for uploaded images and wired preview state cleanup for local blob URLs.
- Split step 2 into two halves:
- left side: store details + image upload controls,
- right side: live store page preview (banner frame + overlaid circular logo frame + live name/description).
- Added step validation gating so `Save and continue`/`Submit application` remain disabled until each step is fulfilled.
- Enforced step-2 gating to require both banner and logo uploads (and no in-flight upload) before continue.
- Updated step 3:
- lat/lng are now read-only display values (no editable input fields),
- editing address clears old coordinates until geocoded again,
- map preview is displayed after successful geocode.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass, no errors/warnings).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.48
### Timestamp
- 2026-03-13 21:12:51 EDT

### Objective
- Fix step-2 merchant preview overlap behavior and align image uploads to a dedicated merchant bucket.

### What Changed
- Updated merchant signup preview layout so the logo circle is overlaid across the bottom edge of the banner (clear partial overlap).
- Added spacing adjustments so preview text sits correctly below the overlaid logo.
- Switched merchant image uploads to dedicated Supabase bucket constant:
- `merchant_assets`.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.49
### Timestamp
- 2026-03-13 21:18:25 EDT

### Objective
- Add a migration that provisions the merchant image storage bucket and required policies.

### What Changed
- Added idempotent Supabase migration to create bucket:
- `merchant_assets` (public).
- Added `storage.objects` policies scoped to `merchant_assets`:
- public `SELECT`,
- authenticated `INSERT`,
- authenticated `UPDATE` (required for upload upserts),
- authenticated `DELETE`.

### Files Edited
- `supabase/migrations/20260313211500_v1.00_merchant_assets_bucket.sql`
- `agent-context/session-log.md`

## v1.50
### Timestamp
- 2026-03-13 21:30:40 EDT

### Objective
- Refine merchant signup step-3 address UX and CTA placement.

### What Changed
- Updated step-3 address placeholder to sample text:
- `123 Main St, Smallville, England`.
- Hid latitude/longitude display until geocoding succeeds.
- Removed inline geocode button from step body and moved it into the bottom action row.
- Added pink primary CTA in step 3:
- button text `Find this address`,
- positioned immediately left of `Save and continue`.
- Added geocoding loading state for this CTA (`Finding...`) and disabled it when address is empty or while requests are in flight.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.51
### Timestamp
- 2026-03-13 21:51:23 EDT

### Objective
- Align step-3 geocode CTA/button styling and improve address/map usability.

### What Changed
- Removed hardcoded color override from step-3 `Find this address` button so it uses the standard app button styling (shared CSS theme pink).
- Lightened step-3 address placeholder text styling for better visual distinction from user-entered text.
- Updated OSM embed URL generation to include a computed neighborhood-scale bbox (~1000m span) centered on the geocoded coordinates.
- Kept marker centered on the resolved address while defaulting initial view to local neighborhood scale instead of global zoom.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.52
### Timestamp
- 2026-03-13 22:03:35 EDT

### Objective
- Improve step-3 address flow by locking geocoded addresses and adding explicit edit/re-geocode behavior.

### What Changed
- Added address edit/lock state to step 3:
- after successful geocode, address field becomes read-only display,
- geocoded address is rendered as multi-line rows (split by comma segments),
- input frame is removed in read-only mode.
- Added `Edit address` button in action row for step 3:
- reenables address editing,
- clears lat/lng so re-geocoding is required,
- disables `Save and continue` until address is geocoded again.
- Updated step-completion gate for step 3 to require both geocoded coordinates and non-editing (locked) state.
- Kept map/coordinate display only after geocoding succeeds.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.53
### Timestamp
- 2026-03-13 22:23:43 EDT

### Objective
- Expand Supabase seed data substantially across project tables and use it to reset/populate the linked database.

### What Changed
- Added new comprehensive seed file:
- `supabase/seed.sql`.
- Seed now includes representative dummy data across:
- core public app tables (`users`, app registry tables, wallet/share tables, transactions, notifications, stores, merchant signup, approvals),
- BIA/voucher/onramp tables,
- contract management metadata tables,
- indexer control + derived tables (`indexer.*`),
- chain event/materialized data tables (`chain_data.*`),
- cron logging table.
- Included deterministic IDs/UUIDs and conflict-safe upserts to keep seed rerunnable.
- Added sequence sync statements for identity-backed tables seeded with explicit IDs.
- Fixed seed compatibility with current migrated schema by removing non-portable `user_encrypted_share` column assumptions (`credential_id` was not present at runtime schema state).

### Verification
- Ran linked remote reset with seed execution:
- `printf 'y\n' | supabase db reset --linked`
- Reset completed successfully and seeded data from `supabase/seed.sql`.

### Files Edited
- `supabase/seed.sql`
- `agent-context/session-log.md`

## v1.54
### Timestamp
- 2026-03-13 22:25:06 EDT

### Objective
- Add explicit City Admin access from the wallet More tab.

### What Changed
- Updated More tab admin controls to include a dedicated button:
- `Open City Admin`.
- Routed button to new wallet route alias:
- `/city-admin`.
- Added new route:
- `app/tcoin/wallet/city-admin/page.tsx` which redirects to existing city manager workspace (`/city-manager`).
- Updated More tab tests to assert city-admin button visibility for admin users and route navigation behavior.

### Verification
- Ran `pnpm test app/tcoin/wallet/components/dashboard/MoreTab.test.tsx` (pass, 10 tests).
- Ran `pnpm exec eslint app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/city-admin/page.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/city-admin/page.tsx`
- `agent-context/session-log.md`

## v1.55
### Timestamp
- 2026-03-13 22:46:29 EDT

### Objective
- Add a seeded admin user for `hubert.cormac@gmail.com`.

### What Changed
- Updated `supabase/seed.sql` to include:
- new user row with email `hubert.cormac@gmail.com`,
- `is_admin = true`,
- deterministic seeded identity values (`id=1004`, username `hubert-cormac`).
- Added matching seeded admin role assignment in wallet dev app instance.
- Added matching seeded `app_user_profiles` row for consistency.

### Files Edited
- `supabase/seed.sql`
- `agent-context/session-log.md`
