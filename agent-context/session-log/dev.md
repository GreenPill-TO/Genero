# Session Log - dev

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
