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
- Resources page summarises links to the hackathon submission, whitepaper, presentation and open-source repository and ends with a return-home link.
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
