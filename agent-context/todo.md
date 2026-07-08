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
  CI-assisted alignment is now available through `.github/workflows/release-alignment-tcoin.yml`: after successful migration deploys on `dev`/`main`, or by manual dispatch, it reloads PostgREST, runs deployment-profile wallet preflight, runs TorontoCoin ops checks, and optionally runs browser smoke when `SMOKE_BASE_URL` is configured. Remaining close-out: configure the Preview/Production GitHub Environment secrets/vars, confirm Vercel envs and retired aliases, run the workflow green for the intended remote target, confirm Data API schema exposure for `public`, `storage`, `graphql_public`, `indexer`, and `chain_data`, keep Buy TCOIN disabled unless fully smoke-tested, and manually verify signed-in/OTP/pay-link/worker scheduler paths that CI cannot yet prove.
  - Status: In progress
  - Timestamp started: 2026-04-29 15:33 EDT
  - Timestamp completed: TBD
  - Feature branch: `codex/edge-privileged-boundary-hardening`
  - Head: pending current branch commit
  - Session-log reference(s): `v1.242`

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

- [x] `P1` Reduce production service-role dependency:
  Completed for the production-readiness P1 scope: deployed Next.js no longer requires `SUPABASE_SERVICE_ROLE_KEY`; wallet release preflight, wallet stats, indexer status, TorontoCoin ops checks, and queued indexer touch use publishable/request-scoped RPC boundaries; the external indexer drain worker owns its service-role runtime explicitly; voucher preference self-service reads/writes and BIA list/mapping reads use request-scoped Edge RPCs; broad Edge service-role authentication helpers were removed; and remaining Edge service-role clients are purpose-labelled at intentionally privileged operation boundaries such as custody, transfer bookkeeping, payment-link privileged resolution/consume, settlement/admin, governance action reads, voucher payment records, merchant/admin, BIA/admin, webhook, and worker/runtime paths. Further splits into narrower domain RPCs remain optional hardening, not a P1 blocker.
  - Status: Completed
  - Timestamp started: 2026-04-20 13:48 EDT
  - Timestamp completed: 2026-04-29 15:19 EDT
  - Feature branch: `codex/edge-privileged-boundary-hardening`
  - Head: `8cfacf1` plus follow-up commit in this branch
  - Session-log reference(s): `v1.219`, `v1.222`, `v1.226`, `v1.234`, `v1.236`, `v1.237`, `v1.238`, `v1.240`, `v1.241`

- [x] `P1` Reduce direct Supabase table access:
  Completed for the production-readiness P1 scope: guarded app-facing paths no longer own direct Supabase table reads/writes; the contracts management hook uses the wallet identity read model; contract proposal metadata/link access goes through narrow RPCs; merchant onboarding app pages import only shared types while runtime work stays behind merchant Edge/server boundaries; voucher/Sarafu table helpers are kept behind server/worker/runtime boundaries; Cubid signer custody reads remain isolated to action-time contract write modules; and the lint guard now blocks app-facing runtime imports of those documented exception helpers. Remaining direct `.from(...)` calls are documented storage, read-model, server, worker, or action-time custody exceptions.
  - Status: Completed
  - Timestamp started: 2026-04-27 16:49 EDT
  - Timestamp completed: 2026-04-29 15:19 EDT
  - Feature branch: `codex/supabase-boundary-cleanup`, `codex/edge-privileged-boundary-hardening`
  - Head: `8b7f642`, `f0ab73a`, `8cfacf1` plus follow-up commit in this branch
  - Session-log reference(s): `v1.232`, `v1.235`, `v1.240`, `v1.241`

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

- Continue optional post-P1 Supabase boundary hardening by splitting remaining intentionally privileged Edge operations into narrower domain RPCs or smaller functions where product risk justifies the complexity.
  Priority candidates are user-settings custody/profile writes, payment-link privileged resolve/consume, governance action-feed reads, voucher-runtime payment records, merchant/admin mutations, BIA/admin mutation surfaces, and onramp settlement/admin paths.
  - Status: Not started
  - Timestamp started: TBD
  - Timestamp completed: TBD
  - Feature branch: TBD
  - Head: TBD
  - Session-log reference(s): `v1.241`
