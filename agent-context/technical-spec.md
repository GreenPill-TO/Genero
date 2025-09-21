# Technical Specification: Genero

## Stack

- **Framework**: Next.js (App Router, ISR ready)
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Styling**: TailwindCSS + Radix UI
  - Tailwind preset centralizes theme and plugins; wallet and sparechange supply app-specific configs with custom content globs.
  - Slide animations use built-in fractional distances to avoid ambiguous utility classes during builds.
- **Testing**: Vitest with tsconfig path resolution for unit tests
  - Tests run in a jsdom environment to provide DOM APIs
  - React Query hooks in tests are wrapped with `QueryClientProvider` and external modules are mocked as needed
- **Authentication**: Twilio SMS OTP via API routes
- **Storage**: Supabase (Postgres + Auth)
  - Browser storage (e.g. `localStorage`) is accessed inside `useEffect` hooks with window guards to avoid Node build-time warnings
  - `agent-context/sql-schema-v0.sql` snapshots the current public schema (tables, enums, RPC signatures) pulled via the Supabase OpenAPI using the anon key; function bodies remain server-side
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
- Public `/ecosystem` page lists allied projects, links from resources and the landing footer for SEO, and opens external links in new tabs with `rel="noopener noreferrer"`.
- Send tab converts string token balances to numbers before performing arithmetic.
- Token balances from Web3 are returned as strings; dashboard components parse them to numbers before applying arithmetic or `toFixed`.
- Sign-in modal shows a spam-folder notice with an inline "Resend Code" link instead of a button.
- Entering the sixth digit in the sign-in modal automatically submits the verification form.
- Send tab binds `useSendMoney` with the authenticated user's ID and selected recipient to avoid undefined sender errors.
- Contact selection modal returns full contact objects so downstream send logic can derive receiver IDs and display metadata.
- Dashboard components guard against null recipient data, and send logic only fires after payload verification with resilient Supabase fetches.
- An `ErrorBoundary` wraps the wallet dashboard to gracefully handle runtime failures.
- Wallet landing page styled after Thinking Machines with mission-driven copy.
- Homepage sets body font to the Special Elite typewriter font via a style tag with system-ui fallback; headings are bold, centred, same size as body text, and spaced with one blank line above and below.
- Wallet dashboard overrides the global typeface with the device's native sans-serif font and provides dedicated tabs for Home, Send, Receive, and Contacts.
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
- Global footer removed from layout; the dashboard renders its own fixed footer navigation.
- Wallet dashboard is composed from modular cards (Contributions, Receive, Send, Account and Other) within `WalletHome`.
- `/admin` route renders an admin-only dashboard that fetches on-ramp/off-ramp requests from Supabase, lets admins adjust status, fees and notes, and is linked from the More tab when `is_admin` is true.
- Deep-link scans on the wallet dashboard run only when the URL includes a `pay` query, and success toasts fire after user lookup and connection insertion.
- Footer navigation icons are evenly spaced and centred, with a prominent Send action.
- Send tab uses a shared QR scanning modal instead of an embedded scanner, but still offers buttons to select a contact or paste a pay link and always displays the send form with amount inputs and a send button.
- In Manual mode the Send tab shows a borderless oversized amount input with a CAD/TCOIN toggle, displays the converted value rounded to two decimals alongside the available balance and a "Use Max" shortcut, and only reveals scan or contact options once a positive amount is entered.
- Receive tab renders its QR code with a white background for visibility in dark mode.
- Requests-to-pay modal styles Pay with the primary pink button and Ignore with a white button for clearer affordances.
- Receive tab lists outgoing requests under a "Payment requests I have sent" heading and delete buttons call Supabase to set `is_active` to false.
- Dark mode preference persists across tab switches via localStorage.
- Header camera button immediately opens the scan modal from any tab.
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
- Sign-in modals replace the single passcode field with six auto-advancing inputs that accept pasted codes.
- New-user sign-in routes to `/welcome`, which proposes a sanitized username, debounces Supabase availability checks, surfaces phone verification status, and clarifies why the Continue action may be disabled.
