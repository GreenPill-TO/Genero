# Merchant Signup + City-Manager Approval Architecture (Wallet App)

## Overview
This implementation adds a merchant application control plane to the wallet app with a draft-to-approval lifecycle:

- Merchant applicant lifecycle: `draft -> pending -> live | rejected`
- Guided merchant signup: 5 steps with persisted progress
- City-manager review surface: list applications and approve/reject
- Dynamic wallet CTA behavior based on merchant application state

The wallet app remains the primary UX surface for merchant onboarding. Existing live merchant operations continue in the existing merchant dashboard.

## Key Design Choices Implemented
1. Merchant CTA in More tab is state-driven:
- `none` -> `Sign up as Merchant`
- `draft` -> `Continue Merchant Application`
- `pending|live|rejected` -> `Open Merchant Dashboard`

2. Signup wizard uses server-persisted steps (1–5) with progress counter increments.
3. Slug uniqueness is DB-enforced within app/city scope using `(app_instance_id, lower(slug))`.
4. City-manager approvals run through wallet route `/city-manager`, API-gated by `admin/operator` roles.
5. Geocoding is server-side via Nominatim endpoint calls.
6. Wallet address remains deferred in v1 (not required at signup submission).

## Runtime Components
1. Wallet frontend:
- More tab CTA resolver
- Merchant lifecycle gate + guided signup wizard
- City-manager approvals page

2. Merchant APIs:
- Application status/start/restart/step/submit
- Slug availability check
- Address geocoding

3. City-manager APIs:
- Application list
- Approve
- Reject

4. Shared server utilities:
- Merchant context resolution (city/app/user)
- Lifecycle/slug helpers
- Draft creation/reset helpers

## Data Model (v0.99 Migration)
### `public.stores`
Added lifecycle and signup progress columns:
- `lifecycle_status`: `draft|pending|live|rejected`
- `signup_step` (1..5)
- `signup_progress_count`
- `signup_started_at`
- `submitted_at`
- `approved_at`, `approved_by`
- `rejected_at`, `rejected_by`, `rejection_reason`

### `public.store_profiles`
Added merchant application/profile metadata:
- `app_instance_id` (backfilled from `stores`)
- `slug`
- `description`
- `logo_url`
- `banner_url`

Uniqueness enforcement:
- unique index on `(app_instance_id, lower(slug)) where slug is not null`

### `public.store_employees`
- Added `is_admin boolean not null default false`
- Existing rows backfilled `true` during migration for backward compatibility.

### `public.store_signup_events`
- Added audit/telemetry table for step progression and status transitions.

## API Surface
### Merchant application APIs
- `GET /api/merchant/application/status`
- `POST /api/merchant/application/start`
- `POST /api/merchant/application/restart`
- `POST /api/merchant/application/step`
- `POST /api/merchant/application/submit`
- `GET /api/merchant/slug-availability`
- `POST /api/merchant/geocode`

### City-manager APIs
- `GET /api/city-manager/stores`
- `POST /api/city-manager/stores/:id/approve`
- `POST /api/city-manager/stores/:id/reject`

## Lifecycle and Data Flow
1. Applicant starts signup:
- Creates `stores` draft row
- Creates first `store_employees` row with `is_admin=true`
- Initializes `store_profiles` shell row

2. Applicant saves steps:
- Step payload persisted to profile/BIA tables
- `stores.signup_step` + `stores.signup_progress_count` updated
- `store_signup_events` appended

3. Applicant submits:
- Validation across required fields and active BIA
- `stores.lifecycle_status` set to `pending`

4. City-manager review:
- Pending queue loaded from `/api/city-manager/stores`
- Approve sets `live`; reject sets `rejected` with reason
- Governance/action and signup event audit records written

## Authorization Model
1. Applicant mutations require store-admin ownership (`store_employees.is_admin=true`) or admin/operator override.
2. City-manager endpoints require admin/operator role checks.
3. Existing store access checks were extended for admin-sensitive mutations.

## Operational Notes
1. Migration file:
- `supabase/migrations/20260313161000_v0.99_merchant_signup_city_manager.sql`

2. Environment knobs:
- `NEXT_PUBLIC_ENABLE_MERCHANT_SIGNUP`
- `NOMINATIM_USER_AGENT`

3. Compatibility:
- Existing live stores were backfilled to `lifecycle_status='live'` from prior active profile state.

## Known Limits in v1
1. Wallet assignment is deferred (not part of signup completion path).
2. Geocoding depends on Nominatim availability and response quality.
3. UI-level media fields are URL-first; direct upload hardening can be expanded in follow-up.
