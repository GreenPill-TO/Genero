# Genero

Genero is a Next.js monorepo for applications that implement local **"citycoins"**, built on new monetary principles. The first implementation is **T-Coin**, a Toronto-focused digital currency. The repository contains the wallet, sparechange, contracts, Supabase Edge Functions, and operator scripts needed to run the TorontoCoin app family.

The project integrates Supabase for storage and auth, Cubid for onboarding and wallet-management surfaces, Twilio Verify for SMS OTP, and Celo/TorontoCoin contracts for the live token runtime. UI components are built with React, Tailwind CSS, Radix, and the local shared component/hook libraries.

## Requirements

- Node.js 20+
- pnpm 10.x, matching the `packageManager` field in `package.json`
- Docker/Colima for local Supabase work
- Supabase CLI for local or remote migration validation
- Foundry for TorontoCoin contract/deployment work under `contracts/foundry`

## Setup

1. Copy `.env.example` to `.env.local` and populate the Next app variables. If you also deploy Supabase Edge Functions from this repo, use `supabase/functions/.env.example` as the companion edge-runtime template.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the default development server:
   ```bash
   pnpm dev
   ```

If you want separate local-dev Supabase target profiles, keep shared values in `/.env.local` and run one of:

```bash
pnpm dev:supabase-local
pnpm dev:supabase-remote
```

Those commands layer one of these ignored local-only files on top of the shared base env:

- `/.env.local-supabase-local`
- `/.env.local-supabase-remote`

For local Supabase work under Colima, start the trimmed local stack with:
```bash
pnpm supabase:start:local
```
That helper switches to the `colima-varrun` Docker context when available and reapplies the GoTrue mailer-host patch needed to suppress local `GOTRUE_MAILER_EXTERNAL_HOSTS` warnings for browser and gateway traffic (`localhost`, `127.0.0.1`, and the local `kong` gateway host).

Open `http://localhost:3000` in your browser. Next.js will serve the app configured by `NEXT_PUBLIC_CITYCOIN` and `NEXT_PUBLIC_APP_NAME`.

## Scripts

- `pnpm dev` – run the development server
- `pnpm dev:supabase-local` – run the development server with the local-Supabase env profile layered on top of `/.env.local`
- `pnpm dev:supabase-remote` – run the development server with the remote-Supabase env profile layered on top of `/.env.local`
- `pnpm build` – create a production build
- `pnpm build:supabase-local` – create a production build with the local-Supabase profile loaded
- `pnpm build:supabase-remote` – create a production build with the remote-Supabase profile loaded
- `pnpm start` – start the production server
- `pnpm start:supabase-local` – start the production server with the local-Supabase profile loaded
- `pnpm start:supabase-remote` – start the production server with the remote-Supabase profile loaded
- `pnpm smoke:e2e` – run the Playwright smoke harness against `SMOKE_BASE_URL` or a local production server
- `pnpm smoke:e2e:supabase-local` – build with the local-Supabase profile and smoke stable public/preview-safe routes in Chromium
- `pnpm supabase:start:local` – start the local Supabase stack for this repo and patch local GoTrue mailer host handling
- `pnpm lint` – run Next.js lint plus the app-facing Supabase boundary guard
- `pnpm test` – run the Vitest suite
- `pnpm ops:wallet:preflight:supabase-local` – run the wallet release preflight against the local Supabase profile
- `pnpm ops:wallet:preflight:supabase-remote` – run the wallet release preflight against the remote Supabase profile
- `pnpm ops:wallet:preflight:deployment` – run the wallet release preflight against process env only
- `pnpm ops:indexer:drain-touch-queue` – drain one queued async indexer touch request from the worker runtime
- `pnpm ops:torontocoin`, `pnpm ops:torontocoin:pools`, `pnpm ops:torontocoin:acceptance` – run TorontoCoin operator health checks

## Project Structure

