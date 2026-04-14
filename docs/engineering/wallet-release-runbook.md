# Wallet Release Runbook

## Purpose

Use this runbook to take the TorontoCoin wallet from "build is green" to "release is safe". It ties the current repo state to the exact env, validation, smoke, cron, indexer, and rollback checks needed before and after a production push.

Companion references:

- [TorontoCoin Ops Runbook](./torontocoin-ops-runbook.md) for on-chain ownership, pool, and reserve-route checks
- [BIA Pools + Indexer Tandem Runbook](./bia-pools-runbook.md) for deeper BIA and voucher-indexer operations
- [Technical Specification](./technical-spec.md) for the current wallet, pay-link, and indexer contracts

Env template references:

- `.env.example` for the Next app / repo-local runtime
- `supabase/functions/.env.example` for the Supabase Edge Function runtime

## Required env configuration

### Always required for wallet go-live

| Area | Env vars | Why it matters |
| --- | --- | --- |
| Core Supabase runtime | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Required by browser auth, edge-function proxying, server-side indexer reads, and operator status APIs. |
| App scoping | `NEXT_PUBLIC_CITYCOIN=tcoin`, `NEXT_PUBLIC_APP_NAME=wallet`, `NEXT_PUBLIC_APP_ENVIRONMENT=staging|production` | Controls app-instance scoping, auth bootstrap behaviour, and production-versus-local auth rules. |
| Public wallet URLing | `NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `USER_SETTINGS_ALLOWED_ORIGINS` | Required for pay-link generation, edge CORS, and public callback/origin checks. |
| Wallet user experience | `NEXT_PUBLIC_CITYCOIN_CAD_FALLBACK_RATE`, `NEXT_PUBLIC_EXPLORER_URL`, `NEXT_PUBLIC_TCOIN_BANNER_LIGHT_URL`, `NEXT_PUBLIC_TCOIN_BANNER_DARK_URL` | Keeps public landing and authenticated wallet flows coherent when exchange-rate or explorer data is needed. |
| Indexer runtime | `INDEXER_CHAIN_ID`, `INDEXER_CHAIN_RPC_URL`, `INDEXER_INITIAL_BLOCK`, `INDEXER_MAX_BLOCKS_PER_RUN`, `INDEXER_DISCOVERY_POOL_LIMIT` | Drives `/api/indexer/touch`, `/api/indexer/status`, wallet stats, and operator health. |

### Required when the related launch surface is enabled

| Surface | Env vars | Notes |
| --- | --- | --- |
| Cubid-backed onboarding widgets | `NEXT_PUBLIC_CUBID_API_KEY`, `NEXT_PUBLIC_CUBID_APP_ID` | Required for the `/tcoin/wallet/welcome` onboarding surface that renders the Cubid verification widget and provider wrapper. |
| Wallet off-ramp SMS verification | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Required for `/api/send_otp` and `/api/verify_otp`, which the wallet off-ramp flow uses. |
| Merchant signup | `NEXT_PUBLIC_ENABLE_MERCHANT_SIGNUP`, `NOMINATIM_USER_AGENT` | Merchant geocoding falls back to a default user agent, but production should set an explicit one. |
| Buy TCOIN checkout | `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT` plus the `ONRAMP_*` vars across `.env.example` and `supabase/functions/.env.example` | Keep the feature flag `false` unless the full Transak plus deposit-wallet path has been validated end to end. |

### Local-only or non-production helpers

- `AUTH_BYPASS_USER_ID` is for local or development preview only. Do not set it in staging or production.
- `INDEXER_TRACKER_PULL_URL` is optional. Leave it unset unless the tracker bridge is intentionally deployed.

## Release preflight

### 1. Confirm the target env is coherent

Before any deploy:

1. Confirm `NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL` and `NEXT_PUBLIC_SITE_URL` both point at the exact wallet host you are releasing.
2. Confirm `USER_SETTINGS_ALLOWED_ORIGINS` includes every deployed wallet or sparechange origin that will call authenticated edge functions.
3. Confirm `NEXT_PUBLIC_APP_NAME=wallet`, `NEXT_PUBLIC_CITYCOIN=tcoin`, and the target `NEXT_PUBLIC_APP_ENVIRONMENT` are set correctly.
4. Confirm optional features that are not launch-critical remain off:
   - `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT=false` unless onramp has been fully validated
   - leave Cubid env unset unless the `/tcoin/wallet/welcome` onboarding widget is intentionally live in the target environment

### 2. Run the repo validation suite

Run these from the repo root:

```bash
pnpm ops:wallet:preflight
pnpm lint
pnpm test
pnpm build
pnpm ops:torontocoin
pnpm ops:torontocoin:pools
pnpm ops:torontocoin:acceptance
```

Expected outcome:

- `pnpm ops:wallet:preflight` confirms the required wallet env is present, `public.payment_request_links` is reachable, and the tcoin indexer status is readable.
- `lint`, `test`, and `build` all pass.
- `pnpm ops:torontocoin` shows healthy ownership, reserve-route, pool summaries, and a non-null indexer payload.
- `pnpm ops:torontocoin:pools` reports the tracked pools as healthy and visible.
- `pnpm ops:torontocoin:acceptance` stays in preview-only mode by default. Do not set `TORONTOCOIN_LIVE_BUY_ENABLED=true` as part of a normal release preflight.

Operational note:

- `pnpm ops:torontocoin`, `pnpm ops:torontocoin:pools`, and `pnpm ops:torontocoin:acceptance` auto-load `.env.local` through Next's env loader.
- `pnpm ops:wallet:preflight`, `pnpm ops:torontocoin`, and `pnpm ops:torontocoin:pools` use the server-side Supabase key and now fail fast if `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, because a partial chain-only pass is not production-ready.
- If any command reports `Invalid schema: indexer` or `Invalid schema: chain_data`, the target Supabase Data API is missing required exposed schemas for the wallet's indexer features.
- Treat any reported `releaseBlockers` output as a hard stop for go-live.

