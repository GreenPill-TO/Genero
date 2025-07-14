# Genero

Genero is a Next.js application that implements **T-Coin**, a Toronto-focused digital currency. The repository contains two main app variants: `wallet` for payments and `sparechange` for micro‑donations. These apps live under `app/[CITYCOIN]/[APP_NAME]` where the values are provided via environment variables.

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
  api/                   # Next.js API routes
  [citycoin]/
    wallet/
      components/
      dashboard/
      styles/
      welcome/
    sparechange/
      components/
      dashboard/
      home/
      styles/
      welcome/
shared/
  api/                   # Cubid and Supabase service wrappers
  components/            # Reusable UI components
  contexts/              # React context providers
  hooks/                 # Custom React hooks
  lib/                   # Utility libraries
  providers/             # Application providers
  styles/                # Global stylesheets
  types/                 # TypeScript types
  utils/                 # Helper utilities
public/                  # Static assets
```

API routes for Twilio OTP verification are located under `app/api`.

## Environment Variables

Credentials for Supabase, Cubid and Twilio are required. They are referenced throughout the hooks in `shared/` and the API routes. Refer to `.env.local.example` for full details.

## Contribution

Use 2 spaces for indentation and run `pnpm lint` before committing changes.

## Potential Improvements

- Add automated tests for API routes and critical hooks
- Introduce a CI workflow that runs `pnpm lint` and `pnpm build`
- Centralize error handling for the Twilio endpoints
- Add end-to-end tests for the wallet and donation flows

## License

MIT
