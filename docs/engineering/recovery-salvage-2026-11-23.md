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

## Combined recovery candidate — 2026-11-23T23:47:21.565909+00:00

- `d64c8a6` preserves the assessment records and restores guarded development tooling. Independent risk and acceptance review found inherited wrapper arguments executing while the runtime environment was sourced (R1 / AXE-T882-001). `751a9ac` repairs this without changing the shared runtime script; both validators passed the replacement source.
- `7ffb644` cherry-picks the already reviewed OTP contrast product commit `0b6c9ac`. The five OTP product/fixture/config files are byte-identical to that source. The original branch and its evidence remain preserved; no obsolete OTP transport was restored.
- Combined validation passes: 14 stub-only Python checks, 111 Vitest files / 495 tests with one worker, repository lint including the Edge boundary guard, CI TypeScript, and a production build. Build used CI placeholders, one Next.js build worker and a bounded process/memory/pressure guard; completed in approximately40 seconds without a guard stop. Local Node26 differs from CI Node20.
- Browser smoke against the local production server rendered the public wallet landing page, Resources and the signed-out authentication modal. It used CI placeholder configuration and sent no OTP. The owned server was stopped and its listener was verified absent. This is frontend route evidence, not database, hosted or fresh-login acceptance.
- S33–S36 now have Noak's acceptance recorded in the coordination ledger. S34 is active as the recovery prerequisite; the other accepted sprints remain pending. No sprint completion or issue acceptance is implied.
- Actual local migration/seed/Auth/Edge validation is still pending the exact self-service lease. Queue position2 was last observed; no reliable completion time or permission to start follows from waiting. The earlier statement that the readability fix was separate describes the pre-salvage checkpoint; it is now present in the combined candidate, still unmerged into dev.

## Backup consolidation and delivery checkpoint — 2026-11-23T23:51:35.608655+00:00

The original bundle and both disposable bare restore copies have now been retired after independently restoring the refreshed `verified-recovery.bundle`. The retained private bundle is14492329 bytes, SHA-256 `fe5696b40ca0e849734869ddf08575f03bd6e82bf2f049049a47f9efbc5f15ef`, through `d86480c`. All original ref objects (including tree-valued Codex snapshot refs) and linked-worktree HEAD objects were checked; restored refs matched the bundle header, no alternates were present and full fsck passed. Original ref mappings and six byte-for-byte file snapshots remain in the private preservation directory. Active/reviewer linked worktrees remain intact. The historical bundle paths above are provenance, not current retained artefacts.

[Draft PR100](https://github.com/GreenPill-TO/Genero/pull/100) preserves the combined recovery candidate remotely against dev. CI and candidate deployments run through the existing integrations. GitHub had disabled Secret Scan for inactivity; its existing workflow was re-enabled so the next scoped push receives the required diff scan. No workflow logic or security exception was added. There are now three purpose-bearing remote branches: dev, main and this new candidate; the43 archived historical feature branches remain retired.

## Admitted runtime and review completion checkpoint — 2026-11-24T00:24:03.169080+00:00

Actual self-service admission granted this exact session/project/family. Applied38 intended migrations and the full seed from fresh inputs. Local synthetic email verification returned a session, ensure-user returned200 and bootstrap returned200 with a user. Real startup exposed harmless CLI-generated cache/branch/Edge-env files; final guarded handling at3cdca98 allows only the observed same-project private state, rejects hosted/foreign/saved-database/symlinked state, and explicitly pins --workdir against inherited overrides. All20 guard tests and independent risk/acceptance reviews pass. Both original automatic Codex review findings were replied to with3cdca98 and resolved; no rereview was requested.

Restored a mode0600 ignored local app profile with public/local credentials only, explicit public banner asset settings and checkout disabled. Added the six-digit local-mail template because the fresh CLI default exposes only a magic link. Configured it only in the independent local inputs; canonical ports/project config and hosted provider settings stayed unchanged. The guarded dev command launched and the native Chrome local synthetic account reached the authenticated wallet dashboard. Initial local provisioning had a JWT-future timing error and needed normal reload; the initial1GiB dev heap cap also exhausted during dashboard compile. Node22/1536MiB then rendered the dashboard. These limits are recorded, not hidden or treated as a new Production gate.

One separate fresh candidate Preview OTP, through the approved existing Mail account, matched GeneroDev issuer uyopiuwmlhbevoxmfvfx and reached setup/dashboard. Populated deployed dark digits measured18.41:1 contrast. This is candidate evidence; stable-domain post-merge acceptance remains distinct. No payment, on-chain state or hosted configuration changed.

Final guarded project-only stop and central release succeeded at2026-11-24T00:21:35Z. Readback shows zero own open records, services and family listeners; the frontend listener is absent and Colima remains running. Transient generated local credential/session logs were deleted after retaining sanitized evidence. The private ownership token remains in default local Codex storage for this stable identity; the public app profile remains ignored.

## Canonical dependency and disposable artefact cleanup — 2026-11-24T00:27:58.505916+00:00

Replaced the canonical node_modules symlink to the OTP worktree with an independent `pnpm install --frozen-lockfile --offline` using the shared MiniBot store (zero downloads). React, Next and tsx now resolve within the canonical checkout. All12 focused profile/passcode checks and CI TypeScript pass under Node22 with these independent dependencies; earlier full495-test/Node20 CI evidence remains separate.

The historical OTP validation folder and current generated fixtures/one-off probe scripts/logs were consolidated into a private67791-byte archive at `.git/recovery-preservation/2026-11-23/otp-validation-evidence.tar.gz`, SHA-256 `cafd52814eeb60283e06f87bcdb497bcf26c53e0e1aa6a868ca7d7a66281a12a`. Each archived source file was SHA-256 compared against a fresh extraction before removal. Retired the old non-worktree validation cache (255839868 logical bytes), generated fixtures and one-off scratch scripts/logs; no open handles were found in the old validation directory. The archive excludes reinstallable node_modules. All linked source/reviewer worktrees remain retained. Shared recovery roots are untouched.

The retained Git backup will be refreshed against the final documentation checkpoint; its exact retained head, digest and verified restoration are recorded by the private `final-checkpoint.json`. Integration refs remain PR-only, and Production/main delivery gates are unchanged.
