# Todo

## Production Readiness Priorities

- [x] `P0` Security hardening for wallet runtime flows:
  Remove sensitive browser-side logging from wallet send / custody-recovery paths, retire the unused raw `/api/sendsms` endpoint, and keep only non-secret operational error messages in production-facing flows.
- [x] `P0` OTP contract hardening:
  Standardize validation and Twilio error handling for `/api/send_otp` and `/api/verify_otp`, then add automated route tests for missing input, missing env, upstream failure, and success cases.
- [x] `P1` CI security gating:
  Add TruffleHog scanning for pull-request diffs and a scheduled full-repo scan so secret leaks are caught before release instead of during incident response.
- [x] `P1` Warning reduction:
  Trim the current lint / test noise floor, especially the wallet test warnings around mocked auth session access, `next/image` mock props, and React test `act(...)` noise, so CI output stays actionable.
- [x] `P1` Release runbook:
  Capture a wallet go-live checklist covering required env vars, local/prod smoke tests, pay-link cleanup cron verification, indexer health checks, and rollback expectations.
- [x] `P1` Release environment alignment:
  Closed for the local Supabase target. The ignored `.env.local-supabase-local` profile now points at the running local Supabase stack, `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT=false` keeps the onramp surface dormant, local PostgREST exposes `indexer` and `chain_data`, `pnpm ops:wallet:preflight:supabase-local` reports no blockers, and the pay-link cleanup cron was verified locally with the expected table, function, `pg_cron` extension, active job, schedule, command, and recent successful runs.
- [ ] `P1` Remote/deployment release environment alignment:
  Mirror the local close-out against the intended remote Supabase and Vercel staging/production targets before go-live. Confirm the deployment env sets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_ENVIRONMENT`, `NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_EXPLORER_URL`, and `USER_SETTINGS_ALLOWED_ORIGINS`; expose Supabase Data API schemas `indexer` and `chain_data`; keep `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT=false` unless the complete `ONRAMP_*` contract is present and smoke-tested; configure Twilio only if off-ramp OTP is live; and repeat the manual `pg_cron` verification from `docs/engineering/wallet-release-runbook.md`.
- [ ] `P1` Retire temporary Supabase publishable-key aliases:
  The runtime now temporarily falls back from `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the old `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` names so CI and previews keep building during env rollout. Before launch, confirm Vercel, GitHub Actions, local profile files, and any operator shells all set the canonical key, then remove the legacy fallback from `shared/lib/supabase/env.ts` and reconcile the technical-spec note that currently records both the canonical target and temporary compatibility behaviour.
- [ ] `P1` Reduce production service-role dependency:
  The release runbook and preflight still require `SUPABASE_SERVICE_ROLE_KEY` for routine server-side wallet/indexer/pay-link health checks. Keep the key server-only while preparing a narrower production boundary: prefer SECURITY DEFINER RPCs, scoped edge functions, or dedicated read models for operational status paths so the production Next runtime does not need broad service-role database access for normal reads.
- [x] `P2` Performance pass:
  The authenticated wallet dashboard shell, send/off-ramp runtime, and modal/scanner boundaries have now been trimmed successfully. Current `pnpm build` output is roughly `234–242 kB` for `/tcoin/contracts*`, `164 kB` for `/tcoin/sparechange/dashboard`, `267 kB` for `/tcoin/wallet/dashboard`, and `252 kB` for `/tcoin/wallet/dashboard/contacts/[id]`.

## Future Ideas

- Make `pnpm ops:wallet:preflight` profile-aware now that `.env.local` intentionally excludes scenario-dependent Supabase values. The command could accept a profile argument or print an explicit hint to run `pnpm ops:wallet:preflight:supabase-local` / `pnpm ops:wallet:preflight:supabase-remote` instead of only reporting missing base env.
- Revisit passcode send/verify transport behind one shared server boundary instead of splitting behaviour between direct browser Supabase auth calls and ad hoc API routes.
  Consider a Supabase Edge Function or a common server-side helper that both wallet and SpareChange can reuse.
  Preserve the current post-OTP requirement that verification returns or establishes a usable session quickly enough for the browser auth bootstrap to reuse the fresh access token without reintroducing the earlier `401` race.
  If this is pursued, carry over the stronger error-handling and test coverage ideas from the older `codex/fix-toast-error-on-signup-modal` branch rather than reviving that branch wholesale.
