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
- [ ] `P2` Performance pass:
  Review the heaviest wallet routes and reduce avoidable client bundle weight before launch, especially the dashboard and operator surfaces that currently ship large first-load payloads.

## Future Ideas

- Revisit passcode send/verify transport behind one shared server boundary instead of splitting behaviour between direct browser Supabase auth calls and ad hoc API routes.
  Consider a Supabase Edge Function or a common server-side helper that both wallet and SpareChange can reuse.
  Preserve the current post-OTP requirement that verification returns or establishes a usable session quickly enough for the browser auth bootstrap to reuse the fresh access token without reintroducing the earlier `401` race.
  If this is pursued, carry over the stronger error-handling and test coverage ideas from the older `codex/fix-toast-error-on-signup-modal` branch rather than reviving that branch wholesale.
