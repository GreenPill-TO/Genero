# Session Log - tcoin-dev-cors-origins

## 2026-07-21T04:56:27Z - Add TCOIN dev CORS origins

- agent: Codex
- branch: codex/tcoin-dev-cors-origins
- head: 90c5ffe
- summary: Followed up after the same `user-settings/auth/ensure-user` CORS preflight failure appeared on `https://tcoin-dev-git-dev-cubid-team.vercel.app/` and `https://dev.tcoin.me/`. Verified the deployed Edge Function allowed the earlier hashed `tcoin-*` preview origin but did not return `Access-Control-Allow-Origin` for these two dev surfaces. Added the owned `dev.tcoin.me` custom domain and the `tcoin-dev-*` Vercel project host pattern while keeping arbitrary, HTTP, and lookalike origins rejected.
- validation: `pnpm exec vitest run supabase/functions/_shared/cors.test.ts supabase/functions/_shared/auth.test.ts supabase/functions/user-settings/index.test.ts`; `pnpm exec tsc --noEmit --pretty false`; `pnpm lint`; `git diff --check`.
- follow-ups: Open a PR to `dev`, wait for checks/review, merge normally, and confirm the merge-triggered Supabase workflow deploys the updated Edge Function. After deployment, rerun preflight `OPTIONS` checks for both dev origins and refresh the affected hosted pages.
