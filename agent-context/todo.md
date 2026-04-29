# Todo

## Production Readiness Priorities

- [x] `P0` Security hardening for wallet runtime flows:
  Remove sensitive browser-side logging from wallet send / custody-recovery paths, retire the unused raw `/api/sendsms` endpoint, and keep only non-secret operational error messages in production-facing flows.
  - Status: Completed
  - Timestamp started: 2026-04-13 01:16 EDT
  - Timestamp completed: 2026-04-13 09:11 EDT
  - Feature branch: TBD
  - Head: `06d6d98`
  - Session-log reference(s): `v1.191`
- [x] `P0` OTP contract hardening:
  Standardize validation and Twilio error handling for `/api/send_otp` and `/api/verify_otp`, then add automated route tests for missing input, missing env, upstream failure, and success cases.
  - Status: Completed
  - Timestamp started: 2026-04-13 01:16 EDT
  - Timestamp completed: 2026-04-13 09:11 EDT
  - Feature branch: TBD
  - Head: `06d6d98`
  - Session-log reference(s): `v1.191`
- [x] `P1` CI security gating:
  Add TruffleHog scanning for pull-request diffs and a scheduled full-repo scan so secret leaks are caught before release instead of during incident response.
  - Status: Completed
  - Timestamp started: 2026-04-13 01:16 EDT
  - Timestamp completed: 2026-04-13 09:11 EDT
  - Feature branch: TBD
  - Head: `06d6d98`
  - Session-log reference(s): `v1.191`
- [x] `P1` Warning reduction:
  Trim the current lint / test noise floor, especially the wallet test warnings around mocked auth session access, `next/image` mock props, and React test `act(...)` noise, so CI output stays actionable.
  - Status: Completed
  - Timestamp started: 2026-04-13 09:21 EDT
  - Timestamp completed: 2026-04-13 09:31 EDT
  - Feature branch: TBD
  - Head: `963b691`
  - Session-log reference(s): `v1.192`, `v1.194`
- [x] `P1` Release runbook:
  Capture a wallet go-live checklist covering required env vars, local/prod smoke tests, pay-link cleanup cron verification, indexer health checks, and rollback expectations.
  - Status: Completed
  - Timestamp started: 2026-04-13 09:41 EDT
  - Timestamp completed: 2026-04-13 13:26 EDT
  - Feature branch: TBD
  - Head: `6422d5a`
  - Session-log reference(s): `v1.193`
- [x] `P1` Release environment alignment:
  Closed for the local Supabase target. The ignored `.env.local-supabase-local` profile now points at the running local Supabase stack, `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT=false` keeps the onramp surface dormant, local PostgREST exposes `indexer` and `chain_data`, `pnpm ops:wallet:preflight:supabase-local` reports no blockers, and the pay-link cleanup cron was verified locally with the expected table, function, `pg_cron` extension, active job, schedule, command, and recent successful runs.
  - Status: Completed for local Supabase; remote/deployment split into its own open item
  - Timestamp started: 2026-04-19 21:49 EDT
  - Timestamp completed: 2026-04-20 02:47 EDT
  - Feature branch: `codex/local-supabase-release-alignment`
  - Head: `a59fed5`
  - Session-log reference(s): `v1.216`