```
.github/workflows/       # Frontend CI, Supabase migration deploy/dry-run, and secret scanning
agent-context/           # Session workflow, logs, app context, and agent operating notes
app/
  tcoin/                 # TorontoCoin apps and contract-management surfaces
    wallet/              # General-purpose TorontoCoin wallet
    sparechange/         # SpareChange app
    contracts/           # Contract-management UI
contracts/
  foundry/               # TorontoCoin Solidity workspace, deployment artefacts, and runtime manifests
docs/
  engineering/           # Current specs, architecture notes, and release runbooks
scripts/                 # Repository helper scripts, env/profile loaders, and operator checks
services/                # Node service modules for indexer/onramp workers and shared runtime logic
shared/                  # Reusable hooks, components, clients, and utilities
  lib/contracts/         # Runtime contract bridges and operator status helpers
  lib/edge/              # Typed browser clients and app-scope helpers for Supabase Edge Functions
supabase/
  migrations/            # Versioned SQL migrations synced with Supabase
  functions/             # Supabase Edge Functions plus shared Deno helpers
    _shared/             # Shared auth, scoping, RBAC, validation, and domain helpers
```

API routes for Twilio OTP verification and temporary compatibility shims are located under `app/api`.

The current implementation specs live in `docs/engineering/technical-spec.md` and `docs/engineering/functional-spec.md`. Session-by-session change history remains in `agent-context/session-log.md`.

TorontoCoin retail runtime now uses the fresh Celo mainnet suite surfaced through `shared/lib/contracts/torontocoinRuntime.ts` for buy, transfer, and operator-health flows. Legacy city-registry resolution remains in place only for older contract-management surfaces that have not yet been repointed.

## Environment Variables

Credentials for Supabase, Cubid and Twilio are required. The Next app template lives at `.env.example`, and the Supabase Edge Functions template lives at `supabase/functions/.env.example`.

Use `NEXT_PUBLIC_CITYCOIN` to choose the city/currency scope and `NEXT_PUBLIC_APP_NAME` to choose the deployed app surface. For TorontoCoin wallet release work, the canonical public Supabase key is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; retired aliases are not active runtime inputs.

Local development can use one shared base env plus target-specific overlays:

- `/.env.local` for shared local values
- `/.env.local-supabase-local` for local app plus local Supabase
- `/.env.local-supabase-remote` for local app plus remote Supabase

Do not put real secrets in checked-in files. Keep `SUPABASE_SERVICE_ROLE_KEY` out of deployed Next.js/Vercel envs; it belongs in the external indexer worker runtime and privileged Supabase Edge Function runtime when those surfaces intentionally need it.

## CI And Database Delivery

Pull requests run frontend CI, secret scanning, and Supabase migration validation when relevant. The dedicated TCOIN Supabase workflow dry-runs migrations for PRs into `dev` against `Preview – tcoin` and PRs into `main` against `Production – tcoin`; pushes to those branches deploy migrations to the matching database after the GitHub Environment gate.

Agents must never directly mutate a linked Supabase database. Remote schema changes should flow through reviewed migrations and the guarded GitHub workflow, or through an explicit human/operator action described in the relevant runbook.

## Supabase Boundary

Wallet and SpareChange app-facing data flows should prefer typed Supabase Edge Functions, narrow RPCs, or documented server boundaries instead of broad browser/client table access. Existing direct access paths are either compatibility surfaces or cleanup candidates; new app-facing direct table reads/writes need an explicit reason in the engineering docs.

## Contribution

Use 2 spaces for TypeScript indentation, keep Solidity at 4 spaces, and run the relevant checks before committing. For ordinary app/runtime changes, start with `pnpm lint` and `pnpm test`; for release work, also run the profile-specific preflight and smoke checks in `docs/engineering/wallet-release-runbook.md`. The current testing contract lives in `docs/engineering/testing-ci-contract.md`.

## License

MIT. See [LICENSE](./LICENSE).
