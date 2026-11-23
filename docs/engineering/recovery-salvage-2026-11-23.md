# Verified recovery and salvage — 2026-11-23

## Preserved history

- Private bundle: `/Volumes/MiniBot/src/greenpill/genero/.git/recovery-preservation/2026-11-23/all-refs.bundle` (14488205 bytes; SHA-256 `abf78e354a92ff7da6739958cbd701e50495fd8b2fb04d9e67162d7aad727bd6`). Mode0600 inside private mode0700 directory. All50 refs restored into a standalone mirror, no alternates, full fsck passed.
- Six uncommitted assessment files were copied byte-for-byte and SHA-256 verified before edits. They are now included in the recovery branch, with current follow-through added rather than removing earlier plans.
- Remote history tag: [`archive/tcoin-pre-recovery-2026-11-23`](https://github.com/GreenPill-TO/Genero/tree/a44a7c13492e9bed6b1a5671144503de6d24ee4f) at `a44a7c13492e9bed6b1a5671144503de6d24ee4f`. Its manifest maps all45 original remote branch names to tips; each tip is an ancestor. Fetched the tag into the independent restore and verified every source commit and manifest entry. This is archival metadata, not an application release.
- All43 old feature branches were retired atomically with an expected-SHA guard for every deletion. Only origin/dev and origin/main remain. No open PR heads, active worktree branches or integration refs were deleted. No issue delivery/Project promotion is implied by archival retirement. The current user explicitly authorized redundancy cleanup after verifying preservation; this was history retirement, not a claim that every old feature had been deployed.
- Active OTP fix remains local on codex/tcoin-otp-contrast (product0b6c9ac, current head2f11336). It is in the private bundle; it was not published through the remote-only history tag or silently merged. Active implementation/reviewer worktrees remain intact.

## OTP salvage for existing issue75

Sources: e2e08a8/1b08de8 from the former fix-toast-error-on-signup-modal branch, now reachable through the archive. Its API routes had useful provider-failure/success tests but discarded the verified session; wholesale cherry-picking would regress the current fresh-token bootstrap.

`shared/api/services/supabaseService.passcode.test.ts` adapts the useful scenarios to the existing direct Supabase Auth transport: email/phone send payloads, provider rate-limit errors without retry, upstream transport failure, returned/snapshotted verified sessions, rejected verification preserving the prior snapshot, and no invented session when none is supplied. Eight focused tests pass. Production auth transport/error semantics are unchanged.

Future issue75 retains explicit missing-input/configuration and friendly-error contract decisions if a shared server boundary is pursued. Those old route-specific behaviours are preserved as historical design evidence, not introduced into today's working login by accident. Existing dark OTP readability fix remains a separate reviewed branch and must not be recreated.

## Local development restoration

`local-development-recovery.md` describes the restored path. Startup now uses independent session inputs, canonical runtime environment and exact durable self-service ownership. Optional service ports are all explicit, including current CLI local_smtp or legacy inbucket configuration. Unsafe global/default/canonical-target starts and automatic Auth replacement were removed. Stop is project-only and release requires the central helper's independent zero-resource proof.

The local profile wrapper refuses omitted/inherited target credentials, non-loopback URLs, incorrect environment or an API port different from active admission. Quoted-value whitespace parsing is corrected. Generic remote profiles remain explicitly separate. No privileged app credential or hosted linkage was copied.

Fresh intended migration/function/seed inputs are prepared under the actual stable session directory, unique project tcoin-01a1ce37-recovery and registered family64320–64329. Ownership token is saved privately in default local Codex storage and is not in this repository. Runtime request is queued; no stack has been started without a grant. Actual migrations/auth/browser validation remains pending until admission succeeds. Guard/unit checks are not database acceptance.

## Registered sprint sequence

S33 reuses GitHub Sprint78 and its existing Goals. S34 covers recovery and repeatable acceptance. S35 reconciles75/76 and residual57/63 without repeating delivered hardening. S36 reuses contract design59. All four were registered in order with user approval noted; Hubert/Noak acceptance is recorded through their permitted role, not by impersonating either identity. No duplicate GitHub sprint issues were opened.

Production promotion, live Buy, main merge, provider/security configuration and linked database write gates remain unchanged. No failed-Iomega access, global prune/stop, peer resource change or cross-project agent action occurred.
