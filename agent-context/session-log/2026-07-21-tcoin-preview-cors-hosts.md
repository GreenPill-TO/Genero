# Session Log - tcoin-preview-cors-hosts

## 2026-07-21T03:51:01Z - Allow TCOIN Vercel preview Edge CORS

- agent: Codex
- branch: codex/tcoin-preview-cors-hosts
- head: 5c9198a
- summary: Diagnosed a hosted Preview deployment stuck on `...loading` at `https://tcoin-802yqav97-cubid-team.vercel.app/`. The browser console and attached logs showed repeated CORS preflight failures for `user-settings/auth/ensure-user` because the Edge CORS helper only allowed stable dev/main/production hosts, not hashed Vercel deployment preview hosts. Added a narrow HTTPS-only Vercel preview host allow rule for the known `tcoin` and `spare-change` Cubid-team deployment host patterns, while keeping arbitrary origins rejected.
- validation: `pnpm exec vitest run supabase/functions/_shared/cors.test.ts supabase/functions/_shared/auth.test.ts supabase/functions/user-settings/index.test.ts`.
- follow-ups: Open a PR to `dev` and let the gated Supabase workflow deploy the updated Edge Function through CI. After merge, reload the affected Preview deployment and confirm `user-settings/auth/ensure-user` preflight returns `Access-Control-Allow-Origin` for the hashed Vercel host.
