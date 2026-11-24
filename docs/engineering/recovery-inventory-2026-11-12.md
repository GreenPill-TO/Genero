# TCOIN recovery inventory and return-to-operation plan

Assessed 2026-11-12T05:27:55Z against freshly fetched `origin/dev` `4d7220bfeb0d7e84f71075eb6ab901f61240f3b7`.
Canonical checkout: `/Volumes/MiniBot/src/greenpill/genero`.
Temporary worktrees: `/Volumes/MiniBot/scratch/`. The failed Iomega volume was not accessed.

## Findings

- Checkout started clean on `dev`, exactly matching origin. One worktree, no stashes, no extra local branches. `git fsck --full --no-reflogs` reported no problems or dangling objects. Local reflog contains only the clone.
- Origin has 45 actual branches: dev, main, 22 feature tips contained in dev, and 21 feature tips not contained in dev. No `backup/*` or recovery-named branches were found. Commit ancestry and patch equivalence were checked; the unmerged features contain non-equivalent historical patches, which does not establish current product value.
- `main` has one merge-only commit absent from dev; dev has 26 commits absent from main. PR [#77](https://github.com/GreenPill-TO/Genero/pull/77) remains open from dev to main. Its July checks passed, but they are historical evidence, not current hosted acceptance.
- The November 1 recovery report lists only an empty TCOIN indexer repository (no commits and only `.DS_Store`); no indexer source was recovered there. The current project has indexer/worker implementation under `services/` and `scripts/`.
- No Genero/TCoin source checkout, bundle, or project-specific recovery directory was identified in `/Users/botmaster/recovery-2026-11-01` or `/Volumes/MiniBot/recovery`, after directory/file-name inventory and recovery report/manifest inspection. TCOIN portfolio images belong to recovered Regenerator/Firebelly work. A preserved environment manifest includes the public `tcoin.me` host; that is not application source. Shared recovery folders belong to other projects and must remain intact.

## Genuine unique work

1. **Keep OTP transport design/test evidence.** `codex/fix-toast-error-on-signup-modal` (`e2e08a8`) and `copilot/sub-pr-48` retain missing-input/config/upstream error handling and tests absent from current dev. Existing [issue #75](https://github.com/GreenPill-TO/Genero/issues/75) explicitly requests reuse of these ideas. The old verification handler discards the provider session and returns success only; current `verifyPasscode` returns a session and updates its snapshot. Salvage selected ideas with new session-preservation tests, not a wholesale cherry-pick. The Copilot tip adds an empty planning commit on the same changes.
2. **Preserve optional design history, do not reintroduce it by default.** Closed 2025 branches contain alternate typography, landing/about/demo pages, per-app theme/style experiments, mobile navigation and binary font/favicon assets (not all are on dev). Current dev has a newer dashboard, navigation, path normalization and Edge-backed contact requests. These old alternatives are real historical differences, but no required recovery feature was established. Keep in an archive until explicitly discarded; no product merge recommended.
3. **Superseded fixes need no immediate merge.** Dashboard import/redirect branches, resources/contact alternatives, contradictory public/private dashboard policies and old setup docs overlap newer dev implementations. Current `pathname.ts` and `ContentLayout.tsx` intentionally support unauthenticated dashboard/welcome previews. Preserve history before retiring branches rather than restoring old policy.

## Operational gaps

- `node_modules`, `.next`, local env profiles and `.vercel` linkage are absent. Only `.env.example` is available. No lint, typecheck, unit suite, build, browser smoke or hosted preflight was run during this inventory.
- `scripts/start-local-supabase.sh` defaults to `colima-agents`, clears `DOCKER_HOST`, starts the canonical config and can recreate Auth. This conflicts with current self-service admission and explicit socket rules. Do not run it unchanged.
- Existing startup docs/logs include obsolete runtime guidance; the repo-status session-log row was stale and has been corrected.
- Sprint [#78](https://github.com/GreenPill-TO/Genero/issues/78), Goals #74/#79/#80/#81 and Tasks #82–#93 remain open. Reconcile their latest evidence/status before resuming launch work through the sprint orchestrator.
- GitHub default is main; squash merging is disabled. Owner roadmap is [GreenPill Project](https://github.com/orgs/GreenPill-TO/projects/1).

## Proposed execution sessions

1. **Preserve and classify.** Create a permission-restricted Git bundle of every candidate ref on MiniBot, plus a SHA/disposition manifest. Verify bundle integrity and restoration into a standalone temporary repository. Extract useful OTP test/design notes into #75's implementation work before deleting its source refs. Record a branch-by-branch deletion list; compare current remote SHAs again immediately before deletion. Do not retain a permanent second recovery tree once the archive's retention decision is settled.
2. **Restore local development.** Use a `codex/` branch/worktree under MiniBot scratch. Repair runtime helper/docs to use the required runtime environment, independent session inputs and durable active-lease checks. Restore environment profiles from an authorized secure source, install frozen dependencies, run lint/typecheck/unit/build checks. Then obtain a self-service lease, validate fresh migrations/functions and local route smoke, stop only that project and release. Foundry checks apply if contract code changes. Do not touch linked database state.
3. **Reconcile hosted release.** Use existing issues/Project rather than a new backlog. Review #77's entire current diff and refresh Preview/schema/function/worker/auth evidence; reconcile #75 and release tasks. Keep production promotion as a separately reviewed step. Repo rules reserve linked database writes to a human; this assessment authorizes none.
4. **Retire verified residue.** After preservation, ownership and any deployment/migration checks: remove the 22 ancestry-contained feature refs; retire the 21 unmerged historical alternatives only after their salvage/archive disposition is agreed. Close obsolete PRs only where appropriate. There are no identified TCOIN recovery directories to delete in the two shared recovery roots. Never delete those roots or other projects' evidence.

## Precrash-memory reconciliation and additive plan

Validated on 2026-11-12 against current source, PR metadata/review comments, issue bodies and #86 comments. The original four execution sessions above remain in scope. This section adds the immediate Preview acceptance lane and clarifies evidence; it does not replace preservation, operational restoration, release reconciliation or cleanup.

| Memory | Validation and implication |
| --- | --- |
| Last checkout clean dev at 4d7220b | Matches the recovery inspection's clean starting state and current HEAD. Exact Git subject is `Merge pull request #99 from GreenPill-TO/codex/tcoin-dev-cors-origins`; the underlying fix is bd049ee. Current documentation changes are from this recovery assessment, not recovered product edits. |
| PR #98 hashed Preview CORS; #99 stable dev origins | Both merged and present in dev. `_shared/cors.ts` explicitly allows `https://dev.tcoin.me` and its owned Preview regex accepts `https://tcoin-dev-git-dev-cubid-team.vercel.app`; tests cover both. Browser Origin has no trailing slash. Source inclusion does not prove today's deployed function version. |
| PR #97 review comments outstanding at one point | Confirmed historically; both comments have corrective replies citing 5c9198a, which is on current dev. Current workflow defaults manual Edge deployment off, gates it on deploy mode, and loops over function names. Recheck deployment evidence, not reimplement these fixes. |
| Earlier ensure-user failure and eventual login progress | #86 comments record an initial post-OTP Unauthorized provisioning failure, followed by successful fresh OTP, authenticated setup and dashboard after the approved Preview runtime repair. The user-supplied later stable-domain test saw an existing signed-in dashboard, successful sign-out and no repeated CORS failure, but fresh OTP hit an email rate limit. These are compatible observations at different times/targets. |
| Last stable-domain OTP rate limit, readable email, entered-digit contrast unverified | Retained as user-supplied historical browser evidence. This assessment did not replay that browser session or verify current rate limits. Neither an existing session nor absence of one console error proves fresh login acceptance today. |
| Competing dark OTP styles and weak readability tests | Confirmed in `shared/components/ui/formFieldStyles.ts`: otpDigitFieldClass includes both inherited dark:bg-slate-950/55 and dark:bg-slate-100 with dark:text-slate-950. `formFieldStyles.test.ts` checks class inclusion, not computed colours/contrast. Class-string order alone does not establish the winning generated CSS or a visible defect. No confirmed contrast fix was recovered. |
| Sprint/Goal mapping | #78 is Preview-first production readiness; #79 includes Preview OTP (#86), pay-link (#87), sandbox Buy TCOIN (#85). #80 covers worker/scheduler proof. Correction: #81 is Production smoke/live gate, not the sandbox Buy lane. |
| Remote changes via PR/CI, Preview before Production, live Buy explicit | Consistent with current issues and workflow source. Keep linked database operations human-owned; use reviewed PR/CI delivery for authorized repairs. Old one-off Preview repair authorization is historical context, not blanket authorization for new hosted mutations. |
| No final uncommitted product changes | Consistent with clean recovered dev and no stashes/dangling objects. No evidence of a lost login/contrast patch was found; absence of evidence cannot prove nothing existed on the failed disk. Old missing-path observations are superseded by the verified new canonical checkout. |

### Added immediate execution lane

Run after sufficient environment restoration in session 2 and before release acceptance/promotion in session 3. Preserve branch history first as planned; broader OTP transport refactoring (#75) is not a prerequisite for diagnosing current Preview login.

1. **Reconcile deployed Preview identity.** Confirm `https://dev.tcoin.me/` maps to the intended deployment/commit and Preview Supabase project. Inspect current CI deployment evidence for #97–#99 and 5c9198a. If ensure-user fails, capture sanitized request status, actual Origin and response headers, plus provisioning error category. Separate CORS, JWT/session handoff, Edge runtime and delivery failures.
2. **Unblock fresh OTP carefully (#86 / #79).** Inspect current email delivery/rate-limit configuration and sanitized failures through authorized read-only access. Distinguish resend cooldown, per-user throttling, project email quota and mail-provider failure. Honour the actual retry window and avoid repeated requests. If a configuration change is required, record the precise operator action/authorization rather than weakening protections or silently changing hosted state.
3. **Prove entered-digit readability.** Inspect actual rendered/computed foreground and background colours in light and dark mode, including entered digits and focus state. A local isolated rendered OTP state can verify styling while email delivery is blocked, but does not count as fresh-login acceptance. Capture visual evidence and measured text contrast (target at least 4.5:1 for normal-size digits); fix only a reproduced issue. Add browser-level style/contrast coverage if changed, alongside typing/paste/autosubmit/resend coverage. Do not treat class-presence assertions as readability proof.
4. **Complete fresh stable-domain signed-in smoke.** With the approved test identity, request and verify a fresh OTP without recording it, prove a usable session and ensure-user completion, dashboard load, sign-out and login again as needed to exclude reuse of an old session. Capture bounded loading/failure behaviour and app errors separately from extension content-script warnings. Keep #86 acceptance open until current target evidence is recorded on #79/#86.
5. **Resume downstream Preview acceptance.** After signed-in smoke, complete faucet/testnet pay-link create/resolve (#87), sandbox Buy (#85 under #79), and refresh scheduler/queue proof (#80, #88–#90). Retain blockers explicitly; do not expose pay-link tokens or secrets. Record deployer end-balance/delta/costs if chain state is touched.
6. **Preserve Production gates and cleanup work.** Review #77 after Preview evidence; Production gets its own post-merge preflight, fresh OTP and permitted pay-link read/resolve smoke (#81, #91–#93). Keep Buy checkout disabled unless the target is fully green and live enablement explicitly approved. Continue the original branch archive/salvage/deletion plan; neither successful Preview smoke nor ancestry alone proves hosted migration/function deployment.

Planning validation only: no new OTP request, browser smoke, hosted configuration change, deployment, chain transaction or product test was performed in this reconciliation.

## Running queue — 2026-11-12

This is an execution snapshot of the existing recovery plan, not a replacement backlog. GitHub Issues and [GreenPill Project](https://github.com/orgs/GreenPill-TO/projects/1) remain authoritative. Estimates are working time ranges, not elapsed delivery promises; OTP cooldown and external responses are excluded. No new heavy checks/services started during this reconciliation.

### Current task and completion evidence

Current task: complete recovery reconciliation and prepare the bounded return-to-operation queue; local assessment documents remain uncommitted on dev. No implementation PR exists for recovery documentation/runtime repair. Release source is [Sprint #78](https://github.com/GreenPill-TO/Genero/issues/78), [Preview Goal #79](https://github.com/GreenPill-TO/Genero/issues/79) and [promotion PR #77](https://github.com/GreenPill-TO/Genero/pull/77).

Completed in this session: checkout/ref/recovery inventory; exact 22-contained/21-unmerged classification; precrash memory reconciliation; source verification of CORS and PR97 review corrections; refreshed issue/Project status and latest #85/#87/#88–#90 evidence. `git diff --check` passes. No app, hosted login, migration or transaction acceptance is claimed.

Current Project snapshot: #74 Ready; #79 In Review; #80 On dev; #81 Ready; #82–#86 and #88–#90 On dev; #87 In Review; #91–#93 Ready; #75 Inbox. Project status is historical workflow metadata, not proof that dependencies, runtime or acceptance remain satisfied today. Do not restart delivered implementation simply because issues remain open.

### Prioritized queue

| Priority / action | Source | Effort | Readiness / exact dependency | Completion evidence |
| --- | --- | --- | --- | --- |
| 1. Inspect runtime helper and safe restoration inputs; prepare exact repair scope and identify credential owner without reading/printing secret values | Recovery session 2; #74/#83/#84 | 30–45 min | Ready for read-only inspection. Helper uses colima-agents and clears DOCKER_HOST; local profiles/dependencies absent. No runtime start or new hosted mutation. | File/line repair specification, required env names/secure source owner, commands and lease checks documented. |
| 2. Prepare branch preservation/deletion manifest and verify existing commit provenance | Recovery session 1; #75 | 30–45 min | Ready for read-only preparation. Archive creation is reversible within recovery scope; deletions wait for exact approved disposition and ownership/deployment checks. | Exact refs/SHAs, OTP salvage mapping, bundle restoration checklist and no unexplained lost work. |
| 3. Review deployed Preview metadata/access and current rate-limit evidence; map stable-domain target and copied-link base URL | #83/#84/#86/#87 under #79 | 30–60 min | Ready only where existing read access works; browser/hosting authentication may block. No fresh OTP request loop. Missing authenticated access or rate-limit telemetry must be reported precisely. | Intended commit/project/Origin mapping, deployment evidence, sanitized current failure category and retry window, actual Preview public-base setting or explicit access blocker. |
| 4. Restore local environment and repair startup under isolated branch/worktree, then focused validation | Recovery session 2; #74 | 1–2 h | Conditional: authorized secure config source, dependencies/storage and bounded implementation scope. Local Supabase additionally requires fresh self-service admission; hosted writes excluded. No heavy run in this planning pass. | Runtime-env/explicit socket and durable ownership respected; focused checks plus app lint/type/unit/build evidence when inputs allow; stop own project and release lease. |
| 5. Measure OTP computed readability and fix only a confirmed defect; refresh fresh-login acceptance | #86/#79; existing contrast follow-up | 1–1.5 h | Conditional: rendered build/browser access and OTP delivery available after actual retry window. Existing-session access alone is insufficient. No #75 transport rewrite prerequisite. | Computed light/dark text contrast, entered-digit/focus visual evidence, focused regression coverage for any fix; fresh session, ensure-user and dashboard succeed without saved OTP/secrets. |
| 6. Refresh Preview link creation/resolve and isolate public-host mismatch; settle funded wording | #87/#79 | 30–60 min | Conditional on signed-in access. Historical create/resolve passed; copied URL used www.tcoin.me and wallet balance was zero. Funding/value movement needs applicable transaction permission and approved testnet source; new hosted config change is a separate action. | Preview-generated link stays on approved Preview host; redacted-token route evidence; funded criterion either proven or explicitly retained as unmet. |
| 7. Read-only scheduler/Buy prerequisite reconciliation, preserving implemented work | #80/#88–#90; sandbox #79/#85 | 30–45 min | Metadata review only where authorized. Hosted drain/scheduler enablement requires scoped operator approval; sandbox provider settings and smoke access remain unverified. | Current health or exact access blocker; named operator action for drain/scheduler, missing sandbox env names, checkout remains disabled if not green. |

The whole conditional queue is approximately 4–8 hours. Strictly unblocked preparation is only about 1–1.5 hours; another 0.5–1 hour may be available if existing authenticated read access works. There is no honest full half-day of confirmed ready work yet. Re-estimate after rows 1–3 resolve access/configuration dependencies; do not fill the horizon with unrelated hardening or speculative refactors.

### Acceptance and blockers retained from current GitHub evidence

- #87 historically passed create/resolve after PR97 CI deployment ([run](https://github.com/GreenPill-TO/Genero/actions/runs/29772912100)). It did not consume funds: wallet balance remained zero. Copied links used Production host from Preview's public base URL; the redacted token resolved when opened on Preview instead. Preserve that success and the remaining host/funding gap.
- #85 recorded disabled checkout, missing confirmed onramp sandbox configuration and Vercel SSO blocking automated smoke. Secret-name absence in GitHub alone does not prove Vercel/Edge secrets are absent now. Recheck metadata through authorized access; do not assume successful sandbox acceptance.
- #88–#90 delivered scheduler target, bounded worker and runbook, with validators returning pass-with-notes. No recurring hosted scheduler was enabled; live queue-drain proof and just-in-time operator approval remained pending. On dev status does not erase those residual gates.
- The latest user-reported stable-domain fresh login was email-rate-limited. Current quota/window/provider cause has not been measured; no repeated OTP attempts should be used as diagnosis.
- #77/main promotion, Production #81/#91–#93 and live Buy remain gated. No Production work starts merely because its Project items say Ready. PR97 fixes are already delivered; no reimplementation planned.
- No action or agent contact involving SmarTrust, WondrBot, Kano, POMP/ProofOfMeeting, VerifyMyResearch, MusicRightsPassport or FundLoop is authorized here. Record any discovered cross-project dependency only; none is established as a current TCOIN blocker.

### Decisions and questions awaiting answers

These are the distinct outstanding decisions. Silence is not consent; metadata inspection and reversible preparation continue independently. No blanket approval is requested for uncertain hosted changes.

1. **Premise:** No app env profiles or hosting link were recovered, so local and authenticated hosted acceptance cannot yet be reproduced reliably. **Suggested answer:** identify the approved secure credential/configuration source and owner, then restore only the needed Preview/local profile; benefit: enables the existing validation path while keeping secrets out of chat/Git. **Alternative:** use an existing authenticated hosted browser session for read-only diagnosis first; what's good about this option: useful progress with less local setup, though it cannot replace local tests or fresh login. **Alternative:** have the operator restore the profiles; what's good about this option: credentials remain entirely operator-managed.
2. **Premise:** #87 create/resolve passed without funds, but its acceptance still says faucet-funded and Preview copied Production-host links. **Suggested answer:** retain the funded criterion and schedule an explicitly authorized testnet-only funding step after fresh login, while correcting the Preview base URL via reviewed delivery; benefit: fulfils the written contract and avoids cross-environment links. **Alternative:** explicitly amend #87 to create/resolve-only and track funded/value-moving proof separately; what's good about this option: matches demonstrated non-value-moving behaviour without silently declaring the original criterion complete. The exact hosted configuration action must be specified before approval/execution.
3. **Premise:** #85 sandbox configuration is not green and live Buy is separately gated by #81/#93. **Suggested answer:** keep checkout disabled while auth/pay-link acceptance is finished, then have the sandbox operator supply the missing provider configuration; benefit: preserves the current safe fallback and priority. **Alternative:** prioritize sandbox configuration now; what's good about this option: surfaces provider dependencies earlier, but requires the responsible operator/access and does not authorize live enablement.
4. **Premise:** #80 implementation is delivered but hosted queue-drain proof and recurring scheduler enablement were not authorized/completed. **Suggested answer:** first inspect current read-only health, then prepare a precise one-shot Preview drain for just-in-time approval; benefit: verifies bounded behaviour before any recurring job. **Alternative:** keep scheduling disabled and retain the explicit release blocker; what's good about this option: avoids background mutations until an operator is available. Exact queue target, credentials boundary and operator action must precede execution.
5. **Premise:** 21 historical feature branches contain unique patches and 22 are ancestry-contained; useful OTP ideas belong to #75. **Suggested answer:** verify a minimal archive and salvage references, then approve the exact obsolete-ref deletion list; benefit: clears recovery residue with a tested restoration path. **Alternative:** keep unique branches temporarily and retire only verified contained branches; what's good about this option: retains direct access to historical alternatives with less archive dependence. **Alternative:** archive all candidates and retain that archive for an agreed interval; what's good about this option: maximizes reversible cleanup, with temporary storage overhead. No retention interval or deletion disposition has yet been chosen.

Production merge/live enablement decisions are intentionally deferred until fresh Preview evidence is available; they remain human gates rather than questions requiring an early blanket answer. OTP-provider/rate-limit changes, if needed, similarly require an exact diagnosis/action first.

### Next safe approved action

Read and trace `scripts/start-local-supabase.sh`, its callers and local profile loading to produce the minimal runtime repair specification and required configuration-name list. Do not start Supabase, run heavy tests, send an OTP, change hosted settings, delete refs or contact another project's agents during that action. Then report which conditional queue items became ready.

## Runtime repair specification and preservation preparation — 2026-11-12

Current task completed: read-only startup/profile tracing and preservation preparation. No startup/profile implementation changed. Remote tips were re-read with `git ls-remote --heads origin`; all 45 match local tracking refs. The machine-readable [preservation manifest](recovery-refs-2026-11-12.json) records exact refs/SHAs, integration branches and ancestry disposition. It explicitly marks bundle/restore/deletion as not performed or authorized. This advances queue rows 1–2; those completed inspections should not be repeated without source drift.

### Minimal startup repair

Owning surfaces: `scripts/start-local-supabase.sh`, `package.json`'s `supabase:start:local`, README startup instructions and `wallet-release-runbook.md` local smoke steps. Canonical `supabase/config.toml` currently uses project `Genero`, API/db/shadow/mail ports 55421/55422/55420/55424; retain it as source input, never as admitted runtime identity.

1. Source the canonical `runtime-env.sh` in every runtime shell and preserve its explicit Docker socket. Remove the helper's `DOCKER_CONTEXT=colima-agents` fallback and `unset DOCKER_HOST`. If MiniBot/runtime input is absent, fail closed; no other context/profile fallback.
2. Require an explicit independent session input directory beneath `/Volumes/MiniBot/colima/sessions/codex/<actual-thread-id>/`, containing a fresh copy of intended migrations/seed/functions and unique project ID plus a complete registered free port family. Keep repo canonical configuration untouched. Reject canonical checkout, `.temp` linkage, alternate runtime paths and invalid/missing identity before any start. Do not select ports in this planning pass.
3. Use the existing slots.py request/check/heartbeat/release protocol, stable `codex:01a1ce37-91b5-7bc1-b93f-1d28c5195166`, and one securely saved token in default session storage. Before start, require its exact durable active lease to match checkout/project/family/scope/token. A queue response or successful pressure snapshot alone is insufficient. No private ledger parsing/writing or competing admission implementation. `check` itself may reconsider/mutate the ledger; do not invoke it merely as a read-only probe in the current restricted pass.
4. Start from the admitted directory only; validate caller arguments rather than allow them to retarget runtime/project. Preserve documented optional-service exclusions only when smoke requirements allow them; account for all optional/default port assignments during admission. Keep the ability to stop this exact project, prove services/listeners gone, and release without stopping shared Colima/Docker.
5. Remove the unconditional Auth delete/recreate path from the default helper. It currently exports container environment into temporary files and a generated docker command, pins GoTrue v2.188.1, and replaces a CLI-managed container while suppressing removal errors. A mailer-host warning alone is not a reason to replace Auth. If a functional mailer defect is reproduced later, use a CLI-supported configuration mechanism after checking the installed version, or separately scope a narrowly owned workaround with private files and correct container lifecycle. Do not implement that workaround speculatively.
6. Update docs with independent session setup/admission/release order and explicit profile scripts; remove the runbook's unqualified `cp .env.example .env.local; ...; pnpm dev` startup recipe. Validation plan: shell syntax, meaningful rejection cases for missing/queued/mismatched ownership without Docker mutation, argument/path guards, followed by one fresh admitted local migration/auth/route smoke only when separately allowed. No service or test was run now.

### Profile loader findings and bounded repair

`scripts/run-with-env-profile.ts` resolves the requested profile relative to cwd, errors if missing, calls Next's base env loader, then overlays a hand-written key/value parser and spawns the command with the full resulting environment. It does not start Supabase itself. No evidence supports replacing the entire loader just to restore runtime admission.

- Existing filenames are `.env.local-supabase-local` and `.env.local-supabase-remote`; both are ignored. The earlier recovery narrative's dotted variants are not the actual package script names.
- Overlay precedence preserves omitted base/shell variables. Restoring an incomplete local profile could therefore inherit remote targets or privileged keys. For local mode add an explicit target/profile validation boundary before app/ops execution; require the admitted local API identity/port rather than merely assuming a loopback URL proves ownership. Preserve intentional server/worker secret boundaries and do not inject service-role into deployed Next.js.
- The parser handles simple assignments and wrapping quotes only; it is not full dotenv syntax (export prefixes, inline comments, escapes, expansion and multiline values are unsupported). Leading whitespace after `=` interferes with quote stripping. Minimal choices: document/validate supported simple syntax, or use an existing supported env parser with focused precedence/parsing tests; defer choosing until implementation scope is approved. No generic env-system rewrite is needed.
- Required configuration-name checklist for the next restoration step: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_ENVIRONMENT`, `NEXT_PUBLIC_CITYCOIN`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_WALLET_PUBLIC_BASE_URL`, and `NEXT_PUBLIC_ENABLE_BUY_TCOIN_CHECKOUT`. Confirm actual app/runtime-required extras through its preflight before declaring the profile complete. Privileged worker/Edge credentials are a separate operator-owned profile. The loader emits no values by itself; keep profile contents out of logs and tracked artefacts.
- No approved credential/configuration owner or secure source has been identified. No secret search, new grant or profile restoration was performed. Existing decision 1 remains unanswered.

### Preservation procedure prepared, not executed

Use the JSON manifest as the explicit source-ref list, retaining dev/main as well as feature history for self-contained restoration. Proposed restricted artifact destination is `/Volumes/MiniBot/scratch/tcoin-recovery-2026-11-12/` (mode 0700; bundle mode 0600). Older history may contain historical credentials; do not upload the archive or dump historical env blobs. Capture archive SHA-256, verify with `git bundle verify`, and restore into a standalone scratch bare repository with no alternate-object dependency. Compare every manifest tip to restored refs and run connectivity checks; re-read remote SHAs before any eventual deletion. Keep the local uncommitted assessment documents separately accounted for; a Git bundle does not preserve working-tree files. The archive creation/restore itself remains next reversible preservation work, not a completed backup.

OTP salvage mapping remains #75: retain e2e08a8/1b08de8 error/test ideas and current session-return requirements; do not revive the older session-discarding route. Keep copied-link host/faucet acceptance decisions and Production/sandbox gates unchanged.

### Decision packet delta and next safe action

Questions 1–5 above remain distinct and unanswered. Runtime inspection adds evidence to question 1, not a new blanket approval request. The host/funding question, sandbox configuration, hosted drain/scheduling and exact historical-ref disposition are unchanged. No denial or uncertain mutation occurred; no retry was attempted.

Next safe action within the current constraints: prepare static rejection/acceptance cases for the startup/profile repair and a non-executing preservation verification script, or conduct read-only hosted deployment metadata checks if existing authenticated access is available. Do not consume the conditional 4–8-hour queue by launching services, tests, OTP sends or implementation under this read-only instruction. Ready work has shrunk after completing the preparation rows; configuration/access decisions still control the larger horizon.

## Prepared acceptance cases and ownership — 2026-11-12

Project coordination remains in this existing Tcoin HBIC chat. Root supervision routes through this chat; no duplicate owner, worker, chat or schedule was created. No cross-project work is included. The issue-backed conditional 4–8-hour queue and unanswered decision packet above remain in force; completed preparation does not create new implementation, publication, resource or hosted authorization.

### Startup/profile repair acceptance cases

These are specifications, not test-run results. Implement focused tests when the bounded repair begins; use stubbed CLI/Docker boundaries for rejection tests so no service starts.

| Case | Expected result / evidence |
| --- | --- |
| MiniBot missing or runtime-env cannot load | Nonzero exit before any Docker/Supabase call; no alternate runtime fallback. |
| Missing session path, canonical checkout supplied, path outside session root or symlink escape | Nonzero exit before start; canonical config remains byte-identical. |
| Missing config identity, duplicate canonical project ID, incomplete/invalid port family | Reject before start/request; include disabled/optional service port assignments in admission input validation. |
| Missing token, ownership mismatch, queued-only record or no exact active lease | No project start/reset/repair. Do not substitute global pressure/readiness for ownership. Stub results contain no real token. |
| Lease identity differs in checkout, project, port family or requested scope | Fail closed. Stable real chat ID and saved token are reused; no new identity to bypass an open request. |
| Valid independent inputs and exact active ownership | Source runtime-env; preserve explicit socket; start only the admitted checkout/project. Stubbed command capture proves correct cwd/arguments without starting services. |
| Caller passes arguments that retarget workdir/project or select linked state | Reject before mutation. Support only the explicitly reviewed local argument set. |
| Auth container absent/present or mailer warning occurs | Default helper never removes/recreates Auth or pins a replacement image. No container env is dumped. |
| Missing local profile or incomplete required target keys | Explicit configuration error before app/ops execution; do not silently use base/shell remote values. |
| Local profile URL/port differs from admitted project | Reject local runtime command; check URL/project mapping against intended session inputs. |
| Simple quoted env value and precedence | Document supported grammar; correct parsing of intentional whitespace/quotes; profile values override defaults without logging values. Unsupported syntax receives a useful non-secret error if strict grammar is chosen. |
| Intentional remote profile | Remains a separate explicit path; local validation must not silently rewrite its target. No hosted write is used to test parsing. |
| Project stop/release | Stop only owned project, prove all its services/family listeners gone, then release using CLI. Shared Colima/Docker/images/swap remain running/intact. Test command selection with stubs first. |

Runtime integration acceptance remains conditional on authorized implementation, restored configuration and fresh self-service admission. A static/stubbed pass alone cannot prove real migrations, Auth or route smoke.

### Archive verification contract

The manifest is preparation only. Before an archive is called recoverable:

1. Confirm the manifest's base and every source ref still resolve to its recorded SHA; stop on drift and reconcile rather than silently updating the evidence.
2. Create restricted scratch storage on MiniBot, never Iomega; bundle the explicit ref set without secrets/profiles/working-tree exports. Preserve current uncommitted assessment documents separately before any cleanup that could remove them.
3. Record bundle size and SHA-256; verify the bundle, then restore into a separate standalone bare repository without alternates.
4. Compare all 45 restored source tips to the manifest and verify object connectivity. Treat missing dev/main ancestry or any missing tip as failure, not a partial backup success.
5. Record the restoration command/result and retention decision. Re-read exact remote tips and confirm ownership/deployment prerequisites before proposing a concrete deletion batch. No deletion commands are prepared or authorized by this contract.

### Current state after preparation

Static acceptance and archive-verification criteria are now prepared. No permitted worker is active in this chat, and no delegation is needed for this bounded read-only pass. Next substantive implementation is the runtime/profile repair, conditional on scope/configuration inputs; next reversible preservation step is actual archive creation/restoration if authorized under the current action constraints. Read-only hosted metadata reconciliation remains available only where existing authenticated access succeeds. Do not repeat preparation merely to fill the half-day horizon: the strict ready queue is now short and the outstanding decision packet is the route to unblock the larger queue.

## Reconnection checkpoint — 2026-11-13

Current task: bounded source/PR/check refresh and public Preview reachability check, completed. Local and remote dev remain 4d7220b; main remains 3b01037. PR77 remains open/mergeable, with successful July 21 checks and no newer dev runs observed. #85/#86/#87 remain open with July evidence; no new acceptance or implementation is implied. Recovery documentation and the ref manifest remain local/uncommitted; no product-code edits were recovered or added.

New read-only evidence: `https://dev.tcoin.me/tcoin/wallet` returns HTTP 200 without redirect; the `tcoin-dev-git-dev-cubid-team.vercel.app` wallet alias returns HTTP 302 to Vercel SSO. No bypass token or access grant is needed merely to reach the stable dev route. This only proves HTTP reachability, not deployment identity, rendered app health, OTP delivery, contrast or signed-in acceptance. No OTP was sent and no browser/session was changed.

Queue update: startup/profile inspection, acceptance specification and manifest preparation are complete. The remaining high-value auth/contrast lane can begin with rendered read-only inspection of the reachable stable domain using existing browser access; it must not request OTP or change hosted state under the current restricted instruction. Full local validation remains blocked by missing dependencies/env profiles and unimplemented runtime guards. Fresh login remains gated by the no-OTP instruction and unknown current rate-limit cause/window. Archive creation/restoration is reversible recovery work but is not permitted in the latest read-only execution scope; exact branch deletion remains unapproved. There is no remaining 4–8 hours of confirmed Ready work: retain the conditional queue rather than invent scope.

Highest-value next action: inspect rendered stable-dev OTP styling and deployment/runtime metadata with existing read access; capture computed contrast only if the entered-digit state is accessible without sending OTP or changing application state. If that state is inaccessible, report that exact gate and do not bypass auth/throttling or manufacture a contrast result. The next substantive local repair requires permission to implement beyond read-only inspection; secure configuration source decision 1 is still unanswered. Questions 2–5 remain unanswered and unchanged.

The supplied 35% memory-pressure observation is partial and was not treated as runtime admission. No heavy task, ledger request, Colima operation, denied-route retry, hosted mutation or excluded-project action occurred.

## Rendered stable-dev acceptance checkpoint — 2026-11-13

Completed the permitted rendered inspection through the in-app browser at `https://dev.tcoin.me/tcoin/wallet`, using normal access and no bypass. The public Toronto Coin landing page rendered headings, explanatory copy, navigation and the open-wallet control. Clicking that control displayed a signed-out Sign In or Sign Up modal while the page URL remained on the landing route. The modal showed an empty Email address field and Get Verification Code button. No authenticated dashboard/session was demonstrated, no email was entered, and the verification button was not used.

Read-only computed styles on the visible email textbox: type=email; foreground rgb(2,6,23); background rgb(255,255,255); border rgb(203,213,225); font size 14px. Computed foreground/background text contrast is approximately 20.17:1 using WCAG relative luminance. This describes the field's configured text colours in the observed light state, not entered text, placeholder contrast or dark-mode acceptance. A screenshot was visually inspected during this pass. No dark-mode preference was changed.

Exact acceptance blocker: the signed-out modal has not reached the OTP-entry stage, and this pass explicitly prohibits sending an OTP. Therefore entered-digit rendering, dark-mode contrast, OTP delivery/rate-limit behaviour, ensure-user success and fresh signed-in dashboard acceptance cannot be measured here. Do not synthesize OTP state, reuse an old session as fresh-login evidence, or infer that previously fixed CORS has failed from this unattempted flow. No visible loading hang appeared on the observed landing/modal surfaces; authenticated loading is untested. Deployed commit identity was not exposed by this inspection.

Queue/current-task update: stable-domain rendered inspection is complete. All previously identified independent read-only preparation is now complete. No further substantive approved item is established within the no-OTP/no-implementation/no-hosted-mutation scope. The next highest-value acceptance step is a specifically permitted fresh Preview OTP attempt using the existing approved test identity, after determining/observing applicable rate-limit timing; a successful response would enable actual entered-digit inspection. Alternatively, authorize the bounded local startup/profile repair so rendering can be tested against isolated local inputs after configuration restoration and required admission. These are existing conditional queue paths, not new scope. Decision packet questions 1–5 remain unanswered; this checkpoint does not authorize either path. Do not keep polling unchanged evidence to fill the half-day horizon.

## Complete remote feature inventory

`Ahead` is commit ancestry relative to dev, including any merge commits. These are inventory classifications, not deletion approvals or deployment proofs.

| Branch | Tip | Ahead | PR | Disposition |
| --- | --- | ---: | --- | --- |
| `codex/add-/admin-route-for-admin-dashboard` | `ee37492157ab8107be3b9a3ba03285e6f5b3bd01` | 0 | #36 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/add-modal-escape-functionality-and-reintroduce-header` | `4a95ab5c4fd29c8dedb8f9fd7862facd66fa6ba1` | 0 | #26 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/allow-unauthenticated-access-to-dashboard` | `a71e8e7c293732be19ad54cf4359056d9e0315ca` | 2 | #22 closed | Archive before retirement; historical alternative |
| `codex/allow-unauthenticated-access-to-dashboard-tolnzd` | `05ef80711003a3e028429afcb8d71fa665a85060` | 2 | #23 closed | Archive before retirement; historical alternative |
| `codex/connect-to-supabase-and-export-sql-schema` | `9af16a79457fe0c19f940fcfaaa884835cd2880a` | 0 | #35 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/create-resources-and-contact-pages` | `012c3593f9a0faf86cc4ae3784ce0d55f108d214` | 1 | #9 closed | Archive before retirement; historical alternative |
| `codex/create-resources-and-contact-pages-ccutv1` | `bada5b12a088a21907d6d928cb0018bba67fc3da` | 0 | #10 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/create-supabase-migration-for-fks` | `21f6d742f9c0dda0ab705842ecea2591b560b77d` | 0 | #42 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/enhance-seo-for-ecosystem-page` | `e7240fa0200ed763fe928504bc553c532f6be9f4` | 0 | #32 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/ensure-qr-code-colors-are-consistent` | `f62a3491487b3018719da14280464216d2cfa6f2` | 2 | #14 closed | Archive before retirement; historical alternative |
| `codex/ensure-qr-code-renders-in-black-and-white` | `7f0301d674c1f8da27a1ba0d34b1acac61c984cd` | 4 | #17 merged | Archive before retirement; historical alternative |
| `codex/find-style-sheet-dependencies-for-monorepo-parts` | `f68370294ac01019195a852fe2ef6ce59a36dfc2` | 1 | #11 closed | Archive before retirement; historical alternative |
| `codex/fix-app-router-page-paths` | `2ba0b83ebcbe6e412489205a1e890f86f26ee340` | 0 | #20 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/fix-client-side-exception-on-dashboard` | `ba5fb373dd4b02fbc97391889d12d0f71151d5f6` | 2 | #29 closed | Archive before retirement; historical alternative |
| `codex/fix-toast-error-on-signup-modal` | `e2e08a83ca6551ea47a564f15b94bb679b095d09` | 2 | #48 closed | Preserve OTP error handling/tests for #75; do not merge wholesale |
| `codex/fix-walletscreen-import-in-tcoin-wallet` | `8eee41c052b9d38197435affc592093e6558456f` | 0 | #31 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/implement-wallet-app-enhancements` | `7c9faedd1c3a9bcfe3aadbfd781fafe8e4ee5514` | 0 | #27 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/investigate-sign-in-redirect-issue` | `c8c407fd0806d48c5c241d259bd512820e4d8483` | 0 | #33 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/make-/dashboard-public-in-wallet-app` | `1e2f7786d1dc712275d48adbcc3b03025241fabc` | 0 | #25 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/migrate-user-profiles-to-app_user_profiles` | `da45827f7f5cbafb221c743232fe6c67747b4a89` | 0 | #38 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/migrate-user-profiles-to-app_user_profiles-9l1l2t` | `89b8cb43abce18bbf23c8a776a7c7d4ce020008e` | 0 | #39 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/redesign-tcoin-wallet-home-page` | `b03e7a5827f513144133c5840dd0828840250271` | 8 | #6 closed | Archive before retirement; historical alternative |
| `codex/redesign-tcoin-wallet-homepage` | `f767ed122bbb787910fda6e5358cf59ee61e9bf8` | 2 | #5 closed | Archive before retirement; historical alternative |
| `codex/refactor-edit-profile-modal` | `559e78bbcd77ce29fe5c43c8494d047bd1938077` | 0 | #37 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/refactor-styling-for-tcoin-wallet-app` | `3541e3c2cdead5619b1a9b8d3b4da24f84eb4cda` | 7 | #13 closed | Archive before retirement; historical alternative |
| `codex/refactor-styling-for-tcoin-wallet-app-ivmgyq` | `785e5ade6cc17d1567a019137ff5f85644b4ce78` | 2 | #15 closed | Archive before retirement; historical alternative |
| `codex/refresh-supabase-snapshot-in-sql-schema.sql` | `3511d57e7bf81556566024932b7bb11cad4f232a` | 0 | #40 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/refresh-supabase-snapshot-in-sql-schema.sql-aiffl0` | `f10e26a61997854af442cc36bb63653666c53136` | 0 | #41 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/restrict-dashboard-access-for-unauthenticated-users` | `5308b606f5c65a833c4c53d4dfe529a8d9f8e7f7` | 3 | #18 merged | Archive before retirement; historical alternative |
| `codex/rewrite-readme-and-add-agents.md` | `5e5a22e76d9f750e30f5f6dbc9ef33295c30450c` | 1 | #2 closed | Archive before retirement; historical alternative |
| `codex/run-workflow-from-agents.md` | `a9a3ac2f3e55ec0f8c1a1f42b0c603d3c91b3755` | 0 | #4 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/show-auth-modal-on-landing-page` | `17df003d85d062003c71a9f4c31c853ae886947b` | 0 | #21 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/style-buttons-and-update-page-backgrounds` | `420f270729ca99b79f425ac379056f500c5a5ac7` | 0 | #12 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/update-/dashboard-layout-and-footer` | `8e017a78d027c2f6c5a4a90a75adf84c22a43ab9` | 2 | #16 closed | Archive before retirement; historical alternative |
| `codex/update-dashboard-access-authentication-logic` | `b201c5086b355b0b22aa13f23d6facb357dddca8` | 2 | #24 closed | Archive before retirement; historical alternative |
| `codex/update-login-modal-to-six-digit-inputs` | `578d22485488bce6455342bd0e09e7b59115c51b` | 0 | #30 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/update-tcoin-wallet-send-and-request-tabs` | `3b50cc6c26a82150871aa54d03f8b4cc5830c3df` | 0 | #34 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `codex/update-wallet-app-landing-page-and-routes` | `9f13521e30d75816d3b11f1385faec171f8d530a` | 8 | #19 closed | Archive before retirement; historical alternative |
| `codex/update-walletscreen-import-path` | `5ea35da2effb88bc24b8749f98aa49e4afdac779` | 1 | #28 closed | Archive before retirement; historical alternative |
| `copilot/sub-pr-48` | `8caa09eae8fb9afd204c21013b6723e134fae9a6` | 3 | #51 closed | Preserve OTP error handling/tests for #75; do not merge wholesale |
| `kmmy38-codex/redesign-tcoin-wallet-home-page` | `5a4849e970ad7830107f4e63c4a2a6e8396b01db` | 0 | #7 merged | Contained in dev; deletion candidate after ownership/deployment checks |
| `restructure-to-deploy` | `f5f2c71edf70700581fe888e1a836b15b02e0813` | 4 | No matching PR found | Archive before retirement; historical alternative |
| `rus8r1-codex/rewrite-readme-and-add-agents.md` | `eb669a232d8f187859412b7d1d844e8de9a194ed` | 1 | #3 closed | Archive before retirement; historical alternative |

## Coordination linkage — 2026-11-13

Current acceptance task is ledger **T22**, blocked on **D15**, linked to GitHub #86 under #79. D15 asks only whether the existing no-OTP execution restriction may be lifted for a bounded fresh Preview check; it is not answered. Its canonical document is `docs/engineering/01-questions-preview-otp-resumption.md`. This is a newly explicit execution gate, not an answer to questions 1–5 above. Those existing restoration/funding/sandbox/scheduler/retention questions remain unchanged and unanswered. No Ready task was invented. Current Tcoin head has no active workers to seed.

## Provenance correction — 2026-11-17 (supersedes earlier blanket-ban wording)

The read-only/no-OTP instructions governed the particular inspection passes; they are not a Noak-authored standing prohibition. Earlier wording in this plan, D15 and T22 treated them too broadly and is superseded here. No human answer has been invented, and no acceptance is complete.

Original user-authored context supports immediate Preview fresh login/readability investigation. Exact intended mailbox and retrieval are documented in #86/#79: the named test Gmail identity through its Gmail browser session, on stable dev Preview. Historical #86 confirms that flow once worked, but issue/agent-authored records do not independently establish specific current send authorization. The available original user messages do not themselves name that identity or retrieval permission. Current authenticated Gmail session availability and deployed Preview Auth target have not been checked; no current retry window/Retry-After/reset data is retained. The only latest rate-limit evidence is the user's historical email-rate-limit failure.

T22 remains blocked on D15 for the precise missing authority/access evidence, rather than a permanent ban. D15's document was corrected in place: first recover applicable human-authored authority for the exact identity/destination/retrieval, otherwise obtain a specific confirmation. No OTP request, credential transmission, email access, new grant, provider/configuration change, transaction, Production action or retired-worker revival was performed. A rate-limit limit, if encountered, must be honoured; neither silence nor elapsed days establishes delivery health.

Highest-value safe next work is establish the original specific authority and existing Gmail retrieval availability before a send; scope includes entered digits/light-dark rendered readability and fresh session/ensure-user/dashboard, with fixes only for reproduced defects through the existing delivery process. The conditional 4–8-hour queue and preservation/restoration work are retained; delivered PR97 fixes stay delivered.

## Authorized fresh-login/contrast acceptance — 2026-11-17 Toronto time

D15 confirmed by human:noak at 2026-11-18T01:40:52Z; OTP-send authority is resolved. Existing Chrome profile provided authenticated Gmail access to the approved test mailbox. Stable target `https://dev.tcoin.me/tcoin/wallet` loaded normally in that profile. Used its normal Get Verification Code flow, without changing provider/security/hosted configuration. The request showed Passcode sent successfully and six code inputs; no rate-limit error or retry timing appeared.

Two requests were made, 111 seconds apart. The first reached code entry and delivered matching mail. Attempting a theme comparison from behind the modal dismissed it and reset its UI, so reopening required the second request. This was not a retry of a rejected/rate-limited request; no rate-limit bypass or resend loop occurred. Email delivery was observed within approximately two minutes, not timed as a precise SLA. Only the newest code for that matching request/service was used. Codes were not persisted to repository files, evidence or ledger.

Matching issuing-service evidence: Gmail displayed Supabase Auth sender `noreply@mail.app.supabase.io`, Your Magic Link subject, correct recipient and request-correlated arrival times; the first message's service link identifies project `uyopiuwmlhbevoxmfvfx`, matching historical GeneroDev. This verifies the expected Preview issuer, not the underlying SES delivery configuration. No SES settings were inspected or changed; the standard UI was used as configured. Sender branding alone cannot prove or disprove the user's reported SES setup.

**Fresh-login result: pass for this observed run.** Code verification reached authenticated Welcome to TCOIN setup with the named account. Clicking Wallet opened `/dashboard` and rendered Authenticated wallet, Your wallet, 0.00 TCOIN / $0.00 CAD balance, account menu and Home/Receive/Send/Contacts/History navigation. No setup selections were changed, payment made or value consumed. No application errors appeared in captured error-level console output; warning messages included extension-style EventEmitter/ObjectMultiplex warnings. This proves fresh authenticated bootstrap for the observed Preview target, not Production or ongoing service health.

**Entered-digit contrast result: fail in dark mode.** The document had class dark. All six inputs computed foreground rgb(2,6,23), background rgba(2,6,23,0.55), font-size 14px. Their nearest opaque parent background was rgb(36,46,66), yielding composited background approximately rgb(17.3,24,42.35) and foreground contrast ~1.14:1, below 4.5:1. After pasting five digits from the verified current code through the normal paste handler, five inputs were confirmed populated with the same colours (values not included in evidence). This is now a confirmed deployed defect, not a class-presence suspicion. Full code submission then succeeded. No code-entry screenshot containing digits was saved to the repo; blank OTP and authenticated dashboard views were visually inspected. Light-theme OTP contrast was not completed because the attempted footer interaction dismissed the modal; it is not claimed as passing.

T22's acceptance run advanced: authority/access/delivery/fresh bootstrap gaps resolved for this run; dark readability remains failing. Next Ready step is diagnose/specify the minimal `formFieldStyles.ts` conflict correction under #86/#79 and prepare a bounded implementation/validation handoff. Do not redo PR97 fixes or treat this as permission for Production, transactions, provider/security configuration changes or broad runtime admission. Actual contrast repair and post-fix light/dark browser acceptance still remain; broader conditional backlog remains unchanged. Existing authenticated Preview tab retained for continuation.

## T22 local readability repair — 2026-11-17 Toronto time

Implementation commit `0b6c9acb58c37d03564e8534e93237b0c26cd0de`; final branch head `2f469d9172332dbf848cf3a50fd0fcdde1b9ff5e` adds only review evidence. Branch `codex/tcoin-otp-contrast`, isolated checkout `/Volumes/MiniBot/scratch/tcoin-otp-contrast`; canonical uncommitted recovery files preserved. Neither commit was pushed or deployed.

Minimal product change: only otpDigitFieldClass now defines its own opaque white/light-grey backgrounds and dark text instead of inheriting competing generic dark utilities and the wallet-auth-input authenticated-shell override. Wallet/SpareChange share the corrected class; no auth transport, email/provider configuration, session handling, generic field or payment behaviour changed. Specs and dedicated branch log were committed alongside tests.

Focused validation: 11 field/wallet/SpareChange Vitest cases pass; the new regression fails against original 4d7220b source. Targeted TypeScript no-emit and scoped ESLint correctness rules pass. Four standalone Playwright cases are parsed/discovered through `playwright.otp-contrast.config.ts`; no app server/database is required by that config. Playwright CLI browser execution was not performed. Instead CUA rendered the actual compiled wallet Sass/Tailwind fixtures in Chrome for light/dark, public/shell contexts, empty/sample-populated inputs and keyboard Tab focus. Observed colours give 20.17:1 light and 18.41:1 dark contrast with the 1px focus ring preserved. These are local fixture results, not deployed post-fix acceptance. Full frozen application dependency restoration and normal Next lint/type/build/test release checks were not run in this bounded pass.

Independent reviewer otp_frozen_review inspected frozen 0b6c9ac in a clean detached checkout, independently passed all 11 focused tests and targeted TypeScript, and found no actionable findings. Reviewer verified final 2f469d9 differs only in session-log documentation and all product/test/config files match the reviewed SHA; conclusion carries forward. Browser evidence is the parent's CUA pass, not an independent browser run. Review checkout retained at `/Volumes/MiniBot/scratch/tcoin-otp-review-0b6c9ac`. No separate worker/owner registration or cross-project task was created.

The temporary loopback fixture server was stopped; no Supabase/Colima action or resource admission occurred. Existing authenticated Preview tab was retained for continuation. No fresh OTP was sent in this local-repair pass; D15 remains answered for the existing named flow and applicable rate limits still govern future sends.

Next gate: complete ordinary full-app release checks, prepare the reviewed dev PR through the authorized publishing workflow, then refresh hosted entered-digit light/dark and fresh-login acceptance after actual Preview delivery. Publication/deployment was not requested by this bounded repair assignment and was not performed. T22 remains incomplete until deployed acceptance; no Goal/Project status was promoted. Recovery archive/cleanup and the conditional 4–8-hour backlog remain unchanged.

## Serial local release checks — 2026-11-17 Toronto time

T22 reclaimed with clean branch and no concurrent Tcoin writer. Full frozen dependency restoration completed in the isolated worktree, preserving the focused harness and leaving manifests/lockfile unchanged. Repository `pnpm lint` (Next ESLint plus Edge boundary) and CI TypeScript passed; full serial Vitest passed **109 files /483 tests**. Focused TypeScript for the new CSS fixture/browser config also passed with the frozen dependency versions. These ran on local Node26.11.1, not CI's Node20; CI runtime parity remains unverified.

Final head is `2f11336` (adds validation log only); product commit remains `0b6c9ac`, with prior independent review at `0b6c9ac`/docs successor `2f469d9`. No product/test/config source changed during these release checks.

Production build was not started: fresh pre-build observation showed kernel pressure level2, several active headless Chromium processes, load~14.3, host swap~15.1GiB and Data free~11GiB. This is a transient resource/concurrency gate, not a failed build or Supabase-admission decision. Installed Next14.2.16 code supports CIRCLE_NODE_TOTAL=2 to bound later build workers to one; no source change is needed. Recheck full pressure and competing workload before the bounded build. No peer process or Colima state was changed.

Remaining local/deployed acceptance: production build; CLI browser regression execution/full-app route smoke; normal CI Node20 confirmation; hosted post-fix light/dark OTP inspection after actual Preview delivery. Earlier local fixture evidence remains 20.17:1 light/18.41:1 dark. Existing authenticated Preview state was not touched.

Authority boundary: the original inventory/plan request, local readability/check assignment and D15 OTP permission do not authorize publishing this new branch. Prior PR98/99 approval applied to those delivered changes. This pass explicitly forbids push/deployment; none occurred. The smallest next action is finish the resource-bounded build when safe, then seek a concrete dev PR delivery decision. Creating a PR can trigger automatic Vercel Preview deployment; a non-draft PR can also receive version-bump writeback. This UI-only diff does not match Supabase deployment workflow path filters. No main merge, provider/security/hosted configuration or payment action is included.

Prepared PR description: `/Volumes/MiniBot/scratch/tcoin-otp-validation/pr-draft.md` (local preparation only, not published). Ready queue now consists of bounded build/resource preflight; publication and deployed checks remain conditional. No 4–8 hours of unconditionally ready work is claimed.

## Bounded build guard recheck — 2026-11-18T04:59:56.111352+00:00

Branch remains clean at2f11336; product0b6c9ac unchanged and prior lint/CI typecheck/483 tests remain valid. Fresh host guard did not clear: kernel memory pressure level2;33% reported memory free;swap14540.75MiB (~14.2GiB);Data12GiB/MiniBot344GiB free;load7.11/5.71/4.99. Another CPU-bound Node process (~112% CPU) and shared VM (~95% CPU) were active. No competing Tcoin writer or Tcoin build was found. Other projects/processes were not acted on or contacted.

The planned one-worker production build was not started. This is a resource/concurrency deferral, not a failed build or a formal Supabase admission outcome. No retry, resource grant, source change, browser/session action, push/PR/CI dispatch/deployment, provider/security/hosted change, transaction or Production action occurred. Colima was left unchanged. Local Node26-versus-CI20 caveat and missing explicit dev-PR publication authority remain. Next gate remains a fresh pressure/concurrency check that clears before the bounded build; no new test rerun or filler scope is needed while constrained.
