# Technical Specification: Genero

## Stack

- **Framework**: Next.js (App Router, ISR ready)
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Styling**: TailwindCSS + Radix UI
- **Testing**: Vitest with tsconfig path resolution for unit tests
- **Authentication**: Twilio SMS OTP via API routes
- **Storage**: Supabase (Postgres + Auth)
- **Wallet/Identity**: Cubid (web3 login + wallet abstraction)
- **CI**: GitHub workflow installs dependencies with `pnpm install --no-frozen-lockfile`

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
- Modal provider listens for the Escape key to dismiss any open modal.
- QR scanning modal requests camera access via `navigator.mediaDevices.getUserMedia`.
- Demurrage timers for token decay embedded in wallet logic.
- Wallet landing page styled after Thinking Machines with mission-driven copy.
- Homepage sets body font to the Special Elite typewriter font via a style tag with system-ui fallback; headings are bold, centred, same size as body text, and spaced with one blank line above and below.
- Section padding removed so the net spacing around headings is exactly one blank line.
- Banner image matches text width and the "<open my wallet>" link is positioned within the right margin, linking to the dashboard.
- Sections have slimmer spacing and the prior blue accent line is removed.
- ESLint config disables react/no-unescaped-entities.
- Banner and tagline are placed in the fixed header so the page scrolls underneath, and the header has no shadow.
- Footer background is white with black text.
- Body content and banner span roughly 60% width on large screens to reduce side margins.
- Tagline reads "Local Currency. Value = $3.35. Proceeds to charity." as plain text, right-aligned with margin below.
- The first section includes extra top padding so content clears the fixed header.
- Header split into three columns with left blank, centre column equal to body width containing banner and right-aligned tagline, right column with the "<open my wallet>" link.
- Footer now lists links to Whitepaper, Github and a new contact page.
- Added a Resources page with links to the hackathon submission, whitepaper, presentation and source code and a return-home link.
- Contact page features a form that records user requests in Supabase `user_requests` along with an array of detected IP addresses and offers clearer spacing before the return-home link.
- Resources and Contact pages reuse the landing page header and footer, adopt the wider layout and are accessible without authentication.
- Wallet dashboard (`/dashboard`) is also a public route, allowing unauthenticated access and rendering without the navbar or toast notifications.
- Landing page links resolve to the whitepaper, Telegram chat, presentation and source code repository.
- Twilio API routes initialise clients inside handlers so builds succeed without environment variables.
- All section headings use the `font-extrabold` class for extra emphasis.
- Next.js config allows remote images from Supabase for the banner.
- Copy uses standard dashes and closes with "build up - not extract from - our communities".
- Dark mode hook initialises based on `prefers-color-scheme` and syncs theme across pages, applying the `dark` class to the body so background colours and banner images switch appropriately.
- Dashboard background swaps between white and black according to the current theme.
- Landing, Resources and Contact pages use `bg-background` and `text-foreground` so colours follow the active theme.
- Footer component uses themed colours and is injected by the layout to avoid duplicates.
- On small screens the landing header hides the tagline and shows a hamburger icon that slides out a panel from the right with the tagline and "<open my wallet>" link.
- Layout sets the page background to white in light mode and black in dark mode, leaving headers, footers and other panels with `bg-background` for contrast.
- Highlight spans on public wallet pages use `bg-gray-200` in light mode and `dark:bg-gray-700` in dark mode to emphasise key phrases.
- The top-right call-to-action aligns vertically with the banner image and a duplicate "<open my wallet>" link is centred beneath the closing copy.
- Landing header swaps between light and dark banner images using Tailwind's `dark` utility, with the dark image URL carrying a version query to bypass stale caches.
- Tailwind is configured for class-based dark mode so `dark:` utilities respond to the root `dark` class.
- "<open my wallet>" links on the landing page display as rectangular buttons with #05656F backgrounds and white text in light mode and invert colours in dark mode.
- Contact page send button adopts a #05656F background in light mode.
- Hamburger icon in the landing header uses #05656F in light mode.
- Theme background variables are now pure white for light mode and pure black for dark mode, and the landing, resources and contact main panels force black backgrounds when dark mode is active.
- Public page wrappers now use `bg-background` so panels take their colour from the theme variable instead of hard-coded white.
- Internal links use root-relative URLs and rewrites map them to the wallet app, eliminating `/tcoin/wallet` from page paths.
