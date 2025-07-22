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
- Banner is limited to content width and navbar shows "<open my wallet>" linked to the dashboard.
- Top banner image sourced from Supabase is displayed on the wallet homepage.
- Supports demurrage logic (e.g., 1% monthly balance decay).

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
