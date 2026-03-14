# Functional Specification: Genero

## Overview

Genero is a multi-city, modular platform enabling the creation and operation of local digital currencies—"CityCoins"—that reinforce community wealth and sustainable economies. The first implementation is Toronto Coin (T-Coin).

## Apps

### 1. Wallet

- Digital wallet for holding, sending, and receiving CityCoins.
- Modal windows close when the Escape key is pressed, and zero-value requests prompt for confirmation before sending.
- Sign-in flow presents six single-digit inputs that auto-focus, advance and accept pasted codes.
- Interface includes balance display, QR payment flow, and transaction history.
- Homepage uses mission-driven copy with Thinking Machines layout.
- Closing line states "build up - not extract from - our communities" with space-dash-space style.
- Layout loads the Special Elite typewriter font via a style tag with system-ui fallback and uniform text size; headings are bold, centred, and spaced with one blank line above and below.
- Section margins trimmed so headings net exactly one blank line of space above and below.
- Banner is limited to content width and the "<open my wallet>" link sits in the right margin, linking to the dashboard.
- Top banner image sourced from Supabase displays light and dark variants based on the active theme on the wallet homepage, and the dark banner appends a version query so the latest asset loads.
- Banner and tagline now sit in the fixed header so the page scrolls under them.
- Body content and banner expand to roughly 60% width on large screens to reduce side margins.
- Tagline text now reads "Local Currency. Value = $3.35. Proceeds to charity." and is right-aligned beneath the banner image.
- Headings are extra bold for greater emphasis.
- Supports demurrage logic (e.g., 1% monthly balance decay).
- Footer uses a white background with black text.
- The "<open my wallet>" link is left aligned within the right margin.
- Tagline appears as normal text with spacing below it.
- Header split into three columns: blank left, centre matches body width with banner and right-aligned tagline, right column holds "<open my wallet>".
- Extra top padding pushes the first section below the header.
- Footer includes links to Whitepaper, Github and Contact, which opens a new contact page.
- Resources and Contact pages share the landing page header and footer, adopt the wider layout and are publicly accessible without authentication.
- Dashboard page (`/dashboard`) is publicly accessible without authentication.
- Dashboard's public status is verified by a Vitest unit test covering the unauthenticated path list.
- Resources page summarises links to the hackathon submission, whitepaper, presentation and open-source repository and ends with a return-home link.
- Ecosystem page showcases related community projects and is linked from the Resources page and the landing footer.
- Contact page contains a form that saves user requests to Supabase including IP addresses and separates the send button from the return-home link.
- Landing page links now point directly to the whitepaper, Telegram chat, presentation and open-source repository, with a trimmed top margin and wider content area.
- Dark mode applies to the entire layout via a body-level class so backgrounds and banner images switch between themes.
- Landing, Resources and Contact pages respond to the theme selector without exposing the toggle.
- Footer is rendered once across all wallet pages.
- Theme defaults to the system preference on load and carries across navigation.
- On small screens the landing header hides the tagline and replaces the open-wallet link with a hamburger menu that opens a slide-out panel with the tagline and "<open my wallet>" link.
- Page backgrounds are white in light mode and black in dark mode, while headers, footers and inline panels use the themed background colour.
- The top-right "<open my wallet>" link or menu aligns vertically with the banner image, and the same link appears centred below the "We’re building one." line.
- Both "<open my wallet>" links render as rectangular buttons with #05656F backgrounds and white text in light mode and invert colours in dark mode.
- Contact page send button uses a #05656F background in light mode.
- Hamburger menu icon adopts #05656F in light mode.
- Highlighted phrases in landing, resources and contact copy use a light grey background in light mode and a slightly lighter dark grey (Tailwind gray-700) background in dark mode.
- Theme background colours are pure white for light mode and pure black for dark mode, and the landing, resources and contact main panels enforce black backgrounds in dark mode.
- Main panels derive their background from the theme variable instead of fixed white so they correctly switch to black in dark mode.
- Wallet routes are available from the domain root so links use paths like `/dashboard` rather than `/tcoin/wallet/dashboard`.
- Users only see the `/admin` and City Admin shortcuts when the server confirms they have the required app-scoped `admin` or `operator` role, and direct visits without that role are redirected to `/dashboard`.
- The `/admin` dashboard surfaces explicit legacy ramp-schema errors when required legacy tables, columns, or relationships are missing instead of showing a generic request-loading failure.
- Incoming payment request modals use the pink primary button for Pay and a white button for Ignore.
- Receive tab surfaces "Payment requests I have sent" with delete buttons that deactivate the underlying requests.
- Newly created users land on `/welcome`, which suggests a unique username, indicates when Continue is blocked, and confirms phone verification inline.
- Wallet user-managed settings are now backed by one shared app-scoped user-settings service, so `/welcome`, Edit Profile, theme selection, charity selection, and BIA preferences all read from the same normalized bootstrap payload and save through the same contract.
- Wallet app-scoped operational flows are shifting to the same edge-function model: merchant onboarding, city-manager approvals, BIA administration, governance feeds, redemption requests, voucher preference writes, control-plane access checks, and contact submissions now have canonical Supabase edge-function backends scoped by `ref_app_instances`.
- Wallet onboarding is now resumable: first-time users see a welcome screen, returning incomplete users can resume or reset their draft, and the step order is Welcome → User details → Profile picture → Community settings → Wallet setup → Final welcome.
- Theme selection is stored per app instance and follows the user across devices, while still using a local cached value for first paint before authenticated bootstrap completes.
- Charity selection is backed by a shared Supabase catalogue so wallet onboarding and settings modals always offer seeded local charity options instead of failing closed when the app profile lacks prior charity data.
- In development and local environments only, wallet onboarding step 5 exposes a Skip action so engineers can bypass wallet creation when WebAuthn or Cubid origin requirements are not available on the current host.
- Wallet profile pictures are uploaded into a dedicated Supabase Storage bucket and the onboarding photo step plus Edit Profile now use the same storage path and public URL generation.
- Wallet pages that previously depended on `/api/control-plane/access`, `/api/user_requests`, `/api/merchant/application/*`, `/api/bias/*`, `/api/stores*`, `/api/city-manager/stores*`, `/api/redemptions/*`, and `/api/vouchers/preferences` now talk to typed edge clients instead; the old Next routes remain temporarily for compatibility with non-wallet or not-yet-migrated consumers.

### 2. SpareChange

- Micro-donation interface for tipping or charitable giving.
- Onboarding persists persona selection, tipping defaults, and charity preferences to the scoped app profile so wallet and SpareChange share base user data while keeping independent settings.
- Panhandlers, artists, and nonprofits use static QR codes to receive donations.
- Donors scan and pay instantly via the wallet.
- Sign-in modal mirrors the wallet with six auto-advancing verification inputs.

## Key User Flows

- **Wallet onboarding**: SMS verification → wallet creation via Cubid → funding wallet.
- **Wallet onboarding** now persists passkey credential identifiers and app/device context with encrypted custody shares so returning users can recover keys against the correct credential.
- **Wallet recovery compatibility**: if app-scoped passkey shares are missing for legacy records, send-money falls back to legacy cross-app shares and then to the most recently used credentialed share.
- **Wallet settings management**: authenticated wallet users can update profile details, theme, charity, and BIA preferences through one shared app-scoped settings layer instead of separate ad hoc flows.
- **Payments**: Scan QR → specify amount or tip % → confirm and sign.
- **SpareChange**: Scan public QR → donate → automatic charity attribution.

## Target Users

- General public (local residents)
- Small businesses
- Local charities & service workers
- Visitors looking for an ethical spending alternative
