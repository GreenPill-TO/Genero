
# TCOIN Voucher Layer PRD

### Integration with Sarafu Pools

This document defines the architecture for integrating **Sarafu-style merchant voucher pools** with the **TCOIN wallet and liquidity model**.

Unlike Sarafu’s UI and user model, TCOIN prioritizes:

* a **single liquidity token (TCOIN)**
* **cross-BIA liquidity**
* a **wallet showing total value**
* automated voucher routing

The system will **reuse Sarafu smart contracts** but implement a **custom indexer, wallet, and backend logic**.


---


# Section A: Architecture Overview

## Objective

Introduce merchant voucher liquidity while preserving the **TCOIN-first user experience**.

Users should think in terms of:

**Total TCOIN Value**

not:

* pools
* voucher types
* commitment instruments

Those remain **internal liquidity mechanics**.

---

## System Components

### Provided by Sarafu (Existing)

The following components already exist and **do not need to be built**:

* Sarafu **voucher smart contracts**
* Sarafu **pool accounting**
* Sarafu **voucher issuance mechanics**
* Sarafu **merchant commitment ledger**
* Sarafu **voucher redemption to merchant**
* Sarafu **pool governance logic**

These run on-chain and remain the **source of truth** for voucher balances and issuance.

---

### Built by TCOIN Stack

TCOIN must build:

1. **Wallet App**
2. **Voucher Indexer**
3. **Supabase Backend**
4. **Payment Routing Logic**
5. **Voucher Compatibility Logic**
6. **Aggregate Value Accounting**

These components translate the Sarafu system into a **simple consumer UX**.


---


# Section B: Indexer Requirements

## Objective

Create an indexer that mirrors Sarafu voucher activity into the TCOIN backend.

The indexer must track:

* voucher issuance
* voucher transfers
* voucher redemption
* pool membership
* merchant voucher supply

---

## Indexer Responsibilities

### Track Voucher Tokens

For each voucher:

```
voucher_id
merchant_id
pool_id
value
holder_wallet
```

---

### Track Pool Context

For each pool:

```
pool_id
BIA_reference
merchant_list
```

---

### Track Merchant Credit

Merchants accumulate the ability to issue vouchers.

Indexer must track:

```
merchant_credit_limit
merchant_credit_issued
merchant_credit_remaining
```

---

### Update Supabase

Indexer pushes updates into Supabase tables used by the wallet.

Supabase becomes the **fast-query layer** for the wallet.


---


# Section C: Supabase Responsibilities

Supabase acts as the **operational coordination layer** between:

* wallet
* indexer
* Sarafu contracts

---

## Merchant Registry

Supabase must store:

```
merchant_id
merchant_wallet
store_location
BIA
active_status
```

Operators must be able to:

* add merchants
* remove merchants
* adjust merchant credit

These changes may later be synced to Sarafu contracts.

---

## Voucher Compatibility Table

Supabase must maintain compatibility rules:

```
voucher_id
merchant_id
pool_id
accepted_by_default
```

---

## User Trust Preferences

Users can override acceptance rules.

```
user_id
merchant_id
trust_status
```

Possible values:

```
trusted
blocked
default
```

---

## Voucher Holdings Mirror

Wallet queries Supabase for fast balance lookups:

```
wallet
voucher_id
balance
```

Source of truth remains on-chain.


---


# Section D: Wallet Value Accounting

## Objective

Show a **single value number** for users.

Wallet must calculate:

```
Total Value =
TCOIN balance
+ voucher balances
```

All assets are denominated in **TCOIN equivalent value**.

---

## Example Wallet

User holds:

```
80 TCOIN
10 CafeVoucher
15 BakeryVoucher
```

Wallet displays:

```
105 TCOIN total value
```

---

## Display Requirements

Wallet should show:

Primary view:

```
Total Balance
```

Expandable view:

```
TCOIN
CafeVoucher
BakeryVoucher
```


---


# Section E: Merchant Payment Flow

## Objective

Increase voucher circulation before consuming TCOIN liquidity.

---

## Two-Step Payment

When a user pays a merchant:

### Step 1

Convert TCOIN to merchant vouchers if available.

### Step 2

Send voucher to merchant.

Flow:

```
TCOIN → Merchant Voucher → Merchant
```

---

## Conversion Logic

Wallet checks:

```
available merchant vouchers
in the pool
```

If available:

```
swap TCOIN for voucher
```

Then send voucher.

---

## Fallback

If vouchers are unavailable:

```
send TCOIN
```


---


# Document F: Peer-to-Peer Transfers

Users may hold multiple voucher types.

Transfers should prioritize **circulating vouchers**.

---

## Transfer Algorithm

When sending value:

### Step 1

Check sender vouchers.

### Step 2

Check recipient accepted vouchers.

### Step 3

Send compatible vouchers first.

### Step 4

Use TCOIN for remaining amount.

---

## Example

Sender:

```
CafeVoucher
BakeryVoucher
```

Recipient accepts:

```
CafeVoucher
```

Transfer result:

```
CafeVoucher sent
Remaining value paid in TCOIN
```


---


# Section G: Voucher Acceptance Logic

Users automatically accept vouchers from:

```
BIAs they belong to
```

Users may belong to multiple BIAs.

---

## Wallet Controls

Users can override acceptance rules.

Options:

```
Accept all BIA vouchers
Accept specific merchants
Block specific merchants
```

---

## Default Behavior

Consumer wallets default to:

```
accept vouchers from aligned BIAs
```

This allows payroll and local circulation.


---


# Section H: Merchant Credit Issuance

Merchants may issue vouchers representing future goods/services.

Voucher issuance expands liquidity inside the pool.

---

## Issuance Control

Issuance limits should depend on:

* merchant credit score
* governance rules
* pool health
* merchant reputation

---

## Supabase Control Surface

Operators must be able to adjust:

```
merchant_credit_limit
```

This affects voucher issuance capacity.


---


# Section I: Phase Separation

To avoid unnecessary work in Phase 1:

### Phase 1

Build:

* wallet
* indexer
* Supabase logic
* payment routing
* voucher compatibility checks

Use:

* existing Sarafu contracts
* existing Sarafu pool UI for pool management

---

### Phase 2

Potential future work:

* TCOIN pool management UI
* merchant credit dashboards
* automated risk scoring
* advanced voucher analytics

---

# Summary

This architecture:

* reuses **Sarafu voucher smart contracts**
* keeps **TCOIN as the universal liquidity token**
* introduces **merchant credit circulation**
* simplifies UX through **aggregate wallet value**

The TCOIN stack builds the **coordination layer**, not the voucher protocol itself.

---
EOD