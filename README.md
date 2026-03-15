# Genero

Genero is a Next.js monorepo for applications that implements local **"citycoins"**, built on new monetary principles. The first implementation is **T-Coin**, a Toronto-focused digital currency. The repository contains two main app variants: `wallet` for payments and `sparechange` for micro‑donations. These apps live under `app/[CITYCOIN]/[APP_NAME]` where the values are provided via environment variables.

The project integrates Supabase for storage, Cubid for identity and wallet management and Twilio for SMS based verification. UI components are built with React, TailwindCSS and Radix.

## Requirements

- Node.js 20+
 - pnpm

## Setup

1. Copy `.env.local.example` to `.env.local` and populate the variables. The sample file lists the expected values and explains what each is for.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dev
   ```

Open `http://localhost:3000` in your browser. Next.js will serve the app configured by `NEXT_PUBLIC_CITYCOIN` and `NEXT_PUBLIC_APP_NAME`.

## Scripts

- `pnpm dev` – run the development server
- `pnpm build` – create a production build
- `pnpm start` – start the production server
- `pnpm lint` – run ESLint

## Project Structure

```
app/
  [citycoins]/     # Starting with Toronto's TCOIN, this monorepo allows for multiple cities, each with their own local currency
    [citycoin apps]/  # Each citycoin will have one or more dedicated apps, aka wallets.
agent-context/     # Session workflow, logs, app context, and agent operating notes
docs/
  engineering/     # Engineering specs and root-level architecture notes
shared/            # Reusable hooks, components and utilities
  lib/edge/        # Typed browser clients and app-scope helpers for Supabase Edge Functions
supabase/
  migrations/      # Versioned SQL migrations synced with Supabase
  functions/       # Supabase Edge Functions plus shared Deno helpers
    _shared/       # Shared auth, scoping, RBAC, validation, and domain helpers
```

API routes for Twilio OTP verification and temporary compatibility shims are located under `app/api`.

The current implementation specs live in `docs/engineering/technical-spec.md` and `docs/engineering/functional-spec.md`. Session-by-session change history remains in `agent-context/session-log.md`.

## Environment Variables

Credentials for Supabase, Cubid and Twilio are required. They are referenced throughout the hooks in `shared/` and the API routes. Refer to `.env.local.example` for full details.

Notably, use variables NEXT_PUBLIC_CITYCOIN= to determin which city and citycoin to deploy, and NEXT_PUBLIC_APP_NAME= to pich which app to deploy to serve your citycoin.

## Future Improvements

- Add automated tests for API routes
- Introduce a CI workflow to run `pnpm lint` and builds

## Contribution

Use 2 spaces for indentation and run `pnpm lint` before committing changes.

## License

MIT
