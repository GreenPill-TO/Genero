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
  - `public.app_user_profiles` enforces row-level security so authenticated users can only read and mutate profile rows tied to their own `auth_user_id`.
  - `public.connections` uses composite foreign keys `(owner_user_id, app_instance_id)` and `(connected_user_id, app_instance_id)` into `public.app_user_profiles` with `ON DELETE CASCADE` for app-scoped relationship integrity.
  - Shared app-scoped user settings are now served by the `supabase/functions/user-settings` edge function, which resolves the authenticated `users` row plus the active `ref_app_instances` record before reading or mutating profile/preferences/signup state.
  - `public.charities` is restored as the shared charity catalogue for wallet and sparechange settings, with authenticated read access and deterministic seed rows so the user-settings bootstrap can always populate required charity choices.
  - Supabase Storage now provisions a public `profile_pictures` bucket for user avatars, with authenticated write/update/delete policies and public read access for rendered profile images.
  - Agents may prepare migrations and inspect local schema files, but linked-database mutation commands remain human-only and require explicit approval before any `supabase --linked` or equivalent write operation is attempted.
- **Wallet/Identity**: Cubid (web3 login + wallet abstraction)
- **CI**: GitHub workflow installs dependencies with `pnpm install --no-frozen-lockfile`

## Architecture

- **Monorepo Design**: Dynamic routing based on `NEXT_PUBLIC_CITYCOIN` and `NEXT_PUBLIC_APP_NAME`.
  app/
  [citycoin]/wallet/
  [citycoin]/sparechange/
  shared/ # Shared UI + logic
- **API Routes**: Custom `/api/auth/sms` for Twilio verification, wallet auth, and onboarding.
  - Protected wallet control-plane routes now resolve app-scoped access server-side from `public.roles` (`admin`/`operator`) against the active `ref_app_instances` record, and UI affordances are keyed from that same API contract.
  - Wallet user-managed settings surfaces (`/welcome`, Edit Profile, Theme, Charity, BIA preferences) now use the shared user-settings edge function rather than bespoke Next API handlers or direct browser table writes.
  - Client control-plane access caching is now keyed by authenticated user identity as well as city slug so role-derived UI state cannot leak across account switches.
