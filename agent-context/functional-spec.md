# Functional Specification: Genero

## Overview

Genero is a multi-city, modular platform enabling the creation and operation of local digital currencies—"CityCoins"—that reinforce community wealth and sustainable economies. The first implementation is Toronto Coin (T-Coin).

## Apps

### 1. Wallet

- Digital wallet for holding, sending, and receiving CityCoins.
- Interface includes balance display, QR payment flow, and transaction history.
- Homepage uses mission-driven copy with Thinking Machines layout.
- Closing line states "build up - not extract from - our communities" with space-dash-space style.
- Layout loads the Special Elite typewriter font via a style tag with system-ui fallback and uniform text size; headings are bold, centred, and spaced with one blank line above and below.
- Section margins trimmed so headings net exactly one blank line of space above and below.
- Banner is limited to content width and the "<open my wallet>" link sits in the right margin, linking to the dashboard.
- Top banner image sourced from Supabase is displayed on the wallet homepage.
- Banner and tagline now sit in the fixed header so the page scrolls under them.
- Body content shrinks to 40% width with 30% side margins on large screens, and the banner matches this width.
- Tagline text now reads "Local Currency. Value = $3.35. Proceeds to charity." and is right-aligned beneath the banner image.
- Headings are extra bold for greater emphasis.
- Supports demurrage logic (e.g., 1% monthly balance decay).
- Footer uses a white background with black text.
- The "<open my wallet>" link is left aligned within the right margin.
- Tagline appears as normal text with spacing below it.
- Header split into three columns: blank left, centre matches body width with banner and right-aligned tagline, right column holds "<open my wallet>".
- Extra top padding pushes the first section below the header.
- Footer includes links to Whitepaper, Github and Contact, which opens a new contact page.
- Resources and Contact pages share the landing page header and footer and are publicly accessible without authentication.
- Resources page summarises links to the hackathon submission, whitepaper, presentation and open-source repository.
- Contact page contains a form that saves user requests to Supabase including IP addresses.
- Landing page links now point directly to the whitepaper, Telegram chat, presentation and open-source repository.
- Landing, Resources and Contact pages respond to the theme selector without exposing the toggle.
- Footer is rendered once across all wallet pages.
- Theme defaults to the system preference on load and carries across navigation.
- On small screens the landing header hides the tagline and replaces the open-wallet link with a hamburger menu that opens a slide-out panel with the tagline and "<open my wallet>" link.
- Page backgrounds are white in light mode and black in dark mode, while headers, footers and inline panels use the themed background colour.
- The top-right "<open my wallet>" link or menu aligns vertically with the banner image, and the same link appears centred below the "We’re building one." line.

### 2. SpareChange

- Micro-donation interface for tipping or charitable giving.
- Panhandlers, artists, and nonprofits use static QR codes to receive donations.
- Donors scan and pay instantly via the wallet.

## Key User Flows

- **Wallet onboarding**: SMS verification → wallet creation via Cubid → funding wallet.
- **Payments**: Scan QR → specify amount or tip % → confirm and sign.
- **SpareChange**: Scan public QR → donate → automatic charity attribution.

## Target Users

- General public (local residents)
- Small businesses
- Local charities & service workers
- Visitors looking for an ethical spending alternative