### 3. Confirm the target database exposes the required wallet contracts

Use read-only SQL in the target Supabase environment:

```sql
select
  to_regclass('public.payment_request_links') as payment_request_links_table,
  to_regprocedure('public.cleanup_payment_request_links()') as cleanup_payment_request_links_fn;
```

Expected outcome:

- `payment_request_links_table` resolves to `public.payment_request_links`
- `cleanup_payment_request_links_fn` resolves to `public.cleanup_payment_request_links()`

If either value is `null`, stop the release. The deployed app expects the pay-link schema and cleanup function to exist.

## Local smoke steps

### 1. Start the local stack

```bash
cp .env.example .env.local
pnpm supabase:start:local
pnpm dev
```

Keep `NEXT_PUBLIC_APP_ENVIRONMENT=local` and `NEXT_PUBLIC_APP_NAME=wallet` in `.env.local`.

### 2. Browser smoke checklist

Use a clean browser profile if possible.

1. Open `/tcoin/wallet` and confirm the public landing page, banner assets, footer links, and theme-aware header all render.
2. Open `/tcoin/wallet/resources`, `/tcoin/wallet/contact`, `/tcoin/wallet/merchants`, and `/tcoin/wallet/ecosystem` and confirm they stay public and styled correctly.
3. Sign in through the wallet auth modal and confirm the flow lands on `/tcoin/wallet/welcome` or `/tcoin/wallet/dashboard` without repeated unauthorised bootstrap failures.
4. Open `/tcoin/wallet/dashboard?tab=receive` and confirm:
   - a rotating QR/pay link is minted automatically
   - the QR refreshes while remaining valid
   - switching to a one-time link still produces a shareable pay link
5. Open the generated `/tcoin/wallet/pay/<token>` link in a second tab and confirm the public pay page resolves the intended recipient and amount snapshot.
6. Open `/tcoin/wallet/dashboard?tab=more` and confirm the account-centre panels render, including the configured explorer link.
7. If you have an operator account, open `/tcoin/wallet/admin` and confirm the read-only health cards populate.
8. If Twilio env is configured, open the wallet off-ramp flow and confirm `/api/send_otp` plus `/api/verify_otp` both succeed.
9. If `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT=true`, open the Buy TCOIN modal and confirm it can create a checkout session without exposing the configuration-error fallback state.

## Production smoke steps

Run these immediately after deploy against the production host.

### Public and auth smoke

1. Visit the public wallet landing and confirm the deployed host, banner assets, footer links, and public routes all load over HTTPS.
2. Sign in with a low-risk internal wallet account.
3. Confirm `/tcoin/wallet/dashboard` loads, the authenticated shell renders, and More opens normally.
4. From Receive, mint one no-amount rotating pay link and open it in a second browser context.
5. Confirm the public `/pay/<token>` page resolves; do not complete a real payment unless that is part of an intentional smoke plan.