- [ ] `P1` Remote/deployment release environment alignment:
  Mirror the local close-out against the intended remote Supabase and Vercel staging/production targets before go-live. Confirm the deployed Next.js env sets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_ENVIRONMENT`, `NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_EXPLORER_URL`, and `USER_SETTINGS_ALLOWED_ORIGINS`; confirm the worker and privileged-function runtime still has `SUPABASE_SERVICE_ROLE_KEY`; have a human/operator apply the `public.wallet_release_health_v1(...)`, `public.indexer_scope_status_v1(...)`, `public.wallet_stats_summary_v1(...)`, and queued touch RPC migrations to the remote target, reload PostgREST, and confirm `public`, `storage`, `graphql_public`, `indexer`, and `chain_data` are exposed; keep `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT=false` unless the complete `ONRAMP_*` contract is present and smoke-tested; configure Twilio only if off-ramp OTP is live; and repeat the manual production smoke from `docs/engineering/wallet-release-runbook.md`, including queue-backed indexer worker checks.
  - Status: Not started
  - Timestamp started: TBD
  - Timestamp completed: TBD
  - Feature branch: TBD
  - Head: TBD
  - Session-log reference(s): TBD
- [x] `P1` Retire temporary Supabase publishable-key aliases:
  Runtime Supabase clients now accept only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; CI, active docs, and local profile contracts use the canonical name, with no active fallback to the retired legacy publishable-key aliases.
  - Status: Completed
  - Timestamp started: 2026-04-20 13:48 EDT
  - Timestamp completed: 2026-04-20 16:26 EDT
  - Feature branch: `codex/p1-env-health-preflight`
  - Head: `c277219`
  - Session-log reference(s): `v1.219`
- [x] `P1` Profile-aware wallet preflight:
  The base wallet preflight command now exits with explicit profile guidance, while `pnpm ops:wallet:preflight:supabase-local`, `pnpm ops:wallet:preflight:supabase-remote`, and `pnpm ops:wallet:preflight:deployment` target the intended environment source.
  - Status: Completed
  - Timestamp started: 2026-04-20 13:48 EDT
  - Timestamp completed: 2026-04-20 16:26 EDT
  - Feature branch: `codex/p1-env-health-preflight`
  - Head: `c277219`
  - Session-log reference(s): `v1.219`
- [ ] `P1` Reduce production service-role dependency:
  Partially closed: wallet release preflight now uses the publishable-key `public.wallet_release_health_v1(...)` RPC for routine pay-link cleanup, cron, and indexer health reads; signed-in wallet stats now use authenticated `public.wallet_stats_summary_v1(...)`; `/api/indexer/status`, `/api/tcoin/ops/status`, and the TorontoCoin ops scripts now use the publishable/request-scoped `public.indexer_scope_status_v1(...)` read model; `POST /api/indexer/touch` now queues work through `public.request_indexer_touch_v1(...)` instead of constructing a service-role client in Next.js; `pnpm ops:indexer:drain-touch-queue` now constructs service-role access only at the worker wrapper boundary and passes it explicitly into the queue library; voucher preference self-service reads/writes and BIA list/mapping reads now use publishable-key request-scoped Edge clients plus narrow RPCs; privileged Edge helper calls now require named purpose/context labels; and the broad user-settings, onramp, merchant, store, voucher-runtime, and BIA mutation entrypoints now resolve identity/app context through request-scoped RPCs before constructing route-specific service-role clients. Remaining work: move more privileged Edge operations behind narrower RPCs or split functions where worthwhile, especially user-settings custody/profile writes, onramp settlement/admin paths, merchant-operation mutations, voucher runtime payment records, and BIA/admin mutation surfaces.
  - Status: In progress
  - Timestamp started: 2026-04-20 13:48 EDT
  - Timestamp completed: TBD
  - Feature branch: `codex/edge-privileged-boundary-hardening`
  - Head: `18cdd5e`
  - Session-log reference(s): `v1.219`, `v1.222`, `v1.226`, `v1.234`, `v1.236`, `v1.237`, `v1.238`
- [ ] `P1` Reduce direct Supabase table access:
  Partially closed: app-facing direct table access now has an expanded lint guard and a dedicated boundary contract; the contracts management hook resolves the current wallet through the `v_wallet_identities_v1` read-model helper instead of querying `wallet_list` directly; and contract proposal metadata/link access now goes through narrow RPCs instead of direct table calls. Remaining work: move merchant onboarding compatibility helpers, voucher/Sarafu routing helpers, and Cubid action-time signer custody reads behind typed Edge Functions or narrower RPCs where product risk justifies the migration.
  - Status: In progress
  - Timestamp started: 2026-04-27 16:49 EDT
  - Timestamp completed: TBD
  - Feature branch: `codex/supabase-boundary-cleanup`
  - Head: `8b7f642`, `f0ab73a`
  - Session-log reference(s): `v1.232`, `v1.235`
- [x] `P2` Performance pass:
  The authenticated wallet dashboard shell, send/off-ramp runtime, and modal/scanner boundaries have now been trimmed successfully. Current `pnpm build` output is roughly `234–242 kB` for `/tcoin/contracts*`, `164 kB` for `/tcoin/sparechange/dashboard`, `267 kB` for `/tcoin/wallet/dashboard`, and `252 kB` for `/tcoin/wallet/dashboard/contacts/[id]`.
  - Status: Completed
  - Timestamp started: 2026-04-13 17:14 EDT
  - Timestamp completed: 2026-04-13 17:15 EDT
  - Feature branch: TBD
  - Head: `c1a05fe`
  - Session-log reference(s): `v1.195`, `v1.196`

## Future Ideas

- Revisit passcode send/verify transport behind one shared server boundary instead of splitting behaviour between direct browser Supabase auth calls and ad hoc API routes.
  Consider a Supabase Edge Function or a common server-side helper that both wallet and SpareChange can reuse.
  Preserve the current post-OTP requirement that verification returns or establishes a usable session quickly enough for the browser auth bootstrap to reuse the fresh access token without reintroducing the earlier `401` race.
  If this is pursued, carry over the stronger error-handling and test coverage ideas from the older `codex/fix-toast-error-on-signup-modal` branch rather than reviving that branch wholesale.
  - Status: Not started
  - Timestamp started: TBD
  - Timestamp completed: TBD
  - Feature branch: TBD
  - Head: TBD
  - Session-log reference(s): `v1.190`
