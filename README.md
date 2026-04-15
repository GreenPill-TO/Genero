# Genero

Genero is a Next.js monorepo for applications that implements local **"citycoins"**, built on new monetary principles. The first implementation is **T-Coin**, a Toronto-focused digital currency. The repository contains two main app variants: `wallet` for payments and `sparechange` for micro‑donations. These apps live under `app/[CITYCOIN]/[APP_NAME]` where the values are provided via environment variables.

The project integrates Supabase for storage, Cubid for identity and wallet management and Twilio for SMS based verification. UI components are built with React, TailwindCSS and Radix.

## Requirements

- Node.js 20+
 - pnpm

## Setup

1. Copy `.env.example` to `.env.local` and populate the Next app variables. If you also deploy Supabase Edge Functions from this repo, use `supabase/functions/.env.example` as the companion edge-runtime template.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
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
- `pnpm start` – start the production server
- `pnpm supabase:start:local` – start the local Supabase stack for this repo and patch local GoTrue mailer host handling
- `pnpm lint` – run ESLint

## Project Structure

```
app/
  [citycoins]/     # Starting with Toronto's TCOIN, this monorepo allows for multiple cities, each with their own local currency
    [citycoin apps]/  # Each citycoin will have one or more dedicated apps, aka wallets.
agent-context/     # Session workflow, logs, app context, and agent operating notes
contracts/
  foundry/         # TorontoCoin Solidity workspace, deployment artefacts, and runtime manifests
docs/
  engineering/     # Engineering specs and root-level architecture notes
scripts/           # Repository helper scripts, including TorontoCoin operator health checks
shared/            # Reusable hooks, components and utilities
  lib/contracts/   # Runtime contract bridges and operator status helpers
  lib/edge/        # Typed browser clients and app-scope helpers for Supabase Edge Functions
supabase/
  migrations/      # Versioned SQL migrations synced with Supabase
  functions/       # Supabase Edge Functions plus shared Deno helpers
    _shared/       # Shared auth, scoping, RBAC, validation, and domain helpers
```

API routes for Twilio OTP verification and temporary compatibility shims are located under `app/api`.

The current implementation specs live in `docs/engineering/technical-spec.md` and `docs/engineering/functional-spec.md`. Session-by-session change history remains in `agent-context/session-log.md`.

TorontoCoin retail runtime now uses the fresh Celo mainnet suite surfaced through `shared/lib/contracts/torontocoinRuntime.ts` for buy, transfer, and operator-health flows. Legacy city-registry resolution remains in place only for older contract-management surfaces that have not yet been repointed.

## Environment Variables

Credentials for Supabase, Cubid and Twilio are required. The Next app template lives at `.env.example`, and the Supabase Edge Functions template lives at `supabase/functions/.env.example`.

Notably, use variables NEXT_PUBLIC_CITYCOIN= to determin which city and citycoin to deploy, and NEXT_PUBLIC_APP_NAME= to pich which app to deploy to serve your citycoin.

## Future Improvements

- Add automated tests for API routes
- Introduce a CI workflow to run `pnpm lint` and builds

## Contribution

Use 2 spaces for indentation and run `pnpm lint` before committing changes.

## License

MIT
