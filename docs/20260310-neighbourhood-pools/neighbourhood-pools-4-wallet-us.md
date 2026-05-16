# TCOIN PRD — Document 4

# Wallet App & UX Requirements for BIA Pools

## 1. Purpose

This document defines the **wallet and application UX capabilities** required to support the BIA-segmented TCOIN system.

The goal is to make BIA pools visible enough to support community alignment and risk containment **without making the user experience complicated**.

Users should experience TCOIN as a **single simple currency**, while the system quietly manages pool attribution underneath.

---

## 1.1 Implementation Baseline (v1)

This wallet spec is locked to the v1 model:

* Users can transact with merchants across any city pool (no spend restriction by user BIA).
* User primary BIA is used for buy/top-up attribution and personalization.
* Merchant redemption remains request-based and operator-approved.
* Wallet should expose a discovery/filter view for "merchants in my pool."
* Geospatial matching uses center-point nearest ranking in v1; polygon containment is **Optional / Future Phase**.

---

# 2. UX Principles

### 2.1 One Currency

Users interact with **one TCOIN balance**, not multiple tokens.

Pools are a **context**, not a second currency.

### 2.2 Local Belonging

The app should emphasize **local participation** in a neighborhood economy.

### 2.3 Low Friction

BIA selection should be easy and reversible.

### 2.4 Transparency

Users and merchants should understand which BIA ecosystem they are participating in.

---

# 3. User BIA Selection

Users must select a **primary BIA**.

This determines where their purchases of TCOIN route reserve liquidity.

## Selection Flow

1. User signs up
2. App asks for location (postal code or GPS)
3. System suggests nearby BIAs
4. User selects one

Example suggestion list:

* Queen West
* Kensington Market
* Danforth

Users must always be able to **override suggestions**.

---

# 4. User Profile State

The wallet must be able to display:

* primary BIA
* nearby BIAs
* option to switch BIA

Changing BIA should:

* affect future purchases
* not rewrite past transactions

---

# 5. Merchant / Store Onboarding

Merchants must register a **store location** and associate it with a BIA.

## Merchant onboarding flow

1. Merchant registers store
2. Provides address or location
3. System suggests BIA
4. Merchant confirms

Merchants with multiple locations should be able to register **multiple storefronts**.

Each storefront belongs to one BIA.

---

# 6. Buying TCOIN

When users purchase TCOIN:

1. App resolves user's BIA
2. Purchase routed to that BIA pool
3. TCOIN minted

The UI should simply show:

"You are supporting the Queen West community."

Users should not see complex pool mechanics.

---

# 7. Payments to Merchants

When a user pays a merchant:

1. Merchant store is identified
2. Store BIA is known
3. Transaction executes normally

No UX complexity is required.

User payments are city-wide and cross-pool permissive. A user's primary BIA must not block payment to a merchant in another pool.

However, the receipt may optionally show:

* merchant BIA
* community supported

Example:

"This payment supports the Kensington Market network."

---

# 8. Merchant Redemption UX

Merchants must be able to redeem TCOIN through the wallet or merchant dashboard.

Merchant UI must show:

* store BIA
* TCOIN balance
* redeemable amount

Redemption requests should clearly indicate:

"Redeeming from Queen West pool"

This reinforces pool responsibility.

---

# 9. Community Visibility

To strengthen the local network effect, the wallet should expose optional community information.

Examples:

* merchants in your BIA
* nearby merchants accepting TCOIN
* activity in your BIA

The "merchants in your BIA" view is discovery/filter functionality, not a payment restriction.

This supports the **community trust layer** that underpins the economic model.

---

# 10. Risk Communication

The wallet should communicate BIA participation clearly without alarming users.

Possible UI messages:

"Your purchases support local businesses in Queen West."

or

"Each neighborhood operates its own TCOIN economy."

The goal is to reinforce **local responsibility**, not highlight systemic fragility.

---

# 11. Admin and Monitoring Views

Admin dashboards should expose BIA-level views including:

* users per BIA
* merchants per BIA
* TCOIN purchases per BIA
* redemption volume per BIA
* reserve coverage indicators

These views are primarily for **operators**, not end users.

---

# 12. Optional Future UX Features

Future versions of the wallet may add:

* BIA leaderboards
* local incentives or rewards
* BIA-level governance participation
* community funding flows
* polygon-based geospatial containment and overlap resolution

These features reinforce the **local economy narrative**.

---

# 13. Acceptance Criteria

The wallet UX supports the BIA architecture when it can:

1. Suggest BIAs based on location.
2. Allow users to select and change their primary BIA.
3. Allow merchants to register stores tied to BIAs.
4. Route purchases to the correct BIA pool.
5. Allow users to pay merchants across different city pools without pool-block errors.
6. Display BIA context in transactions where helpful.
7. Show "merchants in my pool" as a discovery/filter view.
8. Allow merchants to redeem through request -> approval -> settlement workflow.

---

# 14. Summary

The wallet should make TCOIN feel like **a simple local currency** while quietly aligning users, merchants, and reserves around Business Improvement Areas.

BIAs create the social trust layer needed to make the flatcoin model viable.

The wallet's role is to make that alignment **intuitive, visible, and frictionless**.