- **Environment-Based Config**: CityCoin-specific logic toggled via `.env`.
  - **App Registry**: `ref_apps`, `ref_citycoins`, and `ref_app_instances` tables track each deployment pairing with unique slugs;
    runtime helpers resolve the active combination from `NEXT_PUBLIC_APP_NAME`/`NEXT_PUBLIC_CITYCOIN` and cache the identifier for Supabase
    queries.

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
- Dashboard tab deep-links are now URL-backed for both footer navigation and programmatic tab changes, so internal transitions remain consistent with `/dashboard?tab=...`.
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
- `/admin` and `/city-manager` access is now aligned to the app-scoped API role check instead of the looser local `is_admin` profile flag, preventing UI links from exposing pages that the API will reject.
- Legacy `/admin` ramp-request loading now runs through a server endpoint that can report missing legacy schema objects directly; the repository migrations currently do not fully define the legacy `interac_transfer`/`off_ramp_req` shape or `ref_request_statuses`.
- Deep-link scans on the wallet dashboard run only when the URL includes a `pay` query, and success toasts fire after user lookup and connection insertion.
- Footer navigation icons are evenly spaced and centred, with a prominent Send action.
- Send tab uses a shared QR scanning modal instead of an embedded scanner, but still offers buttons to select a contact or paste a pay link and always displays the send form with amount inputs and a send button.
- In Manual mode the Send tab shows a borderless oversized amount input with a CAD/TCOIN toggle, displays the converted value rounded to two decimals alongside the available balance and a "Use Max" shortcut, and only reveals scan or contact options once a positive amount is entered.
- Receive tab renders its QR code with a white background for visibility in dark mode.
- Requests-to-pay modal styles Pay with the primary pink button and Ignore with a white button for clearer affordances.
- Receive tab lists outgoing requests under a "Payment requests I have sent" heading and delete buttons call Supabase to set `is_active` to false.
- Dark mode preference persists across tab switches via localStorage.
- Header camera button immediately opens the scan modal from any tab.
- On the wallet landing page, small screens and tablet landscape move the unauthenticated tagline lines plus the "<open my wallet>" call-to-action into a scrollable body section at the top, while medium portrait and larger screens keep these controls in the fixed header.
- Wallet landing banner images on small screens now use full-image containment (no cropping) with a capped visual height, and landing-page content maintains about 70% width in tablet portrait and phone landscape layouts to preserve side margins.
- On phone portrait viewports, the landing footer collapses into one column with right-aligned stacked links above left-aligned TCOIN branding and copyright text.
- Wallet landing heading rhythm uses asymmetrical spacing (`mt-9`/`mb-6`) so the space before each section title is roughly 50% larger than the space after it.
- Wallet landing header and fade strip are rendered as separate fixed layers; the gradient strip top offset is continuously synced from measured header height (ResizeObserver + load/resize + RAF) with a 1px overlap to avoid any visible fully-opaque gap between header and fade on initial large-screen render.
- Wallet landing midsize layout uses a `15/70/15` header grid with banner images at `md:w-[75%]`, ensuring banner width stays below body-column width but never drops under half that column.
- On tablet portrait (768-1023, portrait), wallet header content is centre-aligned and the "<open my wallet>" CTA appears in a third row below the tagline as a centred block (`w-fit` + `mx-auto`); side-column CTA remains for desktop widths.
- Wallet landing banner growth is capped between 535-767px via `max-w-[535px]` to keep the fade strip from covering the top summary line in that band.
- Wallet landing tagline uses a 1023-1163px-only `text-sm` + `whitespace-nowrap` rule to prevent two-line overflow near desktop breakpoint transitions.
- Wallet landing dark mode now uses a near-black to charcoal vertical gradient for less stark contrast, with white section headings over light-grey body text.
- Wallet landing "<open my wallet>" CTAs use a light-grey gradient background in dark mode to maintain contrast without pure white blocks.
- Wallet landing dark shell now uses a stronger near-black to charcoal gradient (`#030303 -> #111111 -> #2a2a2a`) and dark-mode content containers avoid opaque overlays so the gradient remains visible.
- Dark-mode landing CTAs now use a brighter three-stop light-grey gradient with a subtle grey border for clearer affordance.
- Landing footer links now use base body text sizing for consistency with page copy.
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
- Wallet custody shares are normalised into `wallet_keys` (`user_id` + `namespace`) so multiple wallet addresses can reference one key via `wallet_key_id`; `wallet_list` no longer stores raw `app_share` directly.
- `user_encrypted_share` rows are linked to the same `wallet_keys` record through `wallet_key_id`, enabling deterministic key reconstruction for wallets that share custody material.
- `user_encrypted_share` now stores decoded `credential_id`, scoped `app_instance_id`, optional `device_info`, and lifecycle audit timestamps (`last_used_at`, `revoked_at`) so passkey lookups are app-aware and traceable.
- Legacy `user_encrypted_share` backfills infer `app_instance_id` from the user's latest `app_user_profiles` row before falling back to the default wallet/tcoin app instance.
- Legacy/malformed passkey credential identifiers are backfilled to deterministic `legacy-{row_id}` values so `credential_id` can be enforced as non-null and uniquely constrained per `(wallet_key_id, app_instance_id, credential_id)`.
- `wallet_list.wallet_key_id` remains nullable for legacy/system rows where `user_id` is null, but user-owned rows are constrained to include a key reference.
- New-user sign-in routes to `/welcome`, which proposes a sanitized username, debounces Supabase availability checks, surfaces phone verification status, and clarifies why the Continue action may be disabled.
- Wallet user settings now flow through a single normalized bootstrap payload containing:
- base user profile fields from `users`,
- app-scoped preferences from `app_user_profiles`,
- theme from `metadata.appearance.theme`,
- resumable signup state from `metadata.signup`,
- BIA selections from the affiliation tables,
- wallet readiness derived from existing wallet custody/share tables.
- Theme preference is now server-backed per app instance, cached locally only for first paint under `theme_cache:${appSlug}:${citySlug}:${environment}`, and legacy local theme keys are migrated after authenticated bootstrap when the server is still on `system`.
- Wallet `/welcome` is now a resumable six-step wizard (welcome, user details, profile picture, community settings, wallet setup, final hand-off), and both onboarding plus Edit Profile upload avatars through the same `shared/lib/supabase/profilePictures.ts` helper.
- The wallet layout now always mounts the Cubid SDK `Provider` and `WalletCubidProvider`, even when the older `NEXT_PUBLIC_ENABLE_CUBID_WALLET_PROVIDERS` flag is unset, so inline Cubid verification widgets on `/welcome` inherit the wagmi context they require.
- The linked remote Supabase project now seeds `Daily Bread Food Bank`, `Native Women's Resource Centre of Toronto`, and `Parkdale Community Food Bank` into `public.charities`, which unblocks the required charity step in wallet onboarding and the direct-read sparechange charity modal.
- Step 5 of wallet onboarding now exposes a development-only/local-only `Skip` action when `NEXT_PUBLIC_APP_ENVIRONMENT` is `development` or `local`; the edge function mirrors that rule so wallet setup can be bypassed only in those environments.