### Operator smoke

1. Sign in with an operator or admin account.
2. Open `/tcoin/wallet/admin`.
3. Confirm the TorontoCoin ops summary loads without falling back to empty or unauthorised states.
4. Confirm `/api/indexer/status?citySlug=tcoin` and `/api/tcoin/ops/status` return `200` from the signed-in session.

## Pay-link cleanup cron verification

The checked-in migration expects a `pg_cron` job named `wallet-payment-request-links-cleanup` with schedule `15 6 * * *`, which corresponds to `06:15 UTC` daily.

### Verify `pg_cron` is available before querying scheduler tables

```sql
select exists (
  select 1
  from pg_extension
  where extname = 'pg_cron'
) as pg_cron_installed;
```

Expected outcome:

- `pg_cron_installed = true`

If this returns `false`, stop the release and document the approved fallback scheduler or manual retention process before calling the wallet production-ready.

### Verify the job exists

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'wallet-payment-request-links-cleanup';
```

Expected outcome:

- exactly one row
- `schedule = '15 6 * * *'`
- `command = 'select public.cleanup_payment_request_links();'`
- `active = true`

### Verify recent executions

```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (
  select jobid
  from cron.job
  where jobname = 'wallet-payment-request-links-cleanup'
)
order by start_time desc
limit 10;
```

Expected outcome:

- the latest runs are `succeeded` or the platform-equivalent success status
- no repeating error message
- the latest successful run is recent enough for your release window

If the job row is missing, inactive, or scheduled differently, treat that as an explicit go-live gap and resolve it before release.

## Indexer health checks

### CLI checks

Run:

```bash
pnpm ops:torontocoin
pnpm ops:torontocoin:pools
```

Healthy release signals:

- governance ownership checks are healthy
- reserve-route checks are healthy
- tracked pools expose liquidity, quoter readiness, and preview readiness

### API checks

Check `GET /api/indexer/status?citySlug=tcoin`.

Healthy response signals:

- `runControl.lastStatus` is `success` after the latest manual touch or recent user activity
- `runControl.lastCompletedAt` is non-null
- `activePoolCount` is greater than `0`
- `torontoCoinTracking` includes the required `cplTcoin` token and tracked pools
- `biaSummary.unmappedPools` and `biaSummary.staleMappings` are explained and acceptable for the current launch state

Check `GET /api/tcoin/ops/status`.

Healthy response signals:

- `ownership.*.healthy` values are all `true`
- `reserveRouteHealth.reserveAssetActive` is `true`
- `reserveRouteHealth.mentoUsdcRouteConfigured` is `true`
- `reserveRouteHealth.liquidityRouterPointerHealthy` is `true`
- `reserveRouteHealth.treasuryControllerPointerHealthy` is `true`
- `indexer.requiredTokenAddress` matches `addresses.cplTcoin`
- `indexer.cplTcoinTracked` is `true`

If the indexer looks stale, sign in and trigger normal user activity or `POST /api/indexer/touch`, then re-check `runControl.lastCompletedAt`. The indexer cooldown is five minutes, so a recent successful run may legitimately block another immediate run.

## Rollback steps

### Application rollback

1. Roll back the frontend and Next.js runtime to the previous known-good deployment.
2. Restore the previous env set if the regression was caused by bad runtime configuration, especially `NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL`, `USER_SETTINGS_ALLOWED_ORIGINS`, or any `INDEXER_*` value.
3. Re-run the minimum production smoke set:
   - public landing
   - auth sign-in
   - Receive pay-link mint
   - `/api/indexer/status?citySlug=tcoin`
   - `/api/tcoin/ops/status`

### Feature rollback

If the fault is isolated, disable the affected surface instead of taking the whole wallet down:

- set `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT=false` to remove the new onramp flow
- set `NEXT_PUBLIC_ENABLE_MERCHANT_SIGNUP=false` to hide merchant signup
- remove `NEXT_PUBLIC_CUBID_API_KEY` and `NEXT_PUBLIC_CUBID_APP_ID` if the Cubid onboarding widget is the issue

### Database and schema safety

- Do not run linked Supabase rollback or destructive cleanup commands as part of a rushed app rollback.
- If a schema mismatch is discovered after release, prefer restoring the previous app build first, then plan a forward fix or a controlled human-approved database change.
- Do not invoke `select public.cleanup_payment_request_links();` against production just to test it; that function deletes data by design.
