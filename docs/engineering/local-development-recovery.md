# Recovery-safe local development

Canonical source: `/Volumes/MiniBot/src/greenpill/genero`. New temporary worktrees use `/Volumes/MiniBot/scratch`. Do not access the failed Iomega volume. Runtime ownership follows AGENTS.md and the shared self-service CLI; no coordinator chat/approval is needed.

## Dependencies

Use the pinned pnpm version and `pnpm install --frozen-lockfile`. Preserve local env files outside Git with mode 0600. The deployed Next.js runtime does not need a service-role key. Keep privileged worker/Edge credentials separate; do not copy them into the app profile.

## Independent inputs and identity

Use the actual stable session ID and one private random token saved in normal local Codex storage (for example `~/.codex/session-secrets/<thread>/supabase-slot.token`, owner-only mode 0600). Reuse it after interruption. Export `SLOT_SESSION`, `SLOT_TOKEN_FILE`, `SLOT_DIR` and `SLOT_SCOPE`; the latter must match the requested scope exactly. Do not put the token value in logs or `.env.example`.

`SLOT_DIR` is `/Volumes/MiniBot/colima/sessions/codex/<actual-thread-id>/` (or the equivalent Claude session directory). Generate fresh Supabase CLI config there, use a unique session project ID, and copy intended migrations, seed and functions including authorized changes. Exclude `.temp`, `.branches`, `.env*`, credentials and old databases. Preserve the canonical config. Current CLI calls the email testing section `local_smtp`; older configs use `inbucket`. Configure exactly one.

Choose a currently free registered family from the shared port registry. Explicitly assign all ten offsets even when services are disabled:

| Offset | Config field |
| --- | --- |
| 0 | db.shadow_port |
| 1 | api.port |
| 2 | db.port |
| 3 | studio.port |
| 4 | local_smtp.port (or inbucket.port) |
| 5 | local_smtp.smtp_port |
| 6 | local_smtp.pop3_port |
| 7 | analytics.port |
| 8 | edge_runtime.inspector_port |
| 9 | db.pooler.port |

## Admission and runtime

Source `/Users/botmaster/.codex/skills/local-supabase-coordinator/scripts/runtime-env.sh` in every runtime shell. Use only its explicit socket and `codex-supabase` profile. Request via `slots.py request` with the saved identity/token, unique project ID, full family, independent checkout and bounded scope/duration. Follow the exact policy and examples in AGENTS.md; never edit the ledger.

A queue entry is not permission. Check at its returned interval while doing independent work. Run `heartbeat` at least every five minutes while active and before resuming. Do not evade resource gates or restart shared runtime around another owner.

Once the exact durable record is active:

```sh
pnpm supabase:start:local
zsh scripts/start-local-supabase.sh check
```

The helper rejects mismatched identity, canonical checkout, scope, runtime kind, project or ports. A regular CLI-generated `.temp/cli-latest` update-cache file is allowed; hosted project linkage, unknown cache files and symlinks are rejected. It cannot accept a linked target or arbitrary Supabase flags. It keeps CLI-managed Auth intact and does not deploy hosted functions or change the linked database.

## Local app profile

Capture local CLI status privately (never print its complete credential output); write only the local API URL/public key and necessary app configuration into ignored `.env.local-supabase-local`, mode 0600. Required explicit values are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_ENVIRONMENT=local`. Set `NEXT_PUBLIC_CITYCOIN=tcoin`, `NEXT_PUBLIC_APP_NAME=wallet` and a local `NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL` as appropriate; keep Buy checkout disabled for initial auth checks. No service-role key is needed in this app profile.

```sh
pnpm dev:supabase-local
```

The profile loader verifies exact active admission and API port before starting the app. It will not inherit a missing local target/key from base/shell settings. Use the separate `.env.local-supabase-remote` profile only for intentionally authorized remote development. Profile syntax is simple KEY=VALUE with optional wrapping quotes, not shell code or full dotenv interpolation.

## Stop and release

Stop the local app process, then run:

```sh
zsh scripts/start-local-supabase.sh stop
```

This stops only the admitted project and asks the self-service CLI to release after fresh container/listener-zero proof. Failure preserves ownership for diagnosis; do not abandon running resources or use global stop/prune. Leave Colima, Docker and shared swap running. Cancel queued requests promptly if runtime work is no longer being pursued.

## Focused bootstrap checks

```sh
/opt/homebrew/bin/python3 scripts/test-local-supabase-session.py
pnpm exec vitest run scripts/run-with-env-profile.test.ts shared/api/services/supabaseService.passcode.test.ts --maxWorkers=1 --minWorkers=1
```

These use private temporary inputs and stubbed admission replies. They do not start Docker/Supabase or mutate the real slot ledger. A passing stub test is not migration, local auth, browser or deployed acceptance; those require a separately recorded admitted runtime run.
