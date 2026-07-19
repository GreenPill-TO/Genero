# Session Log - dev

## 2026-07-16T19:22:38Z - Vet Sprint #78 and start release env alignment

- agent: Codex
- branch: codex/tcoin-production-launch-readiness
- head: d453f70
- summary: Vetted Sprint #78 into Ready executable Goals/Tasks, created the shared implementation branch, added vetting/worktree notes and dependency edges, and started Task #82 by confirming GitHub Environment variable/secret name alignment for `Preview – tcoin` and `Production – tcoin`. Added `SMOKE_BASE_URL` as a non-secret GitHub Environment variable for both TCOIN environments.
- validation: `gh project item-list 1 --owner GreenPill-TO --format json --limit 1000`; `gh variable list --env "Preview – tcoin"`; `gh variable list --env "Production – tcoin"`; `gh secret list --env "Preview – tcoin"`; `gh secret list --env "Production – tcoin"`.
- follow-ups: Task #82 still needs environment-specific Supabase deploy secrets set in GitHub Environments: `SUPABASE_SESSION_POOLER_TCOIN_PREVIEW`, `SUPABASE_ACCESS_TOKEN_TCOIN_PREVIEW`, `SUPABASE_SESSION_POOLER_TCOIN_PRODUCTION`, and `SUPABASE_ACCESS_TOKEN_TCOIN_PRODUCTION`. GitHub does not expose existing repo-level fallback secret values for copying.

## 2026-07-16T19:30:12Z - Record Vercel env confirmation blocker

- agent: Codex
- branch: codex/tcoin-production-launch-readiness
- head: 859b7f1
- summary: Started Task #83, confirmed the TCOIN Preview deployment URL from PR #77's Vercel comment and repo-level launch env docs, then documented the remaining blocker: this shell has no Vercel CLI, cached auth, local project link, or token that would allow direct Vercel env metadata inspection.
- validation: `vercel --version` failed with command not found; `pnpm exec vercel --version` failed with command not found; checked `printenv` and local env profiles for `VERCEL*`; checked `~/.vercel` and `.vercel/project.json`; inspected PR #77 Vercel deployment comment.
- follow-ups: A Vercel-authenticated operator or agent session must inspect TCOIN Preview/Production env metadata directly, or provide/install a Vercel token/CLI login, before Task #83 can claim full Vercel env confirmation.

## 2026-07-16T19:36:45Z - Record remote Supabase DNS blocker

- agent: Codex
- branch: codex/tcoin-production-launch-readiness
- head: 8c7c938
- summary: Started Task #84 and ran the read-only remote Supabase release checks. The wallet remote preflight, TorontoCoin ops check, pool compatibility check, direct fetch probe, and DNS lookup all failed before schema/RPC validation because the configured `.env.local-supabase-remote` Supabase host does not resolve.
- validation: `pnpm ops:wallet:preflight:supabase-remote` failed with `Wallet release health RPC failed: TypeError: fetch failed`; `pnpm exec tsx scripts/run-with-env-profile.ts .env.local-supabase-remote -- pnpm ops:torontocoin` failed with `TypeError: fetch failed`; `pnpm exec tsx scripts/run-with-env-profile.ts .env.local-supabase-remote -- pnpm ops:torontocoin:pools` failed with `TypeError: fetch failed`; direct Node fetch/DNS probe failed with `getaddrinfo ENOTFOUND`.
- follow-ups: Confirm or replace the remote Supabase project URL in `.env.local-supabase-remote`, or restore/unpause the intended Supabase project, before remote schema/API alignment and hosted smoke can proceed.

## 2026-07-19T09:53:18Z - Re-run restored remote Supabase readiness

- agent: Codex
- branch: codex/tcoin-production-launch-readiness
- head: abf8c97
- summary: Re-ran Task #84 after the Supabase projects were restored. The prior DNS blocker is resolved and remote release-health reads now return structured data, but remote readiness remains blocked by missing `pg_cron`, missing `wallet-payment-request-links-cleanup` cron, indexer run status `error`, and missing required TCOIN/pool indexer visibility.
- validation: `pnpm ops:wallet:preflight:supabase-remote` reached the RPC and failed with release blockers; `pnpm exec tsx scripts/run-with-env-profile.ts .env.local-supabase-remote -- pnpm ops:torontocoin` reached chain/ops checks and failed on indexer tracking blockers; `pnpm exec tsx scripts/run-with-env-profile.ts .env.local-supabase-remote -- pnpm ops:torontocoin:pools` reached pool compatibility checks and failed on tracked-pool/indexed visibility blockers.
- follow-ups: Fixing the remaining remote blockers requires explicit linked Supabase/operator approval for `pg_cron`/cleanup cron configuration and follow-up indexer/scheduler work before Preview smoke should proceed.

## 2026-07-16T18:05:12Z - Align local Supabase Colima defaults

- agent: Codex
- branch: dev
- head: 68908b5
- summary: Updated the local Supabase startup helper to default to the shared `colima-agents` Docker context, clear `DOCKER_HOST`, document that context in the README, and align local Supabase config with Postgres 17 plus disabled local analytics.
- validation: `bash -n scripts/start-local-supabase.sh`; `git diff --check`.
- follow-ups: None.

## 2026-07-16T17:54:29Z - Migrate active todos to GitHub Issues

- agent: Codex
- branch: dev
- head: 60bcf61
- summary: Created GitHub issues for the remaining repo-local open/not-started todos, added them and existing unresolved roadmap issues to the `GreenPill Project` with `Status = Inbox`, and marked `agent-context/todo.md` as superseded by GitHub Issues for active backlog tracking.
- validation: `gh issue create` for #74, #75, #76; `gh project item-add` and `gh project item-edit` for #57, #59, #63, #74, #75, #76; `gh project item-list 1 --owner GreenPill-TO --format json --limit 20`.
- follow-ups: Reconcile stale issue #63 against the completed P1 service-role work, then align Inbox issues into Features/Sprints/Goals when ready.

## 2026-05-25T16:49:36.722Z - Branch-scoped session-log migration

- agent: Codex
- branch: dev
- head: 02caea9
- summary: Migrated this repo to branch-scoped session logs, archived the legacy monolithic log when present, documented the new workflow, and added PR version-bump automation.
- validation: Generated migration artifacts were inspected by script; run `node .github/scripts/pr-version-bump.mjs --base dev --dry-run` and `node .github/scripts/pr-version-bump.mjs --base main --dry-run` after migration.
- follow-ups: Future agents should append new entries to this branch log before each commit and keep completed work out of archived legacy logs.
