# Technical Specification: Genero

## Stack

- **Framework**: Next.js (App Router, ISR ready)
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Styling**: TailwindCSS + Radix UI
- **Authentication**: Twilio SMS OTP via API routes
- **Storage**: Supabase (Postgres + Auth)
- **Wallet/Identity**: Cubid (web3 login + wallet abstraction)

## Architecture

- **Monorepo Design**: Dynamic routing based on `NEXT_PUBLIC_CITYCOIN` and `NEXT_PUBLIC_APP_NAME`.
  app/
  [citycoin]/wallet/
  [citycoin]/sparechange/
  shared/ # Shared UI + logic
- **API Routes**: Custom `/api/auth/sms` for Twilio verification, wallet auth, and onboarding.
- **Environment-Based Config**: CityCoin-specific logic toggled via `.env`.

## Extensibility

- Easily forkable to new cities by duplicating `[citycoin]` folders and updating branding/env vars.
- Centralized UI logic in `shared/` keeps code DRY across cities/apps.

## Notable Features

- NFC/RFID support planned for physical tBill integrations.
- Demurrage timers for token decay embedded in wallet logic.
- Wallet landing page styled after Thinking Machines with mission-driven copy.
- Homepage sets body font to the Special Elite typewriter font via a style tag with system-ui fallback; headings are bold, centred, and the same size as body text.
- Banner image matches text width and a minimal navbar displays "<open my wallet>" linking to the dashboard.
- Sections have slimmer spacing and the prior blue accent line is removed.
- ESLint config disables react/no-unescaped-entities.
- Next.js config allows remote images from Supabase for the banner.
