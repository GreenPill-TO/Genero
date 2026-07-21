# Session Log - codex/edge-publishable-key-runtime

## 2026-07-20T19:07:00Z - Repair Preview Edge publishable-key runtime

- agent: Codex
- branch: codex/edge-publishable-key-runtime
- head: 99f74c6
- summary: Cleaned up after merged PR #96 by fast-forwarding `dev`, deleting the merged local and remote branch, and preserving Task #86 as in-progress until hosted OTP smoke was green. With explicit operator approval for the Preview Supabase `user-settings` Edge Function/runtime, inspected the `GeneroDev` project, confirmed `user-settings` was active, deployed the current function code, and found the project account can read but not manage Edge Function secrets. Patched the shared Edge auth helper so request-scoped clients can use Supabase's hosted `SUPABASE_PUBLISHABLE_KEYS` default secret when the custom `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alias is unavailable, with legacy `SUPABASE_ANON_KEY` only as the final platform fallback. Also added exact-match CORS fallbacks for the standard TCOIN Preview and launch hosts so Preview can authenticate without wildcard origin reflection when custom Edge secrets are not manageable.
- validation: `supabase functions list --project-ref uyopiuwmlhbevoxmfvfx --output json`; `supabase functions deploy user-settings --project-ref uyopiuwmlhbevoxmfvfx --no-verify-jwt` deployed Preview `user-settings` version 13; `supabase secrets list --project-ref uyopiuwmlhbevoxmfvfx --output json`; Supabase dashboard confirmed additional permissions are required to manage custom Edge secrets; `pnpm exec vitest run supabase/functions/_shared/auth.test.ts`; `pnpm exec vitest run supabase/functions/_shared/auth.test.ts supabase/functions/_shared/cors.test.ts`; Chrome hosted smoke signed out, requested a fresh OTP for the approved test account, submitted it, reached the authenticated welcome/setup surface, and then loaded `/tcoin/wallet/dashboard` with authenticated wallet content.
- follow-ups: Commit and publish the helper patch. Move Task #86 to `On dev` with sanitized evidence, then start Task #87 pay-link create/resolve smoke against Preview. Keep any additional Edge origins in `USER_SETTINGS_ALLOWED_ORIGINS` instead of broadening the exact-match fallback list.

## 2026-07-20T19:34:00Z - Route Preview pay-link function deployment through CI

- agent: Codex
- branch: codex/edge-publishable-key-runtime
- head: f7dffb2
- summary: Continued Goal #79 Task #87 using the orchestrator flow. Preview signed-in state loaded in Chrome, but Receive-tab pay-link minting failed with browser `Failed to fetch`. Read-only OPTIONS checks showed `user-settings` now returns the corrected TCOIN Preview CORS headers while `payment-links` returns `404 Requested function was not found`, proving the Preview project is missing the deployed pay-link Edge Function. Per operator guidance, did not deploy linked Supabase directly; instead updated PR #97 so the gated `supabase-deploy-tcoin.yml` workflow deploys the wallet-critical Edge Function bundle (`user-settings`, `payment-links`, `payment-requests`) on merges to `dev`/`main` and only reports the plan on PRs.
- validation: Read-only `curl -i -X OPTIONS` checks for Preview `user-settings` and `payment-links`; `supabase functions list --project-ref uyopiuwmlhbevoxmfvfx --output json`; `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy-tcoin.yml")'`; `pnpm exec vitest run supabase/functions/_shared/auth.test.ts supabase/functions/_shared/cors.test.ts supabase/functions/payment-links/index.test.ts supabase/functions/payment-requests/index.test.ts`; `pnpm lint`; `pnpm exec tsc --noEmit --pretty false`; `git diff --check`.
- follow-ups: Merge #97 through normal review/CI so the Preview push deploys `payment-links` and `payment-requests`; then rerun #87 pay-link create/resolve smoke against Preview before starting Goal #81.

## 2026-07-20T19:39:00Z - Pin Supabase CLI for PR migration dry-runs

- agent: Codex
- branch: codex/edge-publishable-key-runtime
- head: 7e1350f
- summary: Addressed the failing `Preview TCOIN migrations` check on PR #97. The job used the default `supabase/setup-cli@v1` CLI version `2.20.3`, which failed before dry-run with `Invalid db.major_version: 17`; pinned both Preview and Production Supabase deploy jobs to CLI `2.101.0`, matching the local version that parses the repo config successfully.
- validation: GitHub job log for `Preview TCOIN migrations`; `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/supabase-deploy-tcoin.yml")'`; `git diff --check`.
- follow-ups: Push the fix and wait for PR #97 checks to rerun before requesting review/merge.
