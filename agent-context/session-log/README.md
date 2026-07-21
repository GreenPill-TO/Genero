# Session Logs

This folder contains branch-scoped session logs. Use it instead of a single long-running `agent-context/session-log.md` file.

## File Naming

- Feature branches in single-app repos use `YYYY-MM-DD-featurebranch.md`.
- Feature branches in monorepos use `YYYY-MM-DD-app-featurebranch.md`.
- Direct work on `main` uses `main.md`.
- Direct work on `dev` uses `dev.md`.
- The date is the best-known branch creation date: local reflog date first, first branch-only commit date second, current date last.
- Slug branch names by replacing `/` and unsafe path characters with `-`.


## Entry Format

Add or update the current branch log immediately before each commit. Keep entries concise, factual, and easy to merge.

```md
## 2026-05-25T00:00:00.000Z - Short session title

- agent: Codex
- branch: feature/example
- head: abc1234
- summary: What changed and why.
- validation: Commands or checks run, or "Not run (...)" with the reason.
- follow-ups: Remaining work, or "None".
```

## Legacy History

Older monolithic logs are preserved in `agent-context/session-log/archive/`. Treat archived logs as historical audit material, not the active logging location.
