# Testing and CI Contract

## Purpose

This document defines the current validation contract for Genero. It separates fast local checks, production-build browser smoke, release preflight, and GitHub CI so contributors know which command proves which part of the system.

## Local validation

Run these from the repo root for ordinary app/runtime changes:

```bash
pnpm lint
pnpm test
pnpm build
```

Use the profile-backed build when validating local production behaviour against the local Supabase stack:

```bash
pnpm build:supabase-local
```

For release-readiness work, add the explicit wallet preflight for the target environment:

```bash
pnpm ops:wallet:preflight:supabase-local
pnpm ops:wallet:preflight:supabase-remote
pnpm ops:wallet:preflight:deployment
```

The base `pnpm ops:wallet:preflight` command intentionally exits with profile guidance. Use one of the profile commands above.

## Browser smoke harness

The checked-in Playwright smoke harness is local-first and validates stable unauthenticated or preview-safe production routes in Chromium. It is not a required PR gate yet. `pnpm smoke:e2e` targets `SMOKE_BASE_URL` when set; otherwise it builds and starts a local production server before running the route checks.

First-time local setup:

```bash
pnpm exec playwright install chromium
```

Default local production smoke against `.env.local-supabase-local`:

```bash
pnpm smoke:e2e:supabase-local
```

To smoke an already-running preview, staging, or production URL:

```bash
SMOKE_BASE_URL=https://example.tcoin.me pnpm smoke:e2e
```

Current route coverage:

- `/tcoin/wallet`
- `/tcoin/wallet/resources`
- `/tcoin/wallet/contact`
- `/tcoin/wallet/merchants`
- `/tcoin/wallet/ecosystem`
- `/tcoin/wallet/welcome`
- `/tcoin/wallet/dashboard`
- `/tcoin/contracts`

Each route must return `2xx`, stay on the requested path, render visible body content, and avoid obvious Next.js/runtime error text.

## CI validation

Frontend CI runs on pull requests and pushes to `dev`/`main`, except docs-only and Supabase-only changes ignored by the workflow. Vitest excludes `e2e/**`; browser smoke runs through Playwright separately. Frontend CI currently runs:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- TypeScript no-emit checking
- `pnpm build`
- `pnpm test -- --reporter=default`

Secret scanning runs TruffleHog on pull-request diffs and on the scheduled full-repo workflow.

The dedicated TCOIN Supabase workflow dry-runs migrations on PRs to `dev` and `main`, then deploys migrations after pushes to the matching branch through the `Preview – tcoin` and `Production – tcoin` GitHub Environment gates.

After a successful migration deploy on `dev` or `main`, `.github/workflows/release-alignment-tcoin.yml` runs the matching environment-gated release alignment job. It reloads the PostgREST schema cache with `notify pgrst, 'reload schema';`, runs `pnpm ops:wallet:preflight:deployment`, runs `pnpm ops:torontocoin` and `pnpm ops:torontocoin:pools`, and runs the Playwright smoke harness when `SMOKE_BASE_URL` is configured. The same workflow can be launched manually for Preview or Production after Vercel env changes, Supabase dashboard schema exposure changes, or operator-side worker/scheduler changes.

## Not covered yet

The local and release-alignment smoke harnesses do not cover signed-in e2e, OTP delivery, QR/pay-link creation, Buy TCOIN live checkout, live on-chain acceptance buys, or async indexer worker scheduling. Those remain manual release-runbook checks until stable seeded browser auth, test identities, and worker deployment primitives are available.
