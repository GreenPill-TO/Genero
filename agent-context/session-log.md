## v1.193
### Timestamp
- 2026-04-13 09:41 EDT

### Objective
- Complete the wallet release runbook so production launch checks are explicit, repo-grounded, and reusable by humans instead of living only in scattered notes and prior session context.

### What Changed
- Added `docs/engineering/wallet-release-runbook.md` as the canonical wallet go-live checklist, wiring it to the repo's actual runtime contracts: required env groups, release preflight commands, local and production smoke steps, pay-link cleanup cron verification, indexer health expectations, and rollback guidance.
- Synced `.env.local.example` with production-facing runtime inputs that were already used in code but not surfaced in the template, including `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_EXPLORER_URL`, and the Twilio Verify env vars for off-ramp SMS verification.
- Marked the release-runbook todo item complete and updated the technical/functional specs so the new runbook is discoverable from the main engineering artefacts.

### Verification
- `pnpm lint`
- `pnpm test`

### Files Edited
- `agent-context/session-log.md`
- `agent-context/todo.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `docs/engineering/wallet-release-runbook.md`
- `.env.local.example`

## v1.192
### Timestamp
- 2026-04-13 09:21 EDT

### Objective
- Eliminate the repo-owned lint and test warnings uncovered during the production-readiness pass so new warnings stand out as real regressions instead of background noise.

### What Changed
- Fixed every current ESLint warning by tightening hook dependencies, replacing legacy image usage in the warned SpareChange surfaces, and moving the wallet layout’s Special Elite font loading onto `next/font/google`.
- Reduced test noise by stubbing Cubid SDK/provider modules in `vitest.setup.ts`, modernizing modal tests away from deprecated `react-dom/test-utils`, fixing the `next/image` test mock that leaked the `priority` prop to the DOM, and mocking or silencing expected error-path logging in focused component/hook tests.
- Hardened a few warning-adjacent implementation details while touching those files, including the SpareChange user-info username hydration bug and the wallet dashboard tests’ missing edge-client mocks.
- Updated the todo/spec artefacts to mark the warning-reduction work complete and to record that the remaining repeated `--localstorage-file` warning comes from the surrounding local runtime rather than from checked-in repo code.

### Verification
- `pnpm lint`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/ContactSelectModal.test.tsx app/tcoin/wallet/components/modals/ShareQrModal.test.tsx app/tcoin/wallet/components/modals/SignInModal.test.tsx app/tcoin/wallet/components/landing-header/LandingHeader.test.tsx app/tcoin/wallet/components/dashboard/SendCard.test.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx shared/api/hooks/useAuth.test.tsx shared/hooks/useSendMoney.test.ts`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `pnpm test`
- `pnpm build`

### Files Edited
- `agent-context/session-log.md`
- `agent-context/todo.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `next.config.js`
- `vitest.setup.ts`
- `app/tcoin/contracts/proposals/[id]/page.tsx`
- `app/tcoin/sparechange/ContentLayout.tsx`
- `app/tcoin/sparechange/components/navbar/Navbar.tsx`
- `app/tcoin/sparechange/dashboard/page.tsx`
- `app/tcoin/sparechange/dashboard/screens/WalletComponent.tsx`
- `app/tcoin/sparechange/home/Hero.tsx`
- `app/tcoin/sparechange/welcome/page.tsx`
- `app/tcoin/sparechange/welcome/steps/UserInfoStep.tsx`
- `app/tcoin/wallet/layout.tsx`
- `app/tcoin/wallet/components/landing-header/LandingHeader.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendCard.test.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `app/tcoin/wallet/components/modals/CharitySelectModal.test.tsx`
- `app/tcoin/wallet/components/modals/ContactSelectModal.test.tsx`
- `app/tcoin/wallet/components/modals/ShareQrModal.test.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.test.tsx`
- `shared/api/hooks/useAuth.test.tsx`
- `shared/hooks/useSendMoney.test.ts`

## v1.191
### Timestamp
- 2026-04-13 01:16 EDT

### Objective
- Turn the initial wallet production-readiness audit into concrete repo work by hardening public OTP endpoints, removing unsafe runtime logging, and adding the missing CI secret-scan gate.

### What Changed
- Added a prioritised production-readiness checklist to `agent-context/todo.md`, then completed the first three items: wallet-runtime logging hardening, OTP contract hardening, and CI secret scanning.
- Removed the unused `/api/sendsms` route, stripped unsafe `console.log(...)` calls from wallet custody/send flows and related QR/profile screens, and kept the remaining runtime logging focused on non-secret operational errors.
- Extracted the active Twilio Verify integration into `shared/lib/twilioVerify.ts`, updated `/api/send_otp` and `/api/verify_otp` to share input validation and upstream error handling, and added route tests for malformed input, missing env, upstream failures, and success paths.
- Added `.github/workflows/secret-scan.yml` so pull requests run a TruffleHog diff scan and nightly/manual runs perform a full repository scan, aligning CI with the repo security guard-rails.
- Updated the engineering specs to record the shared OTP validation contract, the retired raw SMS endpoint, the no-secret-logging rule for wallet runtime flows, and the new secret-scan posture.

### Verification
- `pnpm exec vitest run app/api/send_otp/route.test.ts app/api/verify_otp/route.test.ts shared/hooks/useSendMoney.test.ts`
- `pnpm lint`
- `pnpm build`

### Files Edited
- `agent-context/session-log.md`
- `agent-context/todo.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `.github/workflows/secret-scan.yml`
- `shared/lib/twilioVerify.ts`
- `app/api/send_otp/route.ts`
- `app/api/send_otp/route.test.ts`
- `app/api/verify_otp/route.ts`
- `app/api/verify_otp/route.test.ts`
- `app/api/sendsms/route.ts`
- `shared/hooks/useSendMoney.tsx`
- `app/tcoin/sparechange/components/modals/QrScanModal.tsx`
- `app/tcoin/sparechange/components/modals/UserProfileModal.tsx`
- `app/tcoin/sparechange/dashboard/screens/WalletComponent.tsx`

## v1.190
### Timestamp
- 2026-04-06 19:14 EDT

### Objective
- Capture a future auth-refactor idea in the agent context so the OTP transport discussion is not lost after the branch cleanup.

### What Changed
- Added `agent-context/todo.md` with a follow-up note about revisiting passcode delivery and verification behind a shared server boundary, potentially via a Supabase Edge Function or a common server-side helper.
- Recorded the constraint that any future refactor must preserve the immediate post-OTP session handoff needed by the current wallet auth bootstrap flow.

### Verification
- Not run; documentation-only change.

### Files Edited
- `agent-context/session-log.md`
- `agent-context/todo.md`

## v1.189
### Timestamp
- 2026-04-06 16:30 EDT

### Objective
- Clear the renewed GitHub Actions failure on PR #62 by making the shared auth-listener fan-out compatible with the repository's CI TypeScript target.

### What Changed
- Replaced the `for...of` iteration over `Map.keys()` inside `useAuth()` with `Map.forEach(...)`, preserving the multi-`QueryClient` auth fan-out while avoiding the downlevel-iteration requirement that CI rejected.
- Kept the auth behaviour unchanged: every active React Query client still receives the session update, and the best-effort indexer touch still runs once per `SIGNED_IN` event.

### Verification
- `pnpm exec tsc --noEmit -p tsconfig.ci.json`
- `pnpm exec vitest run shared/api/hooks/useAuth.test.tsx shared/lib/supabase/session.test.ts shared/lib/edge/core.test.ts`

### Files Edited
- `agent-context/session-log.md`
- `shared/api/hooks/useAuth.ts`

## v1.188
### Timestamp
- 2026-04-06 17:19 EDT

### Objective
- Address the inline PR review feedback on the wallet auth-bootstrap work by fixing the shared auth listener for nested React Query providers and making the Supabase session snapshot browser-only.

### What Changed
- Reworked `useAuth()` so the single shared Supabase `onAuthStateChange(...)` listener now reference-counts every active `QueryClient` and fans auth cache updates out to each one, instead of only updating the last-mounted client.
- Kept the best-effort `/api/indexer/touch` trigger tied to the auth event itself, so one sign-in still emits only one indexer touch even when multiple query clients are active.
- Restricted the shared Supabase session snapshot helper to browser-only caching, preventing SSR or other server-side execution from persisting a process-global auth token across requests.
- Added regression coverage for multi-client auth propagation and the server-side no-cache guard, and updated the engineering specs to reflect both constraints.

### Verification
- `pnpm exec eslint shared/api/hooks/useAuth.ts shared/api/hooks/useAuth.test.tsx shared/lib/supabase/session.ts shared/lib/supabase/session.test.ts`
- `pnpm exec vitest run shared/api/hooks/useAuth.test.tsx shared/lib/supabase/session.test.ts shared/lib/edge/core.test.ts`

### Files Edited
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `shared/api/hooks/useAuth.ts`
- `shared/api/hooks/useAuth.test.tsx`
- `shared/lib/supabase/session.ts`
- `shared/lib/supabase/session.test.ts`

## v1.187
### Timestamp
- 2026-04-06 13:56 EDT

### Objective
- Fold the already-documented wallet public-shell and auth-field styling fixes into the active auth PR branch so the review bundle includes the matching UI polish instead of leaving those useful changes behind locally.

### What Changed
- Added the `wallet-public-shell` class to public wallet routes and kept the matching tests/styles that scope unauthenticated link and brand colours to the teal palette in both light and dark mode.
- Kept the shared auth-only form-field updates that switch the sign-in email field and OTP digit boxes to a light dark-mode surface with dark text for stronger contrast inside the auth modal.
- Validated the focused wallet layout and auth-field styling tests before packaging the changes onto the same feature branch and PR.

### Verification
- `pnpm exec eslint app/tcoin/wallet/ContentLayout.tsx app/tcoin/wallet/ContentLayout.test.tsx shared/components/ui/formFieldStyles.ts shared/components/ui/formFieldStyles.test.ts`
- `pnpm exec vitest run app/tcoin/wallet/ContentLayout.test.tsx shared/components/ui/formFieldStyles.test.ts`

### Files Edited
- `agent-context/session-log.md`
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/wallet/ContentLayout.test.tsx`
- `app/tcoin/wallet/styles/app.scss`
- `shared/components/ui/formFieldStyles.ts`
- `shared/components/ui/formFieldStyles.test.ts`

## v1.186
### Timestamp
- 2026-04-06 13:45 EDT

### Objective
- Finish the remaining local wallet auth issues by removing the last bootstrap ordering race and the duplicate auth-event fan-out that still appeared during OTP smoke testing.

### What Changed
- Updated `useUserSettings()` so authenticated settings bootstrap waits for `useAuth()` to finish `ensure-user` and expose a concrete authenticated user record before it ever calls `user-settings/bootstrap`.
- Reworked `useAuth()` to share one Supabase `onAuthStateChange(...)` subscription across hook consumers, preventing a single sign-in from triggering repeated `user-data` invalidations and duplicate best-effort indexer touches from every mounted auth consumer.
- Added focused regression tests for both behaviours, then reran the clean local Supabase + Playwright OTP smoke flow to confirm the wallet now reaches `/welcome` without `401` responses or the earlier auth bootstrap failures.

### Verification
- `pnpm exec eslint shared/api/hooks/useAuth.ts shared/api/hooks/useAuth.test.tsx shared/hooks/useUserSettings.ts shared/hooks/useUserSettings.test.tsx`
- `pnpm exec vitest run shared/api/hooks/useAuth.test.tsx shared/hooks/useUserSettings.test.tsx app/tcoin/wallet/components/modals/SignInModal.test.tsx shared/lib/edge/core.test.ts`
- `supabase start --ignore-health-check -x storage-api -x imgproxy -x studio -x postgres-meta -x logflare -x vector -x supavisor --workdir /Users/botmaster/.codex-smoke/genero-local-home`
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=... SUPABASE_SERVICE_ROLE_KEY=... PORT=3001 pnpm dev`
- `HOME=/tmp/genero-playwright-home PLAYWRIGHT_BROWSERS_PATH=/tmp/genero-playwright-browsers node /tmp/genero-smoke-pw/smoke-auth.js`

### Files Edited
- `shared/api/hooks/useAuth.ts`
- `shared/api/hooks/useAuth.test.tsx`
- `shared/hooks/useUserSettings.ts`
- `shared/hooks/useUserSettings.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.185
### Timestamp
- 2026-04-06 13:37 EDT

### Objective
- Smoke-test the post-OTP auth-race fix locally, harden the wallet sign-in handoff when OTP verification already returns a usable Supabase session, and record the remaining local-only runtime failures discovered during the browser pass.

### What Changed
- Reworked the wallet sign-in modal so the OTP verify success path reuses the `Session` returned by `supabase.auth.verifyOtp(...)` for the immediate `/welcome` versus `/dashboard` decision, only falling back to `waitForAuthenticatedSession(...)` if the verify response does not include a usable access token.
- Updated the shared passcode service to return the verified Supabase session object, and added a regression test proving the wallet modal no longer waits on auth polling when a fresh verified session is already available.
- Re-ran the local Colima/Supabase/Playwright smoke flow outside `/tmp`, confirmed the earlier `/tmp` bind-mount problem was causing the initial local `503` boot failures, and captured the remaining valid-stack issues: local edge-worker creation timeouts plus a later `user-settings` app-profile statement timeout during bootstrap.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/modals/SignInModal.test.tsx shared/api/hooks/useAuth.test.tsx shared/lib/edge/core.test.ts`
- `pnpm exec eslint app/tcoin/wallet/components/modals/SignInModal.tsx app/tcoin/wallet/components/modals/SignInModal.test.tsx shared/api/services/supabaseService.ts`
- Local smoke environment:
- `supabase start --ignore-health-check -x storage-api -x imgproxy -x studio -x postgres-meta -x logflare -x vector -x supavisor --workdir /Users/botmaster/.codex-smoke/genero-local-home`
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=... SUPABASE_SERVICE_ROLE_KEY=... PORT=3001 pnpm dev`
- `HOME=/tmp/genero-playwright-home PLAYWRIGHT_BROWSERS_PATH=/tmp/genero-playwright-browsers node /tmp/genero-smoke-pw/smoke-auth.js`

### Files Edited
- `shared/api/services/supabaseService.ts`
- `app/tcoin/wallet/components/modals/SignInModal.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.184
### Timestamp
- 2026-04-06 12:11 EDT

### Objective
- Fix the post-OTP auth bootstrap race that was leaving wallet sign-in stuck behind repeated `401 Unauthorized` responses from the shared user-settings edge routes.

### What Changed
- Added a shared browser-session snapshot helper so auth-aware clients can reuse the newest Supabase access token immediately after OTP verification instead of depending on a second `getSession()` read to settle first.
- Updated wallet auth state, Supabase auth service helpers, and the shared edge/user-settings clients to gate authenticated bootstrap work on a non-empty access token and to omit empty bearer headers when no token is available yet.
- Extended auth and edge-client tests to cover the cached-token path and the no-token-auth-state guard, and recorded the new auth bootstrap contract in the engineering specs.

### Verification
- `pnpm exec eslint shared/lib/supabase/session.ts shared/api/hooks/useAuth.ts shared/api/services/supabaseService.ts shared/lib/userSettings/client.ts shared/lib/edge/core.ts shared/api/hooks/useAuth.test.tsx shared/lib/edge/core.test.ts`
- `pnpm exec vitest run shared/api/hooks/useAuth.test.tsx shared/lib/edge/core.test.ts`

### Files Edited
- `shared/lib/supabase/session.ts`
- `shared/api/hooks/useAuth.ts`
- `shared/api/hooks/useAuth.test.tsx`
- `shared/api/services/supabaseService.ts`
- `shared/lib/userSettings/client.ts`
- `shared/lib/edge/core.ts`
- `shared/lib/edge/core.test.ts`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.183
### Timestamp
- 2026-04-06 11:53 EDT

### Objective
- Fix the auth modal field surface in dark mode so the email and OTP inputs use a very light grey fill instead of the current dark grey background.

### What Changed
- Updated the shared auth-only field classes so the sign-in email input and OTP digit inputs now render with a light grey dark-mode surface, darker text, and a matching lighter border for clearer contrast inside the auth modal.
- Left the broader signed-in form-field surface tokens unchanged, keeping this styling fix scoped to the authentication modal flows used by wallet and SpareChange.
- Extended the shared form-field style test to lock in the new dark-mode auth-field surface contract.

### Verification
- `pnpm exec eslint shared/components/ui/formFieldStyles.ts shared/components/ui/formFieldStyles.test.ts`
- `pnpm exec vitest run shared/components/ui/formFieldStyles.test.ts`

### Files Edited
- `shared/components/ui/formFieldStyles.ts`
- `shared/components/ui/formFieldStyles.test.ts`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.182
### Timestamp
- 2026-04-06 11:50 EDT

### Objective
- Fix unauthenticated wallet hyperlink colours in dark mode so public links use the shared teal palette instead of the old pink token, and keep public link colour ownership inside the shared unauthenticated shell styling.

### What Changed
- Added a dedicated `wallet-public-shell` class to public wallet routes in `ContentLayout`, so all landing, resources, contact, merchants, ecosystem, and pay-link descendants share one unauthenticated theme scope.
- Updated the wallet stylesheet so `wallet-public-shell` now defines teal link and brand-logo tokens in light mode plus a lighter teal variant in dark mode, replacing the old pink dark-mode hyperlink colour on unauthenticated pages.
- Extended the `ContentLayout` test coverage to assert that both standard public routes and `/pay/[token]` routes receive the shared public shell class.

### Verification
- `pnpm exec eslint app/tcoin/wallet/ContentLayout.tsx app/tcoin/wallet/ContentLayout.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/ContentLayout.test.tsx`

### Files Edited
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/wallet/ContentLayout.test.tsx`
- `app/tcoin/wallet/styles/app.scss`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.181
### Timestamp
- 2026-04-06 12:04 EDT

### Objective
- Address the remaining migration review comments by closing the transfer-bookkeeping spoofing hole and making the email-history backfill tolerant of legacy duplicate emails.

### What Changed
- Removed direct `authenticated` execute access from the legacy `simple_transfer(...)` migration contract so only trusted service-role callers can invoke the `SECURITY DEFINER` function.
- Hardened `recordWalletTransfer(...)` in the wallet-operations shared edge helper so the requested `transfer_user_id` must match the authenticated wallet user id, and the RPC call now always records the authenticated user id rather than trusting caller input.
- Updated the email-history migration to de-duplicate active history rows before unique indexes are created, rank duplicate legacy `users.email` values deterministically during backfill, and promote a fallback primary email when a user would otherwise end up with none.
- Added focused wallet-operations tests covering the new transfer-user validation and authenticated-user RPC forwarding behaviour.

### Verification
- `pnpm exec eslint supabase/functions/_shared/walletOperations.ts supabase/functions/_shared/walletOperations.test.ts`
- `pnpm exec vitest run supabase/functions/_shared/walletOperations.test.ts`
- `git diff --check -- supabase/migrations/20260402024500_v1.08_user_email_history.sql supabase/migrations/20260402184500_v1.10_wallet_transaction_ledger_contract.sql`

### Files Edited
- `supabase/migrations/20260402024500_v1.08_user_email_history.sql`
- `supabase/migrations/20260402184500_v1.10_wallet_transaction_ledger_contract.sql`
- `supabase/functions/_shared/walletOperations.ts`
- `supabase/functions/_shared/walletOperations.test.ts`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.180
### Timestamp
- 2026-04-06 11:35 EDT

### Objective
- Address the unresolved inline PR review comments with targeted hardening fixes and clarify the intentional auth contract for the new stats endpoint.

### What Changed
- Switched `supabase:start:local` to launch its zsh-only helper script with `zsh`, matching the script shebang and avoiding shell mismatch failures.
- Hardened shared helpers by stripping `variant` from the custom `Input` wrapper, replacing `window.setTimeout` with runtime-safe `setTimeout`, and making legacy wallet pay-link decoding UTF-8 safe without deprecated `escape(...)`.
- Added `revokePreparedProfilePicturePreview(...)`, wired it into the wallet welcome/profile image flows, and added focused tests for both the preview revoke helper and the pay-link decoder.
- Kept `/api/tcoin/stats/summary` available to any authenticated wallet user, and made that read-only aggregate contract explicit in the route and route test.

### Verification
- `pnpm exec eslint shared/components/ui/Input.tsx shared/api/services/supabaseService.ts shared/lib/walletPayLinks.ts shared/lib/walletPayLinks.test.ts shared/lib/profilePictureCrop.ts shared/lib/profilePictureCrop.test.ts app/api/tcoin/stats/summary/route.ts app/api/tcoin/stats/summary/route.test.ts app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `pnpm exec vitest run shared/lib/walletPayLinks.test.ts shared/lib/profilePictureCrop.test.ts app/api/tcoin/stats/summary/route.test.ts`

### Files Edited
- `package.json`
- `shared/components/ui/Input.tsx`
- `shared/api/services/supabaseService.ts`
- `shared/lib/walletPayLinks.ts`
- `shared/lib/walletPayLinks.test.ts`
- `shared/lib/profilePictureCrop.ts`
- `shared/lib/profilePictureCrop.test.ts`
- `app/api/tcoin/stats/summary/route.ts`
- `app/api/tcoin/stats/summary/route.test.ts`
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.179
### Timestamp
- 2026-04-06 11:07 EDT

### Objective
- Repair the latest PR CI failure by making the off-ramp manual-phone fallback test assert the stable intent of the message instead of brittle exact copy.

### What Changed
- Updated `OffRampModal.test.tsx` so the Cubid phone-stamp fallback assertion matches the durable `load your verified phone automatically` fragment rather than the full sentence.
- Left the user-facing off-ramp copy unchanged; this is a CI hardening pass only.
- Recorded the copy-flexible fallback contract in the technical and functional specs so the test intent is clearer for future edits.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/OffRampModal.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/OffRampModal.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/OffRampModal.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.178
### Timestamp
- 2026-04-06 00:39 EDT

### Objective
- Fix the repeat wallet OTP flow so resend and retry attempts do not leave stale six-digit codes in place or trigger `403 /auth/v1/verify` failures from mixed old/new OTP submissions.

### What Changed
- Added an `otpResetKey` contract to both wallet and sparechange OTP forms so the six-digit inputs clear and re-focus whenever a resend succeeds or a verify attempt fails.
- Updated both sign-in modals to reset passcode state on resend and verify errors, and to send the normalized `fullContact` to Supabase for both send and verify operations instead of the raw contact fragment.
- Added regression coverage proving the OTP inputs clear when the reset key changes, which protects the resend path that previously left old digits in place.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/forms/OTPForm.tsx app/tcoin/wallet/components/forms/OTPForm.test.tsx app/tcoin/wallet/components/modals/SignInModal.tsx app/tcoin/sparechange/components/forms/OTPForm.tsx app/tcoin/sparechange/components/forms/OTPForm.test.tsx app/tcoin/sparechange/components/modals/SignInModal.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/forms/OTPForm.test.tsx app/tcoin/wallet/components/modals/SignInModal.test.tsx app/tcoin/sparechange/components/forms/OTPForm.test.tsx`
- Local headed Playwright smoke on `http://localhost:3000/welcome` with a fresh OTP user, then sign-out, second sign-in for the same email, resend, successful verify, and a final DB check confirming exactly one `public.users` row for that email

### Files Edited
- `app/tcoin/wallet/components/forms/OTPForm.tsx`
- `app/tcoin/wallet/components/forms/OTPForm.test.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.tsx`
- `app/tcoin/sparechange/components/forms/OTPForm.tsx`
- `app/tcoin/sparechange/components/forms/OTPForm.test.tsx`
- `app/tcoin/sparechange/components/modals/SignInModal.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.177
### Timestamp
- 2026-04-06 00:10 EDT

### Objective
- Enforce unique `users.auth_user_id` ownership so OTP/auth cannot create duplicate user rows, while preserving the multi-contact account model that lets one account own several emails and later several phones without supporting cross-account merges.

### What Changed
- Added `20260406022000_v1.14_auth_identity_uniqueness.sql`, which backs up and nulls non-canonical duplicate `auth_user_id` rows before creating a partial unique index on `public.users(auth_user_id)` for non-null values.
- Added canonical `public.user_phone_addresses` history, mirroring the existing email-history design with one active phone globally, one active primary phone per user, soft deletes, and a trigger that keeps `public.users.phone` synced to the current primary phone.
- Updated shared user-settings auth provisioning to resolve phone ownership through the new phone-history table, preserve authenticated emails/phones on the canonical user, reconcile unique-index races, and reject attempts to bind an email or phone that already belongs to another active account.
- Updated the shared authenticated-user resolver to consult phone history as well as email history, and added unit coverage for the new phone normalization helpers.

### Verification
- `pnpm exec eslint supabase/functions/_shared/userSettings.ts supabase/functions/_shared/userSettings.test.ts supabase/functions/_shared/auth.ts`
- `pnpm exec vitest run supabase/functions/_shared/userSettings.test.ts`
- `supabase db push --local --include-all`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select auth_user_id, array_agg(id order by id), count(*) from public.users where auth_user_id is not null group by auth_user_id having count(*) > 1;"`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \"select indexname from pg_indexes where schemaname='public' and tablename='users' and indexname='users_auth_user_id_key';\"`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \"select indexname from pg_indexes where schemaname='public' and tablename='user_phone_addresses';\"`
- Local OTP smoke on `http://localhost:3000/welcome` with a fresh email, checking that auth now reuses the canonical user row instead of minting another active row for the same `auth_user_id`

### Files Edited
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/_shared/userSettings.test.ts`
- `supabase/functions/_shared/auth.ts`
- `supabase/migrations/20260406022000_v1.14_auth_identity_uniqueness.sql`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.176
### Timestamp
- 2026-04-05 21:46 EDT

### Objective
- Let auth-backed users keep a nullable `cubid_id` and cleanse the old app-derived `cubid_id` values that were copied from `auth_user_id`.

### What Changed
- Updated shared user-settings bootstrapping and authenticated-user provisioning so `users.cubid_id` is normalized to `null` whenever it only mirrors the authenticated Supabase user id, instead of persisting that fallback into new or existing rows.
- Tightened the shared frontend auth/user types around nullable `cubid_id`, including the last strict sparechange wallet screen type and clearer auth-hook logging for identity fetch failures.
- Added the local cleanup migration `20260405214500_v1.13_nullify_app_derived_cubid_ids.sql`, which backs up and nulls any stored `users.cubid_id` values that equal `auth_user_id` before leaving future reads to treat those users as Cubid-less until a real Cubid identity exists.
- Hardened `ensureAppProfile(...)` against duplicate insert races by re-reading the existing composite-key row when concurrent auth/bootstrap work creates the same `app_user_profiles` record at the same time.

### Verification
- `pnpm exec eslint app/tcoin/sparechange/dashboard/screens/WalletComponent.tsx shared/api/hooks/useAuth.ts shared/api/hooks/useAuth.test.tsx shared/api/services/supabaseService.ts shared/lib/userSettings/types.ts shared/types/cubid.ts supabase/functions/_shared/userSettings.ts supabase/functions/_shared/userSettings.test.ts`
- `pnpm exec vitest run shared/api/hooks/useAuth.test.tsx supabase/functions/_shared/userSettings.test.ts`
- `supabase db push --local --include-all`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select id, email, auth_user_id, cubid_id from public.users where auth_user_id is not null and cubid_id = auth_user_id limit 10;"`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select id, email, auth_user_id, cubid_id from public.users where email = 'stats-smoke-8@example.com';"`
- Headed local wallet sign-in smoke on `http://localhost:3000/welcome` using fresh OTP user `stats-smoke-8@example.com`, confirming onboarding still loads after the cleanup with `cubid_id = null` and without the earlier duplicate `app_user_profiles_pkey` error

### Files Edited
- `app/tcoin/sparechange/dashboard/screens/WalletComponent.tsx`
- `shared/api/hooks/useAuth.ts`
- `shared/api/hooks/useAuth.test.tsx`
- `shared/api/services/supabaseService.ts`
- `shared/lib/userSettings/types.ts`
- `shared/types/cubid.ts`
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/_shared/userSettings.test.ts`
- `supabase/migrations/20260405214500_v1.13_nullify_app_derived_cubid_ids.sql`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.175
### Timestamp
- 2026-04-05 21:31 EDT

### Objective
- Remove the browser regex warning from the wallet auth form by fixing the email input validation contract used in the OTP modal.

### What Changed
- Removed the custom email `pattern` attribute from both wallet and sparechange OTP forms, relying on the existing native `type="email"` validation instead.
- Added focused assertions in both OTP-form test files to keep the email field free of the old browser-rejected regex pattern.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/forms/OTPForm.tsx app/tcoin/wallet/components/forms/OTPForm.test.tsx app/tcoin/sparechange/components/forms/OTPForm.tsx app/tcoin/sparechange/components/forms/OTPForm.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/forms/OTPForm.test.tsx app/tcoin/sparechange/components/forms/OTPForm.test.tsx`
- Headed Playwright smoke on `http://localhost:3000/welcome`, opening the auth modal and confirming the console no longer reports the email-pattern regex error

### Files Edited
- `app/tcoin/wallet/components/forms/OTPForm.tsx`
- `app/tcoin/wallet/components/forms/OTPForm.test.tsx`
- `app/tcoin/sparechange/components/forms/OTPForm.tsx`
- `app/tcoin/sparechange/components/forms/OTPForm.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.174
### Timestamp
- 2026-04-05 21:18 EDT

### Objective
- Diagnose and fix the local wallet OTP sign-in failures that were still surfacing `user-settings/auth/ensure-user` errors and noisy Cubid API failures after authentication.

### What Changed
- Fixed `supabase/functions/_shared/userSettings.ts` so the shared bootstrap query now actually selects and returns `users.auth_user_id`, `created_at`, and `updated_at`, which keeps the legacy Cubid compatibility payload from looking permanently stale.
- Updated `shared/api/hooks/useAuth.ts` to surface real ensure-user failures, skip external Cubid refreshes when the stored `cubid_id` is just the authenticated Supabase user id, and treat Cubid refresh failures as non-fatal so auth/bootstrap remains usable.
- Added `waitForAuthenticatedSession()` in `shared/api/services/supabaseService.ts` and changed the wallet/sparechange sign-in modals to wait for a settled auth session before resolving the post-OTP user row, removing the old fallback that tried to create a brand-new Cubid user whenever provisioning looked transiently unavailable.
- Added regression coverage for the wallet sign-in modal and `useAuth`, including the auth-session wait path and the “auth id is not a real Cubid identity” refresh skip case.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/SignInModal.tsx app/tcoin/wallet/components/modals/SignInModal.test.tsx app/tcoin/sparechange/components/modals/SignInModal.tsx shared/api/hooks/useAuth.ts shared/api/hooks/useAuth.test.tsx shared/api/services/supabaseService.ts shared/lib/userSettings/types.ts supabase/functions/_shared/userSettings.ts supabase/functions/_shared/userSettings.test.ts supabase/functions/_shared/auth.ts`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/SignInModal.test.tsx shared/api/hooks/useAuth.test.tsx supabase/functions/_shared/userSettings.test.ts`
- Headed Playwright OTP smoke on `http://localhost:3000/welcome` using `stats-smoke-6@example.com`, which now lands on `/welcome` without the previous `ensure-user` 400 or Cubid `get_identity` 500 noise
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select id, email, auth_user_id, cubid_id, has_completed_intro from public.users where email = 'stats-smoke-6@example.com';"`

### Files Edited
- `app/tcoin/wallet/components/modals/SignInModal.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.test.tsx`
- `app/tcoin/sparechange/components/modals/SignInModal.tsx`
- `shared/api/hooks/useAuth.ts`
- `shared/api/hooks/useAuth.test.tsx`
- `shared/api/services/supabaseService.ts`
- `shared/lib/userSettings/types.ts`
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/_shared/userSettings.test.ts`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.173
### Timestamp
- 2026-04-03 09:35 EDT

### Objective
- Add a read-only `Stats for Nerds` workspace to the wallet so authenticated users can inspect shared TCOIN product, market, BIA, and ops telemetry from one place.

### What Changed
- Added `app/tcoin/wallet/stats/page.tsx`, which renders overview tiles, time-series charts, BIA and asset breakdowns, and indexer / reserve-route diagnostics inside the shared signed-in wallet shell.
- Added `app/api/tcoin/stats/summary/route.ts` plus shared types/helpers under `shared/lib/walletStats/`, using service-role reads to combine existing wallet, payment-request, exchange-rate, BIA, indexer, and TorontoCoin ops sources into one read-only response.
- Added a `Stats for Nerds` action row to `app/tcoin/wallet/components/dashboard/MoreTab.tsx` so advanced-mode users can open the page directly from More without introducing a new bottom-nav or sidebar tab.
- Added focused tests for the More navigation action, the authenticated API route, the pure wallet-stats aggregation helper, and the new stats page rendering / empty states.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/stats/page.tsx app/tcoin/wallet/stats/page.test.tsx app/api/tcoin/stats/summary/route.ts app/api/tcoin/stats/summary/route.test.ts shared/lib/walletStats/server.ts shared/lib/walletStats/server.test.ts shared/lib/walletStats/types.ts`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/stats/page.test.tsx app/api/tcoin/stats/summary/route.test.ts shared/lib/walletStats/server.test.ts`

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/stats/page.tsx`
- `app/tcoin/wallet/stats/page.test.tsx`
- `app/api/tcoin/stats/summary/route.ts`
- `app/api/tcoin/stats/summary/route.test.ts`
- `shared/lib/walletStats/types.ts`
- `shared/lib/walletStats/server.ts`
- `shared/lib/walletStats/server.test.ts`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.172
### Timestamp
- 2026-04-02 20:50 EDT

### Objective
- Add a Supabase-side cleanup function and nightly cron schedule for expired wallet pay links so rotating QR churn does not grow `payment_request_links` indefinitely.

### What Changed
- Added `supabase/migrations/20260402205500_v1.12_payment_request_links_cleanup_cron.sql`, which creates `public.cleanup_payment_request_links()` and configures the named `pg_cron` job `wallet-payment-request-links-cleanup` for `06:15 UTC` when `pg_cron` is available.
- Set the retention policy in SQL: expired `rotating_multi_use` links are deleted after 1 day, and expired or consumed `single_use` links are deleted after 30 days.
- Made the migration safe for environments without `pg_cron` by keeping the cleanup function in place and skipping job creation with a notice rather than failing the migration.

### Verification
- `supabase db push --local --include-all`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f /tmp/payment_request_links_cleanup_check.sql`
- `git diff --check -- supabase/migrations/20260402205500_v1.12_payment_request_links_cleanup_cron.sql`

### Files Edited
- `supabase/migrations/20260402205500_v1.12_payment_request_links_cleanup_cron.sql`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.171
### Timestamp
- 2026-04-02 20:41 EDT

### Objective
- Add a visible local timestamp to saved shareable requests in the Receive tab so same-day requests are easier to distinguish.

### What Changed
- Updated `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx` so `Payment requests I have sent` now formats saved shareable requests as `Saved YYYY-MM-DD at h.mm am/pm` instead of showing only the date.
- Added a focused regression in `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx` to pin the new saved-date-plus-time display.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.170
### Timestamp
- 2026-04-02 20:36 EDT

### Objective
- Update the shareable-request email wording so emailed QR links read like TCOIN invoices/requests rather than generic QR links.

### What Changed
- Updated `app/tcoin/wallet/components/modals/ShareQrModal.tsx` so email sharing now uses the subject `My TCOIN Request` and the body `Please check out this TCOIN invoice / request link: ...`.
- Added a focused mailto regression in `app/tcoin/wallet/components/modals/ShareQrModal.test.tsx` to keep that email copy pinned.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/ShareQrModal.tsx app/tcoin/wallet/components/modals/ShareQrModal.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/ShareQrModal.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/ShareQrModal.tsx`
- `app/tcoin/wallet/components/modals/ShareQrModal.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.169
### Timestamp
- 2026-04-02 20:31 EDT

### Objective
- Tighten the large-screen Receive-tab layout further by moving the TCOIN/CAD amount inputs into the same desktop-side control column as the request buttons, making the non-QR workflow more likely to stay beside the QR code without vertical scrolling.

### What Changed
- Updated `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx` so the amount-entry panel now lives in the same right-hand control column as `Request from Contact` / `Create a shareable request` on large screens, leaving the left column focused on the QR card itself.
- Added a focused control-column regression in `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx` to keep the amount fields tied to that explicit controls container.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.168
### Timestamp
- 2026-04-02 20:28 EDT

### Objective
- Rework the authenticated Receive-tab layout on large screens so the QR/input area and request-management area sit beside each other instead of forcing a tall stacked layout.

### What Changed
- Updated `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx` so the main Receive content now switches to a two-column grid on large screens, with the QR and amount inputs on the left and request-selection / request-history panels on the right.
- Kept the existing stacked behaviour on smaller breakpoints while adjusting the action-button row to stay flexible inside the new right-hand desktop column.
- Added a focused layout regression in `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx` so the large-screen grid contract stays explicit.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.167
### Timestamp
- 2026-04-02 20:24 EDT

### Objective
- Tighten the short-lived Receive QR helper copy so it explains audience/reuse more directly.

### What Changed
- Updated the rotating Receive QR helper copy in `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx` from `This link refreshes automatically while this screen stays open.` to `This QR code can be shown to multiple people.`
- Extended the existing Receive-card QR copy regression so the simplified rotating-mode wording remains covered.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.166
### Timestamp
- 2026-04-02 20:10 EDT

### Objective
- Refine the Receive-tab QR behaviour so short-lived codes rotate much more frequently while still keeping a 60-second validity window, and simplify the QR expiry / one-time-use copy.

### What Changed
- Updated `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx` so rotating short-lived pay links now re-mint every 3 seconds while the Receive QR remains visible, instead of waiting 45 seconds between regenerations.
- Updated `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx` so rotating QR cards now say `Expires within 60 seconds` rather than showing a clock time, and long-lived one-time QR cards now show `Expires in [x] days`.
- Replaced the long-lived QR helper copy from `This link stops rotating, but it will work only once.` to `This QR code will work only once.`
- Added focused tests for the 3-second rotation cadence and the new expiry / one-time copy.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveTab.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.165
### Timestamp
- 2026-04-02 20:06 EDT

### Objective
- Smoke test the local wallet Receive tab against local Supabase, diagnose why it still showed the generic `Unable to generate a pay link right now.` message, and tighten the UI so it waits for a resolved wallet profile before trying to mint a pay link.

### What Changed
- Confirmed the local Receive-tab outage was not a QR rendering problem: the live failure path was an authenticated pay-link mint attempt happening before the wallet’s own `public.users`/Cubid profile had finished resolving for the current session.
- Updated `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx` so QR pay-link minting now waits for both a Supabase auth session and a resolved wallet user id instead of firing as soon as auth exists.
- Replaced the old blanket receive-tab error copy with targeted messages for the main local failure cases, including missing wallet profile resolution, missing local `payment-links` edge routing, missing local `payment_request_links` schema, and generic edge-function messages.
- Verified the local Supabase stack now serves `payment-links` publicly for `/resolve/...`, and applied the missing local migrations so `public.payment_request_links` exists before the Receive tab tries to use it.
- Added focused Receive-tab tests covering the new “wait for wallet profile” behaviour and the explicit unauthorized-message mapping.

### Verification
- Browser/CLI smoke checks against local services:
  - `curl -i -X POST http://127.0.0.1:54321/functions/v1/payment-links/create ...`
  - `curl -i http://127.0.0.1:54321/functions/v1/payment-links/resolve/test-token`
  - `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\dt public.payment_request_links"`
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveTab.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.164
### Timestamp
- 2026-04-02 19:41 EDT

### Objective
- Replace Receive-tab QR payloads with public `https://www.tcoin.me/pay/<token>` links that survive sign-in and onboarding, while keeping Send and QR scanning compatible with both the new pay-link contract and the legacy base64 links during the transition.

### What Changed
- Added `public.payment_request_links` through `supabase/migrations/20260402201500_v1.11_payment_request_links.sql`, including opaque token hashes, recipient/user linkage, optional requested amount, mode (`rotating_multi_use` or `single_use`), expiry, and single-use consumption audit fields.
- Added the new `payment-links` edge function plus shared helpers/client types to create authenticated pay links, resolve them publicly, and consume single-use links only after successful payment completion.
- Updated Receive so QR generation now mints public `https://www.tcoin.me/pay/<token>` links by default, rotates them every 45 seconds with a 60-second TTL, and supports an opt-in long-lived one-time QR mode with a 30-day expiry.
- Added the new public wallet route `app/tcoin/wallet/pay/[token]/page.tsx`, made `/pay/...` public in the shared wallet shell, and used that page as the canonical continuation surface after sign-in.
- Extended user-settings bootstrap/signup metadata with `pendingPaymentIntent`, plus save/clear endpoints and React Query mutations, so incomplete users can go through `/welcome` and still land back in prefilled Send afterwards.
- Updated dashboard Send to accept `paymentLink` and `resumePayment` query parameters, resolve new pay-link tokens, keep legacy `?pay=<base64>` handling for pasted/scanned links, and consume single-use pay links after successful payment.
- Updated welcome completion/redirect behaviour so onboarding with a pending payment intent now routes back to `/dashboard?tab=send&resumePayment=1` instead of dropping the user on a generic dashboard entry.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/SendTab.tsx app/tcoin/wallet/components/dashboard/SendTab.test.tsx app/tcoin/wallet/components/modals/QrScanModal.tsx app/tcoin/wallet/components/modals/QrScanModal.test.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx 'app/tcoin/wallet/pay/[token]/page.tsx' 'app/tcoin/wallet/pay/[token]/page.test.tsx' app/tcoin/wallet/ContentLayout.tsx app/tcoin/wallet/ContentLayout.test.tsx app/tcoin/wallet/dashboard/page.tsx app/tcoin/wallet/dashboard/page.test.tsx app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx shared/lib/userSettings/types.ts shared/lib/userSettings/client.ts shared/hooks/useUserSettingsMutations.ts shared/lib/edge/paymentRequestLinks.ts shared/lib/edge/paymentRequestLinksClient.ts shared/lib/walletPayLinks.ts supabase/functions/_shared/paymentRequestLinks.ts supabase/functions/payment-links/index.ts supabase/functions/_shared/userSettings.ts supabase/functions/_shared/userSettings.test.ts supabase/functions/user-settings/index.ts`
- `pnpm exec vitest run app/tcoin/wallet/dashboard/page.test.tsx app/tcoin/wallet/components/dashboard/SendTab.test.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx 'app/tcoin/wallet/pay/[token]/page.test.tsx' app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `.env.local.example`
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/wallet/ContentLayout.test.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.test.tsx`
- `app/tcoin/wallet/components/modals/QrScanModal.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.test.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/dashboard/page.test.tsx`
- `app/tcoin/wallet/layout.tsx`
- `app/tcoin/wallet/pay/[token]/page.tsx`
- `app/tcoin/wallet/pay/[token]/page.test.tsx`
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `shared/hooks/useUserSettingsMutations.ts`
- `shared/lib/edge/paymentRequestLinks.ts`
- `shared/lib/edge/paymentRequestLinksClient.ts`
- `shared/lib/userSettings/client.ts`
- `shared/lib/userSettings/types.ts`
- `shared/lib/walletPayLinks.ts`
- `supabase/functions/_shared/paymentRequestLinks.ts`
- `supabase/functions/_shared/userSettings.test.ts`
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/payment-links/index.ts`
- `supabase/functions/user-settings/index.ts`
- `supabase/migrations/20260402201500_v1.11_payment_request_links.sql`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.163
### Timestamp
- 2026-04-02 19:14 EDT

### Objective
- Clean up the Receive-tab QR caption so it stops surfacing long transient decimals while CAD/TCOIN amounts are being entered and shows the paired TCOIN/CAD summary in one clear line.

### What Changed
- Updated `ReceiveCard` to derive the QR caption from parsed numeric TCOIN and CAD amounts instead of reusing the raw in-progress input string.
- Rounded the displayed TCOIN amount to two decimals and, when available, appended the corresponding CAD value in parentheses so the caption reads like `Receive 3.91 TCOIN ($13.10)`.
- Added a focused regression test that guards the rounded combined caption and ensures the long raw decimal string no longer leaks into the QR stage.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.162
### Timestamp
- 2026-04-02 18:44 EDT

### Objective
- Simplify the simple-mode home actions by collapsing the two top-up buttons into one clearer `Buy more TCOIN` entry point.

### What Changed
- Replaced the separate `Top Up with Interac` and `Buy more TCOIN` buttons in `SimpleWalletHome` with one `Buy more TCOIN` button.
- Added a small floating menu under that button with two explicit paths: `Top up with Interac` and `Top up with Credit Card`.
- Kept the existing modal destinations intact, so the menu simply routes into the current Interac and credit-card top-up flows instead of introducing new payment logic.
- Added focused component tests for the floating menu and both modal-opening branches.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/SimpleWalletHome.tsx app/tcoin/wallet/components/dashboard/SimpleWalletHome.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/SimpleWalletHome.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/SimpleWalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/SimpleWalletHome.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.161
### Timestamp
- 2026-04-02 18:51 EDT

### Objective
- Formalize the missing local wallet transfer ledger contract so local History and transfer bookkeeping can work on a real schema/RPC instead of relying only on the new empty-history fallback.

### What Changed
- Added a new `v1.10` idempotent migration that extends `public.act_transactions` with the wallet-transfer fields the app already expects: `transaction_category`, `amount`, `currency`, `token_price`, `wallet_account_from`, and `wallet_account_to`.
- Added a compatibility view, `public.act_transaction_entries`, backed by `act_transactions`, so existing local history/recents queries can continue reading the legacy ledger name without duplicating storage.
- Added a `public.simple_transfer(...)` RPC that resolves the wallet app instance, inserts a transfer row into `act_transactions`, and returns the inserted accounting record for downstream notification and history flows.
- Applied that migration to the local Supabase database and verified it end-to-end by creating a real transfer row between seeded wallet identities and reading it back through `act_transaction_entries`.

### Verification
- `git diff --check -- supabase/migrations/20260402184500_v1.10_wallet_transaction_ledger_contract.sql`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations/20260402184500_v1.10_wallet_transaction_ledger_contract.sql`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\\d+ public.act_transactions"`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select user_id, public_key from public.v_wallet_identities_v1 order by user_id limit 5;"`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select (t).id as id, (t).amount as amount from (select public.simple_transfer('0x2222222222222222222222222222222222222002','0x1111111111111111111111111111111111111001',3.35,12.5,1001) as t) s;"`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select id, amount, currency, wallet_account_from, wallet_account_to, transaction_category from public.act_transaction_entries order by created_at desc limit 3;"`

### Files Edited
- `supabase/migrations/20260402184500_v1.10_wallet_transaction_ledger_contract.sql`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.160
### Timestamp
- 2026-04-02 18:37 EDT

### Objective
- Stop local `/dashboard?tab=history` from surfacing the missing `act_transaction_entries` schema error and align the History tab with the canonical wallet-operations response shape.

### What Changed
- Diagnosed the local root cause by inspecting the running local Postgres schema: `public.act_transactions` exists, but `public.act_transaction_entries` and the legacy `simple_transfer(...)` RPC do not, so the wallet history code was still depending on a legacy contract that the repo’s local migration chain never provisions.
- Updated the shared wallet-operations history helpers to treat a missing local legacy transaction ledger as an empty-history condition instead of throwing a user-visible error, which keeps local History and recents usable while that legacy ledger remains absent.
- Fixed `TransactionHistoryTab` to read the canonical `wallet-operations` response shape (`transactions` with camelCase fields) instead of the stale `entries` / snake_case payload it was still expecting.
- Added focused regressions for both the missing-ledger backend fallback and the canonical history-tab response parsing path.

### Verification
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\\dt public.act*"`
- `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\\df+ public.simple_transfer"`
- `pnpm exec eslint supabase/functions/_shared/walletOperations.ts supabase/functions/_shared/walletOperations.test.ts app/tcoin/wallet/components/dashboard/TransactionHistoryTab.tsx app/tcoin/wallet/components/dashboard/TransactionHistoryTab.test.tsx`
- `pnpm exec vitest run supabase/functions/_shared/walletOperations.test.ts app/tcoin/wallet/components/dashboard/TransactionHistoryTab.test.tsx`

### Files Edited
- `supabase/functions/_shared/walletOperations.ts`
- `supabase/functions/_shared/walletOperations.test.ts`
- `app/tcoin/wallet/components/dashboard/TransactionHistoryTab.tsx`
- `app/tcoin/wallet/components/dashboard/TransactionHistoryTab.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.159
### Timestamp
- 2026-04-02 18:27 EDT

### Objective
- Make the authenticated header’s mode-setting entry read more naturally in simple mode by changing the label from `Experience mode` to `Switch mode`.

### What Changed
- Updated the authenticated header account-menu action so it derives its label from the active wallet experience mode.
- In simple mode the menu item and opened modal now use `Switch mode`, while advanced mode keeps `Experience mode`.
- Added a focused navbar regression covering the simple-mode label and modal title.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/navbar/Navbar.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.158
### Timestamp
- 2026-04-02 17:34 EDT

### Objective
- Add a persisted wallet experience-mode choice to onboarding and use it to introduce a simpler signed-in wallet shell for users who do not need the full dashboard surface.

### What Changed
- Extended the shared user-settings contract with `preferences.experienceMode`, defaulting missing or invalid legacy metadata to `simple` at bootstrap time while still allowing `advanced` to round-trip through the existing app-profile metadata path.
- Expanded the wallet onboarding flow from six steps to seven by inserting a dedicated experience-mode step after community settings; fresh v2 drafts now require an explicit choice, while legacy drafts with no stored mode are preselected to `simple` so old onboarding sessions can continue.
- Added a new `SimpleWalletHome` and made `/dashboard` mode-aware: simple mode now hides the More tab, redirects `?tab=more` back to home, uses the narrower focused-content layout for home, and removes the empty-contacts invite onboarding in favour of a plain empty state.
- Added an `Experience mode` entry to the authenticated header account menu, backed by a dedicated modal so users can switch between simple and advanced later without relying on the More tab being visible.
- Added focused tests across the bootstrap helper, welcome flow, dashboard shell, contacts tab, and authenticated header so the new mode contract is exercised from persistence through UI behaviour.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx app/tcoin/wallet/dashboard/page.tsx app/tcoin/wallet/dashboard/page.test.tsx app/tcoin/wallet/components/DashboardFooter.tsx app/tcoin/wallet/components/DashboardFooter.test.tsx app/tcoin/wallet/components/dashboard/ContactsTab.tsx app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx app/tcoin/wallet/components/dashboard/SimpleWalletHome.tsx app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/modals/ExperienceModeModal.tsx shared/lib/userSettings/types.ts supabase/functions/_shared/userSettings.ts supabase/functions/_shared/userSettings.test.ts app/tcoin/wallet/components/modals/index.ts`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx app/tcoin/wallet/dashboard/page.test.tsx app/tcoin/wallet/components/DashboardFooter.test.tsx app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx supabase/functions/_shared/userSettings.test.ts`

### Files Edited
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
- `app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/SimpleWalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/index.ts`
- `app/tcoin/wallet/components/modals/ExperienceModeModal.tsx`
- `app/tcoin/wallet/components/modals/index.ts`
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/dashboard/page.test.tsx`
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `shared/lib/userSettings/types.ts`
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/_shared/userSettings.test.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.157
### Timestamp
- 2026-04-02 16:01 EDT

### Objective
- Eliminate the local wallet-custody backend noise caused by code assuming `public.wallet_list.created_at` exists, and formalize that column in the repo schema.

### What Changed
- Added `getLatestWalletListRow(...)` in the shared user-settings helpers so wallet-custody reads resolve the newest wallet row by descending `wallet_list.id` instead of relying on a `created_at` column that older environments never had.
- Updated both wallet-custody call sites in `userSettings.ts` to use that helper, which removes the runtime dependency on `wallet_list.created_at` for local custody registration and recovery reads.
- Added an idempotent `v1.09` migration that backfills and constrains `public.wallet_list.created_at`, including a supporting index for future schema-consistent ordering.
- Added focused helper coverage proving the wallet-row resolver orders by `id` rather than `created_at`.

### Verification
- `pnpm exec eslint supabase/functions/_shared/userSettings.ts supabase/functions/_shared/userSettings.test.ts`
- `pnpm exec vitest run supabase/functions/_shared/userSettings.test.ts`
- `git diff --check -- supabase/migrations/20260402160500_v1.09_wallet_list_created_at.sql`
- Local `GET /functions/v1/user-settings/wallet/custody-material` probe using a signed local JWT now advances past the old `wallet_list.created_at` failure path and instead surfaces the next stale-schema issue (`user_encrypted_share.credential_id does not exist`), confirming the `wallet_list` root cause is removed.

### Files Edited
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/_shared/userSettings.test.ts`
- `supabase/migrations/20260402160500_v1.09_wallet_list_created_at.sql`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.156
### Timestamp
- 2026-04-02 15:40 EDT

### Objective
- Stop `/dashboard?tab=contacts` from falling into a render loop and blocking the rest of the authenticated dashboard navigation.

### What Changed
- Removed the `ContactsTab` behaviour that echoed `initialContacts` back through `onContactsResolved`, which was causing the parent dashboard cache to bounce the same contact list back into the tab on every render.
- Stabilized the parent dashboard contacts resolver with a memoized callback and an equality check so identical contact lists no longer trigger redundant cache writes or rerenders.
- Added focused regressions covering seeded-contact hydration in `ContactsTab` and repeated identical contact-resolution events in the dashboard page.
- Verified the fix in a headed Playwright browser session against the local app after authenticating into `/dashboard?tab=contacts`.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ContactsTab.tsx app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx app/tcoin/wallet/dashboard/page.tsx app/tcoin/wallet/dashboard/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx app/tcoin/wallet/dashboard/page.test.tsx`
- Headed Playwright smoke pass on `http://localhost:3000/dashboard?tab=contacts`, including sidebar navigation away from Contacts after sign-in

### Files Edited
- `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
- `app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/dashboard/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.155
### Timestamp
- 2026-04-02 15:31 EDT

### Objective
- Split the authenticated dashboard layout contract so broad overview tabs can fill the workspace while task-heavy tabs stay centred to a narrower working width on large screens.

### What Changed
- Updated `dashboard/page.tsx` so overview tabs (`home`, `more`) still use the full authenticated shell, while focused task tabs (`send`, `receive`, `contacts`, `history`) now cap only their inner content area at roughly `1000px`.
- Kept the surrounding dashboard panel shell full width, so the new width cap applies to the working content and not the background frame.
- Added a dashboard-page regression test that distinguishes uncapped home content from the narrower receive-tab content wrapper.
- Updated the technical and functional specs to document the new overview-vs-task tab layout rule.

### Verification
- `pnpm exec eslint app/tcoin/wallet/dashboard/page.tsx app/tcoin/wallet/dashboard/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/dashboard/page.test.tsx`
- `curl -I http://localhost:3000/dashboard?tab=receive`

### Files Edited
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/dashboard/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.154
### Timestamp
- 2026-04-02 15:25 EDT

### Objective
- Fix the receive QR card so its white stage always stays square and its caption/loading text remains readable in dark mode.

### What Changed
- Made the QR stage in `ReceiveCard` a dedicated square white surface instead of a loosely sized wrapper, keeping the QR card at a consistent 1:1 shape.
- Switched the QR caption and fallback copy to explicit slate text inside that white stage so strings like `Receive any amount` no longer disappear in dark mode.
- Added a focused regression test that checks the QR stage keeps its square white contract and that the caption uses the dark text treatment.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `curl -I http://localhost:3000/dashboard?tab=receive`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.153
### Timestamp
- 2026-04-02 16:22 EDT

### Objective
- Remove the duplicate `Make a payment / Send To` panel from the authenticated wallet home tab so `/dashboard` stays focused on overview content and the dedicated Send tab owns payment composition.

### What Changed
- Removed the send-card section from `WalletHome`, including the home-only amount, recipient, QR deep-link, and send-action state that existed only to power that panel.
- Reflowed the home layout so the Recents panel now sits alongside the contributions/settings row, reducing vertical height while keeping the balance summary, everyday actions, recent people, charity context, and More handoff intact.
- Updated the wallet-home tests to assert that the send grid no longer renders and to keep the ultra-wide layout coverage aligned with the new two-row home structure.
- Updated the technical and functional specs so they describe home as an overview surface and the Send tab as the canonical money-composition workspace.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/WalletHome.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `curl -I http://localhost:3000/dashboard`

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.152
### Timestamp
- 2026-04-02 15:31 EDT

### Objective
- Make welcome step 5 explain why the device name matters and replace the irrelevant wallet-ready notice with the actual device details we collect automatically.

### What Changed
- Added two short explanation paragraphs to step 5 clarifying that the custom device name helps identify and deactivate a device later if needed.
- Replaced the old `Wallet already configured...` message with a small device-details panel that shows the auto-collected operating system, browser, and derived detected label used alongside the custom device name.
- Added a focused regression ensuring the new step-5 explanation and auto-collected device fields render, while the old wallet-ready copy stays gone.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`
- `curl -I http://localhost:3000/welcome`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.151
### Timestamp
- 2026-04-02 15:20 EDT

### Objective
- Seed `Universal Basic Income` as the default catch-all charity option and let welcome step 4 continue without a manual charity pick by falling back to that default.

### What Changed
- Added `Universal Basic Income` to the local `public.charities` seed rows in `supabase/seed.sql`.
- Updated welcome step 4 so `Continue` no longer blocks on an unset charity, and pressing it with no explicit charity now auto-selects `Universal Basic Income` before saving.
- Kept the primary BIA requirement unchanged while making the charity field feel optional in the UI.
- Expanded the welcome-page test coverage to assert the new charity fallback behaviour.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`
- `git diff --check -- supabase/seed.sql`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `supabase/seed.sql`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.150
### Timestamp
- 2026-04-02 15:13 EDT

### Objective
- Add a general-purpose `Rest of Toronto` BIA option to the seeded local catalogue.

### What Changed
- Added a new active `REST-OF-TORONTO` row to `public.bia_registry` in `supabase/seed.sql`, labelled `Rest of Toronto`, so local/dev seed data includes a catch-all Toronto option alongside the more specific BIAs.

### Verification
- `git diff --check -- supabase/seed.sql`

### Files Edited
- `supabase/seed.sql`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.149
### Timestamp
- 2026-04-02 15:08 EDT

### Objective
- Add clearer “why this matters” guidance to welcome steps 3 and 4 so the onboarding flow explains the purpose of the photo, charity, and BIA selections.

### What Changed
- Added two short explanatory sentences above the step-3 picture controls clarifying that the profile photo helps senders and recipients identify and verify the user, and should therefore look like them.
- Added a charity explainer above the step-4 default charity field, clarifying that the transaction fees users pay instead of ordinary credit card fees go to the charity they choose.
- Added a BIA explainer above the primary BIA selector, clarifying that merchant discovery in the wallet is filtered based on that BIA choice.
- Expanded the welcome-page tests with focused assertions for the new step-3 and step-4 guidance copy.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.148
### Timestamp
- 2026-04-02 15:03 EDT

### Objective
- Make the empty avatar on welcome step 3 act as a direct upload entry point instead of forcing users to target only the file input.

### What Changed
- Wrapped the empty step-3 avatar preview in a button that opens the same hidden file-picker path as the `Choose a profile picture` input.
- Kept the file-selection flow single-sourced by routing the avatar click through the existing file input rather than adding a second upload handler.
- Added a focused regression proving the empty avatar button triggers the file chooser affordance.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.147
### Timestamp
- 2026-04-02 14:58 EDT

### Objective
- Default the welcome step-2 country selector to Canada as real form data instead of leaving it empty.

### What Changed
- Added a canonical welcome-step default country of `CA` and resolved it from the country options list so fresh onboarding sessions start with Canada selected.
- Updated the bootstrap reset path so draft/completed users still keep their saved country when present, while missing country values fall back to the same Canada default.
- Extended the welcome-page regression to assert that Canada stays selected while the rotating placeholder examples change only in the text fields.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.146
### Timestamp
- 2026-04-02 14:53 EDT

### Objective
- Make the welcome step-2 placeholders get out of the user’s way as soon as they start typing, and move country into the required details card above phone verification.

### What Changed
- Changed the rotating welcome placeholders so they stop immediately once any text detail field receives user input, and all remaining example placeholders clear to blank instead of continuing to cycle.
- Moved the Country selector into the left `Required to continue` card, positioned above the phone verification block.
- Updated step-2 copy and validation so first name, last name, country, and phone verification are treated as the required onboarding details, while preferred name and username remain optional.
- Expanded the welcome-page test to cover placeholder freeze/clear behaviour and the new country-before-phone layout.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.145
### Timestamp
- 2026-04-02 14:45 EDT

### Objective
- Refine the welcome-card economics copy so the stability framing and TTC ticket fact read more precisely.

### What Changed
- Replaced the transit-peg explanation so it now emphasises day-to-day intuitiveness and long-term value stability instead of contrasting TCOIN against speculative token pricing.
- Updated the TTC ticket fun fact to refer to holding on to the ticket itself and to quantify the result as approximately `5,500%` total growth or `4%` per year.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.144
### Timestamp
- 2026-04-02 14:39 EDT

### Objective
- Add a non-production-only `Delete this profile` action to the authenticated header account menu without exposing it in production.

### What Changed
- Added a second account-menu action below `Log Out` in the authenticated wallet header, labelled `Delete this profile`, and gated it to non-production app environments only.
- Reused `NEXT_PUBLIC_APP_ENVIRONMENT` as the UI gate because the wallet already depends on that app-environment contract for other local/development-only affordances.
- Wired the new action to a clear informational toast for now because there is not yet a real profile-deletion backend mutation in the wallet stack.
- Added navbar regressions covering the non-production visibility/toast path and the production-hidden path.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/navbar/Navbar.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.143
### Timestamp
- 2026-04-02 14:28 EDT

### Objective
- Rotate the welcome step-2 name placeholders so the identity examples feel livelier than a single static `Mats Sundin`.

### What Changed
- Added a shared rotating placeholder list for the welcome user-details step, cycling every three seconds through Toronto-flavoured example names instead of keeping one fixed placeholder.
- Derived the first-name, last-name, preferred-name, and username placeholders from the same active full-name entry so all four fields stay visually in sync.
- Updated the welcome-page regression test to assert the initial `Mats Sundin` placeholders and the timed rotation to `Nathan Philips`.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.142
### Timestamp
- 2026-04-02 14:14 EDT

### Objective
- Fix the large-screen authenticated wallet shell so page content no longer slides under the fixed desktop sidebar rail.

### What Changed
- Added a dedicated shared desktop rail-offset contract, `walletRailPageClass`, in the authenticated UI primitives so sidebar-based pages expand their max width and clear the fixed rail with one shared inset definition instead of per-page padding hacks.
- Switched `/dashboard`, `/merchant`, `/admin`, and `/city-manager` onto that shared rail class, and removed the stale `lg:pl-40 xl:pl-44` offsets from those routes as well as non-rail routes like `/welcome` and the contact detail page.
- Updated the shared authenticated-ui regression test plus the operator page tests to assert the new rail-clearance class contract instead of the old page-local padding classes.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts app/tcoin/wallet/dashboard/page.tsx app/tcoin/wallet/admin/page.tsx app/tcoin/wallet/admin/page.test.tsx app/tcoin/wallet/city-manager/page.tsx app/tcoin/wallet/city-manager/page.test.tsx app/tcoin/wallet/merchant/page.tsx app/tcoin/wallet/merchant/page.test.tsx app/tcoin/wallet/welcome/page.tsx 'app/tcoin/wallet/dashboard/contacts/[id]/page.tsx'`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts app/tcoin/wallet/merchant/page.test.tsx app/tcoin/wallet/city-manager/page.test.tsx app/tcoin/wallet/admin/page.test.tsx app/tcoin/wallet/dashboard/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/admin/page.test.tsx`
- `app/tcoin/wallet/city-manager/page.tsx`
- `app/tcoin/wallet/city-manager/page.test.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `app/tcoin/wallet/merchant/page.test.tsx`
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.141
### Timestamp
- 2026-04-02 14:03 EDT

### Objective
- Left-align the two introductory sales-pitch sentences on the public merchants page.

### What Changed
- Removed the hero section’s blanket centring on `/merchants` and applied `text-left` specifically to the two introductory paragraphs while leaving the `For Merchants` heading centred.
- Extended the merchants-page regression test to verify that the main sales-pitch sentence now carries the left-alignment class.
- Updated the required technical and functional specifications to record the intended hero alignment split.

### Verification
- `pnpm exec eslint app/tcoin/wallet/merchants/page.tsx app/tcoin/wallet/merchants/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/merchants/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/merchants/page.tsx`
- `app/tcoin/wallet/merchants/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.140
### Timestamp
- 2026-04-02 13:59 EDT

### Objective
- Make the top `Return home` control on `/merchants` visually match the lower one.

### What Changed
- Removed the pill-style button treatment from the top `Return home` control on the public merchants page so both return links now share the same plain-link presentation.
- Updated the required technical and functional specifications to record that the duplicated return-home actions intentionally use one consistent style.

### Verification
- `pnpm exec eslint app/tcoin/wallet/merchants/page.tsx`

### Files Edited
- `app/tcoin/wallet/merchants/page.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.139
### Timestamp
- 2026-04-02 13:53 EDT

### Objective
- Make the `/merchants` lead-in statements visually match the main landing page.

### What Changed
- Replaced the merchant page’s plain bold lead-in phrases with the same highlighted inline treatment used on the main landing page (`bg-gray-200 dark:bg-gray-700 px-1`).
- Added a focused merchants-page regression test that verifies the shared landing-style highlight classes on representative lead statements.
- Updated the required technical and functional specifications to record that public-site visual-language alignment.

### Verification
- `pnpm exec eslint app/tcoin/wallet/merchants/page.tsx app/tcoin/wallet/merchants/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/merchants/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/merchants/page.tsx`
- `app/tcoin/wallet/merchants/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.138
### Timestamp
- 2026-04-02 13:47 EDT

### Objective
- Increase the height of the public Contact page message input.

### What Changed
- Added a page-local `min-h-40` override to the `/contact` message textarea so longer outreach notes have more visible drafting space.
- Extended the Contact page regression test to verify the taller message textarea class is present.
- Updated the required technical and functional specifications to record the taller public-contact message field.

### Verification
- `pnpm exec eslint app/tcoin/wallet/contact/page.tsx app/tcoin/wallet/contact/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/contact/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/contact/page.tsx`
- `app/tcoin/wallet/contact/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.137
### Timestamp
- 2026-04-02 13:39 EDT

### Objective
- Reduce the visual length of hyperlinks on the public Resources page without changing the body copy.

### What Changed
- Reworked the `/resources` body copy so each resource sentence remains intact while the anchors are limited to shorter CTA fragments such as `this hackathon submission`, `this Whitepaper`, `the presentation here`, and `on GitHub`.
- Added a focused Resources page regression test that checks the shorter link names and confirms they still point to the expected targets.
- Updated the required technical and functional specifications to record the public-link presentation rule on the Resources page as well.

### Verification
- `pnpm exec eslint app/tcoin/wallet/resources/page.tsx app/tcoin/wallet/resources/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/resources/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/resources/page.tsx`
- `app/tcoin/wallet/resources/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.136
### Timestamp
- 2026-04-02 13:33 EDT

### Objective
- Improve the reading rhythm and header clearance of the public merchant sales page.

### What Changed
- Reworked `/merchants` from a stack of single-paragraph headings into broader sections with landing-page-style pacing, using `Benefits for Merchants`, `Grow Through the Network`, and `Simple to Start` as the primary headings.
- Increased the page’s top padding so the `For Merchants` hero clears the fixed header, and added a top-left `Return home` control while keeping the existing footer-adjacent return link.
- Updated the page test to guard the new grouped-heading structure and the presence of both return-home links, and recorded the change in the required specs.

### Verification
- `pnpm exec eslint app/tcoin/wallet/merchants/page.tsx app/tcoin/wallet/merchants/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/merchants/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/merchants/page.tsx`
- `app/tcoin/wallet/merchants/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.135
### Timestamp
- 2026-04-02 13:26 EDT

### Objective
- Make the unauthenticated footer theme link reflect the real current theme on first paint so it does not need a throwaway first click.

### What Changed
- Updated the shared `useDarkMode` hook to initialize from cached theme preference or the current system preference during the first render instead of defaulting to light and correcting later in an effect.
- Added a focused hook regression for the system-dark and cached-light first-render cases, plus a footer test that guards the public theme-link label when following system mode.
- Updated the required technical and functional specifications to capture the footer-theme behaviour change.

### Verification
- `pnpm exec eslint shared/hooks/useDarkMode.tsx shared/hooks/useDarkMode.test.tsx app/tcoin/wallet/components/footer/Footer.test.tsx`
- `pnpm exec vitest run shared/hooks/useDarkMode.test.tsx app/tcoin/wallet/components/footer/Footer.test.tsx`

### Files Edited
- `shared/hooks/useDarkMode.tsx`
- `shared/hooks/useDarkMode.test.tsx`
- `app/tcoin/wallet/components/footer/Footer.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.134
### Timestamp
- 2026-04-02 13:19 EDT

### Objective
- Reduce the visual length of the public Contact page hyperlink without changing the surrounding body copy.

### What Changed
- Adjusted the `/contact` intro paragraph so the invitation text stays in plain prose and only the word `WhatsApp` remains hyperlinked.
- Added a focused Contact page regression test to guard that shorter anchor text contract.
- Updated the required technical and functional specifications to record the public-link presentation tweak.

### Verification
- `pnpm exec eslint app/tcoin/wallet/contact/page.tsx app/tcoin/wallet/contact/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/contact/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/contact/page.tsx`
- `app/tcoin/wallet/contact/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.133
### Timestamp
- 2026-04-02 12:55 EDT

### Objective
- Add a public merchant-sales page to the wallet site and surface it from the unauthenticated footer.

### What Changed
- Added a new public `/merchants` page using the same landing-header, body-width, and footer shell as the other unauthenticated wallet pages, and structured the provided merchant copy into a focused sales page.
- Added a `Merchants` link to the shared unauthenticated footer, added `/merchants` to the wallet public-route allowlist, and included the page in the public sitemap.
- Added focused tests for the new page, footer link, and sitemap entry, and updated the required technical/functional specs.

### Verification
- `pnpm exec eslint app/tcoin/wallet/ContentLayout.tsx app/tcoin/wallet/components/footer/Footer.tsx app/tcoin/wallet/components/footer/Footer.test.tsx app/tcoin/wallet/merchants/page.tsx app/tcoin/wallet/merchants/page.test.tsx app/tcoin/wallet/sitemap.ts app/tcoin/wallet/sitemap.test.ts app/tcoin/wallet/page.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/footer/Footer.test.tsx app/tcoin/wallet/merchants/page.test.tsx app/tcoin/wallet/sitemap.test.ts`

### Files Edited
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/wallet/components/footer/Footer.tsx`
- `app/tcoin/wallet/components/footer/Footer.test.tsx`
- `app/tcoin/wallet/merchants/page.tsx`
- `app/tcoin/wallet/merchants/page.test.tsx`
- `app/tcoin/wallet/sitemap.ts`
- `app/tcoin/wallet/sitemap.test.ts`
- `app/tcoin/wallet/page.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.132
### Timestamp
- 2026-04-02 12:33 EDT

### Objective
- Refresh several wallet landing-page copy blocks to better describe the RFID-note project, merchant usage, fee framing, and TCOIN governance.

### What Changed
- Rewrote the physical tBills paragraph to describe the embedded-RFID notes as work in progress and to invite people to help with that part of the project.
- Expanded the QR recipient examples to include merchants, updated the fee comparison to say TCOIN aims to lower that fee while turning it into a city donation, and replaced the short closing sentence with the longer CAD-vs-TCOIN backing and stewardship explanation.
- Updated the required functional and technical specs to reflect the revised public-facing landing-page narrative.

### Verification
- `pnpm exec eslint app/tcoin/wallet/page.tsx`

### Files Edited
- `app/tcoin/wallet/page.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.131
### Timestamp
- 2026-04-02 12:27 EDT

### Objective
- Centre the wallet landing page’s initial auth-loading placeholder instead of leaving it pinned to the top-left corner.

### What Changed
- Updated the shared wallet `ContentLayout` loading branch to render `...loading` inside a viewport-centred flex wrapper rather than returning the raw layout shell with unaligned text.
- Added a focused `ContentLayout` regression test that checks the loading shell uses centred alignment and still renders the loading label.

### Verification
- `pnpm exec eslint app/tcoin/wallet/ContentLayout.tsx app/tcoin/wallet/ContentLayout.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/ContentLayout.test.tsx`

### Files Edited
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/wallet/ContentLayout.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.130
### Timestamp
- 2026-04-02 12:18 EDT

### Objective
- Tighten the wallet onboarding step-1 lead sentence so it starts more directly and conversationally.

### What Changed
- Replaced the step-1 opener in wallet `/welcome` from “This step is about the signup process itself: we will …” to a shorter “Let’s …” sentence while keeping the rest of the signup guidance unchanged.
- Updated the focused welcome-flow test expectation and the required spec/session artefacts to reflect the revised copy.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.129
### Timestamp
- 2026-04-02 09:49 EDT

### Objective
- Keep wallet signup reset on the true step-0 welcome state instead of auto-forwarding back into the wizard.

### What Changed
- Updated the wallet welcome-page reset handler to close the wizard client state after a successful reset, clear any staged profile-picture editor state, and leave the user on the pre-start welcome card.
- Added a focused welcome-flow regression test that covers resetting a saved draft and verifies the UI stays on step 0 rather than reopening step 1.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.128
### Timestamp
- 2026-04-02 09:58 EDT

### Objective
- Refine wallet onboarding steps 2 and 3 so the user-details screen distinguishes required vs optional fields, and the profile-picture step uses the real avatar editor flow with clearer upload-error handling.

### What Changed
- Reworked onboarding step 2 into `Required to continue` and `Optional for now` panels, made first name/last name blank with `Mats` / `Sundin` placeholders for new signups, and relaxed continuation so only first name, last name, and phone verification are mandatory there.
- Added a dedicated `WelcomeProfilePictureEditorModal` for onboarding step 3, reusing the circular avatar crop controls from Edit Profile so newly selected images are framed before upload instead of being accepted raw.
- Updated step 3 to save the cropped avatar file and to translate low-level upload/network failures such as `name resolution failed` into a picture-specific recovery message instead of a misleading raw infrastructure toast.
- Tightened modal-shell behaviour so content-only modals do not render empty title/description blocks, and added focused welcome-flow tests for the new step-2 grouping and step-3 editor-modal launch.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx app/tcoin/wallet/components/modals/WelcomeProfilePictureEditorModal.tsx shared/components/ui/Modal.tsx shared/components/ui/Modal.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx shared/components/ui/Modal.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `app/tcoin/wallet/components/modals/WelcomeProfilePictureEditorModal.tsx`
- `shared/components/ui/Modal.tsx`
- `shared/components/ui/Modal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.127
### Timestamp
- 2026-04-02 09:41 EDT

### Objective
- Separate the wallet `/welcome` intro copy from the signup-process copy so the first screen feels like a true welcome and step 1 focuses on how onboarding works.

### What Changed
- Rewrote the pre-start `/welcome` card to introduce TCOIN as a community-focused local currency, including the transit-value framing, charity contribution model, and a TTC fare fact instead of repeating the signup instructions.
- Rewrote wizard step 1 so it now explains the signup process itself: what information will be collected, how the wallet setup is staged, and that progress is saved for resuming later.
- Added focused test coverage to keep the new welcome copy and step-1 signup guidance distinct in the wallet onboarding flow.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.126
### Timestamp
- 2026-04-02 18:07 EDT

### Objective
- Move wallet `/welcome` onto the authenticated wallet shell so onboarding uses the signed-in visual language instead of the public landing-page styling.

### What Changed
- Reworked `/welcome` to use the shared authenticated wallet page and panel tokens for signed-out, first-run, resume, wizard, loading, and fallback states, keeping onboarding visually consistent with the dashboard shell.
- Removed the stale dark-mode dependency from the welcome route after the shell move, since the page now relies on shared wallet UI tokens rather than a one-off public-card treatment.
- Added a regression test that checks the authenticated welcome shell still wraps the loading state as well as the signed-in start state.

### Verification
- `pnpm exec eslint app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/welcome/page.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.125
### Timestamp
- 2026-04-02 02:29 EDT

### Objective
- Add multi-email management to wallet Edit Profile while preserving a primary email, soft-delete history, and active-email uniqueness in Supabase.

### What Changed
- Added `public.user_email_addresses` by migration as the canonical account-email history table, with one active unique email across the whole system, one active primary email per user, soft-delete timestamps, and a trigger that keeps `public.users.email` synced to the current primary address.
- Extended wallet user-settings bootstrap and profile updates so Edit Profile now reads and saves a full active email list while keeping `bootstrap.user.email` as the compatibility primary-email mirror for the rest of the app.
- Reworked the Edit Profile email panel into a managed list: users can add another email, choose a different primary email, and remove non-primary emails, while the UI blocks removing the only remaining email or deleting the primary email before another primary is selected.
- Updated auth-side user resolution and ensure-user flows to look up active emails from the new history table and to retain authenticated email addresses without wiping any other saved active emails.
- Seeded the local development users into the new email-history table so fresh local resets start with consistent primary-email records.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx shared/lib/userSettings/types.ts supabase/functions/_shared/userSettings.ts supabase/functions/_shared/userSettings.test.ts supabase/functions/_shared/auth.ts supabase/functions/user-settings/index.ts`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/UserProfileModal.test.tsx supabase/functions/_shared/userSettings.test.ts shared/api/hooks/useAuth.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `shared/lib/userSettings/types.ts`
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/_shared/userSettings.test.ts`
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/user-settings/index.ts`
- `supabase/migrations/20260402024500_v1.08_user_email_history.sql`
- `supabase/seed.sql`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.124
### Timestamp
- 2026-04-02 02:17 EDT

### Objective
- Rework wallet Edit Profile so desktop-sized screens can use a wider two-column layout, separate email from the photo controls, and let existing profile photos reopen in the framing editor.

### What Changed
- Split wallet Edit Profile into four panels: `Picture`, `Email`, `Banking info`, and `Info used in this app`, with a `lg` two-column grid so larger screens use width instead of stacking every section vertically.
- Added `prepareProfilePictureFromUrl` and an `Adjust current photo` action so an already-saved profile image can be reopened in the same zoom and horizontal/vertical framing editor instead of forcing users to upload a new file first.
- Added a wider `5xl` modal size and assigned it specifically to wallet Edit Profile launches from both the authenticated navbar and the More tab, so the new four-panel layout has enough room to reduce desktop scrolling.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx shared/lib/profilePictureCrop.ts shared/components/ui/Modal.tsx shared/contexts/ModalContext.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/UserProfileModal.test.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- Browser pass with the Playwright CLI against `http://127.0.0.1:3000/dashboard?tab=more` confirmed the modal opens from the More tab after local OTP auth; full loaded-form verification was blocked locally because `user-settings/bootstrap` is currently returning `401 Unauthorized` in that environment.

### Files Edited
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `shared/lib/profilePictureCrop.ts`
- `shared/components/ui/Modal.tsx`
- `shared/contexts/ModalContext.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.123
### Timestamp
- 2026-04-02 01:58 EDT

### Objective
- Stabilize the local Colima-backed Supabase auth stack by removing the recurring GoTrue `GOTRUE_MAILER_EXTERNAL_HOSTS` warning during OTP traffic.

### What Changed
- Normalized the local Supabase `site_url` and redirect allow-list in the local `supabase/config.toml` so the local browser-facing hosts are explicit and match the wallet dev hosts we actually use.
- Added `scripts/start-local-supabase.sh` plus the `pnpm supabase:start:local` package script to start the trimmed local Supabase stack and then recreate the GoTrue container with `GOTRUE_MAILER_EXTERNAL_HOSTS=localhost,127.0.0.1,kong`, which the CLI config does not currently expose.
- Documented the local Supabase helper in `README.md` so the warning fix is repeatable instead of relying on one-off manual container surgery.

### Verification
- `pnpm supabase:start:local`
- `docker inspect supabase_auth_Genero --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^GOTRUE_MAILER_EXTERNAL_HOSTS='`
- `curl -sS -X POST http://localhost:54321/auth/v1/otp ...`
- `curl -sS -X POST http://127.0.0.1:54321/auth/v1/otp ...`
- `curl -sS -X POST http://127.0.0.1:54321/auth/v1/verify ...`
- `docker logs --since 5s supabase_auth_Genero`

### Files Edited
- `supabase/config.toml`
- `scripts/start-local-supabase.sh`
- `package.json`
- `README.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.122
### Timestamp
- 2026-04-02 01:18 EDT

### Objective
- Improve light-mode contrast for the auth modal email input so the pre-OTP email field reads clearly as an editable control.

### What Changed
- Added a dedicated `authModalEmailFieldClass` token that keeps the auth modal email input white with a stronger light-mode border and placeholder colour while preserving the existing dark-mode behaviour.
- Applied that higher-contrast field treatment to both wallet and SpareChange OTP auth forms so the shared sign-in flow stays visually consistent across apps.
- Added focused regression checks to confirm the auth email field keeps the stronger light-mode surface classes.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/forms/OTPForm.test.tsx app/tcoin/sparechange/components/forms/OTPForm.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/forms/OTPForm.tsx app/tcoin/wallet/components/forms/OTPForm.test.tsx app/tcoin/sparechange/components/forms/OTPForm.tsx app/tcoin/sparechange/components/forms/OTPForm.test.tsx shared/components/ui/formFieldStyles.ts`

### Files Edited
- `shared/components/ui/formFieldStyles.ts`
- `app/tcoin/wallet/components/forms/OTPForm.tsx`
- `app/tcoin/wallet/components/forms/OTPForm.test.tsx`
- `app/tcoin/sparechange/components/forms/OTPForm.tsx`
- `app/tcoin/sparechange/components/forms/OTPForm.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.121
### Timestamp
- 2026-04-02 00:51 EDT

### Objective
- Harden root wallet route aliasing so direct loads and refreshes on `/merchant` resolve reliably instead of intermittently falling into a 404/dev refresh loop.

### What Changed
- Added explicit root rewrite entries in `next.config.js` for the main wallet and operator pages (`/dashboard`, `/merchant`, `/admin`, `/city-manager`, `/city-admin`, `/welcome`, `/resources`, `/contact`, `/ecosystem`) ahead of the generic non-API fallback rewrite.
- Added a focused `next.config` regression test to assert that the key operator/dashboard aliases remain present and that the broad catch-all rewrite stays last.
- Re-verified the merchant alias over HTTP after the rewrite update so `/merchant` and `/tcoin/wallet/merchant` both resolve through the same workspace entrypoint.

### Verification
- `pnpm exec vitest run next.config.test.ts`
- `curl -I http://localhost:3000/merchant`
- `curl -I http://localhost:3000/tcoin/wallet/merchant`
- `curl -I http://localhost:3000/dashboard`

### Files Edited
- `next.config.js`
- `next.config.test.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.120
### Timestamp
- 2026-04-02 00:37 EDT

### Objective
- Make merchant applicants on the city-manager page inspectable so operators can review the person behind an application before approving or rejecting it.

### What Changed
- Extended the city-manager store-list payload so each applicant now includes username, phone, country, address, profile image URL, and account creation timestamp in addition to full name and email.
- Turned the applicant name on `/city-manager` into a clear clickable control that opens a focused applicant-profile dialog instead of leaving the operator with a static text label.
- Added a lightweight inspector layout in the dialog with avatar, full name, username, email, account age, country, phone, and address, while keeping the existing application-review controls in place.

### Verification
- `pnpm exec eslint app/tcoin/wallet/city-manager/page.tsx app/tcoin/wallet/city-manager/page.test.tsx shared/lib/merchantSignup/types.ts supabase/functions/_shared/merchantApplications.ts`
- `pnpm exec vitest run app/tcoin/wallet/city-manager/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/city-manager/page.tsx`
- `app/tcoin/wallet/city-manager/page.test.tsx`
- `shared/lib/merchantSignup/types.ts`
- `supabase/functions/_shared/merchantApplications.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.119
### Timestamp
- 2026-04-02 00:31 EDT

### Objective
- Add address capture to wallet Edit Profile, match the merchant-signup style more closely, and clarify how banking details are used.

### What Changed
- Added an editable address field to the wallet Edit Profile modal, using a multi-line address input similar to the merchant signup flow rather than a cramped single-line field.
- Added two tooltip explanations in the Banking info section: one at the section level clarifying that banking details are not shared with other users, and one on the address field clarifying that the address is only needed before withdrawals.
- Extended the shared user-settings bootstrap and profile-update contract so `address` now round-trips through the Edit Profile modal instead of being dropped from the wallet bootstrap mapper.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx shared/lib/userSettings/types.ts supabase/functions/_shared/userSettings.ts`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `shared/lib/userSettings/types.ts`
- `supabase/functions/_shared/userSettings.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.118
### Timestamp
- 2026-04-02 00:24 EDT

### Objective
- Fix the local Supabase edge-runtime boot failure caused by stale `corsHeaders` imports, then rerun the local wallet smoke flow against the Colima-backed stack.

### What Changed
- Standardized the affected Supabase edge-function entrypoints to import `resolveCorsHeaders` from the shared CORS helper and to answer `OPTIONS` requests with `resolveCorsHeaders(req)` instead of the removed `corsHeaders` symbol.
- Verified there are no remaining stale `corsHeaders` references in `supabase/functions/**/*.ts` and ran focused ESLint on the touched edge domains.
- Re-ran the local smoke pass against a wallet dev server pointed at the local Supabase URLs: the earlier edge-function `502` worker-boot failure is gone, and `citycoin-market` / `wallet-operations` now return real application responses (`404` / `401`) instead of runtime boot crashes. The smoke pass still uncovered a separate local auth issue where `POST /auth/v1/token?grant_type=pkce` times out with `504`, so the authenticated browser flow still does not complete locally.

### Verification
- `pnpm exec eslint supabase/functions/voucher-preferences/index.ts supabase/functions/onramp/index.ts supabase/functions/user-requests/index.ts supabase/functions/wallet-operations/index.ts supabase/functions/store-operations/index.ts supabase/functions/control-plane/index.ts supabase/functions/redemptions/index.ts supabase/functions/bia-service/index.ts supabase/functions/citycoin-market/index.ts supabase/functions/voucher-runtime/index.ts supabase/functions/governance/index.ts supabase/functions/payment-requests/index.ts supabase/functions/merchant-applications/index.ts`
- `rg -n "corsHeaders" supabase/functions -g '*.ts'`
- Local smoke checks against local Supabase:
- `curl -I http://127.0.0.1:3002/dashboard`
- `curl -i -X POST http://127.0.0.1:54321/functions/v1/citycoin-market/rate/current?citySlug=tcoin ...`
- `curl -i http://127.0.0.1:54321/functions/v1/wallet-operations/contacts/imports ...`
- Browser smoke via Playwright against `http://127.0.0.1:3002/dashboard?tab=contacts`

### Files Edited
- `supabase/functions/bia-service/index.ts`
- `supabase/functions/citycoin-market/index.ts`
- `supabase/functions/control-plane/index.ts`
- `supabase/functions/governance/index.ts`
- `supabase/functions/merchant-applications/index.ts`
- `supabase/functions/onramp/index.ts`
- `supabase/functions/payment-requests/index.ts`
- `supabase/functions/redemptions/index.ts`
- `supabase/functions/store-operations/index.ts`
- `supabase/functions/user-requests/index.ts`
- `supabase/functions/voucher-preferences/index.ts`
- `supabase/functions/voucher-runtime/index.ts`
- `supabase/functions/wallet-operations/index.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.117
### Timestamp
- 2026-04-02 00:13 EDT

### Objective
- Reduce mobile authenticated-dashboard chrome so phone-sized layouts use less nested card framing and more content space.

### What Changed
- Flattened the shared authenticated wallet panel primitives on phone widths so the main panel, muted panel, and metric-tile shells now read as transparent sections with horizontal dividers instead of stacked boxed cards.
- Tightened the wallet home grids and spacing on small screens and adjusted the account/merchant sub-panels so the mobile home tab wastes less space on nested framing.
- Added a regression to lock in the mobile-first flattening rule while keeping the larger-screen card styling intact from `sm` upwards.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts app/tcoin/wallet/components/dashboard/WalletHome.tsx app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts app/tcoin/wallet/components/dashboard/AccountCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.116
### Timestamp
- 2026-04-01 23:54 EDT

### Objective
- Turn the empty Contacts tab into a real invite-onboarding flow that can save imported contacts, collect manual email addresses, and queue an editable invite batch instead of stopping at a dead-end placeholder.

### What Changed
- Reworked the wallet Contacts empty state into a guided collaboration-first flow with friendlier copy, explicit loading behaviour, browser contact import where supported, manual “add another” email entry, saved imported-contact selection, and an editable invite note before queueing.
- Added typed `wallet-operations` support for contact-import persistence and invite batching, including new `/contacts/imports` and `/contacts/invite-batches` routes plus matching client contracts.
- Added an idempotent `v1.07` migration that creates app-scoped tables for saved contact-import approval, imported email contacts, invite batches, and batch recipients.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ContactsTab.tsx app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx shared/lib/edge/walletOperations.ts shared/lib/edge/walletOperationsClient.ts supabase/functions/_shared/walletOperations.ts supabase/functions/wallet-operations/index.ts`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
- `app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx`
- `shared/lib/edge/walletOperations.ts`
- `shared/lib/edge/walletOperationsClient.ts`
- `supabase/functions/_shared/walletOperations.ts`
- `supabase/functions/wallet-operations/index.ts`
- `supabase/migrations/20260402001000_v1.07_contact_invite_batches.sql`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.115
### Timestamp
- 2026-04-01 23:27 EDT

### Objective
- Make the authenticated header account widget reflect the saved user identity more clearly by showing the profile picture and prioritizing preferred name plus email.

### What Changed
- Updated the navbar account widget to source identity chrome from the normalized wallet user-settings bootstrap first, including the saved profile image.
- Changed both the closed account trigger and the opened dropdown summary to lead with preferred name and email instead of the old username-first summary.
- Expanded the navbar regression to assert the preferred-name summary and the presence of the saved profile-image source in the account widget.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/navbar/Navbar.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.114
### Timestamp
- 2026-04-01 23:04 EDT

### Objective
- Fix the Edit Profile avatar editor so the small summary preview and the larger crop editor show the same framing.

### What Changed
- Split the Edit Profile avatar preview rendering into two crop-frame calculations: one for the 80px summary circle and one for the 176px editor circle.
- Kept both previews tied to the same underlying crop state, so changing zoom or offset now yields the same apparent crop at two different sizes instead of reusing one mismatched pixel frame.
- Expanded the modal regression to assert that crop-frame calculation happens for both preview sizes during an image edit session.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.113
### Timestamp
- 2026-04-01 23:02 EDT

### Objective
- Make the More-tab Account centre use the friendlier preferred-name display rule the user expects.

### What Changed
- Updated the More-tab Account centre heading to prefer the saved preferred name (`nickname`) before falling back to the given name and only then to fuller legacy name fields.
- Added focused regression coverage for both branches: one test confirms the preferred name is shown when present, and another confirms the heading falls back to the given name when the preferred name is blank.
- Documented the Account centre naming rule in the technical and functional specs so future UI changes keep the same priority order.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.112
### Timestamp
- 2026-04-01 22:59 EDT

### Objective
- Make the Edit Profile modal sectioning clearer by separating account-holder details from wallet-local display settings.

### What Changed
- Reorganized the Edit Profile form so the first details card is now labeled `Banking info` and contains `Given name(s)`, last name, country, and phone.
- Relabeled the final details card as `Info used in this app`, leaving username and preferred name grouped as wallet-local profile settings.
- Expanded the modal regression to assert the new section headings and the updated `Given name(s)` field label.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.111
### Timestamp
- 2026-04-01 22:56 EDT

### Objective
- Standardize app-facing input backgrounds so editable fields read clearly as controls instead of blending into their surrounding panels.

### What Changed
- Added shared field-surface tokens in `shared/components/ui/formFieldStyles.ts` and applied them to the base text input, textarea, Radix select trigger, command-search input, file input, and OTP digit styles.
- Updated wallet onboarding, the Edit Profile modal, BIA Preferences, and the remaining raw wallet/sparechange profile inputs to use the same surfaced treatment, and aligned the country `react-select` instances with that visual system.
- Added a regression test for the shared field-surface tokens and cleaned up the touched SpareChange profile modal so the pass linted without new warnings.

### Verification
- `pnpm exec eslint shared/components/ui/Input.tsx shared/components/ui/TextArea.tsx shared/components/ui/Select.tsx shared/components/ui/command.tsx shared/components/ui/ImageUpload.tsx shared/components/ui/formFieldStyles.ts shared/components/ui/formFieldStyles.test.ts app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx app/tcoin/wallet/welcome/page.tsx app/tcoin/wallet/components/modals/BiaPreferencesModal.tsx app/tcoin/wallet/components/forms/OTPForm.tsx app/tcoin/sparechange/components/forms/OTPForm.tsx app/tcoin/sparechange/components/modals/UserProfileModal.tsx`
- `pnpm exec vitest run shared/components/ui/formFieldStyles.test.ts app/tcoin/wallet/components/modals/UserProfileModal.test.tsx app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `shared/components/ui/formFieldStyles.ts`
- `shared/components/ui/formFieldStyles.test.ts`
- `shared/components/ui/Input.tsx`
- `shared/components/ui/TextArea.tsx`
- `shared/components/ui/Select.tsx`
- `shared/components/ui/command.tsx`
- `shared/components/ui/ImageUpload.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/components/modals/BiaPreferencesModal.tsx`
- `app/tcoin/wallet/components/forms/OTPForm.tsx`
- `app/tcoin/sparechange/components/forms/OTPForm.tsx`
- `app/tcoin/sparechange/components/modals/UserProfileModal.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.110
### Timestamp
- 2026-04-01 22:47 EDT

### Objective
- Make the Edit Profile country field more intentional by changing the label and only showing matching country options after the user starts typing.

### What Changed
- Renamed the Edit Profile field to “Country or Country number” so the dial-code use case is explicit.
- Updated the `react-select` configuration to keep the country menu closed on focus, open only once there is typed input, and filter against both the visible country label and the stored country code.
- Added a focused modal regression to confirm the picker stays closed until typing begins and then reveals the matching option list.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.109
### Timestamp
- 2026-04-01 22:43 EDT

### Objective
- Stop forcing square profile photos in Edit Profile, and add a signed-in framing step so users can place any uploaded image correctly inside the circular avatar.

### What Changed
- Added a client-side profile-picture preparation and crop helper that reads the selected image dimensions, builds a local preview model, and exports the framed result as a cropped square PNG for upload.
- Reworked the Edit Profile modal to accept any image, show a circular preview immediately after selection, and expose zoom plus horizontal or vertical positioning controls depending on the photo shape and crop state.
- Updated the shared avatar image styling to use `object-cover`, and expanded the modal regression test to cover the new framing flow and cropped upload path.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx shared/lib/profilePictureCrop.ts shared/components/ui/Avatar.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `shared/lib/profilePictureCrop.ts`
- `shared/components/ui/Avatar.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.108
### Timestamp
- 2026-04-01 22:33:51 EDT

### Objective
- Patch the missing `user_identifier` write path so wallet setup and related authenticated flows actually create the shareable identifier that receive-QR lookup depends on.

### What Changed
- Added identifier-generation helpers in the shared user-settings backend to normalize username-based candidates, fall back to deterministic `user-<id>` identifiers, and suffix collisions safely within the length budget.
- Wired those helpers into the canonical authenticated-user, profile-update, and wallet-custody registration flows so missing identifiers are backfilled, fallback identifiers can upgrade to username-based ones, and step 5 wallet setup now guarantees an identifier exists after custody registration.
- Added focused unit coverage for the identifier helper rules and re-ran the welcome/auth tests to confirm the wallet-setup path still behaves correctly.

### Verification
- `pnpm exec eslint supabase/functions/_shared/userSettings.ts supabase/functions/_shared/userSettings.test.ts app/tcoin/wallet/welcome/page.tsx`
- `pnpm exec vitest run supabase/functions/_shared/userSettings.test.ts shared/api/hooks/useAuth.test.tsx app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/_shared/userSettings.test.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.107
### Timestamp
- 2026-04-01 22:27:48 EDT

### Objective
- Make long identity fields in the More-tab `public.users` inspection card easier to read, especially `cubid_identity`.

### What Changed
- Added a wide-row treatment for JSON-heavy `public.users` fields in `MoreTab`, so `cubid_score`, `cubid_identity`, and `cubid_score_details` now render in a stacked, roomier layout instead of the tighter two-column row.
- Switched object formatting to pretty-printed JSON and preserved wrapping with a monospace multi-line container, which gives long identity payloads more horizontal room and cleaner scanning.
- Added a More-tab regression to assert that the long identity row uses the wide layout and keeps wrapped formatting.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.106
### Timestamp
- 2026-04-01 22:26:00 EDT

### Objective
- Add a bottom-of-More account-record card that shows every current `public.users` column alongside whatever value the authenticated wallet currently knows for that field.

### What Changed
- Added a schema-aligned `PUBLIC_USERS_COLUMNS` list and value-formatting helper to `MoreTab`, then rendered a new bottom section that lists each `public.users` column in order with the current authenticated value or an explicit empty placeholder.
- Mapped the card values from the available wallet bootstrap, Cubid-style user payload, and auth session so fields like `auth_user_id`, `user_identifier`, names, contact details, booleans, timestamps, and JSON score blobs all render from the best available source.
- Expanded the More-tab test coverage to assert that the new card renders, that known values appear in the right rows, and that empty database fields still remain visible.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.105
### Timestamp
- 2026-04-01 19:15:08 EDT

### Objective
- Fix the Receive tab QR bootstrap so authenticated users get their real wallet identifier, and make the fallback message distinguish between a record that is still loading and one that is actually missing.

### What Changed
- Added `userIdentifier` to the shared user-settings bootstrap type, selected `users.user_identifier` in the server bootstrap query, and preserved that value in the legacy Cubid-data mapper that `useAuth` consumes.
- Updated `ReceiveTab` to read `isLoadingUser` from `useAuth`, so the tab now shows a true loading message only while the authenticated user record is resolving and switches to a missing-identity message once loading is complete without a `user_identifier`.
- Extended the Receive-tab tests to cover the missing-identity and still-loading cases, and documented the corrected QR bootstrap behaviour in the functional and technical specs.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveTab.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx shared/lib/userSettings/types.ts shared/api/hooks/useAuth.ts shared/api/services/supabaseService.ts`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx shared/api/hooks/useAuth.test.tsx`

### Files Edited
- `shared/lib/userSettings/types.ts`
- `supabase/functions/_shared/userSettings.ts`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.104
### Timestamp
- 2026-04-01 19:05:54 EDT

### Objective
- Make exchange-rate fallback messaging precise across the wallet surfaces and move the fallback CAD estimate off the hardcoded client constant into environment configuration.

### What Changed
- Refactored `useGetLatestExchangeRate` so it exposes state-specific fallback messaging for `empty` and `setup_required`, keeps `ready` free of warning copy, and reads the fallback CAD estimate from `NEXT_PUBLIC_CITYCOIN_CAD_FALLBACK_RATE` with `3.35` as the default.
- Updated the wallet account card, Buy TCOIN, Top Up, and off-ramp modals, plus the SpareChange off-ramp modal, to render the shared precise fallback message instead of their older hand-written “live rate unavailable” variants.
- Added hook regressions covering the new warning semantics and the env override, documented the behaviour in the functional and technical specs, and added the new variable to `.env.local.example`.

### Verification
- `pnpm exec eslint shared/hooks/useGetLatestExchangeRate.ts shared/hooks/useGetLatestExchangeRate.test.tsx app/tcoin/wallet/components/dashboard/AccountCard.tsx app/tcoin/wallet/components/modals/TopUpModal.tsx app/tcoin/wallet/components/modals/BuyTcoinModal.tsx app/tcoin/wallet/components/modals/OffRampModal.tsx app/tcoin/sparechange/components/modals/OffRampModal.tsx`
- `pnpm exec vitest run shared/hooks/useGetLatestExchangeRate.test.tsx app/tcoin/wallet/components/dashboard/AccountCard.test.tsx app/tcoin/wallet/components/modals/TopUpModal.test.tsx app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx app/tcoin/wallet/components/modals/OffRampModal.test.tsx`

### Files Edited
- `.env.local.example`
- `shared/hooks/useGetLatestExchangeRate.ts`
- `shared/hooks/useGetLatestExchangeRate.test.tsx`
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `app/tcoin/wallet/components/modals/TopUpModal.tsx`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/tcoin/wallet/components/modals/OffRampModal.tsx`
- `app/tcoin/sparechange/components/modals/OffRampModal.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.103
### Timestamp
- 2026-04-01 18:49:53 EDT

### Objective
- Unstick the Receive tab QR generator and stop showing a permanent loading state when the wallet’s shareable identifier is missing or arrives before the numeric user id.

### What Changed
- Refactored `ReceiveTab` so QR payload generation depends on the wallet `user_identifier` itself rather than the numeric `id`, which allows QR setup to proceed as soon as the shareable receive identity is available.
- Added an explicit unavailable-state message for cases where the QR identifier is absent, replacing the indefinite “Loading QR Code...” fallback in `ReceiveCard`.
- Added focused regressions for both the receive-tab identifier edge cases and the receive-card unavailable-state message, then documented the behavior in the functional and technical specs.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/ReceiveTab.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.102
### Timestamp
- 2026-04-01 18:44:15 EDT

### Objective
- Prevent the Interac top-up modal from crashing when the legacy onramp route is missing, and surface a clearer error for that environment mismatch.

### What Changed
- Added a route-specific 404 message in the shared edge-function client so bare `Not found.` responses identify which onramp path is unavailable in the current environment.
- Wrapped the wallet `TopUpModal` Next-step legacy Interac reference call in a `try/catch`, keeping the modal on the input step and showing a toast instead of throwing an unhandled runtime error.
- Added focused regressions for the new 404 message and the modal’s failure handling, then documented the degraded-environment top-up behaviour in the functional and technical specs.

### Verification
- `pnpm exec eslint shared/lib/edge/core.ts shared/lib/edge/core.test.ts app/tcoin/wallet/components/modals/TopUpModal.tsx app/tcoin/wallet/components/modals/TopUpModal.test.tsx`
- `pnpm exec vitest run shared/lib/edge/core.test.ts app/tcoin/wallet/components/modals/TopUpModal.test.tsx`

### Files Edited
- `shared/lib/edge/core.ts`
- `shared/lib/edge/core.test.ts`
- `app/tcoin/wallet/components/modals/TopUpModal.tsx`
- `app/tcoin/wallet/components/modals/TopUpModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.101
### Timestamp
- 2026-04-01 17:49:04 EDT

### Objective
- Make the authenticated theme icon communicate `system`, `light`, and `dark` clearly so theme changes never appear to do nothing.

### What Changed
- Refactored the wallet navbar theme button to use the shared `themeMode` value directly instead of inferring state from resolved dark mode alone.
- Added an explicit three-state cycle (`system -> light -> dark -> system`), a dedicated system/laptop icon, and current/next-state labels on the button so the control always communicates what mode is active and what a click will do next.
- Added focused tests covering the explicit system state plus all three cycle transitions and persisted theme writes, then documented the new behaviour in the functional and technical specs.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/navbar/ThemeToggleButton.tsx app/tcoin/wallet/components/navbar/ThemeToggleButton.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/navbar/ThemeToggleButton.test.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/navbar/ThemeToggleButton.tsx`
- `app/tcoin/wallet/components/navbar/ThemeToggleButton.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.100
### Timestamp
- 2026-04-01 17:46:33 EDT

### Objective
- Stop authenticated mobile and tablet layouts from shifting sideways between tab changes when the footer is visible and scrollbar presence changes.

### What Changed
- Marked authenticated non-public wallet routes as a dedicated mobile/tablet frame and inner scroll region so the signed-in shell, not the viewport, owns vertical scrolling under `1024px`.
- Added shared authenticated scrollbar styling that reserves a stable gutter, keeps the scrollbar thin and low-contrast, and lets it sit inside the shell instead of pushing the whole layout left and right as tabs change height.
- Added a focused `ContentLayout` regression test to confirm the scroll-frame classes apply only to authenticated non-public wallet routes, then documented the behaviour in the functional and technical specs.

### Verification
- `pnpm exec eslint app/tcoin/wallet/ContentLayout.tsx app/tcoin/wallet/ContentLayout.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/ContentLayout.test.tsx app/tcoin/wallet/dashboard/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/wallet/ContentLayout.test.tsx`
- `app/tcoin/wallet/styles/app.scss`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.99
### Timestamp
- 2026-04-01 17:43:39 EDT

### Objective
- Use ultra-wide desktop space more efficiently on authenticated Home and More so key wallet content fits with less vertical scrolling.

### What Changed
- Expanded the shared authenticated shell again at `min-[1850px]`, increasing the signed-in page max width and restoring some horizontal space specifically for ultra-wide desktop layouts.
- Reworked `WalletHome` into broader three-track desktop compositions where the summary, send, and support rows give the primary task surfaces wider spans and use the extra width for parallel panels instead of taller stacking.
- Updated `MoreTab` so the account-centre overview becomes a three-column layout and the lower action-section grid grows from two columns to three on ultra-wide screens, making better use of large desktop space.
- Added focused breakpoint regressions for the new Home and More grid classes, then documented the ultra-wide layout behaviour in the functional and technical specs.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/components/dashboard/WalletHome.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.98
### Timestamp
- 2026-04-01 17:35:00 EDT

### Objective
- Make the active tab in the authenticated sidebar and footer obvious at a glance, and stop permanently highlighting Send.

### What Changed
- Refactored `DashboardFooter` so the strong primary-filled icon treatment, raised mobile offset, and stronger label weight now follow the selected tab instead of being hardcoded to Send.
- Applied that same active-state rule across both the mobile footer and the desktop sidebar, so the selected destination uses one consistent visual language in both nav layouts.
- Updated the footer regression tests to assert that active-state styling follows the current tab and that inactive Send returns to the neutral state, then documented the change in the functional and technical specs.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/DashboardFooter.tsx app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/DashboardFooter.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.97
### Timestamp
- 2026-04-01 17:32:00 EDT

### Objective
- Hide scan controls on devices without a reported camera and keep QR-scan flows from presenting broken camera UI there.

### What Changed
- Added a shared `useCameraAvailability()` hook that detects whether the browser reports any `videoinput` devices, along with whether multiple cameras are available.
- Updated wallet and sparechange scan entry points to hide header and send-flow scan buttons when no camera is available, and prevented SpareChange’s deferred `openQR` flow from reopening the scanner on camera-less devices.
- Refactored both QR-scan modals to reuse the shared camera capability state, keep flip-camera support when multiple cameras exist, and show a clear non-camera fallback message instead of always mounting the scanner.
- Added focused tests for the new camera hook plus wallet navbar and send-tab camera gating, then updated the functional and technical specs to document the capability rule.

### Verification
- `pnpm exec eslint shared/hooks/useCameraAvailability.ts shared/hooks/useCameraAvailability.test.tsx app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/dashboard/SendTab.tsx app/tcoin/wallet/components/dashboard/SendTab.test.tsx app/tcoin/wallet/components/modals/QrScanModal.tsx app/tcoin/sparechange/components/navbar/Navbar.tsx app/tcoin/sparechange/components/modals/QrScanModal.tsx app/tcoin/sparechange/dashboard/screens/WalletComponent.tsx`
- `pnpm exec vitest run shared/hooks/useCameraAvailability.test.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/dashboard/SendTab.test.tsx`

### Files Edited
- `shared/hooks/useCameraAvailability.ts`
- `shared/hooks/useCameraAvailability.test.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.test.tsx`
- `app/tcoin/wallet/components/modals/QrScanModal.tsx`
- `app/tcoin/sparechange/components/navbar/Navbar.tsx`
- `app/tcoin/sparechange/components/modals/QrScanModal.tsx`
- `app/tcoin/sparechange/dashboard/screens/WalletComponent.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.96
### Timestamp
- 2026-04-01 17:25:00 EDT

### Objective
- Make clickable controls visually distinct from non-clickable frames across the authenticated wallet without depending on hover.

### What Changed
- Split the shared authenticated surface styling into quieter static panels and more obviously interactive surfaces, giving clickable cards and rows a persistent teal edge, ring, and stronger at-rest control treatment.
- Applied that interactive treatment to the wallet’s shared action rows and choice cards, the small authenticated action buttons, global outline-style buttons, the Recents contact tiles, and the Send-card contact suggestion rows so the distinction carries across dashboard and modal flows.
- Added focused regressions for the shared interaction-language tokens, the outline button variant, and the custom Recents and Send-card clickable tiles, then updated the functional and technical specs to document the new affordance rule.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts app/tcoin/wallet/components/dashboard/WalletHome.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/SendCard.tsx app/tcoin/wallet/components/dashboard/SendCard.test.tsx shared/components/ui/Button.tsx shared/components/ui/Button.test.ts`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/SendCard.test.tsx shared/components/ui/Button.test.ts`

### Files Edited
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/components/dashboard/authenticated-ui.test.ts`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendCard.tsx`
- `app/tcoin/wallet/components/dashboard/SendCard.test.tsx`
- `shared/components/ui/Button.tsx`
- `shared/components/ui/Button.test.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.95
### Timestamp
- 2026-04-01 00:42:00 EDT

### Objective
- Improve readability in the More tab by letting action-row body copy use the full available text width.

### What Changed
- Refactored the shared More-tab action row layout from a flex row into a three-column grid so the icon, text, and meta/chevron areas have explicit structure.
- Moved the action-row description onto `col-[2/4]`, allowing the body copy in the Community defaults and Workspaces and previews cards to span the full right-side text area instead of wrapping in a narrow centre strip.
- Added a focused More-tab regression test and updated the functional and technical specs to document the wider action-row copy behaviour.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.94
### Timestamp
- 2026-04-01 00:27:00 EDT

### Objective
- Make the authenticated home and More screens denser on large displays so users can see more without extra scrolling.

### What Changed
- Widened the shared authenticated page shell to `max-w-[90rem]` and reduced large-screen outer padding so `/dashboard` and `/dashboard?tab=more` use more of the available viewport width.
- Tightened large-screen section and grid spacing in the authenticated home and More surfaces so balance, shortcuts, and account-centre content sit higher on the page.
- Updated the functional and technical specs to document the new desktop-density behaviour for the authenticated wallet shell.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/components/dashboard/WalletHome.tsx app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/AccountCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.93
### Timestamp
- 2026-04-01 00:02:00 EDT

### Objective
- Prevent the More-tab cash-out modal from crashing when Cubid phone-stamp lookup fails in local or degraded environments.

### What Changed
- Wrapped the Cubid SDK phone-stamp prefill in a fail-safe path so `fetchStamps(...)` errors no longer bubble into an unhandled runtime exception during modal mount.
- Kept the cash-out modal usable after lookup failure by falling back to manual phone entry and showing a short explanatory note in the phone-verification section.
- Added a focused regression test that simulates a Cubid 404 and confirms the modal stays mounted in the manual-entry state, then updated the functional and technical specs to document the graceful-degradation rule.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/modals/OffRampModal.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/modals/OffRampModal.tsx app/tcoin/wallet/components/modals/OffRampModal.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/OffRampModal.tsx`
- `app/tcoin/wallet/components/modals/OffRampModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.92
### Timestamp
- 2026-03-31 23:49:00 EDT

### Objective
- Refactor the authenticated More tab into a clearer account centre and align its linked modals and workspaces with the same signed-in wallet UX.

### What Changed
- Rebuilt `/dashboard?tab=more` around a stronger account-centre layout with identity, wallet address and explorer access, defaults summaries, grouped settings/actions, and the moved wallet-optimisation guidance.
- Removed wallet-address and optimisation explainer chrome from the authenticated home screen so `/dashboard` stays focused on balance, money movement, recents, and a handoff into More for account settings.
- Restyled the More-linked modal bodies and operator pages to share calmer signed-in hierarchy and grouped task panels, including profile, theme, BIA, voucher-routing, charity, future-features, cash-out, merchant, city-manager, and admin surfaces.
- Added focused regression coverage for the More tab, wallet home, account card, merchant page, and key modals, then updated the functional and technical specs to document the new account-centre model.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/AccountCard.test.tsx app/tcoin/wallet/components/modals/CharitySelectModal.test.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx app/tcoin/wallet/admin/page.test.tsx app/tcoin/wallet/city-manager/page.test.tsx app/tcoin/wallet/merchant/page.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/components/dashboard/WalletHome.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/AccountCard.tsx app/tcoin/wallet/components/dashboard/AccountCard.test.tsx app/tcoin/wallet/components/modals/ThemeSelectModal.tsx app/tcoin/wallet/components/modals/BiaPreferencesModal.tsx app/tcoin/wallet/components/modals/VoucherRoutingPreferencesModal.tsx app/tcoin/wallet/components/modals/CharityContributionsModal.tsx app/tcoin/wallet/components/modals/CharitySelectModal.tsx app/tcoin/wallet/components/modals/FutureAppFeaturesModal.tsx app/tcoin/wallet/components/modals/OffRampModal.tsx app/tcoin/wallet/components/modals/UserProfileModal.tsx app/tcoin/wallet/admin/page.tsx app/tcoin/wallet/city-manager/page.tsx app/tcoin/wallet/merchant/page.tsx app/tcoin/wallet/merchant/LiveMerchantDashboard.tsx app/tcoin/wallet/merchant/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `app/tcoin/wallet/components/dashboard/AccountCard.test.tsx`
- `app/tcoin/wallet/components/modals/ThemeSelectModal.tsx`
- `app/tcoin/wallet/components/modals/BiaPreferencesModal.tsx`
- `app/tcoin/wallet/components/modals/VoucherRoutingPreferencesModal.tsx`
- `app/tcoin/wallet/components/modals/CharityContributionsModal.tsx`
- `app/tcoin/wallet/components/modals/CharitySelectModal.tsx`
- `app/tcoin/wallet/components/modals/FutureAppFeaturesModal.tsx`
- `app/tcoin/wallet/components/modals/OffRampModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/city-manager/page.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `app/tcoin/wallet/merchant/LiveMerchantDashboard.tsx`
- `app/tcoin/wallet/merchant/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.91
### Timestamp
- 2026-03-31 23:56:00 EDT

### Objective
- Align the authenticated More-linked operator pages with the shared dashboard shell and navigation chrome.

### What Changed
- Switched `/city-manager` and `/merchant` onto the shared authenticated `walletPageClass` wrapper so they inherit the same dashboard padding and desktop sidebar offsets as `/dashboard`.
- Refactored `/admin` to use that same shell across loading, restricted, error, and normal states, and mounted the shared `DashboardFooter` so the side and bottom navigation stay available there too.
- Added focused route regression coverage for the city-manager, merchant, and admin pages, and updated the functional and technical specs to document the shared shell requirement for More-linked authenticated routes.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/city-manager/page.test.tsx app/tcoin/wallet/merchant/page.test.tsx app/tcoin/wallet/admin/page.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/city-manager/page.tsx app/tcoin/wallet/city-manager/page.test.tsx app/tcoin/wallet/merchant/page.tsx app/tcoin/wallet/merchant/page.test.tsx app/tcoin/wallet/admin/page.tsx app/tcoin/wallet/admin/page.test.tsx`

### Files Edited
- `app/tcoin/wallet/city-manager/page.tsx`
- `app/tcoin/wallet/city-manager/page.test.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `app/tcoin/wallet/merchant/page.test.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/admin/page.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.90
### Timestamp
- 2026-03-31 23:24:02 EDT

### Objective
- Make authenticated wallet modals use the signed-in wallet shell styling instead of the landing-page modal chrome.

### What Changed
- Added a route-aware modal theme handoff so authenticated non-public wallet routes automatically pass `wallet-auth-shell font-sans` into the shared modal layer.
- Restyled the shared modal component to use authenticated shell panel, typography, and close-button chrome whenever that theme is present, covering the signed-in wallet modals from contacts, buy/top-up, off-ramp, profile, theme, BIA, voucher, charity, future-features, and admin flows.
- Added a focused modal regression test and updated the functional and technical specs to document the authenticated modal theme behaviour.

### Verification
- `pnpm exec vitest run shared/components/ui/Modal.test.tsx`
- `pnpm exec eslint shared/contexts/ModalContext.tsx shared/components/ui/Modal.tsx shared/components/ui/Modal.test.tsx app/tcoin/wallet/layout.tsx`

### Files Edited
- `shared/contexts/ModalContext.tsx`
- `shared/components/ui/Modal.tsx`
- `shared/components/ui/Modal.test.tsx`
- `app/tcoin/wallet/layout.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.89
### Timestamp
- 2026-03-31 17:38:28 EDT

### Objective
- Make the authenticated header and navigation controls use the wallet app’s sans-serif UI font instead of inheriting the landing page font.

### What Changed
- Added explicit `font-sans` overrides to the authenticated navbar shell, account control, dropdown, nav links, mobile footer, desktop sidebar rail, and footer buttons.
- Added focused navbar/footer regression checks that assert the authenticated chrome keeps its sans-serif font override in place.
- Updated the functional and technical specs to document the authenticated chrome font override.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/navbar/NavLink.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/DashboardFooter.tsx app/tcoin/wallet/components/DashboardFooter.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/NavLink.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.88
### Timestamp
- 2026-03-31 17:36:06 EDT

### Objective
- Make the authenticated sidebar feel proportionate on mid/large screens and tone down the main-screen scale on phone-sized devices.

### What Changed
- Widened the authenticated desktop sidebar, increased its compact label/icon sizing, and adjusted the dashboard/contact-page left offsets so the larger rail stays balanced against the main workspace.
- Reduced the shared authenticated shell scale on small devices by tightening page gaps, outer padding, panel padding, badge sizing, action-chip sizing, and intro typography.
- Added a sidebar sizing regression check and documented the new responsive shell sizing rules in the functional and technical specs.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/DashboardFooter.test.tsx app/tcoin/wallet/dashboard/page.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/DashboardFooter.tsx app/tcoin/wallet/components/DashboardFooter.test.tsx app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/dashboard/page.tsx 'app/tcoin/wallet/dashboard/contacts/[id]/page.tsx'`

### Files Edited
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.87
### Timestamp
- 2026-03-31 17:30:29 EDT

### Objective
- Keep the authenticated header visible on midsized and large screens while preserving the phone-sized hide-on-scroll behaviour.

### What Changed
- Updated the authenticated wallet navbar so both scroll-driven hiding and `hide-header` event handling only apply below the phone breakpoint.
- Added resize handling so the header snaps back into view when the viewport widens from phone size to tablet or desktop.
- Added navbar tests that lock in the new desktop-visible and phone-hide behaviour, and documented the responsive header rule in the specs.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/navbar/Navbar.test.tsx app/tcoin/wallet/components/DashboardFooter.tsx`

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.86
### Timestamp
- 2026-03-31 17:26:52 EDT

### Objective
- Remove the remaining large-screen send-tab padding that was still collapsing the payment workspace into a narrow centre column.

### What Changed
- Removed the send tab’s `lg:px-[25vw]` wrapper padding so the desktop send flow now uses the same authenticated workspace width as the rest of the wallet dashboard.
- Trimmed the local action-switcher panel padding slightly and added a focused regression check that guards against reintroducing the oversized desktop padding class.
- Updated the functional and technical specs to document the corrected send-tab width behaviour.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/SendTab.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/SendTab.tsx app/tcoin/wallet/components/dashboard/SendTab.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.85
### Timestamp
- 2026-03-31 16:52:00 EDT

### Objective
- Make the auth modal’s email input behave like a proper browser-recognized email field.

### What Changed
- Tagged the wallet OTP form’s pre-send email input with standard email-field attributes, including `name="email"` and `autoComplete="email"`, plus email keyboard/autocorrect hints.
- Added a focused OTP form test to lock in the expected email semantics before passcode submission.
- Updated the functional and technical specs to document the browser-recognizable auth email field behaviour.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/forms/OTPForm.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/forms/OTPForm.tsx app/tcoin/wallet/components/forms/OTPForm.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/forms/OTPForm.tsx`
- `app/tcoin/wallet/components/forms/OTPForm.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.84
### Timestamp
- 2026-03-31 14:32:13 EDT

### Objective
- Restore a mobile path to transaction history now that the compact footer omits the dedicated History tab on small screens.

### What Changed
- Added a small-screen-only History button to the More tab so mobile users can still reach transaction history from the authenticated wallet overflow menu.
- Passed the dashboard tab-navigation callback into `MoreTab`, keeping the new mobile History action aligned with the existing URL-backed tab routing.
- Updated the functional and technical specs to document the mobile overflow behaviour.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/dashboard/page.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/dashboard/page.tsx`

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.83
### Timestamp
- 2026-03-31 14:29:51 EDT

### Objective
- Make the authenticated wallet send and receive tabs use the full dashboard workspace width on large screens.

### What Changed
- Removed the nested width cap from the send tab so the payment form now expands across the same signed-in content column as the rest of the wallet dashboard.
- Removed the nested width cap from the receive tab so request and QR surfaces no longer render slightly narrower than adjacent authenticated tabs.
- Updated the functional and technical specs to document the full-width authenticated send/receive layout behaviour.

### Verification
- `pnpm exec eslint app/tcoin/wallet/components/dashboard/SendCard.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- Browser route checks on `http://127.0.0.1:3002/dashboard?tab=send` and `http://127.0.0.1:3002/dashboard?tab=receive` confirmed both deep links still resolve cleanly in signed-out preview mode; no authenticated local session was available to visually exercise the widened tabs.

### Files Edited
- `app/tcoin/wallet/components/dashboard/SendCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.82
### Timestamp
- 2026-03-31 13:55:13 EDT

### Objective
- Clean up the local smoke-test blockers on wallet routes so signed-out preview mode stops generating avoidable runtime noise and React DOM warnings.

### What Changed
- Added a signed-out wallet preview state on `/dashboard` so local-dev bypass no longer mounts authenticated wallet tabs and their protected edge requests before a user signs in.
- Scoped Cubid wallet runtime providers to authenticated non-public wallet routes, which suppresses WalletConnect boot on public and signed-out preview pages.
- Updated the shared `Input` component to strip legacy presentation props such as `label` and `elSize` before they hit the DOM.
- Added a simple app icon so the local app no longer requests a missing favicon by default.
- Extended the dashboard test coverage to assert the new signed-out preview behaviour.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/dashboard/page.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/dashboard/page.tsx app/tcoin/wallet/dashboard/page.test.tsx app/tcoin/wallet/layout.tsx shared/components/ui/Input.tsx`
- Browser smoke pass on `http://127.0.0.1:3000/dashboard` confirmed the signed-out dashboard preview renders with `0` console errors and only existing dev warnings.

### Files Edited
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/dashboard/page.test.tsx`
- `app/tcoin/wallet/layout.tsx`
- `shared/components/ui/Input.tsx`
- `app/icon.svg`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.81
### Timestamp
- 2026-03-27 01:54:59 EDT

### Objective
- Reimagine the authenticated Toronto Coin wallet experience so it feels sleeker, simpler, and more familiar to novice users while leaving the public wallet pages unchanged.

### What Changed
- Added a dedicated authenticated wallet shell with scoped theme tokens, calmer light/dark palettes, and a frosted-surface visual system that applies only to signed-in wallet routes.
- Refactored the authenticated navbar and wallet footer navigation into lighter, pill-based controls with clearer scan/account affordances.
- Restructured the wallet dashboard around a summary-first home screen with a stronger account overview, explicit quick actions, recent contacts, and simplified supporting panels.
- Restyled the authenticated send, receive, contacts, history, more, contributions, and contact-profile surfaces to share the same bank-style interaction language without changing their underlying data contracts.
- Updated the functional and technical specs to document the new authenticated-shell separation from the public wallet pages.

### Verification
- `pnpm install --frozen-lockfile`
- `pnpm exec vitest run app/tcoin/wallet/dashboard/page.test.tsx app/tcoin/wallet/components/DashboardFooter.test.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx`
- `pnpm exec eslint app/tcoin/wallet/dashboard/page.tsx app/tcoin/wallet/components/DashboardFooter.tsx app/tcoin/wallet/components/navbar/Navbar.tsx app/tcoin/wallet/components/dashboard/authenticated-ui.tsx app/tcoin/wallet/components/dashboard/WalletHome.tsx app/tcoin/wallet/components/dashboard/AccountCard.tsx app/tcoin/wallet/components/dashboard/SendCard.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.tsx app/tcoin/wallet/components/dashboard/ContactsTab.tsx app/tcoin/wallet/components/dashboard/ContributionsCard.tsx app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/components/dashboard/TransactionHistoryTab.tsx 'app/tcoin/wallet/dashboard/contacts/[id]/page.tsx' app/tcoin/wallet/ContentLayout.tsx`
- `pnpm lint`

### Files Edited
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/wallet/styles/app.scss`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/components/dashboard/authenticated-ui.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `app/tcoin/wallet/components/dashboard/SendCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
- `app/tcoin/wallet/components/dashboard/ContributionsCard.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/TransactionHistoryTab.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.80
### Timestamp
- 2026-03-26 00:14:52 EDT

### Objective
- Refresh the wallet landing page dark-mode banner so the header uses the new Supabase-hosted Toronto Coin artwork.

### What Changed
- Updated the shared default `TCOIN_BANNER_DARK_URL` asset to `tcoin-banner-dark-mode-2.jpeg`.
- Amended the wallet functional and technical specs so they describe the refreshed dark-mode banner asset instead of the older cache-busting wording.

### Verification
- `rg -n "tcoin-banner-dark-mode-2\\.jpeg|tcoin-banner-dark-mode\\.png" shared/lib/supabase/assets.ts docs/engineering/technical-spec.md docs/engineering/functional-spec.md`

### Files Edited
- `shared/lib/supabase/assets.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.79
### Timestamp
- 2026-03-25 15:20:14 EDT

### Objective
- Address the inline PR review comments on `#60`, including the onramp webhook security gap, TorontoCoin/Sarafu ops doc issues, and the remaining runtime consistency issues called out in review.

### What Changed
- Fixed Foundry/deploy hygiene noted in review:
  - aligned `DeployCityImplementationRegistry.s.sol` to `pragma solidity ^0.8.24`
  - narrowed `contracts/foundry/.gitignore` so checked-in deployment manifests are no longer hidden by a broad `deployments/**` ignore rule
  - added a zero-address guard to `MintableTestReserveToken` owner initialization
- Cleaned the runbooks:
  - removed absolute local filesystem paths from `docs/engineering/torontocoin-ops-runbook.md`
  - corrected the registry deployment runbook to use `pnpm` and the actual Foundry RPC aliases (`celo-mainnet`, `ethereum-sepolia`, `celo-sepolia`)
- Unified the wallet transaction-history client usage around the canonical `wallet-operations` response shape (`transactions[]` with camelCase fields), updating both wallet contact surfaces to consume the same contract.
- Restored the `citySlug` passthrough on `/api/vouchers/route` so the compatibility proxy preserves explicit caller context instead of silently dropping it.
- Closed the webhook trust gap on the Supabase `onramp` edge function by requiring a shared forwarding secret on `/webhooks/transak`, and updated the Next.js webhook ingress to forward that secret only after Transak signature verification succeeds.
- Aligned TorontoCoin onramp preview behaviour with execution by using the deposit wallet as the preview buyer identity, matching the signer that actually submits `buyCplTcoin(...)`.
- Added or updated tests for the voucher route proxy, the webhook forwarding secret, and the edge onramp webhook dispatch path.

### Verification
- `pnpm lint`
- `pnpm test`
- `pnpm exec tsc --noEmit -p tsconfig.ci.json`
- `pnpm build`

### Deployer Balance
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- Start balance: `5.922180920672106578 CELO`
- End balance: `5.922180920672106578 CELO`
- Total spent: `0 CELO`

### Files Edited
- `contracts/foundry/script/deploy/DeployCityImplementationRegistry.s.sol`
- `contracts/foundry/.gitignore`
- `contracts/foundry/src/torontocoin/MintableTestReserveToken.sol`
- `docs/engineering/torontocoin-ops-runbook.md`
- `docs/engineering/city-contract-version-registry-implementation.md`
- `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
- `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx`
- `app/api/vouchers/route/route.ts`
- `app/api/vouchers/route/route.test.ts`
- `app/api/onramp/webhooks/transak/route.ts`
- `app/api/onramp/webhooks/transak/route.test.ts`
- `supabase/functions/onramp/index.ts`
- `supabase/functions/onramp/index.test.ts`
- `supabase/functions/_shared/onramp.ts`
- `.env.local.example`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.78
### Timestamp
- 2026-03-25 14:51:37 EDT

### Objective
- Fix the new Supabase edge-boundary CI guard so it passes on GitHub runners that do not have `rg` installed, then rerun the PR validation suite for the open `dev` PR.

### What Changed
- Updated `scripts/check-no-direct-supabase-db.mjs` so it still prefers `rg --files` locally, but now falls back to a pure Node.js recursive directory walk when `rg` is unavailable.
- Kept the same guarded path scope and allowlist semantics, so the boundary policy is unchanged; only the file-discovery implementation is more portable across CI environments.
- Recorded the guardrail expectation in the specs: lint-time boundary checks must not depend on optional developer-only binaries being present on the runner.
- Fixed follow-on CI type errors that the local `next build` path does not surface:
  - corrected the `getWalletContacts(...)` caller in `shared/api/services/supabaseService.ts` to pass a plain `AppScopeInput`
  - made the legacy Cubid data cast explicit through `unknown`
  - removed `bigint` exponentiation from `shared/lib/contracts/torontocoinPools.ts` so the CI TypeScript target accepts the code
  - tightened tracked-pool filtering and replaced the direct `readContract(getQuote)` call with encoded `eth_call` handling so the Sarafu pool quote check typechecks cleanly

### Verification
- `pnpm lint`
- `pnpm test`
- `pnpm exec tsc --noEmit -p tsconfig.ci.json`
- `pnpm build`

### Deployer Balance
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- Start balance: `5.922180920672106578 CELO`
- End balance: `5.922180920672106578 CELO`
- Total spent: `0 CELO`

### Files Edited
- `scripts/check-no-direct-supabase-db.mjs`
- `shared/api/services/supabaseService.ts`
- `shared/lib/contracts/torontocoinPools.ts`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.77
### Timestamp
- 2026-03-23 20:35:00 EDT

### Objective
- Deploy the updated governance helper contracts to Celo mainnet and repoint the live `Governance` contract so the first-class `addPoolWithAddress(...)` path is available on the current live suite without replacing governance itself.

### What Changed
- Confirmed again that the live `Governance` contract is a direct deployment, not a proxy, so the practical live upgrade surface is its helper pointers rather than the governance address itself.
- Deployed the updated mainnet helper contracts:
  - new `GovernanceProposalHelper`: `0x79b0CC5f5AA657d1dd863D5447f3046EC62F62D3`
  - new `GovernanceExecutionHelper`: `0x505209d667A81c5bc412E5B054fe786DDa56c98D`
- Updated the live `Governance` helper pointers:
  - `proposalHelper = 0x79b0CC5f5AA657d1dd863D5447f3046EC62F62D3`
  - `executionHelper = 0x505209d667A81c5bc412E5B054fe786DDa56c98D`
  - `routerProposalHelper` remains unchanged at `0x1814e7fE88ccfa1e08Db589Ed41994bE15dB76D6`
- Verified the new first-class selector is reachable through the live governance fallback by estimating `proposePoolAddWithAddress(...)` directly against the governance address from the live steward/deployer account.
- Updated the checked-in live suite artefact so `contracts/foundry/deployments/torontocoin/celo-mainnet/suite.json` now reflects the current on-chain helper addresses.

### Verification
- `cast call 0x0Ae274e0898499C48832149266A6625a4D20c581 "proposalHelper()(address)" --rpc-url https://forno.celo.org`
- `cast call 0x0Ae274e0898499C48832149266A6625a4D20c581 "executionHelper()(address)" --rpc-url https://forno.celo.org`
- `cast estimate --from 0x1B7489bE5C572041b682749F7B25B84E30cF9271 0x0Ae274e0898499C48832149266A6625a4D20c581 "proposePoolAddWithAddress(bytes32,string,string,address,uint64)" 0x746573742d706f6f6c2d776974682d6164647265737300000000000000000000 "Test Pool" "test-pool" 0x000000000000000000000000000000000000c0Fe 60 --rpc-url https://forno.celo.org`

### Deployer Balance
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- Start balance: `6.092195950936303558 CELO`
- End balance: `5.922180920672106578 CELO`
- Total spent: `0.170015030264196980 CELO`
- Cost breakdown:
  - deploy new `GovernanceExecutionHelper`: `0.138873920752562916 CELO`
  - deploy new `GovernanceProposalHelper`: `0.029957471914954688 CELO`
  - set live `proposalHelper`: `0.000727882025050860 CELO`
  - set live `executionHelper`: `0.000455755571628516 CELO`

### Files Edited
- `contracts/foundry/deployments/torontocoin/celo-mainnet/suite.json`
- `agent-context/session-log.md`

## v1.76
### Timestamp
- 2026-03-23 20:15:00 EDT

### Objective
- Remove the now-obsolete temporary `GovernancePoolRegistryAdminHelper` after adding the first-class `addPoolWithAddress(...)` governance path.

### What Changed
- Deleted `contracts/foundry/src/torontocoin/GovernancePoolRegistryAdminHelper.sol`.
- Deleted `contracts/foundry/test/unit/torontocoin/GovernancePoolRegistryAdminHelper.t.sol`.
- Confirmed the intended current posture is the first-class `addPoolWithAddress(...)` governance path, not the temporary helper workaround.
- Left the older session-log references in place as historical record, consistent with the append-only session-log policy.

### Verification
- `forge build`
- `rg -n "GovernancePoolRegistryAdminHelper" .`

### Deployer Balance
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- Start balance: `6.092195950936303558 CELO`
- End balance: `6.092195950936303558 CELO`
- Total spent: `0 CELO`

### Files Edited
- `contracts/foundry/src/torontocoin/GovernancePoolRegistryAdminHelper.sol`
- `contracts/foundry/test/unit/torontocoin/GovernancePoolRegistryAdminHelper.t.sol`
- `agent-context/session-log.md`

## v1.75
### Timestamp
- 2026-03-23 20:05:00 EDT

### Objective
- Add a first-class `addPoolWithAddress(...)` path to TorontoCoin `PoolRegistry` and governance so future deployments do not need the temporary pool-address helper, then verify whether the current live `PoolRegistry` and `Governance` can be upgraded in place.

### What Changed
- Added `addPoolWithAddress(bytes32 poolId, string name, string metadataRecordId, address poolAddress)` to `contracts/foundry/src/torontocoin/PoolRegistry.sol` and `contracts/foundry/src/torontocoin/interfaces/IPoolRegistry.sol`.
- Refactored `PoolRegistry` internals so:
  - `addPool(...)` and `addPoolWithAddress(...)` share one `_addPool(...)` path
  - canonical address binding still flows through one `_setPoolAddress(...)` path
  - future bootstrap and operator flows can add and bind a pool in one transaction without changing runtime semantics
- Added first-class governance support for that path across:
  - `contracts/foundry/src/torontocoin/Governance.sol`
  - `contracts/foundry/src/torontocoin/GovernanceProposalHelper.sol`
  - `contracts/foundry/src/torontocoin/GovernanceExecutionHelper.sol`
- Updated `contracts/foundry/script/deploy/DeployTorontoCoinSuite.s.sol` so fresh deployments now bootstrap the canonical Sarafu pool through `addPoolWithAddress(...)` instead of `addPool(...)` plus `setPoolAddress(...)`.
- Extended unit coverage:
  - `contracts/foundry/test/unit/torontocoin/PoolRegistry.t.sol` now proves `addPoolWithAddress(...)` sets the canonical address mapping immediately
  - `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol` now proves the new governance proposal path carries the pool address payload through execution
- Verified the live mainnet deployment shape:
  - live `PoolRegistry` at `0x3e9926Ff48b84f6E625E833219353b9cfb473A74` is a direct deployment, not a proxy
  - live `Governance` at `0x0Ae274e0898499C48832149266A6625a4D20c581` is a direct deployment, not a proxy
  - both EIP-1967 implementation/admin slots are zero on the live governance address
- Conclusion: future deployments no longer need the helper, but the current mainnet suite cannot be upgraded in place. Migrating the live suite to the new first-class path would require a controlled replacement of `PoolRegistry` and `Governance`, not an in-place upgrade transaction.

### Verification
- `forge test --match-path test/unit/torontocoin/PoolRegistry.t.sol`
- `forge test --match-path test/unit/torontocoin/GovernanceDeadline.t.sol`
- `forge build`
- `cast storage 0x0Ae274e0898499C48832149266A6625a4D20c581 0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC --rpc-url https://forno.celo.org`
- `cast storage 0x0Ae274e0898499C48832149266A6625a4D20c581 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103 --rpc-url https://forno.celo.org`

### Deployer Balance
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- Start balance: `6.092195950936303558 CELO`
- End balance: `6.092195950936303558 CELO`
- Total spent: `0 CELO`

### Files Edited
- `contracts/foundry/src/torontocoin/interfaces/IPoolRegistry.sol`
- `contracts/foundry/src/torontocoin/PoolRegistry.sol`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/GovernanceProposalHelper.sol`
- `contracts/foundry/src/torontocoin/GovernanceExecutionHelper.sol`
- `contracts/foundry/script/deploy/DeployTorontoCoinSuite.s.sol`
- `contracts/foundry/test/unit/torontocoin/PoolRegistry.t.sol`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.74
### Timestamp
- 2026-03-23 19:25:00 EDT

### Objective
- Register the live Sarafu pool at `0xA6f024Ad53766d332057d5e40215b695522ee3dE` in the TorontoCoin mainnet `PoolRegistry` and close the governance admin gap that currently prevents `setPoolAddress(...)` from being executed through the native proposal surface.

### What Changed
- Added `contracts/foundry/src/torontocoin/GovernancePoolRegistryAdminHelper.sol` as a narrow governance fallback helper that preserves the normal proposal surface and adds only the missing `setPoolAddress(bytes32,address)` admin call through `Governance.delegatecall`.
- Added `contracts/foundry/test/unit/torontocoin/GovernancePoolRegistryAdminHelper.t.sol` to prove that, once `PoolRegistry` ownership/governance are held by the `Governance` contract, the helper can update a registered pool address through the governance fallback path and have `PoolRegistry` accept the call from `Governance`.
- Broadcast the helper to Celo mainnet at `0x9886f6034A1cdcE73C21602Ec9acd928593bbA05`, temporarily pointed `Governance.proposalHelper` at it, and restored the original helper at `0xEDAFCef37590305709E174787AB59D347B7BA8E6` after registration.
- Registered the pool id `0x746f726f6e746f2d63697263756c61722d65636f6e6f6d790000000000000000` with the name `Toronto's Circular Economy` and metadata record id `0xA6f024Ad53766d332057d5e40215b695522ee3dE` through the normal governance proposal flow:
  - proposal `1` expired because a `1` second voting window was too short on live Celo mainnet
  - proposal `2` succeeded with a `60` second window, then executed cleanly
- Bound the registered pool id to the live Sarafu `SwapPool` at `0xA6f024Ad53766d332057d5e40215b695522ee3dE` through the temporary helper, then verified:
  - `PoolRegistry.listPoolIds()` now returns both the bootstrap pool and `toronto-circular-economy`
  - `PoolRegistry.getPoolAddress(poolId)` returns `0xA6f024Ad53766d332057d5e40215b695522ee3dE`
  - `PoolRegistry.isRegisteredPoolAddress(0xA6f024Ad53766d332057d5e40215b695522ee3dE)` returns `true`
- Re-ran the TorontoCoin ops scripts. They now discover two tracked pools on mainnet. The newly added pool is registered and fee-bypass eligible, but its preview path still fails because it currently has zero `mrTCOIN` and zero `cplTCOIN` liquidity from TorontoCoin’s point of view.
- Added a technical/functional spec note that the current governance surface still lacks a native `setPoolAddress` proposal path, so manual external-pool registration presently requires the temporary helper pattern until governance grows a first-class proposal type for pool-address binding.

### Verification
- `forge test --match-path test/unit/torontocoin/GovernancePoolRegistryAdminHelper.t.sol`
- `forge build`
- `cast call 0x3e9926Ff48b84f6E625E833219353b9cfb473A74 "listPoolIds()(bytes32[])" --rpc-url https://forno.celo.org`
- `cast call 0x3e9926Ff48b84f6E625E833219353b9cfb473A74 "getPoolAddress(bytes32)(address)" 0x746f726f6e746f2d63697263756c61722d65636f6e6f6d790000000000000000 --rpc-url https://forno.celo.org`
- `cast call 0x3e9926Ff48b84f6E625E833219353b9cfb473A74 "isRegisteredPoolAddress(address)(bool)" 0xA6f024Ad53766d332057d5e40215b695522ee3dE --rpc-url https://forno.celo.org`
- `pnpm exec tsx scripts/torontocoin-ops-check.ts`
- `pnpm exec tsx scripts/torontocoin-pool-compatibility-check.ts`

### Deployer Balance
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- Start balance: `6.247118087577593885 CELO`
- End balance: `6.092195950936303558 CELO`
- Total spent: `0.154922136641290327 CELO`
- Cost breakdown:
  - deploy temporary governance helper: `0.126075745339579093 CELO`
  - set temporary proposal helper: `0.000727882025341772 CELO`
  - first expired pool-add proposal: `0.007998831340745289 CELO`
  - second pool-add proposal: `0.007190591371524778 CELO`
  - steward vote on successful proposal: `0.003003682155959716 CELO`
  - execute successful proposal: `0.006903946470927356 CELO`
  - bind pool address through helper: `0.002293575912074349 CELO`
  - restore original proposal helper: `0.000727882025137974 CELO`

### Files Edited
- `contracts/foundry/src/torontocoin/GovernancePoolRegistryAdminHelper.sol`
- `contracts/foundry/test/unit/torontocoin/GovernancePoolRegistryAdminHelper.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.73
### Timestamp
- 2026-03-23 01:10:00 EDT

### Objective
- Expand TorontoCoin Sarafu compatibility monitoring beyond the bootstrap pool by making the runtime, ops surface, indexer status, and operator scripts work against the live set of pools already registered in `PoolRegistry`.

### What Changed
- Extended `shared/lib/contracts/torontocoinRuntime.ts` with configured tracked-pool metadata for the canonical bootstrap pool and added a shared `TrackedTorontoCoinPool` type for runtime consumers.
- Added `shared/lib/contracts/torontocoinPools.ts` as the new shared TorontoCoin pool-matrix helper. It now:
  - resolves live registered pool ids and addresses from `PoolRegistry`
  - merges them with the configured bootstrap pool
  - reads real Sarafu `SwapPool` components (`tokenRegistry`, `tokenLimiter`, `quoter`, `feePpm`, owner)
  - collects token balances, limiter limits, price-index values, quote checks, and router preview readiness per pool
- Refactored `shared/lib/contracts/torontocoinOps.ts` from a bootstrap-only summary into a broader core status contract with:
  - live address summary
  - governance ownership checks
  - reserve-route health
  - a per-pool compatibility matrix
- Extended `app/api/tcoin/ops/status/route.ts` so the operator payload now merges the on-chain TorontoCoin matrix with TorontoCoin-specific indexer tracking state from `getIndexerScopeStatus(...)`.
- Updated `app/tcoin/wallet/admin/page.tsx` so the admin dashboard now renders a pool-by-pool TorontoCoin ops matrix instead of a single bootstrap-liquidity summary.
- Refactored indexer TorontoCoin assumptions beyond the bootstrap pool:
  - `services/indexer/src/discovery/pools.ts` now includes live TorontoCoin-registered Sarafu pools from `PoolRegistry` in discovery, even when they would not be reached by plain token-overlap heuristics alone
  - `services/indexer/src/index.ts` now reports TorontoCoin tracking per pool instead of only `bootstrapPoolTracked`
  - `services/indexer/src/types.ts` and `shared/lib/indexer/types.ts` now model that richer per-pool tracking payload
- Added new operator scripts and package commands:
  - `pnpm ops:torontocoin`
  - `pnpm ops:torontocoin:pools`
  - `pnpm ops:torontocoin:acceptance`
- Added `tsx` as a dev dependency so those checked-in TypeScript scripts can execute with repo path aliases and `.ts` imports intact.
- Updated the TorontoCoin ops runbook plus the technical and functional specs to document the new live registered-pool compatibility posture.

### Verification
- `pnpm test`
- `pnpm lint`
- `pnpm build`
- `pnpm exec tsx scripts/torontocoin-ops-check.ts`
- `pnpm exec tsx scripts/torontocoin-pool-compatibility-check.ts`
- `pnpm exec tsx scripts/torontocoin-pool-acceptance.ts`

### Files Edited
- `shared/lib/contracts/torontocoinRuntime.ts`
- `shared/lib/contracts/torontocoinPools.ts`
- `shared/lib/contracts/torontocoinOps.ts`
- `services/indexer/src/config.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/types.ts`
- `services/indexer/src/discovery/abis.ts`
- `services/indexer/src/discovery/pools.ts`
- `services/indexer/src/discovery/cityContracts.ts`
- `shared/lib/indexer/types.ts`
- `app/api/tcoin/ops/status/route.ts`
- `app/api/tcoin/ops/status/route.test.ts`
- `app/tcoin/wallet/admin/page.tsx`
- `shared/lib/contracts/torontocoinRuntime.test.ts`
- `scripts/torontocoin-ops-check.ts`
- `scripts/torontocoin-pool-compatibility-check.ts`
- `scripts/torontocoin-pool-acceptance.ts`
- `package.json`
- `pnpm-lock.yaml`
- `docs/engineering/torontocoin-ops-runbook.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.72
### Timestamp
- 2026-03-23 00:20:00 EDT

### Objective
- Clear the stale Next.js build warnings caused by the indexer importing required TorontoCoin pool/token constants from the wrong module, and confirm how the indexer is actually hosted in the app runtime.

### What Changed
- Fixed `services/indexer/src/index.ts` so `REQUIRED_POOL_ADDRESSES` and `REQUIRED_TCOIN_TOKEN` are imported from `services/indexer/src/config.ts` instead of `services/indexer/src/state/runControl.ts`.
- Confirmed the indexer is not a Supabase edge function and not a Supabase function at all. It is a server-side TypeScript service under `services/indexer/src` that runs inside the Next.js app runtime and is invoked through:
  - `POST /api/indexer/touch`
  - `GET /api/indexer/status`
- Re-ran lint autofix, tests, and build after the import fix. `next lint --fix` left existing warnings untouched because they are not auto-fixable, while the stale indexer build warnings disappeared.

### Verification
- `pnpm exec next lint --fix`
- `pnpm test`
- `pnpm build`

### Files Edited
- `services/indexer/src/index.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.71
### Timestamp
- 2026-03-22 23:58:00 EDT

### Objective
- Finish the Supabase edge-function migration so wallet/sparechange app runtime and retained DB-backed Next routes no longer own direct Supabase table or RPC logic.

### What Changed
- Extended the shared `user-settings` edge function to own the remaining authenticated bootstrap/profile and custody endpoints:
  - `POST /auth/ensure-user`
  - `GET /personas`
  - `POST /wallet/register-custody`
  - `GET /wallet/custody-material`
  - legacy Cubid data read/write compatibility endpoints
- Added a new `wallet-operations` edge function plus typed client wrappers for:
  - contacts
  - contact connection/state changes
  - recents
  - transaction history
  - contact transaction history
  - user lookup by identifier
  - transfer recording
  - user/admin notifications
- Added a new `voucher-runtime` edge function plus typed client wrappers for:
  - portfolio reads
  - voucher route reads
  - payment-record writes
- Extended existing edge domains so the remaining DB mutations moved behind canonical function boundaries:
  - `onramp` now owns legacy Interac reference/confirm flows, pool purchase request creation, admin request edits, and Transak webhook persistence handoff
  - `redemptions` now owns legacy off-ramp request creation and admin edits
  - `merchant-applications` now serves slug availability
  - `store-operations` now serves risk writes
- Refactored wallet and sparechange runtime surfaces to consume the new typed edge clients instead of direct `supabase.from(...)` / `supabase.rpc(...)` calls, including:
  - welcome/custody bootstrap
  - contacts and QR connect flows
  - recents and transaction history
  - send-money custody-material recovery
  - legacy top-up/off-ramp mutations
  - voucher runtime flows
  - admin legacy ramp edits
- Converted the retained DB-backed Next routes into compatibility proxies with `proxyEdgeRequest(...)` or explicit edge forwarding, including:
  - `/api/vouchers/portfolio`
  - `/api/vouchers/route`
  - `/api/vouchers/payment-record`
  - `/api/pools/buy`
  - `/api/merchant/slug-availability`
  - `/api/stores/risk`
  - `/api/onramp/webhooks/transak`
- Added `scripts/check-no-direct-supabase-db.mjs` and wired `pnpm lint` to fail when new direct Supabase table/RPC access is introduced in guarded app-facing paths.
- Updated tests so the app now asserts edge-client and route-proxy contracts rather than the retired direct DB logic.

### Verification
- `pnpm lint`
- `pnpm test`

### Files Edited
- `supabase/functions/user-settings/index.ts`
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/wallet-operations/index.ts`
- `supabase/functions/_shared/walletOperations.ts`
- `supabase/functions/voucher-runtime/index.ts`
- `supabase/functions/_shared/voucherRuntime.ts`
- `supabase/functions/onramp/index.ts`
- `supabase/functions/_shared/onramp.ts`
- `supabase/functions/redemptions/index.ts`
- `supabase/functions/_shared/redemptions.ts`
- `supabase/functions/merchant-applications/index.ts`
- `supabase/functions/_shared/merchantApplications.ts`
- `supabase/functions/store-operations/index.ts`
- `supabase/functions/_shared/storeOperations.ts`
- `shared/lib/edge/userSettingsClient.ts`
- `shared/lib/edge/walletOperations.ts`
- `shared/lib/edge/walletOperationsClient.ts`
- `shared/lib/edge/voucherRuntime.ts`
- `shared/lib/edge/voucherRuntimeClient.ts`
- `shared/lib/edge/onrampClient.ts`
- `shared/lib/edge/redemptionsClient.ts`
- `shared/lib/edge/merchantApplicationsClient.ts`
- `shared/lib/edge/storeOperationsClient.ts`
- `shared/api/services/supabaseService.ts`
- `shared/api/services/supabaseService.test.ts`
- `shared/utils/insertNotification.ts`
- `app/api/pools/buy/route.ts`
- `app/api/pools/buy/route.test.ts`
- `app/api/vouchers/route/route.ts`
- `app/api/vouchers/route/route.test.ts`
- `app/api/vouchers/portfolio/route.ts`
- `app/api/vouchers/payment-record/route.ts`
- `app/api/merchant/slug-availability/route.ts`
- `app/api/stores/risk/route.ts`
- `app/api/onramp/webhooks/transak/route.ts`
- `app/api/onramp/webhooks/transak/route.test.ts`
- `app/tcoin/wallet/**`
- `app/tcoin/sparechange/**`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.70
### Timestamp
- 2026-03-22 21:05:00 EDT

### Objective
- Switch the app runtime onto the fresh Celo mainnet TorontoCoin suite for wallet buy, transfer, merchant-payment, indexer, and operator visibility flows while preserving the legacy city-registry path for older contract-management surfaces.

### What Changed
- Added a canonical TorontoCoin app-runtime bridge in `shared/lib/contracts/torontocoinRuntime.ts`, backed by the fresh Celo mainnet deployment artefacts rather than legacy city-registry resolution or `deploy-config.json`.
- Added a TorontoCoin ops status helper in `shared/lib/contracts/torontocoinOps.ts`, a read-only API route at `app/api/tcoin/ops/status/route.ts`, a terminal operator script at `scripts/torontocoin-ops-check.ts`, and a concise runbook at `docs/engineering/torontocoin-ops-runbook.md`.
- Switched wallet-facing TCOIN runtime consumers to the live `cplTCOIN` address and `6`-decimal token settings:
  - `shared/hooks/useTokenBalance.ts`
  - `shared/hooks/useSendMoney.tsx`
  - `app/api/pools/buy/route.ts`
  - wallet dashboard buy copy
- Switched buy/onramp settlement from the legacy mint-router flow to `LiquidityRouter.previewBuyCplTcoin(...)` and `LiquidityRouter.buyCplTcoin(...)`, with the current runtime bootstrap `poolId` and reserve metadata resolved from the TorontoCoin runtime bridge.
- Extended onramp session/status payloads so they remain backward-compatible while now carrying TorontoCoin-specific delivery metadata:
  - `routerTxHash`
  - `finalTokenAddress`
  - `finalTokenSymbol`
  - `finalTokenDecimals`
  - `poolId`
  - `reserveAssetUsed`
- Updated Transak and wallet buy copy to describe acquiring `cplTCOIN` through the TorontoCoin liquidity router rather than minting TCOIN directly from USDC.
- Updated the indexer configuration so required pool/token tracking now points at the fresh TorontoCoin bootstrap `SwapPool` and live `cplTCOIN`, while still leaving city-registry discovery intact for legacy contract-family reads.
- Added a read-only TorontoCoin ops status card to the wallet admin page covering live addresses, governance ownership checks, bootstrap pool liquidity, canonical scenario preview output, reserve-route health, and validator timestamps.
- Added unit coverage for the runtime loader and ops status route and updated wallet/onramp tests to assert the new `cplTCOIN` runtime path.
- The current automated onramp delivery path still executes the router buy from the service deposit wallet, then forwards resulting `cplTCOIN` to the recipient wallet because the live router settles to `msg.sender`. That caveat is now documented rather than hidden.

### Verification
- `pnpm test`
- `pnpm lint`
- `node --experimental-strip-types scripts/torontocoin-ops-check.ts`

### Files Edited
- `shared/lib/contracts/torontocoinRuntime.ts`
- `shared/lib/contracts/torontocoinOps.ts`
- `app/api/tcoin/ops/status/route.ts`
- `scripts/torontocoin-ops-check.ts`
- `docs/engineering/torontocoin-ops-runbook.md`
- `services/onramp/src/config.ts`
- `services/onramp/src/settlement.ts`
- `shared/hooks/useTokenBalance.ts`
- `shared/hooks/useSendMoney.tsx`
- `services/indexer/src/config.ts`
- `app/tcoin/wallet/admin/page.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.69
### Timestamp
- 2026-03-22 18:35:00 EDT

### Objective
- Deploy a fresh Celo mainnet TorontoCoin suite with the updated `GeneroTokenV3` pool-fee bypass and `PoolRegistry` reverse lookup, then validate the canonical Sarafu `SwapPool` deposit path and bounded `1 USDC -> cplTCOIN` retail smoke on chain.

### What Changed
- Deployed a fresh canonical TorontoCoin suite to Celo mainnet using the current Sarafu-first runtime and `6`-decimal internal token defaults.
- The new live mainnet entrypoints are:
  - `Governance`: `0x0Ae274e0898499C48832149266A6625a4D20c581`
  - `TreasuryController`: `0x5A860da554bf1301708db7c41C4e540135e3FCE4`
  - `LiquidityRouter`: `0x6BBa692FC6b2F7F19a925a11EEbfc4Dd67C424a7`
  - `ReserveInputRouter`: `0xdCD1419C195e95dBe6BD5494597d5aF0568Ba1a3`
  - `SarafuSwapPoolAdapter`: `0x9EBEedA7c8a98fc58775f088A3210fAC781A1e47`
  - `PoolRegistry`: `0x3e9926Ff48b84f6E625E833219353b9cfb473A74`
  - `mrTCOIN`: `0x63ed4CFAD21E9F4a30Ad93a199f382f98CAf59C3`
  - `cplTCOIN`: `0xAEC330E9d808E4e938bf830016c6B2Eb350e1A19`
  - bootstrap `SwapPool`: `0xDe2a979EC49811aD27730e451651e52b4540c594`
- The fresh deploy successfully seeded the bootstrap Sarafu pool through the canonical pool-deposit path. The earlier workaround of minting to the deployer and transferring directly into the pool is no longer required on this suite.
- Re-ran the post-deploy validator after final state settled. The validator now passes against the new suite and confirms:
  - `tokenDecimalsAreSix = true`
  - `governanceWiring = true`
  - `bootstrapPoolReady = true`
  - `scenarioPoolLiquiditySufficient = true`
  - `mentoUsdcRouteConfigured = true`
- Ran the bounded live Scenario B smoke on the fresh suite with `1 USDC` from the deployer wallet. The on-chain result was:
  - reserve used: `999450005010000000`
  - `mrTCOIN` used: `414923183898090909`
  - pool `cplTCOIN` out: `414923183898090908`
  - charity top-up: `12447695516942727`
  - buyer `cplTCOIN` balance after execution: `427370879415033633`
- The refreshed generated deployment artefacts now live under `contracts/foundry/deployments/torontocoin/celo-mainnet/`. By current repo policy they remain runtime outputs rather than checked-in static config; `deploy-config.json` continues to hold only public deployment inputs.

### Deployer Balance Tracker
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- End balance: `6.247118087577593885 CELO`
- Previous tracked session balance: `7.438596040537245886 CELO`
- Delta from previous tracked session: `-1.191477952959652001 CELO`
- Transaction-cost breakdown this session:
  - Fresh Celo mainnet suite deploy batch: `1.160099447387488446 CELO`
  - Live Scenario B smoke batch: `0.031378505572163555 CELO`

### Verification
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/DeployTorontoCoinSuite.s.sol:DeployTorontoCoinSuite --rpc-url https://forno.celo.org --broadcast`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/ValidateTorontoCoinDeployment.s.sol:ValidateTorontoCoinDeployment --rpc-url https://forno.celo.org`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/RunTorontoCoinScenarioB.s.sol:RunTorontoCoinScenarioB --rpc-url https://forno.celo.org --broadcast`
- `cast balance 0x1B7489bE5C572041b682749F7B25B84E30cF9271 --rpc-url https://forno.celo.org`

### Files Edited
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.68
### Timestamp
- 2026-03-22 17:10:00 EDT

### Objective
- Fix the Sarafu `SwapPool.deposit(...)` compatibility gap by making registered pool addresses bypass `GeneroTokenV3` merchant-fee routing through canonical `PoolRegistry` state instead of per-token manual fee-exemption lists.

### What Changed
- Extended `contracts/foundry/src/torontocoin/PoolRegistry.sol` with canonical pool-address lookup:
  - tracks `poolAddress -> poolId`
  - exposes `getPoolIdByAddress(address)`
  - exposes `isRegisteredPoolAddress(address)`
  - clears stale reverse mappings when a pool address changes
- Updated `contracts/foundry/src/torontocoin/GeneroTokenV3.sol` so `feeApplies(...)` now returns `false` for any address that `PoolRegistry` reports as a registered pool before checking merchant POS eligibility.
- Added regressions in `contracts/foundry/test/unit/torontocoin/PoolRegistry.t.sol` for the new reverse lookup and address-replacement behaviour.
- Added a `GeneroTokenV3` regression in `contracts/foundry/test/unit/torontocoin/GeneroTokenV3.t.sol` that mimics the real Sarafu deposit path:
  - the pool is simultaneously linked as a merchant wallet and as a registered pool
  - the pool calls `transferFrom(...)` into itself using an exact allowance
  - no merchant fee is charged because the registered-pool predicate short-circuits first
- Updated the engineering specs to record the new canonical pool-address fee-bypass rule.

### Verification
- `forge test --match-path test/unit/torontocoin/PoolRegistry.t.sol`
- `forge test --match-path test/unit/torontocoin/GeneroTokenV3.t.sol`
- `forge test --match-path test/unit/torontocoin/GeneroTokenV3SarafuCompatibility.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/PoolRegistry.sol`
- `contracts/foundry/src/torontocoin/GeneroTokenV3.sol`
- `contracts/foundry/test/unit/torontocoin/PoolRegistry.t.sol`
- `contracts/foundry/test/unit/torontocoin/GeneroTokenV3.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.67
### Timestamp
- 2026-03-22 16:40:00 EDT

### Objective
- Remove obsolete TorontoCoin managed-pool contracts, migration scripts, and superseded deployment surfaces after the Sarafu-first runtime reset and the fresh-deploy-only six-decimal posture.

### What Changed
- Deleted the obsolete managed-pool execution contract and its stale review artefacts:
  - `contracts/foundry/src/torontocoin/ManagedPoolAdapter.sol`
  - `contracts/foundry/src/torontocoin/ManagedPoolAdapter.md`
  - `contracts/foundry/test/unit/torontocoin/ManagedPoolAdapter.t.sol`
- Deleted the old in-place six-decimal migration script set because that flow targeted the superseded managed-pool architecture and had already been reduced to intentional reverts:
  - `contracts/foundry/script/deploy/TorontoCoinSixDecimalMigrationBase.s.sol`
  - `contracts/foundry/script/deploy/StageTorontoCoinSixDecimalMigration.s.sol`
  - `contracts/foundry/script/deploy/ProposeTorontoCoinSixDecimalMigration.s.sol`
  - `contracts/foundry/script/deploy/FinalizeTorontoCoinSixDecimalMigration.s.sol`
  - `contracts/foundry/script/deploy/AbortTorontoCoinSixDecimalMigration.s.sol`
- Deleted the superseded `contracts/foundry/script/deploy/DeployLiquidityRoutingStack.s.sol` entrypoint because the active deployment surface is now `DeployTorontoCoinSuite.s.sol`.
- Updated the Foundry and TorontoCoin docs so they no longer describe managed-pool execution or deprecated in-place migration tooling as part of the active architecture.
- Updated the engineering specs to reflect the cleaned posture:
  - Sarafu `SwapPool` is the only active pool runtime described in current specs
  - greenfield redeploys are the canonical operational posture
  - the old managed-pool migration path is removed from the repo, not merely deprecated

### Verification
- `forge test`

### Files Edited
- `contracts/foundry/README.md`
- `contracts/foundry/src/torontocoin/README.md`
- `contracts/foundry/src/torontocoin/SarafuSwapPoolAdapter.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

### Files Deleted
- `contracts/foundry/src/torontocoin/ManagedPoolAdapter.sol`
- `contracts/foundry/src/torontocoin/ManagedPoolAdapter.md`
- `contracts/foundry/test/unit/torontocoin/ManagedPoolAdapter.t.sol`
- `contracts/foundry/script/deploy/TorontoCoinSixDecimalMigrationBase.s.sol`
- `contracts/foundry/script/deploy/StageTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/ProposeTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/FinalizeTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/AbortTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/DeployLiquidityRoutingStack.s.sol`

## v1.66
### Timestamp
- 2026-03-22 16:25:00 EDT

### Objective
- Bring the TorontoCoin mainnet deployment and migration tooling in line with the Sarafu `SwapPool` runtime plus `6`-decimal token posture, then complete a fresh Celo mainnet deployment and bounded Scenario B smoke test in the most cost-effective way.

### What Changed
- Deprecated the old staged `6`-decimal migration scripts under `contracts/foundry/script/deploy/` by making them revert intentionally through `TorontoCoinSixDecimalMigrationBase.s.sol`, because they target the superseded `ManagedPoolAdapter` architecture rather than the current Sarafu-pool runtime.
- Updated `DeployTorontoCoinSuite.s.sol` so Sarafu `Limiter` defaults now use the full safe Genero raw-unit ceiling instead of the old `1e12` placeholder, which keeps fresh `6`-decimal bootstrap pools compatible with the still-legacy controller raw-unit output scale.
- Updated the checked-in TorontoCoin deploy config so fresh bootstrap Sarafu pools seed `1e18` raw `cplTCOIN` by default instead of a tiny `1e9` / `5e6` seed that cannot clear the configured retail smoke route.
- Switched the Celo mainnet reserve posture in `deploy-config.json` from `CADm` to `USDm` as the active reserve asset. The current mainnet bounded retail route is therefore `USDC -> USDm -> mrTCOIN -> SwapPool -> cplTCOIN`, while `USDm -> CADm` route metadata remains in config for other environments and future reserve-target changes.
- Tightened `ValidateTorontoCoinDeployment.s.sol` so it no longer stops at “pool exists and has some balance”. It now:
  - previews the configured Scenario B route,
  - computes the bootstrap Sarafu `SwapPool` quote plus fees,
  - fails if the seeded pool cannot actually clear that smoke path,
  - records the required `cplTCOIN` liquidity in `validation.json`.
- Deployed two fresh Sarafu-pool-aligned TorontoCoin suites on Celo mainnet this session:
  - the first greenfield deploy proved the original `CADm`-backed mainnet reserve route was not smoke-safe because live `USDm -> CADm` quoting failed with `no valid median`,
  - the second greenfield deploy, using `USDm` as the active reserve asset, became the canonical fresh mainnet suite.
- The current canonical fresh mainnet suite addresses are:
  - `Governance`: `0xF123231dcAc7908B7b0DdbE704DA99d38B690D66`
  - `TreasuryController`: `0x3858537E4EC14eF47AF883aDAB4c0C353Dfbc3D9`
  - `LiquidityRouter`: `0xFA0AA07a1c22d938E7bD2AA0e25E5539A220C367`
  - `ReserveInputRouter`: `0xec32Aaa2fD15Cd6cD0C0b862e4B0dbE696375b5F`
  - `SarafuSwapPoolAdapter`: `0x4f318dDCb61189857C0280Fd65A4f8c196F74a59`
  - `MentoBrokerSwapAdapter`: `0x13387d31713dE1B64a31167fCDDB3c28A377DF0C`
  - `ReserveRegistry`: `0x1dE6e888B83cA130e7be6b2b35af503B4726725c`
  - `PoolRegistry`: `0x9397d14E83a6DD4ca0b540fb7c587C00723D97DC`
  - `Treasury`: `0xB872569930d8624494FE75CCf45E9c3A10c6D72b`
  - `mrTCOIN`: `0xf1eb1436034DFdDD3C31851120CfabEa05fF3910`
  - `cplTCOIN`: `0x2e1008Ae6506852578c5Ec3475B21B2A4b9ceFaD`
  - bootstrap `SwapPool`: `0x6cd584E9b3ed40618c2B2E9FD3F998174487dB04`
- Reused that second fresh suite rather than paying for a third redeploy. To make the bounded smoke pass, I applied the minimum compatible live fixes:
  - raised the bootstrap Sarafu `Limiter` caps for both `mrTCOIN` and `cplTCOIN` to `5e18` raw,
  - temporarily added the deployer as a `cplTCOIN` writer,
  - minted fresh `cplTCOIN` to the deployer and transferred it into the bootstrap `SwapPool`,
  - ran the live bounded Scenario B buy with `1 USDC`,
  - revoked the temporary deployer writer role afterward.
- The bounded mainnet Scenario B smoke is now successful on the fresh suite:
  - input: `1 USDC`
  - normalized reserve used: `999542988495000000` raw `USDm`
  - `mrTCOIN` used: `414961786132772727`
  - pool `cplTCOIN` out: `414961786132772726`
  - charity top-up: `12448853583983181`
  - deployer `cplTCOIN` balance delta captured in `scenario-b-run.json`
  - remaining bootstrap pool balances after smoke:
    - `cplTCOIN`: `585035732367737225`
    - `mrTCOIN`: `414961398014828642`

### Deployer Balance Tracker
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- End balance: `7.438596040537245886 CELO`
- Previous tracked session balance: `9.797287038945049075 CELO`
- Delta from previous tracked session: `-2.358690998407803189 CELO`
- Transaction-cost breakdown this session:
  - First fresh Celo mainnet Sarafu-pool suite deploy plus failed `CADm`-backed retail smoke attempt: `1.159319276245643200 CELO`
  - Second fresh Celo mainnet Sarafu-pool suite deploy plus pre-fix insufficient-liquidity smoke attempt: `1.159341949387073801 CELO`
  - Live limiter/top-up/successful-smoke/cleanup transactions on the canonical fresh suite: `0.040029772775086188 CELO`
  - Recent live fix breakdown:
    - `Limiter.setLimitFor(cplTCOIN, bootstrapSwapPool, 5e18)`: `0.000808335564779684 CELO`
    - `Limiter.setLimitFor(mrTCOIN, bootstrapSwapPool, 5e18)`: `0.000808335564779684 CELO`
    - `cplTCOIN.addWriter(deployer)`: `0.001245173996454050 CELO`
    - `cplTCOIN.mintTo(deployer, 1e18)`: `0.002369561693655118 CELO`
    - `cplTCOIN.approve(bootstrapSwapPool, 1e18)`: `0.001744211653805056 CELO`
    - `cplTCOIN.transfer(bootstrapSwapPool, 999999000000000000)`: `0.002078341441919310 CELO`
    - Scenario B `USDC.approve(liquidityRouter, 1e6)`: `0.001385985979979319 CELO`
    - Scenario B `LiquidityRouter.buyCplTcoin(...)`: `0.028916872271363888 CELO`
    - `cplTCOIN.deleteWriter(deployer)`: `0.000672954608350079 CELO`

### Verification
- `forge build`
- `forge test`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/DeployTorontoCoinSuite.s.sol:DeployTorontoCoinSuite --rpc-url https://forno.celo.org --broadcast`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/ValidateTorontoCoinDeployment.s.sol:ValidateTorontoCoinDeployment --rpc-url https://forno.celo.org`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/RunTorontoCoinScenarioB.s.sol:RunTorontoCoinScenarioB --rpc-url https://forno.celo.org --broadcast`
- `cast balance 0x1B7489bE5C572041b682749F7B25B84E30cF9271 --rpc-url https://forno.celo.org`
- `cast call 0x2e1008Ae6506852578c5Ec3475B21B2A4b9ceFaD 'balanceOf(address)(uint256)' 0x6cd584E9b3ed40618c2B2E9FD3F998174487dB04 --rpc-url https://forno.celo.org`
- `cast call 0xf1eb1436034DFdDD3C31851120CfabEa05fF3910 'balanceOf(address)(uint256)' 0x6cd584E9b3ed40618c2B2E9FD3F998174487dB04 --rpc-url https://forno.celo.org`

### Files Edited
- `contracts/foundry/deploy-config.json`
- `contracts/foundry/script/deploy/DeployTorontoCoinSuite.s.sol`
- `contracts/foundry/script/deploy/ValidateTorontoCoinDeployment.s.sol`
- `contracts/foundry/script/deploy/TorontoCoinSixDecimalMigrationBase.s.sol`
- `contracts/foundry/script/deploy/StageTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/ProposeTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/FinalizeTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/AbortTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/README.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.65
### Timestamp
- 2026-03-20 17:13:00 EDT

### Objective
- Simplify the Mermaid chart skill so local HTML preview is the only validation path and make the skill validator work without temporary dependency shims.

### What Changed
- Removed the optional `mermaid.ai` hosted-editor refinement path from the local `mermaid-chart` skill instructions and browser reference notes.
- Tightened the skill guidance so local HTML preview plus browser screenshot export is now the sole refinement workflow.
- Installed `PyYAML 6.0.3` into the user Python site-packages so `quick_validate.py` runs directly in future sessions.
- Updated the repo engineering notes to describe the Mermaid workflow as local-preview-first.

### Verification
- `python3 -m pip show pyyaml`
- `python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py ~/.codex/skills/mermaid-chart`

### Files Edited
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.65
### Timestamp
- 2026-03-20 21:55:00 EDT

### Objective
- Revert the TorontoCoin retail architecture back toward the original Sarafu pool vision by replacing the custom managed-inventory runtime with real Sarafu `SwapPool` execution, while keeping the reserve-backed treasury path and validating that `GeneroTokenV3` can still participate in Sarafu pool flows.

### What Changed
- Added `SarafuSwapPoolAdapter.sol` as the thin production-facing pool adapter for TorontoCoin. It no longer owns inventory or quote state; instead it resolves a real Sarafu `SwapPool` address from `PoolRegistry`, previews output through `SwapPool.getQuote(...)`, and executes `mrTCOIN -> cplTCOIN` by calling `SwapPool.withdraw(...)`.
- Refactored `LiquidityRouter.sol` so pool selection is now caller-supplied and off-chain driven. The router no longer ranks pools on-chain; it validates the chosen `poolId` against user acceptance preferences, normalizes reserve input, settles reserve through `TreasuryController`, then executes against the selected Sarafu pool through the adapter.
- Re-scoped `PoolRegistry.sol` toward identity and allowlisting by adding explicit `poolId -> poolAddress` support. Merchant-to-pool mapping remains, but pool runtime state is no longer assumed to live in a TorontoCoin-managed inventory contract.
- Refactored the greenfield TorontoCoin deployment scripts to bootstrap Sarafu-native pool infrastructure for the retail path:
  - deploy `TokenUniqueSymbolIndex`
  - deploy `Limiter`
  - deploy `PriceIndexQuoter`
  - deploy a bootstrap Sarafu `SwapPool`
  - register `mrTCOIN` and `cplTCOIN` into the Sarafu token registry
  - set TCOIN limits for the bootstrap pool
  - point `PoolRegistry` at the real `SwapPool`
  - wire `LiquidityRouter` to `SarafuSwapPoolAdapter`
- Updated Scenario B and deployment validation scripts to use the bootstrap pool id explicitly instead of relying on on-chain pool discovery.
- Added a dedicated Sarafu compatibility regression for `GeneroTokenV3`, proving that the current token implementation can still be registered in `TokenUniqueSymbolIndex`, deposited into a Sarafu `SwapPool`, and withdrawn from that pool successfully in the baseline `6`-decimal posture.
- Added router and adapter tests that now use real Sarafu `SwapPool`, `Limiter`, `PriceIndexQuoter`, and `TokenUniqueSymbolIndex` contracts instead of the old mock managed-inventory path.
- Updated the TorontoCoin docs to record the architectural reset:
  - Sarafu `SwapPool` is the intended runtime pool engine
  - `ManagedPoolAdapter` is now legacy / migration-only posture
  - `LiquidityRouter` validates and executes a chosen pool instead of discovering the best one on-chain

### Verification
- `forge test --match-path test/unit/torontocoin/GeneroTokenV3SarafuCompatibility.t.sol`
- `forge test --match-path test/unit/torontocoin/SarafuSwapPoolAdapter.t.sol`
- `forge test --match-path test/unit/torontocoin/LiquidityRouter.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/SarafuSwapPoolAdapter.sol`
- `contracts/foundry/src/torontocoin/PoolRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IPoolRegistry.sol`
- `contracts/foundry/src/torontocoin/LiquidityRouter.sol`
- `contracts/foundry/script/deploy/DeployTorontoCoinSuite.s.sol`
- `contracts/foundry/script/deploy/ValidateTorontoCoinDeployment.s.sol`
- `contracts/foundry/script/deploy/RunTorontoCoinScenarioB.s.sol`
- `contracts/foundry/script/deploy/FinalizeTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/test/unit/torontocoin/LiquidityRouter.t.sol`
- `contracts/foundry/test/unit/torontocoin/SarafuSwapPoolAdapter.t.sol`
- `contracts/foundry/test/unit/torontocoin/GeneroTokenV3SarafuCompatibility.t.sol`
- `contracts/foundry/test/unit/torontocoin/PoolRegistry.t.sol`
- `contracts/foundry/README.md`
- `contracts/foundry/src/torontocoin/LiquidityRouter.md`
- `contracts/foundry/src/torontocoin/ManagedPoolAdapter.md`
- `contracts/foundry/src/torontocoin/SarafuSwapPoolAdapter.md`
- `contracts/foundry/src/torontocoin/README.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.64
### Timestamp
- 2026-03-20 22:35:00 EDT

### Objective
- Implement a targeted live TorontoCoin `6`-decimal migration path for Celo mainnet, execute it only if the existing live controller/router stack can safely accept the new token scale, and leave the live system unchanged if that assumption proves false.

### What Changed
- Added reusable TorontoCoin mainnet migration tooling under `contracts/foundry/script/deploy/`:
  - `TorontoCoinSixDecimalMigrationBase.s.sol`
  - `StageTorontoCoinSixDecimalMigration.s.sol`
  - `ProposeTorontoCoinSixDecimalMigration.s.sol`
  - `FinalizeTorontoCoinSixDecimalMigration.s.sol`
  - `AbortTorontoCoinSixDecimalMigration.s.sol`
- `StageTorontoCoinSixDecimalMigration.s.sol` now deploys a fresh `6`-decimal `mrTCOIN`, a fresh `6`-decimal `cplTCOIN`, and a fresh `ManagedPoolAdapter`, then clones the live bootstrap pool execution settings into a clean pool account and records the staged addresses in `contracts/foundry/deployments/torontocoin/celo-mainnet/six-decimal-migration.json`.
- The live stage broadcast on Celo mainnet succeeded and produced these staged-but-not-live addresses:
  - `newMrTcoin = 0xE735e11f38b4dBafEd71C7a70d24F6316612504B`
  - `newCplTcoin = 0x6e0C7A71ff70C34BCB3Fa42e244aDeA93566E6cd`
  - `newManagedPoolAdapter = 0x64Dc884C37DfCBDa438c78E706B8515B8ABF6bE5`
  - `newPoolAccount = 0x718DE5aC75738B9B2EA6C28aE8B0FD0cA9349b5e`
- `ProposeTorontoCoinSixDecimalMigration.s.sol` then submitted and approved three governance proposals against the live mainnet governance contract:
  - proposal `17`: `TreasuryController.setTcoinToken(newMrTcoin)`
  - proposal `18`: `LiquidityRouter.setCplTcoin(newCplTcoin)`
  - proposal `19`: `LiquidityRouter.setPoolAdapter(newManagedPoolAdapter)`
- `FinalizeTorontoCoinSixDecimalMigration.s.sol` exposed a real compatibility blocker before any cutover transaction was broadcast: the live TorontoCoin controller/router/adapter path still assumes `18`-decimal-scaled internal token amounts. With only the token decimals changed, the fresh `6`-decimal pool inventory was treated as far too small and the router path reverted with `InsufficientPoolLiquidity(...)`.
- Because of that blocker, the live cutover was intentionally aborted. `AbortTorontoCoinSixDecimalMigration.s.sol` cancelled proposals `17`, `18`, and `19`, leaving the live TorontoCoin mainnet stack unchanged:
  - `TreasuryController.tcoinToken()` still points to the old `18`-decimal `mrTCOIN`
  - `LiquidityRouter.cplTcoin()` still points to the old `18`-decimal `cplTCOIN`
  - `LiquidityRouter.poolAdapter()` still points to the previously live `ManagedPoolAdapter`
- The practical conclusion is now explicit: changing deployment defaults to `6` decimals is safe for fresh environments, but live TorontoCoin cannot be migrated by token replacement alone. A real live migration still requires code-level scaling changes in `TreasuryController`, router accounting, and pool-liquidity reads.

### Deployer Balance Tracker
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- End balance: `9.797287038945049075 CELO`
- Previous tracked session balance: `10.066034561180316480 CELO`
- Delta from previous tracked session: `-0.268747522235267405 CELO`
- Transaction-cost breakdown this session:
  - `StageTorontoCoinSixDecimalMigration.s.sol`: `0.242750878455020330 CELO`
  - `ProposeTorontoCoinSixDecimalMigration.s.sol`: `0.023656690827783027 CELO`
  - `AbortTorontoCoinSixDecimalMigration.s.sol`: `0.002339952952464060 CELO`
  - Total spent: `0.268747522235267405 CELO`

### Verification
- `forge test`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/StageTorontoCoinSixDecimalMigration.s.sol:StageTorontoCoinSixDecimalMigration --rpc-url celo-mainnet --broadcast`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/ProposeTorontoCoinSixDecimalMigration.s.sol:ProposeTorontoCoinSixDecimalMigration --rpc-url celo-mainnet --broadcast`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/FinalizeTorontoCoinSixDecimalMigration.s.sol:FinalizeTorontoCoinSixDecimalMigration --rpc-url celo-mainnet`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/AbortTorontoCoinSixDecimalMigration.s.sol:AbortTorontoCoinSixDecimalMigration --rpc-url celo-mainnet --broadcast`
- `cast call 0x8cBd51D726d7D8851bdD3aC003c0Fb20c26ef6E1 'getProposal(uint256)((uint8,address,address,uint256,uint64,uint64,bool,bool,bytes32,string,string))' 17 --rpc-url https://forno.celo.org`
- `cast call 0x8cBd51D726d7D8851bdD3aC003c0Fb20c26ef6E1 'getProposal(uint256)((uint8,address,address,uint256,uint64,uint64,bool,bool,bytes32,string,string))' 18 --rpc-url https://forno.celo.org`
- `cast call 0x8cBd51D726d7D8851bdD3aC003c0Fb20c26ef6E1 'getProposal(uint256)((uint8,address,address,uint256,uint64,uint64,bool,bool,bytes32,string,string))' 19 --rpc-url https://forno.celo.org`
- `cast balance 0x1B7489bE5C572041b682749F7B25B84E30cF9271 --rpc-url https://forno.celo.org`

### Files Edited
- `contracts/foundry/script/deploy/TorontoCoinSixDecimalMigrationBase.s.sol`
- `contracts/foundry/script/deploy/StageTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/ProposeTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/FinalizeTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/script/deploy/AbortTorontoCoinSixDecimalMigration.s.sol`
- `contracts/foundry/README.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.63
### Timestamp
- 2026-03-20 16:53:59 EDT

### Objective
- Create a reusable Codex skill for drafting, refining, and exporting Mermaid diagrams so engineering notes can pair editable Mermaid source with visually checked image artefacts.

### What Changed
- Added a new local Codex skill at `~/.codex/skills/mermaid-chart/`.
- Wrote the skill workflow so Mermaid work now starts from a minimal valid block, renders locally first, iterates structurally for readability, and uses `mermaid.ai` only when the user explicitly wants the hosted workspace.
- Added `scripts/render_mermaid_html.py` to convert raw Mermaid or Markdown-embedded Mermaid into a local HTML preview page suitable for browser inspection and screenshot export.
- Added focused Mermaid authoring and browser-refinement references covering chart selection, layout heuristics, screenshot guidance, and the guard-rail that Google sign-in must stay user-driven.
- Updated the engineering specs to note the shared Mermaid-diagram documentation workflow for internal technical notes and architecture diagrams.

### Verification
- `python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py ~/.codex/skills/mermaid-chart`
- `python3 ~/.codex/skills/mermaid-chart/scripts/render_mermaid_html.py /tmp/mermaid-chart-demo.md --output /tmp/mermaid-chart-demo.html --title "Mermaid Chart Skill Demo"`
- Browser preview of `file:///tmp/mermaid-chart-demo.html` with screenshot export to JPEG

### Files Edited
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.62
### Timestamp
- 2026-03-20 18:20:00 EDT

### Objective
- Formalize deployer-balance tracking in the session log for TorontoCoin chain work, record the current deployer balance baseline, and assess whether the just-landed `6`-decimal default pass requires any cost-effective on-chain deployment.

### What Changed
- Added a workflow rule in `agent-context/workflow.md` requiring TorontoCoin sessions that touch live or testnet chain state to record the deployer wallet end-balance, delta from the prior tracked session, and a transaction-cost breakdown when the balance changes.
- Added the first explicit deployer-balance tracker entry to this session log for the TorontoCoin deployer `0x1B7489bE5C572041b682749F7B25B84E30cF9271` on Celo mainnet.
- Verified that the most recent implementation commit `e8185f1` changes only checked-in defaults, validator logic, tests, and docs. It does not change any deployable production contract bytecode under `contracts/foundry/src/torontocoin/`.
- As a result, the cost-effective deployment action for this session is a deliberate no-op:
  - no contracts were redeployed
  - no governance rewiring was sent
  - no mainnet balance was spent in this session
- This remains consistent with the implemented `6`-decimal posture, which is forward-looking for fresh deployments only and intentionally does not migrate the already-deployed mainnet token addresses.

### Deployer Balance Tracker
- Network: Celo mainnet
- Deployer: `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
- End balance: `10.066034561180316480 CELO`
- Previous tracked session balance: none; this entry establishes the baseline tracker
- Delta from previous tracked session: not applicable
- Transaction-cost breakdown this session: none; no on-chain transactions were broadcast

### Verification
- `cast balance 0x1B7489bE5C572041b682749F7B25B84E30cF9271 --rpc-url https://forno.celo.org`
- `git diff --name-only HEAD^ HEAD | rg '^contracts/foundry/src/torontocoin/.*\\.sol$|^contracts/foundry/script/deploy/.*\\.sol$'`

### Files Edited
- `agent-context/workflow.md`
- `agent-context/session-log.md`

## v1.61
### Timestamp
- 2026-03-20 16:10:00 EDT

### Objective
- Change the checked-in TorontoCoin deployment posture so newly deployed internal tokens default to `6` decimals instead of `18`, while leaving reserve-side precision and the already-deployed mainnet token addresses untouched.

### What Changed
- Updated `contracts/foundry/deploy-config.json` so all three TorontoCoin deployment profiles now default both `mrTCOIN` and `cplTCOIN` to `6` decimals instead of `18`.
- Re-expressed the bootstrap pool seed in each TorontoCoin profile from `5e18` raw units to `5e6`, preserving the same visible `5 cplTCOIN` seed amount under the new token-decimal default.
- Kept reserve-side config unchanged where it reflects live token truth: external reserve assets such as `CADm`, `USDm`, and `USDC` still use their actual on-chain decimals, and CAD pricing / collateralization math remains `1e18` based.
- Tightened `ValidateTorontoCoinDeployment.s.sol` so future deployment validation now explicitly fails if the deployed `mrTCOIN` or `cplTCOIN` decimals are not `6`.
- Updated TorontoCoin unit coverage to match the new internal-token default:
  - `ManagedPoolAdapter.t.sol` now uses `6`-decimal `mrTCOIN` / `cplTCOIN` mocks and confirms a `1000e6` pool inventory is readable and tradable.
  - `LiquidityRouter.t.sol` now uses a `6`-decimal internal `mrTCOIN` posture and `6`-decimal `USDC` reserve input while keeping mixed reserve-token decimal coverage for the normalization path.
  - `GeneroTokenV3.t.sol` now has an explicit regression test proving a `6`-decimal deployment supports a `1000e6` visible balance plus allowance reads without hitting the old practical ceiling.
- Updated Foundry/docs artefacts to make the rollout posture explicit: future deployments use `6`-decimal internal TorontoCoin tokens by default, while the existing mainnet `18`-decimal deployment remains a known legacy posture until a separate live-token migration pass is done.

### Verification
- `forge test --match-path test/unit/torontocoin/GeneroTokenV3.t.sol`
- `forge test --match-path test/unit/torontocoin/ManagedPoolAdapter.t.sol`
- `forge test --match-path test/unit/torontocoin/LiquidityRouter.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/deploy-config.json`
- `contracts/foundry/script/deploy/ValidateTorontoCoinDeployment.s.sol`
- `contracts/foundry/test/unit/torontocoin/GeneroTokenV3.t.sol`
- `contracts/foundry/test/unit/torontocoin/ManagedPoolAdapter.t.sol`
- `contracts/foundry/test/unit/torontocoin/LiquidityRouter.t.sol`
- `contracts/foundry/README.md`
- `contracts/foundry/src/torontocoin/GeneroToken.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.60
### Timestamp
- 2026-03-20 14:20:00 EDT

### Objective
- Complete the live Celo mainnet TorontoCoin peg ramp to `3.3 CAD/TCOIN`, restore a working retail router path after discovering the current `cplTCOIN` single-account balance ceiling, and execute a live `1 USDC` router buy against the recovered pool.

### What Changed
- Executed 13 live governance proposals on Celo mainnet to move the deployed `TreasuryController.cadPeg18` from `1.0e18` to `3.3e18`. The first attempt with 1-second windows exposed Celo sequencer nonce and visibility races, so the successful ramp used longer voting windows and explicit nonce management.
- Confirmed the live router already had `charityTopupBps = 300` (3%), and added the deployer EOA as a `cplTCOIN` writer so pool inventory could be seeded directly from the token contract.
- Discovered an operationally critical limitation in the current live `GeneroTokenV3` / `cplTCOIN` implementation: once a single account balance grows much beyond roughly `9.22` visible tokens, Sarafu-era `ABDKMath64x64.fromUInt` conversions begin reverting on `balanceOf(...)`. This broke the original bootstrap adapter path after an attempted large pool top-up, because `ManagedPoolAdapter` reads pool inventory through `IERC20.balanceOf(poolAccount)`.
- Recovered the live retail path by deploying a fresh `ManagedPoolAdapter` at `0xD2Ef61a2Cc17F44e5b5E41bE0F52a0DBa70Ffdf0`, creating a new bootstrap pool account `0x8054e75AfBbEDa1D0d3c3CA6c2e941627b821cCC`, seeding that safe pool with `5 cplTCOIN`, and switching `LiquidityRouter` to the new adapter through governance proposal `16`.
- Executed a live `1 USDC` buy through `LiquidityRouter` on Celo mainnet after the recovery. The protocol path completed successfully through `USDC -> USDm -> CADm -> TreasuryController -> LiquidityRouter -> cplTCOIN`.
- The live post-buy state on the recovered pool was:
  - deployer `USDC`: `4.000000`
  - deployer `cplTCOIN`: `0.427885999479212629`
  - recovered pool `cplTCOIN`: `4.584567346438253997`
  - recovered pool `mrTCOIN`: `0.415423300465254980`
- The difference between the pool-side `mrTCOIN` inflow and the deployer’s total `cplTCOIN` receipt reflects the 3% charity top-up mint, which still resolves to the deployer wallet under the current bootstrap charity configuration.
- This session leaves one clear engineering follow-up: patch or replace the current `cplTCOIN` visible/base conversion math so large single-account pool inventories do not break `balanceOf(...)`, router previews, and pool accounting.

### Verification
- `cast call 0x4AAf282aE14A437163d9D8fDD44aAcD4fB65244c 'cadPeg18()(uint256)' --rpc-url "$MAINNET_RPC_URL"`
- 13 live `Governance.proposeCadPegUpdate(...)` / `voteProposal(...)` / `executeProposal(...)` transactions on Celo mainnet
- `cast call 0x3fBcBA716c9C2Bb230Ed02d2C41A93C71c8243DD 'isWriter(address)(bool)' 0x1B7489bE5C572041b682749F7B25B84E30cF9271 --rpc-url "$MAINNET_RPC_URL"`
- `forge create src/torontocoin/ManagedPoolAdapter.sol:ManagedPoolAdapter --broadcast ...`
- live governance proposal `16` to switch `LiquidityRouter.poolAdapter` to `0xD2Ef61a2Cc17F44e5b5E41bE0F52a0DBa70Ffdf0`
- live `cast send ... 'buyCplTcoin(address,uint256,uint256,uint256)' ...` call against `LiquidityRouter`
- post-trade balance reads on deployer, recovered pool, `TreasuryController`, and `LiquidityRouter`

### Files Edited
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`

## v1.59
### Timestamp
- 2026-03-20 11:10:00 EDT

### Objective
- Update the checked-in TorontoCoin deployment defaults so future deployments start at the intended `3.3 CAD/TCOIN` peg, and verify whether the already-deployed Celo mainnet stack can be moved from the legacy `1.0 CAD/TCOIN` peg to `3.3 CAD/TCOIN` under the live governance constraints before executing a live `1 USDC` retail router buy.

### What Changed
- Updated `contracts/foundry/deploy-config.json` so all checked-in TorontoCoin deployment profiles now initialize `TreasuryController.cadPeg18` at `3300000000000000000` (`3.3 CAD/TCOIN`) instead of the legacy `1000000000000000000` (`1.0 CAD/TCOIN`) default. This ensures future suite deployments start at the intended reserve-backed mint rate without an immediate post-deploy governance correction.
- Updated the engineering specs to record that fresh TorontoCoin deployments now start at `3.3 CAD/TCOIN`, aligning the static deployment config with the intended retail economics.
- Re-verified the live Celo mainnet stack before sending funds. The deployed `TreasuryController` still has `cadPeg18 = 1e18`, the live router still has `charityTopupBps = 300`, and the live `LiquidityRouter` is already a `cplTCOIN` writer.
- Confirmed that the requested `1.0 -> 3.3` mainnet peg change cannot be completed in 12 governance proposals. The live `TreasuryController` enforces a maximum `10%` peg move per update, so the largest reachable peg after 12 steps is about `3.1384283767`. Reaching `3.3` from `1.0` requires at least 13 governance proposals under the deployed rules.

### Verification
- `cast call 0x4AAf282aE14A437163d9D8fDD44aAcD4fB65244c 'cadPeg18()(uint256)' --rpc-url "$MAINNET_RPC_URL"`
- `cast call 0xFe3aE3c1f9EDDbF74472587893a7f8B84e20D748 'charityTopupBps()(uint256)' --rpc-url "$MAINNET_RPC_URL"`
- `cast call 0x3fBcBA716c9C2Bb230Ed02d2C41A93C71c8243DD 'isWriter(address)(bool)' 0xFe3aE3c1f9EDDbF74472587893a7f8B84e20D748 --rpc-url "$MAINNET_RPC_URL"`
- `python3` check of the 10% compounding path from `1.0` to `3.3`, confirming 12 steps are insufficient and 13 are required.

### Files Edited
- `contracts/foundry/deploy-config.json`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.58
### Timestamp
- 2026-03-19 18:35:00 EDT

### Objective
- Reintroduce explicit `ethereum-sepolia` and `celo-sepolia` TorontoCoin deployment profiles, then deploy and smoke test them to prove the limited non-Mento and limited non-Transak paths work as designed.

### What Changed
- Extended `contracts/foundry/deploy-config.json` with two additional TorontoCoin profiles:
  - `ethereum-sepolia` now runs a limited non-Mento routing posture using a deploy-time `sCAD` reserve asset and a direct-only swap adapter.
  - `celo-sepolia` now runs a limited Mento-path posture using live testnet `USDC`, `USDm`, `CADm`, broker, provider, and exchange-ID metadata, while defaulting Scenario B to preview-only until a funded test wallet is available.
- Added `contracts/foundry/src/torontocoin/DirectOnlySwapAdapter.sol` as the explicit `ISwapAdapter` implementation for non-Mento profiles. It keeps the same helper boundary as production while reverting any attempted swap path.
- Added `contracts/foundry/src/torontocoin/MintableTestReserveToken.sol` so limited non-production profiles can deploy a treasury-accepted reserve asset and mint scenario funding without external token dependencies.
- Updated `contracts/foundry/script/deploy/DeployTorontoCoinSuite.s.sol` so the suite deploy path is profile-aware. It now conditionally deploys the direct-only swap adapter or the Mento adapter, can optionally deploy and mint a reserve token from config, records `reserveSwapAdapter`, `reserveAssetToken`, and `scenarioInputToken` in the generated manifests, and only seeds Mento routes when the selected profile enables them.
- Updated `contracts/foundry/script/deploy/ValidateTorontoCoinDeployment.s.sol` and `contracts/foundry/script/deploy/RunTorontoCoinScenarioB.s.sol` so validation and Scenario B follow the selected profile semantics instead of assuming Celo mainnet Mento. Scenario B now respects profile-configured input tokens and can be configured preview-only where live input funding is not guaranteed.
- Extended `contracts/foundry/script/helpers/DeployChainConfig.sol` with optional integer and boolean readers, and updated `DiscoverMentoExchangeIds.s.sol` to print both the configured route-token path and the `USDC -> USDm` hop for Mento-enabled profiles.
- Added `contracts/foundry/test/unit/torontocoin/DirectOnlySwapAdapter.t.sol` and ran the full Foundry test suite after the profile work landed.
- Deployed the full TorontoCoin suite successfully to Ethereum Sepolia and ran a live Scenario B smoke test there. The generated artifact shows a successful direct-reserve buy into `cplTCOIN`:
  - buyer `0x1B7489bE5C572041b682749F7B25B84E30cF9271`
  - input token `0xA09a2667A878F30107f03399231205e3171eFB68` (`sCAD`)
  - selected pool `0x7365706f6c69612d67656e657369732d706f6f6c000000000000000000000000`
  - `executedCplTcoinOut = 1000000000000000000`
  - `executedCharityTopupOut = 30000000000000000`
  - `cplBalanceAfter = 1029999999999999999`
- Attempted the same full-suite deploy on Celo Sepolia, but the deployer had `0` CELO on chain and the broadcast failed with `insufficient funds for gas * price + value`. A follow-up `cast code` check on the reported `LiquidityRouter` address returned `0x`, confirming the Celo Sepolia deployment did not land. The checked-in Mento testnet route IDs were still verified read-only through `DiscoverMentoExchangeIds.s.sol`.
- Updated Foundry workspace docs, TorontoCoin contract notes, and engineering specs so the source of truth now documents the three-profile deploy model and the limits of the two non-production smoke profiles.

### Verification
- `forge fmt src/torontocoin/DirectOnlySwapAdapter.sol src/torontocoin/MintableTestReserveToken.sol script/helpers/DeployChainConfig.sol script/helpers/DiscoverMentoExchangeIds.s.sol script/deploy/DeployTorontoCoinSuite.s.sol script/deploy/ValidateTorontoCoinDeployment.s.sol script/deploy/RunTorontoCoinScenarioB.s.sol test/unit/torontocoin/DirectOnlySwapAdapter.t.sol`
- `forge test --match-path test/unit/torontocoin/DirectOnlySwapAdapter.t.sol`
- `forge test`
- `DEPLOY_TARGET_CHAIN=celo-sepolia forge script script/helpers/DiscoverMentoExchangeIds.s.sol:DiscoverMentoExchangeIds --rpc-url https://forno.celo-sepolia.celo-testnet.org/`
- `DEPLOY_TARGET_CHAIN=ethereum-sepolia forge script script/deploy/DeployTorontoCoinSuite.s.sol:DeployTorontoCoinSuite --rpc-url https://ethereum-sepolia-rpc.publicnode.com --broadcast`
- `DEPLOY_TARGET_CHAIN=ethereum-sepolia forge script script/deploy/ValidateTorontoCoinDeployment.s.sol:ValidateTorontoCoinDeployment --rpc-url https://ethereum-sepolia-rpc.publicnode.com`
- `DEPLOY_TARGET_CHAIN=ethereum-sepolia forge script script/deploy/RunTorontoCoinScenarioB.s.sol:RunTorontoCoinScenarioB --rpc-url https://ethereum-sepolia-rpc.publicnode.com --broadcast`
- `cast code 0x51663116fC9815BF9E12c820dF5cC260576d57D4 --rpc-url https://ethereum-sepolia-rpc.publicnode.com`
- `DEPLOY_TARGET_CHAIN=celo-sepolia forge script script/deploy/DeployTorontoCoinSuite.s.sol:DeployTorontoCoinSuite --rpc-url https://forno.celo-sepolia.celo-testnet.org/ --broadcast`
- `cast balance 0x1B7489bE5C572041b682749F7B25B84E30cF9271 --rpc-url https://forno.celo-sepolia.celo-testnet.org/`
- `cast code 0xFe3aE3c1f9EDDbF74472587893a7f8B84e20D748 --rpc-url https://forno.celo-sepolia.celo-testnet.org/`

### Files Edited
- `contracts/foundry/.env.example`
- `contracts/foundry/deploy-config.json`
- `contracts/foundry/foundry.toml`
- `contracts/foundry/README.md`
- `contracts/foundry/script/helpers/DeployChainConfig.sol`
- `contracts/foundry/script/helpers/DiscoverMentoExchangeIds.s.sol`
- `contracts/foundry/script/deploy/DeployTorontoCoinSuite.s.sol`
- `contracts/foundry/script/deploy/ValidateTorontoCoinDeployment.s.sol`
- `contracts/foundry/script/deploy/RunTorontoCoinScenarioB.s.sol`
- `contracts/foundry/src/torontocoin/DirectOnlySwapAdapter.sol`
- `contracts/foundry/src/torontocoin/DirectOnlySwapAdapter.md`
- `contracts/foundry/src/torontocoin/MintableTestReserveToken.sol`
- `contracts/foundry/src/torontocoin/MintableTestReserveToken.md`
- `contracts/foundry/src/torontocoin/README.md`
- `contracts/foundry/test/unit/torontocoin/DirectOnlySwapAdapter.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.57
### Timestamp
- 2026-03-19 18:05:00 EDT

### Objective
- Build a mainnet-first TorontoCoin deployment system that can deploy and wire the full current contract suite on Celo mainnet, generate runtime manifests, and validate the retail user journey as two separate scenarios: off-chain USDC on-ramp readiness and on-chain `USDC -> USDm -> CADm -> cplTCOIN` protocol conversion.

### What Changed
- Added `contracts/foundry/src/torontocoin/ManagedPoolAdapter.sol` as the missing deployable production pool adapter. It now owns canonical pool settlement accounts, quote-bps execution settings, managed `cplTCOIN` inventory custody, and merchant-to-pool matching for `LiquidityRouter`, while leaving merchant and pool identity canonical in `PoolRegistry`.
- Added a mainnet-oriented suite deploy script, `contracts/foundry/script/deploy/DeployTorontoCoinSuite.s.sol`, that deploys the TorontoCoin stack in dependency order, deploys upgradeable `ReserveRegistry`, `StewardRegistry`, and `TreasuryController` behind `ERC1967Proxy`, wires treasury/router/registry pointers, seeds the bootstrap reserve asset, charity, steward, pool, merchant, and managed pool inventory, configures the default Mento `USDm -> CADm` and multihop `USDC -> USDm -> CADm` routes, and finalizes governance/ownership posture.
- Added `contracts/foundry/script/deploy/ValidateTorontoCoinDeployment.s.sol` to validate runtime manifests after deploy. It now checks nonzero core addresses, governance helper wiring, token writer roles, treasury authorized-caller posture, reserve activation, bootstrap pool readiness, and presence of the configured Mento `USDC` route.
- Added `contracts/foundry/script/deploy/RunTorontoCoinScenarioB.s.sol` as the protocol-half validation script. It reads the generated suite manifest, previews and executes `LiquidityRouter.buyCplTcoin(...)` for a funded USDC wallet, and writes a `scenario-b-run.json` artifact with preview/execution outputs and resulting `cplTCOIN` balance deltas.
- Added `contracts/foundry/script/deploy/RecordOnRampScenarioA.md` as the operator runbook for the off-chain half of the retail journey. It records the wallet, Celo USDC token address, observed post-Transak balance, and transaction references before handing that same wallet into Scenario B.
- Refactored `contracts/foundry/deploy-config.json` into a static public Celo-mainnet TorontoCoin profile with chain metadata, Celo/Mento addresses, policy defaults, and bootstrap seed metadata only. Deployment outputs are no longer stored in config; runtime manifests are generated under `contracts/foundry/deployments/torontocoin/<target>/`.
- Tightened `contracts/foundry/script/helpers/DeployChainConfig.sol` so optional role and bootstrap wallet fields can be omitted cleanly and fall back to the broadcasting deployer instead of relying on zero-address sentinels in the checked-in config.
- Added the governance helper split required to keep the suite deployable under the EIP-170 runtime-size limit: `GovernanceExecutionHelper.sol`, `GovernanceProposalHelper.sol`, and `GovernanceRouterProposalHelper.sol`. `Governance.sol` now keeps the storage, voting, fallback dispatch, and deadline-gated execution entrypoint at the governance address while delegating proposal construction and execution logic into those helper contracts.
- Added `contracts/foundry/src/torontocoin/StaticCadOracle.sol` as the static CAD price source used by the bootstrap `CADm` reserve asset, and updated `GovernanceDeadline.t.sol` plus the new `ManagedPoolAdapter.t.sol` coverage so the deployable stack and reduced governance surface remain tested.
- Updated Foundry workspace docs, TorontoCoin contract notes, and engineering specs so the repo now documents the mainnet-first deployment posture, static-config versus generated-manifest split, Scenario A / Scenario B validation model, and the new `ManagedPoolAdapter` plus governance helper structure.
- Marked `contracts/foundry/deployments/**` as generated output in `contracts/foundry/.gitignore` so local dry runs and Anvil broadcasts do not pollute the repo with non-canonical mainnet artifacts.

### Verification
- `forge fmt src/torontocoin/Governance.sol src/torontocoin/GovernanceExecutionHelper.sol src/torontocoin/GovernanceProposalHelper.sol src/torontocoin/GovernanceRouterProposalHelper.sol src/torontocoin/ManagedPoolAdapter.sol src/torontocoin/StaticCadOracle.sol script/helpers/DeployChainConfig.sol script/deploy/DeployTorontoCoinSuite.s.sol script/deploy/ValidateTorontoCoinDeployment.s.sol script/deploy/RunTorontoCoinScenarioB.s.sol test/unit/torontocoin/GovernanceDeadline.t.sol test/unit/torontocoin/ManagedPoolAdapter.t.sol`
- `forge test --match-path test/unit/torontocoin/GovernanceDeadline.t.sol`
- `forge test --match-path test/unit/torontocoin/ManagedPoolAdapter.t.sol`
- `forge test --match-path test/unit/torontocoin/LiquidityRouter.t.sol`
- `forge test --match-path test/unit/torontocoin/ReserveInputRouter.t.sol`
- `forge test`
- `anvil --chain-id 42220`
- `forge script script/deploy/DeployTorontoCoinSuite.s.sol:DeployTorontoCoinSuite --rpc-url http://127.0.0.1:8545 --broadcast`
- `DEPLOY_TARGET_CHAIN=celo-mainnet forge script script/deploy/ValidateTorontoCoinDeployment.s.sol:ValidateTorontoCoinDeployment --rpc-url http://127.0.0.1:8545`

### Files Edited
- `contracts/foundry/.env.example`
- `contracts/foundry/.gitignore`
- `contracts/foundry/deploy-config.json`
- `contracts/foundry/foundry.toml`
- `contracts/foundry/README.md`
- `contracts/foundry/script/helpers/DeployChainConfig.sol`
- `contracts/foundry/script/deploy/DeployTorontoCoinSuite.s.sol`
- `contracts/foundry/script/deploy/ValidateTorontoCoinDeployment.s.sol`
- `contracts/foundry/script/deploy/RunTorontoCoinScenarioB.s.sol`
- `contracts/foundry/script/deploy/RecordOnRampScenarioA.md`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/Governance.md`
- `contracts/foundry/src/torontocoin/GovernanceExecutionHelper.sol`
- `contracts/foundry/src/torontocoin/GovernanceProposalHelper.sol`
- `contracts/foundry/src/torontocoin/GovernanceRouterProposalHelper.sol`
- `contracts/foundry/src/torontocoin/ManagedPoolAdapter.sol`
- `contracts/foundry/src/torontocoin/ManagedPoolAdapter.md`
- `contracts/foundry/src/torontocoin/StaticCadOracle.sol`
- `contracts/foundry/src/torontocoin/README.md`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `contracts/foundry/test/unit/torontocoin/ManagedPoolAdapter.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.56
### Timestamp
- 2026-03-19 14:45:00 EDT

### Objective
- Enable atomic `USDC -> USDm -> CADm` normalization through the shared Mento adapter so the retail `LiquidityRouter` path can support a Transak-funded USDC on-ramp without embedding multihop swap logic in the router itself.

### What Changed
- Extended `contracts/foundry/src/torontocoin/MentoBrokerSwapAdapter.sol` so it now supports both single-hop and multihop default routes. The adapter can still execute direct `tokenIn -> CADm` swaps, but it can now also chain `tokenIn -> intermediateToken -> CADm` in one atomic call while preserving the existing `ISwapAdapter` surface consumed by `ReserveInputRouter` and `TcoinMintRouter`.
- Added multihop admin/config support to the adapter via `setDefaultMultiHopRoute(...)`, `getDefaultRouteConfig(...)`, and a dedicated `CadmMultiHopSwapped` event. Existing single-hop `setDefaultRoute(...)` behaviour remains intact and continues to clear the multihop fields for that token.
- Updated `contracts/foundry/script/deploy/DeployLiquidityRoutingStack.s.sol` so the checked-in Celo config now seeds both the direct `USDm -> CADm` Mento leg and the new atomic `USDC -> USDm -> CADm` route during deployment, and enables `USDC` on `ReserveInputRouter` for the retail flow.
- Expanded `contracts/foundry/test/unit/torontocoin/MentoBrokerSwapAdapter.t.sol` with live-shape multihop coverage: previewing `USDC -> USDm -> CADm`, executing the multihop directly through the adapter, and normalizing `USDC` through `ReserveInputRouter` into accepted `CADm`.
- Updated the TorontoCoin contract notes, Foundry README, and engineering specs so the written source of truth now says the retail on-ramp supports atomic `USDC -> USDm -> CADm` normalization through the helper/adapter boundary rather than requiring a separate future multihop pass.

### Verification
- `forge fmt src/torontocoin/MentoBrokerSwapAdapter.sol script/deploy/DeployLiquidityRoutingStack.s.sol test/unit/torontocoin/MentoBrokerSwapAdapter.t.sol`
- `forge build`
- `forge test --match-path test/unit/torontocoin/MentoBrokerSwapAdapter.t.sol`
- `forge test --match-path test/unit/torontocoin/ReserveInputRouter.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/MentoBrokerSwapAdapter.sol`
- `contracts/foundry/script/deploy/DeployLiquidityRoutingStack.s.sol`
- `contracts/foundry/test/unit/torontocoin/MentoBrokerSwapAdapter.t.sol`
- `contracts/foundry/src/torontocoin/MentoBrokerSwapAdapter.md`
- `contracts/foundry/src/torontocoin/ReserveInputRouter.md`
- `contracts/foundry/src/torontocoin/README.md`
- `contracts/foundry/README.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.55
### Timestamp
- 2026-03-19 14:05:00 EDT

### Objective
- Move public Foundry deployment parameters out of env files and into a checked-in config, while keeping only real secrets in `.env.example` and recording the verified Celo Mento route metadata for `USDC`, `USDm`, and `CADm`.

### What Changed
- Added `contracts/foundry/deploy-config.json` as the new checked-in public config for the Foundry workspace. It now holds chain metadata, registry script defaults, TorontoCoin dependency addresses, and the verified Celo mainnet Mento addresses plus exchange IDs.
- Refactored `contracts/foundry/script/helpers/DeployChainConfig.sol` so scripts now default to the target chain declared in `deploy-config.json`, still accept `DEPLOY_TARGET_CHAIN` as a public runtime override, and read chain metadata from the config instead of hardcoding it separately.
- Updated `DeployCityImplementationRegistry.s.sol`, `PromoteCityVersion.s.sol`, `DeployLiquidityRoutingStack.s.sol`, and `DiscoverMentoExchangeIds.s.sol` so all public addresses and route metadata come from `deploy-config.json`; only `PRIVATE_KEY` and RPC/explorer secrets remain in env.
- Tightened `contracts/foundry/.env.example` down to secrets only: `MAINNET_RPC_URL`, `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, and `CELOSCAN_API_KEY`.
- Recorded the verified Celo mainnet Mento route posture in the checked-in config and README: `USDC -> USDm` exists, `USDm -> CADm` exists, and the current single-hop deploy path still seeds `USDm -> CADm` as the active route until a future multihop adapter pass lands.
- Updated the Foundry README plus the engineering specs/runbook so operator docs now point to `deploy-config.json` for public values and to local env files only for secrets.

### Verification
- `forge fmt script/helpers/DeployChainConfig.sol script/helpers/DiscoverMentoExchangeIds.s.sol script/deploy/DeployCityImplementationRegistry.s.sol script/deploy/PromoteCityVersion.s.sol script/deploy/DeployLiquidityRoutingStack.s.sol`
- `forge build`
- `forge test`
- `source contracts/foundry/.env.local && DEPLOY_TARGET_CHAIN=celo forge script contracts/foundry/script/helpers/DiscoverMentoExchangeIds.s.sol:DiscoverMentoExchangeIds --rpc-url "$MAINNET_RPC_URL"`

### Files Edited
- `contracts/foundry/deploy-config.json`
- `contracts/foundry/.env.example`
- `contracts/foundry/foundry.toml`
- `contracts/foundry/README.md`
- `contracts/foundry/script/helpers/DeployChainConfig.sol`
- `contracts/foundry/script/helpers/DiscoverMentoExchangeIds.s.sol`
- `contracts/foundry/script/deploy/DeployCityImplementationRegistry.s.sol`
- `contracts/foundry/script/deploy/PromoteCityVersion.s.sol`
- `contracts/foundry/script/deploy/DeployLiquidityRoutingStack.s.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `docs/engineering/city-contract-version-registry-implementation.md`
- `agent-context/session-log.md`

## v1.54
### Timestamp
- 2026-03-19 11:10:00 EDT

### Objective
- Add a safe way to discover live Mento `exchangeId` values for `tokenIn -> mCAD`, and remove truly unused Foundry env variables from the Solidity workspace.

### What Changed
- Added `contracts/foundry/script/helpers/DiscoverMentoExchangeIds.s.sol` as a read-only helper script. It uses the canonical Mento discovery flow from the Broker docs: query `getExchangeProviders()` on the Broker, then `getExchanges()` on each provider, and print the matching exchange IDs for `MENTO_ROUTE_TOKEN_IN` paired with `CADM_TOKEN_ADDRESS`.
- Trimmed `contracts/foundry/.env.example` to remove unused Alchemy-specific placeholders (`MAINNET_RPC_URL_ALCHEMY`, `SEPOLIA_RPC_URL_ALCHEMY`, `ALCHEMY_API_KEY`) while keeping the active Celo/Sepolia deployment variables and the explorer API-key envs used operationally for verification.
- Updated the Foundry README with the exact `forge script ... DiscoverMentoExchangeIds` invocation and the required env surface for resolving `MENTO_EXCHANGE_ID` from live chain state.
- Updated the engineering technical spec so the current source of truth now records that Mento exchange IDs are discovered from Broker/provider state rather than assumed or hand-derived in the repo.

### Verification
- `forge fmt script/helpers/DiscoverMentoExchangeIds.s.sol`
- `forge build`
- `forge test`

### Files Edited
- `contracts/foundry/script/helpers/DiscoverMentoExchangeIds.s.sol`
- `contracts/foundry/.env.example`
- `contracts/foundry/README.md`
- `docs/engineering/technical-spec.md`
- `agent-context/session-log.md`

## v1.53
### Timestamp
- 2026-03-19 10:55:00 EDT

### Objective
- Standardize the Foundry deployment environment around Celo mainnet and Sepolia, remove the old Flow EVM testnet RPC variable, and make the deploy/admin scripts validate the intended target chain explicitly.

### What Changed
- Removed `FLOW_EVM_TESTNET_RPC_URL` from `contracts/foundry/.env.example`, added `DEPLOY_TARGET_CHAIN`, and complemented `ETHERSCAN_API_KEY` with `CELOSCAN_API_KEY`.
- Added `contracts/foundry/script/helpers/DeployChainConfig.sol` as a shared script helper that resolves the selected deploy target (`celo` or `sepolia`), maps it to the expected chain ID, the expected RPC env variable, and the expected explorer API-key env variable, and reverts if a script is broadcast on the wrong chain.
- Updated `DeployCityImplementationRegistry.s.sol`, `PromoteCityVersion.s.sol`, and `DeployLiquidityRoutingStack.s.sol` to inherit the shared deploy-chain helper, validate `DEPLOY_TARGET_CHAIN` against the connected chain, and log the matching RPC/explorer env expectations for operators.
- Added Foundry RPC aliases for `celo` and `sepolia` in `contracts/foundry/foundry.toml`, and rewrote the Foundry README plus the city-registry engineering runbook so deployment commands now use `--rpc-url celo` / `--rpc-url sepolia` instead of the removed Flow testnet variable.
- Updated the engineering technical spec so the repo-level source of truth now reflects the Celo/Sepolia deployment-target model for the Solidity workspace.

### Verification
- `forge fmt script/helpers/DeployChainConfig.sol script/deploy/DeployCityImplementationRegistry.s.sol script/deploy/PromoteCityVersion.s.sol script/deploy/DeployLiquidityRoutingStack.s.sol`
- `forge build`
- `forge test`

### Files Edited
- `contracts/foundry/.env.example`
- `contracts/foundry/foundry.toml`
- `contracts/foundry/README.md`
- `contracts/foundry/script/helpers/DeployChainConfig.sol`
- `contracts/foundry/script/deploy/DeployCityImplementationRegistry.s.sol`
- `contracts/foundry/script/deploy/PromoteCityVersion.s.sol`
- `contracts/foundry/script/deploy/DeployLiquidityRoutingStack.s.sol`
- `docs/engineering/city-contract-version-registry-implementation.md`
- `docs/engineering/technical-spec.md`
- `agent-context/session-log.md`

## v1.52
### Timestamp
- 2026-03-19 10:35:00 EDT

### Objective
- Operationalize the reserve-normalization split by adding a concrete Mento broker adapter, a deploy-and-wire script for the retail liquidity stack, and repo-level integration updates for the new `LiquidityRouter` input-token flow.

### What Changed
- Added `contracts/foundry/src/torontocoin/MentoBrokerSwapAdapter.sol` plus `MentoBrokerSwapAdapter.md` as the concrete `ISwapAdapter` implementation for Mento routes. The adapter stores default broker routes per input token, supports optional per-call route overrides through `swapData`, and returns actual observed `mCAD` output back to the caller.
- Added `contracts/foundry/script/deploy/DeployLiquidityRoutingStack.s.sol` so the repo now has a concrete deployment/config path for the retail `cplTCOIN` stack. The script deploys `MentoBrokerSwapAdapter`, `ReserveInputRouter`, and `LiquidityRouter`, wires the helper/router circular dependency, calls `TreasuryController.setLiquidityRouter(...)`, optionally seeds one initial Mento route plus helper-enabled input token, transfers ownership of the new contracts to governance, and writes a deployment artifact.
- Updated `contracts/foundry/.env.example` with the liquidity-stack deployment variables required by the new script.
- Added `contracts/foundry/test/unit/torontocoin/MentoBrokerSwapAdapter.t.sol`, covering default-route previews, per-call route overrides, and an integration-style normalization path where `ReserveInputRouter` uses the real broker-backed adapter surface to convert an unsupported input into accepted `mCAD`.
- Updated the TorontoCoin README plus the reserve-input, mint-router, and architecture notes so the written source of truth now distinguishes the older `TcoinMintRouter` checkout path from the newer `LiquidityRouter` retail `cplTCOIN` path, and explicitly documents `MentoBrokerSwapAdapter` as the concrete Mento execution surface shared by both.
- Confirmed there are currently no live app or indexer call sites for `LiquidityRouter.buyCplTcoin(...)` outside the Solidity/docs layer, so this pass focused the external integration cleanup on deployment/config and architecture notes rather than frontend code rewrites.

### Verification
- `forge fmt src/torontocoin/MentoBrokerSwapAdapter.sol src/torontocoin/ReserveInputRouter.sol src/torontocoin/LiquidityRouter.sol test/unit/torontocoin/MentoBrokerSwapAdapter.t.sol script/deploy/DeployLiquidityRoutingStack.s.sol`
- `forge test --match-path test/unit/torontocoin/MentoBrokerSwapAdapter.t.sol`
- `forge test --match-path test/unit/torontocoin/ReserveInputRouter.t.sol`
- `forge test --match-path test/unit/torontocoin/LiquidityRouter.t.sol`
- `forge test --match-path test/unit/torontocoin/GovernanceDeadline.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/MentoBrokerSwapAdapter.sol`
- `contracts/foundry/src/torontocoin/MentoBrokerSwapAdapter.md`
- `contracts/foundry/script/deploy/DeployLiquidityRoutingStack.s.sol`
- `contracts/foundry/.env.example`
- `contracts/foundry/test/unit/torontocoin/MentoBrokerSwapAdapter.t.sol`
- `contracts/foundry/src/torontocoin/README.md`
- `contracts/foundry/src/torontocoin/ReserveInputRouter.md`
- `contracts/foundry/src/torontocoin/TcoinMintRouter.md`
- `docs/engineering/mintTcoinWithUSDC-architecture.md`
- `docs/engineering/buy-tcoin-checkout-orchestrator-architecture.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.51
### Timestamp
- 2026-03-18 22:05:00 EDT

### Objective
- Separate reserve-input normalization from `cplTCOIN` pool routing so `LiquidityRouter` remains the retail entrypoint while Mento-style `mCAD` conversion is only engaged when the user input token is not already treasury-accepted.

### What Changed
- Added `contracts/foundry/src/torontocoin/ReserveInputRouter.sol` plus `ReserveInputRouter.md` as the dedicated normalization helper. It resolves direct treasury-accepted reserve inputs without swapping, normalizes helper-enabled unsupported inputs into `mCAD`, and remains out of pool selection, charity routing, and treasury policy math.
- Refactored `contracts/foundry/src/torontocoin/LiquidityRouter.sol` so its public buy/preview surface is now input-token based rather than reserve-asset-id based. The router pulls user input tokens itself, uses `TreasuryController.resolveAcceptedReserveAsset(...)` to decide whether direct treasury settlement is possible, delegates to `ReserveInputRouter` only when needed, then deposits the normalized reserve asset into `depositAssetForLiquidityRoute(...)`, selects the best eligible pool, and finishes the `cplTCOIN` purchase plus charity top-up.
- Extended `TreasuryController` with `resolveAcceptedReserveAsset(address)` and updated `IReserveRegistry` / `ITreasuryController` accordingly so reserve-input detection stays in the treasury policy layer without embedding normalization logic there.
- Extended the governance-facing router surface with `setReserveInputRouter(...)`, added the corresponding governance proposal path, and updated the governance regression test harness so the finalized owner/governance execution model still covers router pointer updates.
- Added focused tests for `ReserveInputRouter`, rewrote `LiquidityRouter` tests around the new direct-vs-normalized input flow, and updated the treasury mock registry to satisfy the new reserve lookup helper.
- Updated TorontoCoin contract notes and engineering specs so the documented architecture now reflects the split between retail routing, reserve-input normalization, and treasury settlement.

### Verification
- `forge test --match-path test/unit/torontocoin/ReserveInputRouter.t.sol`
- `forge test --match-path test/unit/torontocoin/LiquidityRouter.t.sol`
- `forge test --match-path test/unit/torontocoin/GovernanceDeadline.t.sol`

### Files Edited
- `contracts/foundry/src/torontocoin/ReserveInputRouter.sol`
- `contracts/foundry/src/torontocoin/LiquidityRouter.sol`
- `contracts/foundry/src/torontocoin/TreasuryController.sol`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/interfaces/IReserveRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol`
- `contracts/foundry/src/torontocoin/interfaces/ILiquidityRouterGovernance.sol`
- `contracts/foundry/test/unit/torontocoin/ReserveInputRouter.t.sol`
- `contracts/foundry/test/unit/torontocoin/LiquidityRouter.t.sol`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `contracts/foundry/test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `contracts/foundry/src/torontocoin/ReserveInputRouter.md`
- `contracts/foundry/src/torontocoin/LiquidityRouter.md`
- `contracts/foundry/src/torontocoin/TreasuryController.md`
- `contracts/foundry/src/torontocoin/TcoinMintRouter.md`
- `contracts/foundry/src/torontocoin/README.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.50
### Timestamp
- 2026-03-18 21:42:00 EDT

### Objective
- Clear the remaining TorontoCoin editor lint errors tied to the private-leading-underscore rule on the targeted Solidity contracts.

### What Changed
- Renamed private and internal storage across `GeneroTokenV3.sol`, `Governance.sol`, `ReserveRegistry.sol`, `TreasuryController.sol`, and `UserAcceptancePreferencesRegistry.sol` so the implementation now consistently uses underscore-prefixed private/internal identifiers.
- Updated the matching helper-function names in `GeneroTokenV3.sol` to the same underscore-prefixed convention and kept the existing token behaviour intact.
- Added narrow `solhint` suppression only where the Sarafu-derived private constants in `GeneroTokenV3.sol` must stay in SCREAMING_SNAKE_CASE, avoiding a clash between the underscore rule and the constant-name rule.
- Kept the pass ABI-safe for the targeted contracts; this was an internal naming and tooling-alignment cleanup rather than a behaviour change.
- Recorded the lint-hardening note in the engineering specs so the repo’s current source of truth matches the implementation.

### Verification
- `forge build`
- `pnpm dlx solhint -c /tmp/solhint.XXXXXX.json contracts/foundry/src/torontocoin/GeneroTokenV3.sol contracts/foundry/src/torontocoin/Governance.sol contracts/foundry/src/torontocoin/ReserveRegistry.sol contracts/foundry/src/torontocoin/TreasuryController.sol contracts/foundry/src/torontocoin/UserAcceptancePreferencesRegistry.sol`
- `forge test --match-path test/unit/torontocoin/GeneroTokenV3.t.sol`
- `forge test --match-path test/unit/torontocoin/GovernanceDeadline.t.sol`
- `forge test --match-path test/unit/torontocoin/UserAcceptancePreferencesRegistry.t.sol`
- `forge test --match-path test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `forge test --match-path test/unit/torontocoin/PoolRegistry.t.sol`

### Files Edited
- `contracts/foundry/src/torontocoin/GeneroTokenV3.sol`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/ReserveRegistry.sol`
- `contracts/foundry/src/torontocoin/TreasuryController.sol`
- `contracts/foundry/src/torontocoin/UserAcceptancePreferencesRegistry.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.49
### Timestamp
- 2026-03-18 20:15:00 EDT

### Objective
- Clear the current Solidity formatter and linter-style failures on the targeted TorontoCoin contracts without changing contract behaviour.

### What Changed
- Ran `forge fmt` on the targeted TorontoCoin contract set and updated the files that were out of style: `Governance.sol`, `ReserveRegistry.sol`, and `UserAcceptancePreferencesRegistry.sol`.
- Confirmed the formatter check passes for the full requested target list: `GeneroTokenV3.sol`, `Governance.sol`, `ReserveRegistry.sol`, `TreasuryController.sol`, and `UserAcceptancePreferencesRegistry.sol`.
- Left `GeneroTokenV3.sol` and `TreasuryController.sol` unchanged because they were already compliant with the formatter path used by the repo.

### Verification
- `forge fmt --check src/torontocoin/GeneroTokenV3.sol src/torontocoin/Governance.sol src/torontocoin/ReserveRegistry.sol src/torontocoin/TreasuryController.sol src/torontocoin/UserAcceptancePreferencesRegistry.sol`

### Files Edited
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/ReserveRegistry.sol`
- `contracts/foundry/src/torontocoin/UserAcceptancePreferencesRegistry.sol`
- `agent-context/session-log.md`

## v1.48
### Timestamp
- 2026-03-18 20:06:00 EDT

### Objective
- Add the missing contract notes for `Treasury` and `LiquidityRouter`, and rewrite `TreasuryController.md` so the documentation matches the current treasury split, collateralization policy, and router integration.

### What Changed
- Added `contracts/foundry/src/torontocoin/Treasury.md` documenting `Treasury` as the pure reserve vault, its authorization model, its reserve-movement primitives, and its strict separation from treasury economics.
- Added `contracts/foundry/src/torontocoin/LiquidityRouter.md` documenting the router’s non-custodial execution role, registry-driven acceptance model, pool-selection logic, charity top-up flow, and governance/admin surface.
- Rewrote `contracts/foundry/src/torontocoin/TreasuryController.md` so it now reflects the live split architecture: `Treasury` as reserve vault, `TreasuryController` as policy engine, router-only reserve settlement, overcollateralization-driven charity minting, and the current owner/governance/indexer/liquidity-router authority model.
- Updated the engineering specs to record that the contract-level TorontoCoin design notes are now current for the treasury/controller/router boundary.

### Verification
- Documentation-only pass; no tests were run.

### Files Edited
- `contracts/foundry/src/torontocoin/Treasury.md`
- `contracts/foundry/src/torontocoin/LiquidityRouter.md`
- `contracts/foundry/src/torontocoin/TreasuryController.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.47
### Timestamp
- 2026-03-18 19:56:00 EDT

### Objective
- Add a canonical `UserAcceptancePreferencesRegistry` for pool, merchant-voucher, and token acceptance policy, then make `LiquidityRouter` read those stored preferences on-chain instead of taking user preference vectors as calldata.

### What Changed
- Added `contracts/foundry/src/torontocoin/UserAcceptancePreferencesRegistry.sol`, a self-contained on-chain registry where users can manage denied and accepted pools, denied and accepted merchants, ranked preferred merchants, denied and accepted token addresses, ranked preferred token addresses, and one global `strictAcceptedOnly` flag.
- Added `contracts/foundry/src/torontocoin/UserAcceptancePreferencesRegistry.md` and updated `contracts/foundry/src/torontocoin/README.md` so the repo now documents the canonical semantics: allow-unless-denied by default, strict mode as one global flag, pool preferences as allow/deny only, and merchant/token preferences as rankable and implicitly accepted when preferred.
- Refactored `contracts/foundry/src/torontocoin/LiquidityRouter.sol` so buy and preview flows are now registry-driven: `buyCplTcoin(bytes32,uint256,uint256)` uses `msg.sender`, `previewBuyCplTcoin(address,bytes32,uint256)` takes an explicit buyer, the router stores an `acceptancePreferencesRegistry` pointer, and pool selection now hard-excludes denied pools and denied merchant ecosystems while enforcing strict token/pool/merchant acceptance rules and rank-sensitive preferred-merchant scoring.
- Replaced the router’s pool-adapter preference hook with the generic `poolMatchesAnyMerchantIds(bytes32,bytes32[])` shape so the same adapter method can be reused for denied, accepted, and preferred merchant matching.
- Extended `contracts/foundry/src/torontocoin/interfaces/ILiquidityRouterGovernance.sol` plus `contracts/foundry/src/torontocoin/Governance.sol` so stewards can now propose `LiquidityRouterSetAcceptancePreferencesRegistry` updates against the finalized router admin surface.
- Added `contracts/foundry/test/unit/torontocoin/UserAcceptancePreferencesRegistry.t.sol`, rewrote `contracts/foundry/test/unit/torontocoin/LiquidityRouter.t.sol` around the live registry, and expanded `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol` so the new acceptance-registry router pointer is covered under the intended governance ownership model.
- Updated the engineering specs so the current repo-level source of truth now states that voucher acceptance preferences are canonical on-chain protocol state and that `LiquidityRouter` consumes that state directly for pool eligibility and scoring.

### Verification
- `forge test --match-path test/unit/torontocoin/UserAcceptancePreferencesRegistry.t.sol`
- `forge test --match-path test/unit/torontocoin/LiquidityRouter.t.sol`
- `forge test --match-path test/unit/torontocoin/GovernanceDeadline.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/UserAcceptancePreferencesRegistry.sol`
- `contracts/foundry/src/torontocoin/UserAcceptancePreferencesRegistry.md`
- `contracts/foundry/src/torontocoin/LiquidityRouter.sol`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/interfaces/ILiquidityRouterGovernance.sol`
- `contracts/foundry/src/torontocoin/README.md`
- `contracts/foundry/test/unit/torontocoin/UserAcceptancePreferencesRegistry.t.sol`
- `contracts/foundry/test/unit/torontocoin/LiquidityRouter.t.sol`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.46
### Timestamp
- 2026-03-18 17:40:00 EDT

### Objective
- Finish the treasury split everywhere so the repo consistently treats `Treasury` as the only reserve vault and `TreasuryController` as the economic policy layer only.

### What Changed
- Refactored `contracts/foundry/test/unit/torontocoin/mocks/MockTreasuryMinting.sol` to use a tiny `MockTreasuryVaultForMinting`, so the minting mock now points `treasury()` at a vault address and deposits reserve assets into that vault instead of into the controller mock itself.
- Tightened `contracts/foundry/test/unit/torontocoin/TcoinMintRouter.t.sol` so the router path now asserts the treasury mock is not self-custodying reserves and that successful reserve-backed mints end with CADm in the mock vault and not on the controller mock.
- Rewrote the stale treasury-custody language in `contracts/foundry/src/torontocoin/TreasuryController.md`, `contracts/foundry/src/torontocoin/TcoinMintRouter.md`, and `contracts/foundry/src/torontocoin/ReserveRegistry.md` so they now describe `Treasury` as the reserve holder and `TreasuryController` as the pricing/redemption/router policy engine.
- Updated `docs/engineering/tcoin-smart-contract-architecture.md`, `docs/engineering/tcoin-smart-contract-design-specs.md`, and `docs/engineering/mintTcoinWithUSDC-architecture.md` to introduce `Treasury` as a first-class vault, move reserve-balance ownership from the controller to the vault, and show router/controller/vault interactions explicitly in the architecture narrative.
- Rebuilt `contracts/foundry/src/torontocoin/allTcoinContracts.md` as a live treasury-split mirror that includes the vault interface, minting interface, `Treasury`, and the vault-based `TreasuryController` boundary notes.
- Updated the engineering specs so the current repo-level source of truth now says the treasury split is fully reflected across code, mocks, docs, and mirrors, while admin still retains emergency freeze/unfreeze powers because governance voting is too slow for that operational path.

### Verification
- `forge test --match-path test/unit/torontocoin/TcoinMintRouter.t.sol`
- `forge test --match-path test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/test/unit/torontocoin/mocks/MockTreasuryMinting.sol`
- `contracts/foundry/test/unit/torontocoin/TcoinMintRouter.t.sol`
- `contracts/foundry/src/torontocoin/TreasuryController.md`
- `contracts/foundry/src/torontocoin/TcoinMintRouter.md`
- `contracts/foundry/src/torontocoin/ReserveRegistry.md`
- `contracts/foundry/src/torontocoin/allTcoinContracts.md`
- `docs/engineering/tcoin-smart-contract-architecture.md`
- `docs/engineering/tcoin-smart-contract-design-specs.md`
- `docs/engineering/mintTcoinWithUSDC-architecture.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.45
### Timestamp
- 2026-03-18 17:20:00 EDT

### Objective
- Reconcile `Governance.sol` with the finalized `TreasuryController`, `LiquidityRouter`, and token admin surfaces so on-chain proposals match the current signatures and ownership model.

### What Changed
- Expanded `contracts/foundry/src/torontocoin/Governance.sol` with a `liquidityRouter` pointer, a router-governance event/setter, renamed the stale demurrage proposal path to `ExpirePeriodUpdate`, and added explicit proposal families for finalized `TreasuryController` and `LiquidityRouter` pointer/config/admin actions.
- Added `contracts/foundry/src/torontocoin/interfaces/ILiquidityRouterGovernance.sol` and broadened `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol` so governance dispatch compiles against the current owner-only, governance-only, and governance-or-owner treasury/router surfaces.
- Rebuilt `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol` around access-controlled controller/router/token mocks that enforce the intended deployment posture, covering deadline gating, merchant-entity approval payloads, expiry-period updates, router/controller admin proposals, and failure cases when Governance is not wired as the target owner/governance address.
- Updated `contracts/foundry/src/torontocoin/Governance.md` plus the engineering specs to document that `Governance` should own the finalized controller/router stack and act as their configured governance address where applicable.
- Left `contracts/foundry/src/torontocoin/allTcoinContracts.md` untouched in this session because it is currently deleted in the worktree and restoring it here would overwrite an existing repo-side change outside this task.

### Verification
- `forge test --match-path test/unit/torontocoin/GovernanceDeadline.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/Governance.md`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol`
- `contracts/foundry/src/torontocoin/interfaces/ILiquidityRouterGovernance.sol`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.44
### Timestamp
- 2026-03-18 15:51:00 EDT

### Objective
- Harden `GeneroTokenV3` so `cplTCOIN` is safer to operate in production, with corrected burn semantics, explicit writer authority, clearer previews, visible allowance reporting, and stronger merchant-transfer documentation.

### What Changed
- Refactored `contracts/foundry/src/torontocoin/GeneroTokenV3.sol` around a unified transfer quote path that now powers `transfer`, `transferFrom`, `previewTransfer(...)`, `previewMerchantTransfer(...)`, and `previewAllowanceRequired(...)`.
- Switched token allowance storage to internal base-unit accounting with a visible-unit `allowance(...)` getter, visible-unit `Approval` events, and post-spend approval emission in `transferFrom(...)`.
- Added `getMerchantFeeConfig(...)` and `canResolveCharityFor(...)`, documented the base-unit conservation rule for merchant fee routing, and kept the charity base credit as the rounding remainder to preserve exact internal conservation.
- Fixed `burn(uint256)` to check the base delta instead of comparing visible units to base balance, removed the broken zero-argument `burn()` overload, and separated owner admin authority from explicit writer mint/burn authority.
- Rewrote `contracts/foundry/test/unit/torontocoin/GeneroTokenV3.t.sol` to cover explicit writer requirements, allowance previews, visible allowance decay, merchant-transfer event semantics, charity-resolution health checks, fee-config introspection, and rounding bounds across decimals and demurrage states.
- Updated `contracts/foundry/src/torontocoin/GeneroToken.md`, synced the token surface into `contracts/foundry/src/torontocoin/allTcoinContracts.md`, and refreshed the engineering specs.

### Verification
- `forge test --match-path test/unit/torontocoin/GeneroTokenV3.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/GeneroTokenV3.sol`
- `contracts/foundry/src/torontocoin/GeneroToken.md`
- `contracts/foundry/src/torontocoin/allTcoinContracts.md`
- `contracts/foundry/test/unit/torontocoin/GeneroTokenV3.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.43
### Timestamp
- 2026-03-18 15:28:00 EDT

### Objective
- Add a controllable admin override for `TreasuryController.mintToCharity(...)`, defaulting to enabled while still allowing governance or the admin to switch that path off.

### What Changed
- Added `adminCanMintToCharity` to `contracts/foundry/src/torontocoin/TreasuryController.sol`, defaulting it to `true` during initialization.
- Added `setAdminCanMintToCharity(bool enabled)` plus an `AdminCanMintToCharityUpdated` event so either governance or the owner/admin can disable or re-enable the admin charity-mint path.
- Refactored both `mintToCharity(...)` entrypoints to allow governance unconditionally and owner/admin calls only when `adminCanMintToCharity` remains enabled.
- Expanded `contracts/foundry/test/unit/torontocoin/TreasuryMintPreview.t.sol` to verify the default admin mint path, governance-driven disablement, and owner self-disablement while preserving governance access.
- Synced the treasury-controller interface addition into `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol`, mirrored the public interface change into `contracts/foundry/src/torontocoin/allTcoinContracts.md`, and updated the engineering specs.

### Verification
- `forge test --match-path test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/TreasuryController.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol`
- `contracts/foundry/src/torontocoin/allTcoinContracts.md`
- `contracts/foundry/test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.42
### Timestamp
- 2026-03-18 15:12:37 EDT

### Objective
- Extend `Governance.sol` so stewards can execute on-chain proposals for `setOvercollateralizationTarget(...)` and `mintToCharity(...)` on the refactored treasury controller.

### What Changed
- Added new governance proposal types for overcollateralization-target updates and excess-capacity charity mints, plus the corresponding payload storage and steward-facing proposal constructors in `contracts/foundry/src/torontocoin/Governance.sol`.
- Extended proposal execution so approved governance actions now call `ITreasuryController.setOvercollateralizationTarget(...)`, `ITreasuryController.mintToCharity(uint256)`, or `ITreasuryController.mintToCharity(uint256,uint256)` as appropriate.
- Expanded `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol` so governance can compile against the new treasury-controller hooks.
- Added focused Foundry coverage in `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol` for deadline-gated execution of both the collateral-target proposal and default/specified charity-mint proposals.
- Synced the governance and interface changes into `contracts/foundry/src/torontocoin/allTcoinContracts.md` and updated the engineering specs.

### Verification
- `forge test --match-path test/unit/torontocoin/GovernanceDeadline.t.sol`
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol`
- `contracts/foundry/src/torontocoin/allTcoinContracts.md`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.41
### Timestamp
- 2026-03-18 14:59:54 EDT

### Objective
- Split reserve custody out of `TreasuryController` into a dedicated `Treasury` vault, refactor the controller into the pure economic policy layer, and preserve router/on-ramp settlement flows against the new custody model.

### What Changed
- Added `contracts/foundry/src/torontocoin/Treasury.sol`, a non-upgradeable reserve vault with owner-managed authorized callers, reserve deposit/withdraw primitives, balance views, and emergency sweep support.
- Added `contracts/foundry/src/torontocoin/interfaces/ITreasuryVault.sol` and refactored `contracts/foundry/src/torontocoin/TreasuryController.sol` so reserve custody now flows through the vault instead of the controller contract itself.
- Refactored `TreasuryController` initialization and storage to include `treasury`, `liquidityRouter`, and `overcollateralizationTarget18`, added live collateralization and charity-headroom views, and implemented governance-only `mintToCharity(...)` against excess collateralization headroom.
- Updated the router-facing settlement path so `depositAssetForLiquidityRoute(...)` is router-only, deposits reserves into `Treasury`, and mints mrTCOIN to the router caller; updated `LiquidityRouter.sol` so it now approves the vault, receives mrTCOIN, and passes that liquidity on to the pool adapter.
- Updated `TcoinMintRouter.sol` and `ITreasuryMinting.sol` so the swap router now approves the underlying vault address instead of the controller for reserve-backed minting.
- Expanded the shared interfaces (`ITCOINToken`, `IReserveRegistry`, `ITreasuryMinting`) and added focused Foundry coverage for the vault plus the refactored controller custody/collateralization paths.
- Mirrored the new `Treasury` contract and the related API/interface changes into `contracts/foundry/src/torontocoin/allTcoinContracts.md`.
- Enabled `via_ir = true` in `contracts/foundry/foundry.toml` after the split controller exceeded Solidity 0.8.30’s non-IR stack limits under the existing optimizer settings.

### Verification
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/Treasury.sol`
- `contracts/foundry/src/torontocoin/TreasuryController.sol`
- `contracts/foundry/src/torontocoin/LiquidityRouter.sol`
- `contracts/foundry/src/torontocoin/TcoinMintRouter.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryVault.sol`
- `contracts/foundry/src/torontocoin/interfaces/IReserveRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITCOINToken.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryMinting.sol`
- `contracts/foundry/src/torontocoin/allTcoinContracts.md`
- `contracts/foundry/test/unit/torontocoin/Treasury.t.sol`
- `contracts/foundry/test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `contracts/foundry/test/unit/torontocoin/LiquidityRouter.t.sol`
- `contracts/foundry/test/unit/torontocoin/mocks/MockTreasuryMinting.sol`
- `contracts/foundry/foundry.toml`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.40
### Timestamp
- 2026-03-18 14:28:42 EDT

### Objective
- Build `LiquidityRouter` as the non-custodial execution layer for reserve-asset to `cplTCOIN` liquidity routes, and align the treasury/token/governance surfaces it depends on.

### What Changed
- Added `contracts/foundry/src/torontocoin/LiquidityRouter.sol`, including the router-local treasury, token, charity-preferences, pool-registry, and pool-adapter interfaces needed for reserve-asset routing into `cplTCOIN`.
- Implemented weighted pool scoring with hard eligibility filters, explicit pool and merchant-preference inputs, deterministic fallback to the best eligible pool, preview support, and direct `cplTCOIN` charity top-up minting to the resolved charity wallet.
- Updated `contracts/foundry/src/torontocoin/TreasuryController.sol` with router-facing reserve-deposit helpers (`depositAssetForLiquidityRoute`, `previewLiquidityRouteDeposit`, `getReserveAssetToken`), switched mint calls to the writer-style `mint(address,uint256,bytes)` surface, and changed redemption burns to transfer tokens in first and then call `burn(uint256)`.
- Updated `contracts/foundry/src/torontocoin/interfaces/ITCOINToken.sol` to match the `GeneroTokenV3` writer-style token surface and adjusted `contracts/foundry/src/torontocoin/Governance.sol` to use `setExpirePeriod(...)` on the remaining demurrage proposal path.
- Added `contracts/foundry/test/unit/torontocoin/LiquidityRouter.t.sol` covering preferred-pool routing, automatic fallback, merchant-preference scoring, and admin pool seeding/top-up behaviour, and refreshed the treasury/governance mocks that still assumed the pre-`GeneroTokenV3` token ABI.
- Mirrored the router and the related treasury/governance/token-interface changes into `contracts/foundry/src/torontocoin/allTcoinContracts.md` and updated the engineering specs to describe the new routing flow.

### Verification
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/LiquidityRouter.sol`
- `contracts/foundry/src/torontocoin/TreasuryController.sol`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITCOINToken.sol`
- `contracts/foundry/src/torontocoin/allTcoinContracts.md`
- `contracts/foundry/test/unit/torontocoin/LiquidityRouter.t.sol`
- `contracts/foundry/test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.39
### Timestamp
- 2026-03-18 13:23:40 EDT

### Objective
- Build `GeneroTokenV3` as the Sarafu-family `cplTCOIN` demurrage token with merchant POS fee routing, direct charity fee payout, and preview helpers.

### What Changed
- Added `contracts/foundry/src/torontocoin/GeneroTokenV3.sol`, a Sarafu-style demurrage token that preserves base-balance demurrage, writer/mint/seal/expiry/max-supply/sink controls, and adds merchant-target fee logic on ordinary `transfer` and `transferFrom`.
- Added minimal local registry interfaces inside `GeneroTokenV3.sol` for `PoolRegistry` merchant-target detection and `UserCharityPreferencesRegistry` charity/voluntary-fee resolution.
- Implemented merchant fee configuration knobs: pool-registry and charity-preferences registry setters, merchant-fee enable toggle, default merchant fee, per-merchant-id fee overrides, and address-based fee exemptions.
- Added the required preview and introspection helpers, including `previewMerchantTransfer`, `feeApplies`, `getEffectiveMerchantFeeBps`, `getMerchantFeeOverride`, and `hasMerchantFeeOverride`.
- Added `contracts/foundry/test/unit/torontocoin/GeneroTokenV3.t.sol` covering merchant transfer splits, transfer-from allowance consumption on actual payer debit, fee exemptions, and merchant-id fee overrides.
- Added the accompanying `contracts/foundry/src/torontocoin/GeneroToken.md` design note and replaced the old simple token section in `contracts/foundry/src/torontocoin/allTcoinContracts.md` with the new `GeneroTokenV3` implementation.
- Updated the engineering specs to record the new `cplTCOIN` merchant-payment semantics.

### Verification
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/GeneroTokenV3.sol`
- `contracts/foundry/src/torontocoin/GeneroToken.md`
- `contracts/foundry/src/torontocoin/allTcoinContracts.md`
- `contracts/foundry/test/unit/torontocoin/GeneroTokenV3.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.38
### Timestamp
- 2026-03-18 12:36:17 EDT

### Objective
- Refactor the TorontoCoin `PoolRegistry` into a merchant-entity registry for `cplTCOIN`, with multi-wallet merchants, merchant-level cpl acceptance and POS-fee eligibility, and wallet-facing payment-target helpers.

### What Changed
- Replaced the wallet-keyed `PoolRegistry` merchant model with `MerchantEntity` records keyed by `bytes32 merchantId`, including merchant-level `acceptsCplTcoin` and `posFeeEligible` flags, linked-wallet management, compact wallet payment-config lookup, and wallet-facing predicate helpers for payment/POS checks.
- Expanded `IPoolRegistry` to expose the new merchant-entity approval and query surface while preserving wallet-based compatibility helpers used by existing merchant-redemption logic.
- Updated `Governance.sol` so merchant approval, suspension, removal, and pool-reassignment proposals now carry `merchantId` payloads, with merchant approval also capturing the initial wallet set.
- Added focused Foundry coverage for the new merchant-entity workflow and updated the governance test mock to the new pool-registry ABI.
- Mirrored the updated `PoolRegistry` and `IPoolRegistry` definitions into `contracts/foundry/src/torontocoin/allTcoinContracts.md`.
- Updated the engineering specs to record the new merchant-entity payment-detection model.

### Verification
- `forge test`

### Files Edited
- `contracts/foundry/src/torontocoin/PoolRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IPoolRegistry.sol`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/allTcoinContracts.md`
- `contracts/foundry/test/unit/torontocoin/PoolRegistry.t.sol`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.37
### Timestamp
- 2026-03-15 11:10:00 EDT

### Objective
- Fix the latest PR #58 CI failures by aligning the remaining edge handlers with the shared response helper contract and updating stale tests after the wallet-identity/read-model refactor.

### What Changed
- Updated the edge handlers in `supabase/functions/citycoin-market/index.ts`, `supabase/functions/onramp/index.ts`, `supabase/functions/payment-requests/index.ts`, `supabase/functions/voucher-preferences/index.ts`, `supabase/functions/control-plane/index.ts`, `supabase/functions/governance/index.ts`, `supabase/functions/merchant-applications/index.ts`, `supabase/functions/redemptions/index.ts`, and `supabase/functions/store-operations/index.ts` so every `jsonResponse` call now passes the active `Request`, matching the shared CORS-aware response helper signature.
- Updated `shared/api/services/supabaseService.test.ts` so the contact-service tests mock `v_wallet_identities_v1` instead of the pre-refactor `wallet_list` table and reflect the current “first wallet identity wins” behaviour.
- Updated `app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx` so its wallet mocks align with `v_wallet_identities_v1` and its transaction-modal assertions match the current received/sent rendering.

### Verification
- `pnpm exec tsc --noEmit -p tsconfig.ci.json`
- `pnpm test -- --reporter=default --run`

### Files Edited
- `supabase/functions/citycoin-market/index.ts`
- `supabase/functions/onramp/index.ts`
- `supabase/functions/payment-requests/index.ts`
- `supabase/functions/voucher-preferences/index.ts`
- `supabase/functions/control-plane/index.ts`
- `supabase/functions/governance/index.ts`
- `supabase/functions/merchant-applications/index.ts`
- `supabase/functions/redemptions/index.ts`
- `supabase/functions/store-operations/index.ts`
- `shared/api/services/supabaseService.test.ts`
- `app/tcoin/wallet/components/dashboard/ContactsTab.test.tsx`
- `agent-context/session-log.md`

## v1.36
### Timestamp
- 2026-03-15 10:40:00 EDT

### Objective
- Address the active inline review comments on PR #58 by tightening request validation, cleaning up edge auth headers, fixing rate-dedupe and wallet normalisation edge cases, and aligning seed/migration details with repository standards.

### What Changed
- Updated `supabase/functions/user-requests/index.ts` so `/create` now rejects malformed JSON and validates trimmed `name`, `email`, and `message` fields before inserting, and exported `handleRequest` for direct handler tests.
- Added focused coverage in `supabase/functions/user-requests/index.test.ts` for rejected invalid payloads and successful validated inserts.
- Updated `shared/lib/edge/core.ts` and `shared/lib/edge/serverProxy.ts` so public edge invocations omit `Authorization` entirely when there is no session token, while still failing fast on missing Supabase URL/publishable-key configuration.
- Added targeted tests in `shared/lib/edge/core.test.ts` and `shared/lib/edge/serverProxy.test.ts` to pin the conditional-auth-header behaviour.
- Replaced the commented rollback stub in `supabase/migrations/20260314231500_v1.05_citycoin_exchange_rates.sql` with a proper executable `-- migrate:down` section.
- Updated `services/indexer/src/rates.ts` and `services/indexer/src/rates.test.ts` to compare `observed_at` timestamps semantically instead of by raw string formatting, preventing duplicate inserts when Postgres and `toISOString()` serialize the same instant differently.
- Updated `shared/lib/supabase/walletIdentities.ts` and added `shared/lib/supabase/walletIdentities.test.ts` so wallet lookups are normalised to lowercase for querying while preserving caller-provided keys in the returned map.
- Changed the duplicate personal seed email on the non-primary seeded user in `supabase/seed.sql` to `hubert-cormac@example.com`, keeping the first admin seed row unchanged per PR guidance.

### Verification
- `pnpm exec tsc --noEmit -p tsconfig.ci.json`
- `npx vitest run supabase/functions/user-requests/index.test.ts shared/lib/edge/core.test.ts shared/lib/edge/serverProxy.test.ts services/indexer/src/rates.test.ts shared/lib/supabase/walletIdentities.test.ts`

### Files Edited
- `supabase/functions/user-requests/index.ts`
- `supabase/functions/user-requests/index.test.ts`
- `shared/lib/edge/core.ts`
- `shared/lib/edge/core.test.ts`
- `shared/lib/edge/serverProxy.ts`
- `shared/lib/edge/serverProxy.test.ts`
- `supabase/migrations/20260314231500_v1.05_citycoin_exchange_rates.sql`
- `services/indexer/src/rates.ts`
- `services/indexer/src/rates.test.ts`
- `shared/lib/supabase/walletIdentities.ts`
- `shared/lib/supabase/walletIdentities.test.ts`
- `supabase/seed.sql`
- `agent-context/session-log.md`

## v1.35
### Timestamp
- 2026-03-15 01:45:00 EDT

### Objective
- Fix the failing Frontend CI workflow on PR #58 by resolving the new type errors in the city-rate indexer path and shared Radio component.

### What Changed
- Updated `services/indexer/src/rates.ts` so the optional `ORACLE_ROUTER` and `TCOIN` contract addresses are narrowed after the zero-address guards before calling `viem` `readContract`, which satisfies the stricter CI typecheck without weakening the runtime setup checks.
- Updated `shared/components/ui/Radio.tsx` so `RadioProps` omits the native input `size` attribute before extending the component variant props, avoiding the `InputHTMLAttributes` and `class-variance-authority` type collision uncovered in CI.

### Verification
- `pnpm exec tsc --noEmit -p tsconfig.ci.json`
- `npx vitest run services/indexer/src/rates.test.ts app/tcoin/wallet/components/modals/ContactSelectModal.test.tsx`

### Files Edited
- `services/indexer/src/rates.ts`
- `shared/components/ui/Radio.tsx`
- `agent-context/session-log.md`

## v1.34
### Timestamp
- 2026-03-15 00:50:00 EDT

### Objective
- Formalize payment requests as a city-scoped cross-app contract and remove direct browser access to `invoice_pay_request`.

### What Changed
- Added `supabase/migrations/20260315003000_v1.06_payment_requests_contract.sql`:
  - formalizes `public.invoice_pay_request` with canonical lifecycle and scope columns (`citycoin_id`, `request_by`, `amount_requested`, `status`, `updated_at`, `paid_at`, `closed_at`)
  - backfills `citycoin_id` from `ref_app_instances`
  - creates `public.v_payment_requests_v1` as the stable app-facing read model over payment requests, users, app instances, city coins, and wallet identities
- Added the new `payment-requests` edge domain:
  - `supabase/functions/payment-requests/index.ts`
  - `supabase/functions/_shared/paymentRequests.ts`
  - `shared/lib/edge/paymentRequests.ts`
  - `shared/lib/edge/paymentRequestsClient.ts`
- Refactored Wallet and SpareChange payment-request consumers to use the edge client instead of direct browser reads/writes:
  - `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
  - `app/tcoin/wallet/components/dashboard/SendTab.tsx`
  - `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
  - `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx`
  - `app/tcoin/sparechange/components/modals/ContactSelectModal.tsx`
- Updated dashboard payment-request types and seed data to align with the canonical contract.
- Tightened a few adjacent UI typings uncovered during the refactor:
  - `shared/components/ui/Radio.tsx` now uses input attributes so checked/defaultChecked callers type-check correctly
  - `app/tcoin/wallet/components/modals/QrScanModal.tsx` now declares its optional amount setters in the prop interface

### Verification
- `rg -n "from\\(\"invoice_pay_request\"\\)|invoice_pay_request" app/tcoin shared -g '!**/*.test.tsx'`
- `npx vitest run supabase/functions/payment-requests/index.test.ts app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/dashboard/SendTab.test.tsx app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `npx tsc --noEmit --pretty false 2>&1 | rg "payment-requests|PaymentRequest|ReceiveTab|SendTab|WalletHome|ContactSelectModal|invoice_pay_request|v_payment_requests_v1|20260315003000|QrScanModal"`

### Files Edited
- `supabase/migrations/20260315003000_v1.06_payment_requests_contract.sql`
- `supabase/seed.sql`
- `supabase/functions/payment-requests/index.ts`
- `supabase/functions/payment-requests/index.test.ts`
- `supabase/functions/_shared/paymentRequests.ts`
- `shared/lib/edge/paymentRequests.ts`
- `shared/lib/edge/paymentRequestsClient.ts`
- `app/tcoin/wallet/components/dashboard/types.ts`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx`
- `app/tcoin/sparechange/components/modals/ContactSelectModal.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/ReceiveCard.test.tsx`
- `shared/components/ui/Radio.tsx`
- `app/tcoin/wallet/components/modals/QrScanModal.tsx`
- `app/tcoin/wallet/components/modals/ContactSelectModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.33
### Timestamp
- 2026-03-14 23:15:00 EDT

### Objective
- Replace the broken `control_variables` browser read with a city-scoped, indexer-backed exchange-rate contract tied to the on-chain oracle router.

### What Changed
- Added `supabase/migrations/20260314231500_v1.05_citycoin_exchange_rates.sql`:
  - extends `indexer.city_contract_overrides` with `oracle_router_address`
  - creates `public.citycoin_exchange_rates` as append-mostly citycoin rate storage keyed by `ref_citycoins.id`
  - creates `public.v_citycoin_exchange_rates_current_v1` as the canonical current-rate projection
- Added a new `citycoin-market` edge function and shared edge client/types:
  - `supabase/functions/citycoin-market/index.ts`
  - `shared/lib/edge/citycoinMarket.ts`
  - `shared/lib/edge/citycoinMarketClient.ts`
- Refactored `shared/hooks/useGetLatestExchangeRate.ts` so it no longer reads Supabase tables directly from the browser and now returns city-scoped rate state from the edge function.
- Extended the city registry/read surfaces to include `ORACLE_ROUTER`:
  - `contracts/foundry/src/registry/CityImplementationRegistry.sol`
  - `shared/lib/contracts/cityRegistryAbi.ts`
  - `shared/lib/contracts/cityContracts.ts`
  - `services/indexer/src/discovery/cityContracts.ts`
- Added `services/indexer/src/rates.ts` and wired the user-triggered indexer to persist oracle-router rate snapshots during city indexing runs.
- Updated key wallet/sparechange transactional surfaces to distinguish live and fallback rate usage in copy instead of silently treating fallback values as live data.

### Verification
- Targeted Vitest run covering the new hook, citycoin-market function, indexer rate module, and updated wallet modal/dashboard tests.

### Files Edited
- `supabase/migrations/20260314231500_v1.05_citycoin_exchange_rates.sql`
- `supabase/functions/citycoin-market/index.ts`
- `supabase/functions/citycoin-market/index.test.ts`
- `shared/lib/edge/citycoinMarket.ts`
- `shared/lib/edge/citycoinMarketClient.ts`
- `shared/hooks/useGetLatestExchangeRate.ts`
- `shared/hooks/useGetLatestExchangeRate.test.tsx`
- `services/indexer/src/rates.ts`
- `services/indexer/src/rates.test.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/discovery/cityContracts.ts`
- `contracts/foundry/src/registry/CityImplementationRegistry.sol`
- `contracts/foundry/test/unit/CityImplementationRegistry.t.sol`
- `shared/lib/contracts/cityRegistryAbi.ts`
- `shared/lib/contracts/cityContracts.ts`
- `shared/lib/contracts/cityContracts.test.ts`
- `shared/lib/contracts/management/abis/cityImplementationRegistryAbi.ts`
- `shared/lib/contracts/management/types.ts`
- `shared/lib/contracts/management/registryOps.ts`
- `app/tcoin/contracts/registry/page.tsx`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/tcoin/wallet/components/modals/TopUpModal.tsx`
- `app/tcoin/wallet/components/modals/OffRampModal.tsx`
- `app/tcoin/sparechange/components/modals/OffRampModal.tsx`
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.32
### Timestamp
- 2026-03-14 22:10:00 EDT

### Objective
- Harden the v1.04 operational-read-model migration so it applies cleanly to the linked Supabase project, then verify the deployed edge-function stack in the browser.

### What Changed
- Updated `supabase/migrations/20260314221500_v1.04_operational_read_models.sql` so the migration is self-sufficient on older linked environments:
  - adds `wallet_list.public_key` and `wallet_key_id` if missing before creating `v_wallet_identities_v1`
  - removes dependencies on `user_encrypted_share.revoked_at`, `last_used_at`, and `app_instance_id` while building the wallet-identity rollup
  - converts the reversible block into a non-executed `-- DOWN` section so `supabase db push` applies only the forward migration
- Applied the updated migration to the linked Supabase project and redeployed the touched functions (`onramp`, `bia-service`, `voucher-preferences`).
- Ran a browser smoke pass on `http://localhost:3001` with the linked backend and confirmed the admin surface now loads through direct edge-function calls with `200` responses across:
  - `onramp/admin/requests`
  - `onramp/admin/sessions`
  - `bia-service/list`
  - `bia-service/mappings`
  - `voucher-preferences/compatibility`
  - `voucher-preferences/merchants`
  - `redemptions/list`
  - `governance/actions`

### Verification
- `supabase db push --linked`
- `supabase functions deploy onramp --no-verify-jwt`
- `supabase functions deploy bia-service --no-verify-jwt`
- `supabase functions deploy voucher-preferences --no-verify-jwt`
- Browser smoke pass on `/dashboard`, `/admin`, `/city-manager`, and `/merchant`

### Files Edited
- `supabase/migrations/20260314221500_v1.04_operational_read_models.sql`
- `docs/engineering/technical-spec.md`
- `agent-context/session-log.md`

## v1.31
### Timestamp
- 2026-03-14 20:35:00 EDT

### Objective
- Replace the remaining raw wallet/admin read assumptions with canonical operational read models and explicit setup-required states.

### What Changed
- Added `supabase/migrations/20260314221500_v1.04_operational_read_models.sql` to formalize the next contract layer:
  - creates `public.v_wallet_identities_v1` as the canonical wallet identity/readiness view over `wallet_list` and encrypted-share state
  - creates `public.v_admin_interac_onramp_ops_v1` and `public.v_admin_manual_offramp_ops_v1` for first-class Interac/manual cash-ops administration
  - normalizes legacy `interac_transfer`, `off_ramp_req`, and `ref_request_statuses` columns needed by those views
- Added `shared/lib/supabase/walletIdentities.ts` and refactored wallet consumers to use that canonical view instead of direct operational `wallet_list` reads:
  - `shared/api/services/supabaseService.ts`
  - `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
  - `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
  - `app/tcoin/wallet/components/dashboard/TransactionHistoryTab.tsx`
  - `shared/hooks/useSendMoney.tsx`
- Updated `supabase/functions/_shared/onramp.ts` so Buy TCOIN wallet readiness is resolved from `v_wallet_identities_v1`, and admin cash-ops reads now come from the new admin views with explicit `ready` / `empty` / `setup_required` states instead of raw legacy table assumptions.
- Updated `supabase/functions/_shared/voucherRouting.ts`, `supabase/functions/voucher-preferences/index.ts`, and `supabase/functions/bia-service/index.ts` so missing read models return `setup_required` contracts instead of surfacing generic hard failures.
- Expanded shared edge DTOs in `shared/lib/edge/onramp.ts`, `shared/lib/edge/vouchers.ts`, `shared/lib/edge/bia.ts`, and `shared/lib/edge/types.ts` to carry operational state and setup messaging.
- Updated `app/tcoin/wallet/admin/page.tsx` so missing cash-ops, BIA mapping, or voucher-liquidity infrastructure renders setup guidance rather than a generic destructive error.

### Verification
- `npx vitest run app/tcoin/wallet/admin/page.test.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx supabase/functions/onramp/index.test.ts supabase/functions/voucher-preferences/index.test.ts`
  - 5 files, 15 tests passed

### Files Edited
- `supabase/migrations/20260314221500_v1.04_operational_read_models.sql`
- `shared/lib/supabase/walletIdentities.ts`
- `shared/api/services/supabaseService.ts`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
- `app/tcoin/wallet/components/dashboard/TransactionHistoryTab.tsx`
- `shared/hooks/useSendMoney.tsx`
- `supabase/functions/_shared/onramp.ts`
- `supabase/functions/_shared/voucherRouting.ts`
- `supabase/functions/voucher-preferences/index.ts`
- `supabase/functions/bia-service/index.ts`
- `shared/lib/edge/types.ts`
- `shared/lib/edge/onramp.ts`
- `shared/lib/edge/vouchers.ts`
- `shared/lib/edge/bia.ts`
- `shared/lib/edge/biaClient.ts`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/admin/page.test.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `supabase/functions/voucher-preferences/index.test.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.30
### Timestamp
- 2026-03-14 19:45:00 EDT

### Objective
- Replace the temporary drift-tolerance layer with the intended future-state contracts for wallet checkout and BIA/voucher read paths.

### What Changed
- Added `supabase/migrations/20260314213000_v1.03_wallet_contract_read_models.sql` to formalize the target schema:
  - adds canonical `public.wallet_list.public_key`
  - adds `public.v_bia_mappings_v1`
  - adds `public.v_bia_mapping_health_v1`
  - adds `public.v_voucher_liquidity_rows_v1`
  - adds `public.get_voucher_merchants_v1(...)`
- Updated `supabase/seed.sql` so the seeded wallet users now have deterministic `wallet_list.public_key` rows and Hubert also has a seeded EVM wallet row.
- Updated `supabase/functions/_shared/onramp.ts` so Buy TCOIN checkout now uses `wallet_list.public_key` as the only recipient-wallet source and returns explicit contract states: `ready`, `needs_wallet`, `disabled`, or `misconfigured`.
- Updated `supabase/functions/_shared/voucherRouting.ts` and `supabase/functions/bia-service/index.ts` so voucher merchant liquidity and BIA mapping health read from the new SQL read models instead of shaping wallet/admin payloads directly from raw `indexer` tables.
- Updated `shared/lib/onramp/types.ts` and `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx` to consume those explicit checkout states, including a dedicated wallet-setup message when the user lacks a canonical EVM public key.
- Added/updated focused tests for the new checkout-state contract in `app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx`.

### Verification
- `npx vitest run app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx supabase/functions/onramp/index.test.ts supabase/functions/voucher-preferences/index.test.ts`
- `npx vitest run app/tcoin/wallet/admin/page.test.tsx app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `npx tsc --noEmit --pretty false 2>&1 | rg "(shared/lib/onramp/types|app/tcoin/wallet/components/modals/BuyTcoinModal|app/tcoin/wallet/components/modals/BuyTcoinModal.test|supabase/functions/_shared/onramp|supabase/functions/_shared/voucherRouting|supabase/functions/bia-service|supabase/functions/voucher-preferences)"`
  - no matches for the files changed in this session

### Files Edited
- `supabase/migrations/20260314213000_v1.03_wallet_contract_read_models.sql`
- `supabase/seed.sql`
- `supabase/functions/_shared/onramp.ts`
- `supabase/functions/_shared/voucherRouting.ts`
- `supabase/functions/bia-service/index.ts`
- `shared/lib/onramp/types.ts`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.29
### Timestamp
- 2026-03-14 17:30:00 EDT

### Objective
- Patch the deployed edge-function stack so the linked Supabase project tolerates legacy schema drift during smoke tests, specifically for on-ramp admin reads, voucher merchant reads, BIA mapping health, and disabled Buy TCOIN checkout.

### What Changed
- Updated `supabase/functions/_shared/onramp.ts` so disabled checkout returns a handled payload, legacy admin request reads fetch user names/emails without relying on schema-cache relationships, and recipient-wallet resolution falls back to `users.address` when `wallet_list.public_key` is unavailable.
- Updated `supabase/functions/_shared/voucherRouting.ts` and `supabase/functions/bia-service/index.ts` to treat missing `indexer` schemas/tables as empty optional data instead of hard errors.
- Updated `shared/lib/onramp/types.ts` and `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx` so the wallet handles disabled checkout responses cleanly.
- Added a regression test in `app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx` for the disabled-checkout response contract.

### Verification
- Pending targeted Vitest rerun after patch application.

### Files Edited
- `supabase/functions/_shared/onramp.ts`
- `supabase/functions/_shared/voucherRouting.ts`
- `supabase/functions/bia-service/index.ts`
- `shared/lib/onramp/types.ts`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.28
### Timestamp
- 2026-03-14 17:05:00 EDT

### Objective
- Update the default Supabase seed identity so the seeded admin user uses `hubert.cormac@gmail.com` instead of `alice@example.com`.

### What Changed
- Changed the seeded `public.users` row with `id = 1001` in `supabase/seed.sql` to use `hubert.cormac@gmail.com`.

### Verification
- `rg -n "alice@example.com" supabase agent-context docs README.md AGENTS.md`
  - only the seed row matched before the update

### Files Edited
- `supabase/seed.sql`
- `agent-context/session-log.md`

## v1.27
### Timestamp
- 2026-03-14 16:20:00 EDT

### Objective
- Finish the app-scoped edge-function migration for wallet onramp and the remaining wallet shim dependencies, then convert the corresponding Next routes into compatibility proxies and add targeted handler-level coverage.

### What Changed
- Replaced the `501` placeholder in `supabase/functions/onramp/index.ts` with a real edge-function handler that now supports checkout session creation, session reads, widget-open updates, admin session listing, manual retry, user touch settlement, and legacy ramp admin reads.
- Added Deno-safe shared helpers for onramp and voucher merchant routing in `supabase/functions/_shared/onramp.ts` and `supabase/functions/_shared/voucherRouting.ts`.
- Tightened `supabase/functions/_shared/appContext.ts` so ambiguous `ref_app_instances` matches now fail unless callers specify `environment` explicitly.
- Expanded `supabase/functions/voucher-preferences/index.ts` to serve voucher compatibility reads/writes and voucher merchant liquidity reads.
- Added `shared/lib/edge/serverProxy.ts` and converted the app-scoped Next routes touched in this phase into compatibility shims that proxy to the canonical edge functions instead of keeping duplicate business logic locally.
- Refactored wallet buy checkout, wallet admin, wallet home, and merchant dashboard flows to use typed edge clients for onramp admin/session operations and voucher compatibility/merchant liquidity reads.
- Added focused Vitest coverage for the new edge handlers, shared app-context/RBAC logic, the onramp and redemption proxy routes, wallet admin, wallet home, and the buy-checkout modal.

### Verification
- `npx vitest run supabase/functions/_shared/appContext.test.ts supabase/functions/_shared/rbac.test.ts supabase/functions/onramp/index.test.ts supabase/functions/voucher-preferences/index.test.ts app/api/onramp/session/route.test.ts app/api/redemptions/routes.test.ts app/tcoin/wallet/components/dashboard/WalletHome.test.tsx app/tcoin/wallet/admin/page.test.tsx app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx`
- `npx tsc --noEmit --pretty false | rg "(serverProxy|shared/lib/edge/onramp|shared/lib/edge/vouchers|shared/lib/edge/voucherPreferencesClient|supabase/functions/onramp|supabase/functions/voucher-preferences|supabase/functions/_shared/onramp|supabase/functions/_shared/voucherRouting|app/tcoin/wallet/components/modals/BuyTcoinModal|app/tcoin/wallet/components/dashboard/WalletHome|app/tcoin/wallet/merchant/LiveMerchantDashboard|app/tcoin/wallet/admin/page|app/api/onramp|app/api/vouchers|app/api/redemptions|app/api/merchant/application|app/api/stores|app/api/city-manager|app/api/bias|app/api/control-plane|app/api/governance|app/api/user_requests)"`
  - no matches for the files changed in this session

### Files Edited
- `shared/lib/edge/serverProxy.ts`
- `shared/lib/edge/onramp.ts`
- `shared/lib/edge/onrampClient.ts`
- `shared/lib/edge/vouchers.ts`
- `shared/lib/edge/voucherPreferencesClient.ts`
- `supabase/functions/_shared/appContext.ts`
- `supabase/functions/_shared/onramp.ts`
- `supabase/functions/_shared/voucherRouting.ts`
- `supabase/functions/onramp/index.ts`
- `supabase/functions/voucher-preferences/index.ts`
- `supabase/functions/_shared/appContext.test.ts`
- `supabase/functions/_shared/rbac.test.ts`
- `supabase/functions/onramp/index.test.ts`
- `supabase/functions/voucher-preferences/index.test.ts`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.test.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/merchant/LiveMerchantDashboard.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/admin/page.test.tsx`
- `app/api/onramp/session/route.ts`
- `app/api/onramp/session/[id]/route.ts`
- `app/api/onramp/session/[id]/retry/route.ts`
- `app/api/onramp/admin/sessions/route.ts`
- `app/api/onramp/touch/route.ts`
- `app/api/admin/ramp-requests/route.ts`
- `app/api/vouchers/preferences/route.ts`
- `app/api/vouchers/compatibility/route.ts`
- `app/api/vouchers/merchants/route.ts`
- `app/api/control-plane/access/route.ts`
- `app/api/governance/actions/route.ts`
- `app/api/user_requests/route.ts`
- `app/api/redemptions/request/route.ts`
- `app/api/redemptions/list/route.ts`
- `app/api/redemptions/[id]/approve/route.ts`
- `app/api/redemptions/[id]/settle/route.ts`
- `app/api/merchant/application/status/route.ts`
- `app/api/merchant/application/start/route.ts`
- `app/api/merchant/application/restart/route.ts`
- `app/api/merchant/application/step/route.ts`
- `app/api/merchant/application/submit/route.ts`
- `app/api/stores/route.ts`
- `app/api/stores/[id]/bia/route.ts`
- `app/api/city-manager/stores/route.ts`
- `app/api/city-manager/stores/[id]/approve/route.ts`
- `app/api/city-manager/stores/[id]/reject/route.ts`
- `app/api/bias/list/route.ts`
- `app/api/bias/mappings/route.ts`
- `app/api/bias/controls/route.ts`
- `app/api/bias/create/route.ts`
- `app/api/bias/select/route.ts`
- `app/api/bias/suggest/route.ts`
- `app/api/onramp/session/route.test.ts`
- `app/api/redemptions/routes.test.ts`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `agent-context/session-log.md`

## v1.26
### Timestamp
- 2026-03-14 04:05:00 EDT

### Objective
- Move the current technical and functional specs plus root-level architecture notes into `docs/engineering`, then update the repo instructions so future edge-function work follows the new documentation layout.

### What Changed
- Moved `technical-spec.md` and `functional-spec.md` from `agent-context/` into `docs/engineering/`.
- Moved the root-level architecture notes and runbooks from `docs/` into `docs/engineering/`, leaving subfolders such as `docs/20260310-neighbourhood-pools/` and `docs/torontocoin/` in place.
- Updated `README.md` and `AGENTS.md` so the repository structure now treats `docs/engineering/` as the source of truth for current engineering specs and root architecture documents.
- Updated `agent-context/workflow.md` so the per-session checklist points at the moved spec files.
- Fixed the moved smart-contract documents' internal references so they now point at `docs/engineering/` instead of the old `docs/` root.

### Verification
- `find docs -maxdepth 2 -type f | sort`
- `rg -n "agent-context/(technical-spec|functional-spec)" README.md AGENTS.md agent-context/workflow.md`
  - no matches after the move

### Files Edited
- `README.md`
- `AGENTS.md`
- `agent-context/workflow.md`
- `agent-context/session-log.md`
- `docs/engineering/technical-spec.md`
- `docs/engineering/functional-spec.md`
- `docs/engineering/bia-pools-indexer-architecture.md`
- `docs/engineering/bia-pools-runbook.md`
- `docs/engineering/buy-tcoin-checkout-orchestrator-architecture.md`
- `docs/engineering/city-contract-version-registry-implementation.md`
- `docs/engineering/indexer-architecture.md`
- `docs/engineering/merchant-signup-city-manager-architecture.md`
- `docs/engineering/mintTcoinWithUSDC-architecture.md`
- `docs/engineering/tcoin-smart-contract-architecture.md`
- `docs/engineering/tcoin-smart-contract-design-specs.md`
- `docs/engineering/tcoin-smart-contract-prd.md`
- `docs/engineering/torontocoin-contracts-current-state.md`
- `docs/engineering/webauthn-passkey-storage.md`

## v1.25
### Timestamp
- 2026-03-14 03:10:00 EDT

### Objective
- Refactor the wallet’s remaining app-scoped operational APIs toward Supabase edge functions that resolve scope through `public.ref_app_instances`, and move the wallet’s live consumers onto typed edge clients where the new services are available.

### What Changed
- Added a new shared browser edge-client layer under `shared/lib/edge/`, including app-scope resolution, a generic edge invoker, and typed domain clients for BIA, merchant applications, store operations, redemptions, governance, control-plane access, voucher preferences, user requests, and onramp placeholders.
- Added shared Deno-safe edge helpers in `supabase/functions/_shared/validation.ts`, `supabase/functions/_shared/rbac.ts`, `supabase/functions/_shared/merchantApplications.ts`, `supabase/functions/_shared/storeOperations.ts`, and `supabase/functions/_shared/redemptions.ts`.
- Added canonical Supabase edge-function entrypoints for `bia-service`, `voucher-preferences`, `merchant-applications`, `store-operations`, `redemptions`, `control-plane`, `governance`, and `user-requests`; added an `onramp` placeholder entrypoint while the wallet continues to use the existing Next shim for buy-flow transport in this build.
- Updated wallet consumers to use the new edge clients for control-plane access, contact submissions, merchant application status/start/restart/step/submit flows, merchant dashboard BIA/governance/redemption/store operations, city-manager approvals, voucher preference writes, and off-ramp redemption creation.
- Updated the admin dashboard’s BIA, governance, and redemption control-plane actions to use the new edge clients while leaving voucher compatibility, merchant liquidity, ramp-request legacy tables, and onramp admin retry on their existing shims.
- Added targeted tests for the new app-scope helper and updated wallet tests that would otherwise hit live network during the new client-based flows.

### Verification
- `npx vitest run shared/lib/edge/appScope.test.ts app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/admin/page.test.tsx app/tcoin/wallet/city-manager/page.test.tsx`
- `npx tsc --noEmit`
  - still fails on pre-existing repo issues outside this refactor
  - filtering the output to the files changed in this session produced no hits

### Files Edited
- `shared/lib/edge/*`
- `supabase/functions/_shared/validation.ts`
- `supabase/functions/_shared/rbac.ts`
- `supabase/functions/_shared/merchantApplications.ts`
- `supabase/functions/_shared/storeOperations.ts`
- `supabase/functions/_shared/redemptions.ts`
- `supabase/functions/bia-service/index.ts`
- `supabase/functions/voucher-preferences/index.ts`
- `supabase/functions/merchant-applications/index.ts`
- `supabase/functions/store-operations/index.ts`
- `supabase/functions/redemptions/index.ts`
- `supabase/functions/control-plane/index.ts`
- `supabase/functions/governance/index.ts`
- `supabase/functions/user-requests/index.ts`
- `supabase/functions/onramp/index.ts`
- `shared/api/hooks/useControlPlaneAccess.ts`
- `app/tcoin/wallet/contact/page.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/modals/OffRampModal.tsx`
- `app/tcoin/wallet/city-manager/page.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `app/tcoin/wallet/merchant/LiveMerchantDashboard.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/admin/page.test.tsx`
- `shared/lib/edge/appScope.test.ts`
- `agent-context/technical-spec.md`
- `agent-context/functional-spec.md`
- `agent-context/session-log.md`
- `README.md`
- `AGENTS.md`

## v1.24
## v1.68
### Timestamp
- 2026-03-14 15:18:00 EDT

### Objective
- Switch the two-remote Supabase CI workflows from the unusable direct IPv6 connection strings to the new session-pooler secrets and update the repo documentation accordingly.

### What Changed
- Updated `.github/workflows/pr-migrations.yml` so branch-targeted DEV/PROD migration validation now reads `SUPABASE_SESSION_POOLER_DEV` / `SUPABASE_SESSION_POOLER_PROD`.
- Updated `.github/workflows/db-pull-env.yml` so remote drift generation also uses the DEV/PROD session-pooler secrets instead of the direct connection strings.
- Updated the database workflow and technical spec artefacts to describe the session-pooler based CI connectivity model.

### Verification
- `gh secret list -R GreenPill-TO/Genero`
- `git diff --check`

### Files Edited
- `.github/workflows/pr-migrations.yml`
- `.github/workflows/db-pull-env.yml`
- `agent-context/db-workflow.md`
- `agent-context/technical-spec.md`
- `agent-context/session-log.md`

## v1.67
### Timestamp
- 2026-03-14 14:03:00 EDT

### Objective
- Fix the remaining GitHub Actions network-resolution issue in branch-targeted Supabase PR validation after the new two-remote workflow was pushed.

### What Changed
- Updated `.github/workflows/pr-migrations.yml` to run the Supabase dry-run validation with `--dns-resolver https`, avoiding the failing native runner DNS/IPv6 path when connecting to the remote database host.
- Kept the DEV/PROD branch-targeted validation logic and secret usage unchanged.

### Verification
- `gh run view 23093082436 --log-failed`
- `git diff --check`

### Files Edited
- `.github/workflows/pr-migrations.yml`
- `agent-context/session-log.md`

## v1.66
### Timestamp
- 2026-03-14 13:59:00 EDT

### Objective
- Fix the follow-up Supabase PR validation workflow compatibility issue uncovered after pushing the new two-remote CI configuration.

### What Changed
- Removed the unsupported `--yes` flag from `.github/workflows/pr-migrations.yml` because the repository's current Supabase CLI version accepts `--dry-run` on `db push` but rejects `--yes`.
- Kept the branch-targeted DEV/PROD dry-run validation model unchanged.

### Verification
- `gh run view 23093059175 --log-failed`
- `git diff --check`

### Files Edited
- `.github/workflows/pr-migrations.yml`
- `agent-context/session-log.md`

## v1.65
### Timestamp
- 2026-03-14 13:55:00 EDT

### Objective
- Replace the obsolete PREVIEW-database CI assumptions with a two-remote workflow that targets DEV for PRs into `dev` and PROD for PRs into `main`, using the new direct-connection secrets safely.

### What Changed
- Reworked `.github/workflows/pr-migrations.yml` into a non-destructive PR validation workflow that selects DEV or PROD from `github.base_ref` and runs `supabase db push --dry-run --db-url ...` against the matching remote.
- Removed PREVIEW-specific reset/apply logic from PR CI so shared remote databases are no longer reset during pull-request validation.
- Updated `.github/workflows/db-pull-env.yml` to support only DEV and PROD, source database URLs from `SUPABASE_DIRECT_CONNECTION_STRING_DEV` / `SUPABASE_DIRECT_CONNECTION_STRING_PROD`, and open drift PRs back to `dev` or `main` based on the selected environment.
- Updated the database workflow and technical spec artefacts so repository documentation now matches the two-remote CI/CD model.

### Verification
- `supabase db push --help`
- `git diff --check`

### Files Edited
- `.github/workflows/pr-migrations.yml`
- `.github/workflows/db-pull-env.yml`
- `agent-context/db-workflow.md`
- `agent-context/technical-spec.md`
- `agent-context/session-log.md`

## v1.64
### Timestamp
- 2026-03-14 14:30:00 EDT

### Objective
- Address the inline review comments and failing CI on PR #56 covering app-context environment resolution, profile-picture storage security, CORS, theme hook stability, username uniqueness, and the remaining test/workflow failures.

### What Changed
- Fixed `supabase/functions/_shared/appContext.ts` so resolved app context now returns the environment from the matched `ref_app_instances` row when callers omit the environment header/body.
- Tightened `supabase/functions/_shared/userSettings.ts` username uniqueness checks to use exact normalized matching instead of wildcard-based `ilike`.
- Reworked the user-settings edge-function CORS helper to reflect only allowed frontend origins, documented `USER_SETTINGS_ALLOWED_ORIGINS`, and threaded request-aware headers through the shared JSON response helper.
- Replaced the broad `profile_pictures` storage write policies with auth-owner and `users/<auth.uid>/...` path constraints, then updated the shared profile-picture uploader and sparechange profile modal to write through the same authenticated prefix.
- Stabilized dark-mode theme migration/listener logic in `shared/providers/dark-mode-provider.tsx` and `shared/hooks/useDarkMode.tsx` to avoid effect churn and stale listener closures.
- Fixed the wallet welcome test description to match the step it actually covers.
- Fixed CI by mocking `server-only` in Vitest setup, adding a fallback runtime config path in `shared/hooks/useSendMoney.tsx`, and removing the unsupported `--force` flag from the preview Supabase reset workflow.
- Renumbered the duplicate session-log headers so each recorded session now has a unique version tag.

### Verification
- `pnpm exec vitest run app/tcoin/wallet/welcome/page.test.tsx shared/hooks/useSendMoney.test.ts app/api/indexer/status/route.test.ts`
- `pnpm exec eslint shared/providers/dark-mode-provider.tsx shared/hooks/useDarkMode.tsx shared/hooks/useSendMoney.tsx shared/lib/supabase/profilePictures.ts app/tcoin/sparechange/components/modals/UserProfileModal.tsx app/tcoin/wallet/welcome/page.test.tsx`

### Files Edited
- `.github/workflows/pr-migrations.yml`
- `.env.local.example`
- `agent-context/session-log.md`
- `agent-context/technical-spec.md`
- `app/tcoin/sparechange/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `shared/hooks/useDarkMode.tsx`
- `shared/hooks/useSendMoney.tsx`
- `shared/lib/supabase/profilePictures.ts`
- `shared/providers/dark-mode-provider.tsx`
- `supabase/functions/_shared/appContext.ts`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/responses.ts`
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/user-settings/index.ts`
- `supabase/migrations/20260314024500_v1.02_profile_pictures_bucket.sql`
- `vitest.setup.ts`

## v1.63
### Timestamp
- 2026-03-14 02:24:00 EDT

### Objective
- Add a dedicated profile-picture step to wallet onboarding, provision the backing Supabase Storage bucket by migration, and reuse the same upload path in Edit Profile.

### What Changed
- Added `shared/lib/supabase/profilePictures.ts` as the shared browser upload helper for user avatars, targeting the `profile_pictures` bucket and a stable `users/{userId}/avatar.{ext}` object path.
- Added `supabase/migrations/20260314024500_v1.02_profile_pictures_bucket.sql` to provision the public `profile_pictures` bucket plus authenticated insert/update/delete policies.
- Refactored wallet onboarding in `app/tcoin/wallet/welcome/page.tsx` from five visible steps to six, inserting a new profile-picture step between user details and community settings.
- Updated the user-settings edge function in `supabase/functions/_shared/userSettings.ts` so resumable signup metadata now tracks six steps, persists onboarding avatar URLs at step 3, shifts community settings to step 4 and wallet setup to step 5, and clears `profile_image_url` on incomplete-signup reset.
- Updated `app/tcoin/wallet/components/modals/UserProfileModal.tsx` to upload via the same shared helper as onboarding before saving `profileImageUrl` through the unified user-settings mutation.
- Expanded modal and welcome tests to cover the shared upload path and the shifted development skip step.

### Verification
- `npx vitest run app/tcoin/wallet/welcome/page.test.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`

### Files Edited
- `shared/lib/supabase/profilePictures.ts`
- `supabase/migrations/20260314024500_v1.02_profile_pictures_bucket.sql`
- `shared/lib/userSettings/types.ts`
- `supabase/functions/_shared/userSettings.ts`
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `agent-context/technical-spec.md`
- `agent-context/functional-spec.md`
- `agent-context/session-log.md`

## v1.62
### Timestamp
- 2026-03-14 02:14:00 EDT

### Objective
- Unblock local and development wallet onboarding when wallet creation cannot run on the current host by adding a scoped wallet-skip path.

### What Changed
- Added a `Skip` button to wallet onboarding step 5 in `app/tcoin/wallet/welcome/page.tsx`, shown only when `NEXT_PUBLIC_APP_ENVIRONMENT` is `development` or `local`.
- Updated the edge-function signup logic in `supabase/functions/_shared/userSettings.ts` so wallet setup accepts `skipWalletSetup: true` only in `development` or `local`, and the same environments may complete signup without `walletReady`.
- Added a focused welcome-page test covering the development-only skip button.
- Updated the functional and technical specs to document the scoped wallet-skip behaviour.

### Verification
- `npx vitest run app/tcoin/wallet/welcome/page.test.tsx`
- Live browser smoke test on `/welcome` with the signed-in test account:
- wallet setup now shows `Skip` in the linked `development` app environment
- clicking `Skip` advances to the final welcome step
- finishing signup succeeds and routes to `/dashboard`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `supabase/functions/_shared/userSettings.ts`
- `agent-context/technical-spec.md`
- `agent-context/functional-spec.md`
- `agent-context/session-log.md`

## v1.61
### Timestamp
- 2026-03-14 02:02:00 EDT

### Objective
- Restore a shared charity catalogue so the new user-settings bootstrap can populate wallet onboarding/settings and apply the fix to the linked Supabase database.

### What Changed
- Added `supabase/migrations/20260314015500_v1.01_charities_catalog.sql` to create `public.charities` with deterministic seed rows, authenticated read access, and a documented `-- DOWN` section.
- Seeded three initial charities for the shared settings flows:
- `Daily Bread Food Bank`
- `Native Women's Resource Centre of Toronto`
- `Parkdale Community Food Bank`
- Applied the new migration to the linked Supabase project with `supabase db push --linked`.
- Updated the functional and technical specs to record the shared charity catalogue and its role in wallet/sparechange settings.

### Verification
- `supabase migration list`
- `supabase db push --linked`
- Browser smoke test on the signed-in wallet flow after the migration:
- `/welcome` resume state now reloads step 3 with seeded charity options present
- step 3 saves successfully and advances to step 4
- step 4 wallet creation remains blocked on `http://127.0.0.1:3001` by the Cubid/WebAuthn error `SecurityError: This is an invalid domain`

### Files Edited
- `supabase/migrations/20260314015500_v1.01_charities_catalog.sql`
- `agent-context/technical-spec.md`
- `agent-context/functional-spec.md`
- `agent-context/session-log.md`

## v1.60
### Timestamp
- 2026-03-14 01:41:24 EDT

### Objective
- Unblock the authenticated wallet `/welcome` signup flow by restoring the Cubid/wagmi provider context required by the inline phone-verification widget on step 2.

### What Changed
- Removed the wallet-only provider gate from `app/tcoin/wallet/layout.tsx` so the route tree now always mounts the Cubid SDK `Provider` and `WalletCubidProvider`, matching the sparechange/contracts layouts.
- Kept the existing wallet query, dark-mode, modal, and theme-bootstrap structure intact while moving `/welcome` and the rest of the wallet app back under the required wagmi context.
- Updated the technical spec to record that inline Cubid verification on `/welcome` depends on the always-mounted provider stack rather than the legacy `NEXT_PUBLIC_ENABLE_CUBID_WALLET_PROVIDERS` flag.

### Verification
- Browser smoke test on the signed-in wallet flow after the layout patch:
- `/welcome` bootstrap still succeeds
- `Start setup` still succeeds
- step 1 still saves
- step 2 no longer crashes with `WagmiProviderNotFoundError`

### Files Edited
- `app/tcoin/wallet/layout.tsx`
- `agent-context/technical-spec.md`
- `agent-context/session-log.md`

## v1.59
### Timestamp
- 2026-03-14 00:45:00 EDT

### Objective
- Refactor wallet user settings and onboarding around a shared Supabase edge-function contract, then thin the wallet UI down to hook-driven settings screens and a resumable `/welcome` flow.

### What Changed
- Added a new generic user-settings contract in `shared/lib/userSettings/*` for app-scoped bootstrap data, profile updates, preference updates, theme persistence, and resumable signup actions.
- Added `shared/hooks/useUserSettings` and `shared/hooks/useUserSettingsMutations` so wallet UI surfaces now consume one React Query bootstrap payload and one mutation layer instead of writing to Supabase tables directly.
- Added a new Supabase edge function under `supabase/functions/user-settings/` with shared Deno helpers for authenticated user resolution, app-instance resolution, normalized bootstrap assembly, profile writes, app-scoped preference writes, and resumable signup start/step/reset/complete handling.
- Replaced the wallet `/welcome` page with a thin multi-step signup shell that loads one bootstrap payload, offers start vs resume/reset entry states, saves welcome/profile/settings/wallet readiness step-by-step, and routes completed users to `/dashboard`.
- Refactored wallet Edit Profile, Select Theme, BIA Preferences, Charity Select, More-tab settings wiring, footer/theme toggles, and sign-in post-auth routing to use the shared user-settings hooks instead of local/direct writes.
- Moved theme handling to an app-scoped cached/server-backed model keyed by app slug, city slug, and environment, with legacy local theme migration handled after authenticated bootstrap.

### Verification
- `pnpm test -- app/tcoin/wallet/components/footer/Footer.test.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx app/tcoin/wallet/components/modals/SignInModal.test.tsx app/tcoin/wallet/components/modals/UserProfileModal.test.tsx app/tcoin/wallet/components/modals/CharitySelectModal.test.tsx`
- `npx tsc --noEmit`
- The targeted wallet tests passed.
- Repository-wide failures remained outside this refactor:
- `shared/hooks/useSendMoney.test.ts`
- `app/api/indexer/status/route.test.ts`

### Files Edited
- `app/tcoin/wallet/welcome/page.tsx`
- `app/tcoin/wallet/welcome/page.test.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.test.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.tsx`
- `app/tcoin/wallet/components/modals/UserProfileModal.test.tsx`
- `app/tcoin/wallet/components/modals/ThemeSelectModal.tsx`
- `app/tcoin/wallet/components/modals/BiaPreferencesModal.tsx`
- `app/tcoin/wallet/components/modals/CharitySelectModal.tsx`
- `app/tcoin/wallet/components/modals/CharitySelectModal.test.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/components/footer/Footer.tsx`
- `app/tcoin/wallet/components/footer/Footer.test.tsx`
- `app/tcoin/wallet/components/navbar/ThemeToggleButton.tsx`
- `app/tcoin/wallet/layout.tsx`
- `shared/hooks/useDarkMode.tsx`
- `shared/providers/dark-mode-provider.tsx`
- `shared/api/services/supabaseService.ts`
- `shared/hooks/useUserSettings.ts`
- `shared/hooks/useUserSettingsMutations.ts`
- `shared/lib/userSettings/types.ts`
- `shared/lib/userSettings/context.ts`
- `shared/lib/userSettings/theme.ts`
- `shared/lib/userSettings/client.ts`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/responses.ts`
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/appContext.ts`
- `supabase/functions/_shared/userSettings.ts`
- `supabase/functions/user-settings/index.ts`
- `tsconfig.json`
- `agent-context/session-log.md`
- `agent-context/technical-spec.md`
- `agent-context/functional-spec.md`
- `README.md`
- `AGENTS.md`

## v1.58
### Timestamp
- 2026-03-14 02:20:00 EDT

### Objective
- Address the outstanding inline review comments on PR #55 covering voucher lookups, dashboard tab syncing, top-up CAD display fallback, client auth bypass safety, env documentation, and control-plane access caching.

### What Changed
- Fixed `app/api/vouchers/preferences/route.ts` so scope filters are applied before `.limit(1).maybeSingle()`, avoiding a finalized Supabase builder being filtered afterward.
- Fixed `app/api/vouchers/compatibility/route.ts` so existing-rule lookup no longer filters to active rules only, preventing duplicate rows when reactivating an inactive rule scope.
- Updated `app/tcoin/wallet/dashboard/page.tsx` so programmatic tab changes now flow through the URL-backed tab handler instead of mutating local tab state independently.
- Updated `app/tcoin/wallet/components/modals/TopUpModal.tsx` to use one shared fiat fallback calculation for both submit-time routing and the displayed CAD amount.
- Tightened the client-only auth bypass in `app/tcoin/wallet/ContentLayout.tsx` so it only activates outside production, and kept the effect dependency list aligned.
- Updated `shared/api/hooks/useControlPlaneAccess.ts` so the React Query cache key includes the authenticated user id, preventing stale access state from leaking across account switches.
- Documented `NEXT_PUBLIC_ENABLE_CUBID_WALLET_PROVIDERS` in `.env.local.example`.
- Added focused regression tests for dashboard history deep-linking, top-up CAD fallback, and the control-plane access query key.

### Files Edited
- `agent-context/session-log.md`
- `agent-context/technical-spec.md`
- `app/api/vouchers/preferences/route.ts`
- `app/api/vouchers/compatibility/route.ts`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/dashboard/page.test.tsx`
- `app/tcoin/wallet/components/modals/TopUpModal.tsx`
- `app/tcoin/wallet/components/modals/TopUpModal.test.tsx`
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/wallet/layout.tsx`
- `shared/api/hooks/useControlPlaneAccess.ts`
- `shared/api/hooks/useControlPlaneAccess.test.ts`
- `.env.local.example`

## v1.57
### Timestamp
- 2026-03-13 23:38:00 EDT

### Objective
- Add an explicit repository guardrail preventing agents from changing the linked Supabase database without human approval.

### What Changed
- Updated `AGENTS.md` to state that agents must never directly modify the linked Supabase database.
- Added a second explicit instruction requiring agents to stop and ask for human permission before any Supabase command that could change the linked database, including `supabase db push`, `supabase migration up`, `supabase db reset --linked`, `supabase link`, and other `supabase --linked` write operations.

### Files Edited
- `AGENTS.md`
- `agent-context/session-log.md`
- `agent-context/technical-spec.md`

## v1.56
### Timestamp
- 2026-03-13 23:33:00 EDT

### Objective
- Align `/admin` and `/city-manager` UI access with the same app-scoped API role checks, and diagnose the failing legacy ramp-request loader on `/admin`.

### What Changed
- Added a shared control-plane access API (`/api/control-plane/access`) that resolves the active app instance and checks `roles` for `admin`/`operator`.
- Updated wallet More-tab shortcuts so the City Admin and Admin Dashboard buttons only render when that API confirms access, instead of relying on the local `is_admin` profile flag.
- Updated `/admin` and `/city-manager` pages to wait for the same server-side access decision before loading protected data and to redirect back to `/dashboard` when the user lacks the required role.
- Moved `/admin` legacy ramp-request reads behind a new server route (`/api/admin/ramp-requests`) so the browser no longer queries protected legacy tables directly.
- Added explicit diagnostics for missing legacy ramp schema so admin users now see the actual missing table/column/relationship failure instead of the previous generic load error.
- Confirmed the repository migrations do not fully describe the legacy ramp-request schema currently queried by `/admin`:
- `interac_transfer` and `off_ramp_req` are only minimally defined in-repo, while the UI expects additional legacy columns.
- `ref_request_statuses` is referenced by the UI but is not created anywhere under `supabase/migrations/`.
- Added targeted Vitest coverage for More-tab access gating, admin access gating plus ramp-request loading, and direct city-manager redirect behavior.

### Files Edited
- `app/api/control-plane/access/route.ts`
- `app/api/admin/ramp-requests/route.ts`
- `shared/api/hooks/useControlPlaneAccess.ts`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/admin/page.test.tsx`
- `app/tcoin/wallet/city-manager/page.tsx`
- `app/tcoin/wallet/city-manager/page.test.tsx`
- `agent-context/session-log.md`
- `agent-context/technical-spec.md`
- `agent-context/functional-spec.md`

## v1.17
### Timestamp
- 2026-03-12 11:10:00 EDT

### Objective
- Implement the new one-transaction reserve mint router flow (`mintTcoinWithUSDC`) in the TorontoCoin contract suite, including interfaces, tests, and architecture/spec documentation.

### What Changed
- Added `TcoinMintRouter` with:
- generic input-token mint path (`mintTcoinWithToken`) and USDC convenience wrapper (`mintTcoinWithUSDC`),
- adapter + treasury wiring via dedicated interfaces,
- on-chain safety controls: deadline, token allowlist, slippage checks (`minCadmOut`, `minTcoinOut`), `Pausable`, and `ReentrancyGuard`,
- balance-delta enforcement for swap and mint outputs,
- refund handling for per-call residual `tokenIn`/`CADm`,
- owner-managed runtime configuration for adapter, treasury, CADm config, USDC token, and enabled input tokens.
- Added dedicated interfaces:
- `ISwapAdapter` for token-in -> CADm swap abstraction and previewing.
- `ITreasuryMinting` for treasury minting/preview calls used by the router.
- Added new Foundry unit tests and mocks covering:
- happy paths (USDC + generic token),
- deadline/amount/recipient/allowlist validation failures,
- slippage guard failures for swap and mint outputs,
- pausable/owner-only behavior,
- refund behavior,
- malicious adapter reported-output mismatch,
- adapter callback reentrancy attempt handling.
- Added contract-level and architecture documentation for the router design and rollout assumptions.
- Verified implementation with `forge build` and router-focused tests (`14 passed, 0 failed`).

### Files Edited
- `contracts/foundry/src/torontocoin/TcoinMintRouter.sol`
- `contracts/foundry/src/torontocoin/TcoinMintRouter.md`
- `contracts/foundry/src/torontocoin/interfaces/ISwapAdapter.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryMinting.sol`
- `contracts/foundry/test/unit/torontocoin/TcoinMintRouter.t.sol`
- `contracts/foundry/test/unit/torontocoin/mocks/MockERC20.sol`
- `contracts/foundry/test/unit/torontocoin/mocks/MockSwapAdapter.sol`
- `contracts/foundry/test/unit/torontocoin/mocks/MockTreasuryMinting.sol`
- `docs/mintTcoinWithUSDC-architecture.md`
- `agent-context/session-log.md`

## v1.16
### Timestamp
- 2026-03-12 03:25:00 EDT

### Objective
- Implement the TorontoCoin hardening + Sarafu-accurate integration pass: close outstanding torontocoin README items first, then align indexer/API/wallet behavior to the real Sarafu contract ABI semantics.

### What Changed
- Hardened and reconciled the new `torontocoin` contract suite to compile and test together under one shared interface model (`interfaces/*`).
- Enforced deadline-gated governance execution while preserving early approval semantics.
- Reconciled Charity/Steward coupling onto canonical `syncCharityAppointment(...)` flow and added treasury-required charity helper methods.
- Fixed OZ v4 compatibility and compile blockers across contracts/scripts/tests (Ownable initializer patterns, token transfer hooks, script stack-depth, legacy test removal).
- Replaced guessed Sarafu ABI usage with pinned semantics:
- quote path now prefers pool `getQuote(out,in,amount)` and falls back to quoter `valueFor(out,in,amount)`.
- execution path now uses pool `withdraw(out,in,amount)` (not `swap(...)`).
- limiter reads now use canonical `limitOf(token,pool)` for voucher credit limits.
- Updated voucher routing API/contracts integration:
- `/api/vouchers/route` now resolves TCOIN decimals and returns quote-derived `expectedVoucherOut`, `minVoucherOut`, `quoteSource`, and `feePpm`.
- fallback behavior is deterministic when quote paths are unavailable.
- Updated wallet send flow to honor ABI-accurate route metadata and prevent silent fallback when a swap succeeded but transfer/slippage failed; errors now surface explicitly with swap tx context.
- Extended indexer BIA diagnostics with explicit component mismatch counts (`componentMismatches`) for DB mapping vs on-chain pool tuple divergence.
- Updated architecture docs with ABI-accurate Sarafu routing/limit semantics and mismatch diagnostics.

### Files Edited
- `contracts/foundry/src/torontocoin/README.md`
- `contracts/foundry/src/torontocoin/GeneroToken.sol`
- `contracts/foundry/src/torontocoin/Governance.sol`
- `contracts/foundry/src/torontocoin/CharityRegistry.sol`
- `contracts/foundry/src/torontocoin/StewardRegistry.sol`
- `contracts/foundry/src/torontocoin/PoolRegistry.sol`
- `contracts/foundry/src/torontocoin/ReserveRegistry.sol`
- `contracts/foundry/src/torontocoin/OracleRouter.sol`
- `contracts/foundry/src/torontocoin/TreasuryController.sol`
- `contracts/foundry/src/torontocoin/interfaces/ICharityRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IStewardRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IPoolRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IReserveRegistry.sol`
- `contracts/foundry/src/torontocoin/interfaces/IOracleRouter.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITreasuryController.sol`
- `contracts/foundry/src/torontocoin/interfaces/ITCOINToken.sol`
- `contracts/foundry/src/torontocoin/interfaces/IGovernance.sol`
- `contracts/foundry/script/deploy/PromoteCityVersion.s.sol`
- `contracts/foundry/test/unit/torontocoin/GovernanceDeadline.t.sol`
- `contracts/foundry/test/unit/torontocoin/StewardSync.t.sol`
- `contracts/foundry/test/unit/torontocoin/TreasuryMintPreview.t.sol`
- `contracts/foundry/test/unit/torontocoin-v2/VotingV2.t.sol`
- `services/indexer/src/discovery/abis.ts`
- `services/indexer/src/vouchers.ts`
- `services/indexer/src/normalize/persist.ts`
- `services/indexer/src/bia.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/types.ts`
- `shared/lib/sarafu/abis.ts`
- `shared/lib/sarafu/client.ts`
- `shared/lib/vouchers/types.ts`
- `shared/lib/vouchers/routing.ts`
- `shared/lib/vouchers/onchain.ts`
- `shared/hooks/useSendMoney.tsx`
- `shared/lib/indexer/types.ts`
- `app/api/vouchers/route/route.ts`
- `app/api/vouchers/route/route.test.ts`
- `app/api/vouchers/merchants/route.ts`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `docs/indexer-architecture.md`
- `docs/bia-pools-indexer-architecture.md`
- `agent-context/session-log.md`
## v1.15
### Timestamp
- 2026-03-11 19:33:00 EDT

### Objective
- Record the latest state after voucher-layer integration work and prepare a commit while explicitly excluding Sarafu read-only reference docs under `contracts/foundry/src/registry/sarafu-read-only`.

### What Changed
- Confirmed there are no new code changes pending after `v1.14`.
- Kept `contracts/foundry/src/registry/sarafu-read-only/` out of commit scope as requested.
- Added this log entry to document the exclusion and repository state.

### Files Edited
- `agent-context/session-log.md`

## v1.14
### Timestamp
- 2026-03-11 15:07:04 EDT

### Objective
- Implement Merchant Liquidity Layer (Doc 7) on top of the existing BIA/indexer architecture: add voucher data model and APIs, extend indexer for voucher/credit state, wire wallet/admin/merchant UX, and reflect that merchant credit limits/liquidity requirements are sourced from Sarafu on-chain contracts (read-only in Genero UI, no new Genero smart-contract logic).

### What Changed
- Added `v0.97` Supabase migration for voucher-layer entities and views:
- secondary BIA affiliations for users,
- voucher token catalog and wallet voucher balance snapshots,
- merchant credit/liquidity state mirror,
- voucher compatibility rules and user voucher preferences,
- voucher payment records,
- wallet total-value view including voucher 1:1 equivalent rollup.
- Added voucher API surface:
- `GET /api/vouchers/portfolio`,
- `GET /api/vouchers/merchants`,
- `GET /api/vouchers/route`,
- `GET|POST /api/vouchers/preferences`,
- `GET|POST /api/vouchers/compatibility`,
- `POST /api/vouchers/payment-record`.
- Extended BIA endpoints for hybrid affiliation model:
- `GET /api/bias/list` now returns secondary affiliations,
- `POST /api/bias/select` now supports `secondaryBiaIds[]`.
- Added shared voucher library (`shared/lib/vouchers`) with typed models, preference precedence, deterministic route resolution, valuation, and on-chain execution wrappers.
- Extended indexer voucher pipeline:
- classify voucher tokens from discovered pools excluding city core tokens,
- compute wallet voucher + TCOIN snapshots,
- derive merchant credit state and persist voucher summary metrics,
- extend indexer status summary/types with voucher dimensions.
- Updated wallet UX:
- total balance now supports voucher-equivalent portfolio display,
- merchant send flow can resolve voucher route, execute swap+transfer path, and deterministically fallback to TCOIN transfer,
- `More` tab includes secondary BIA selection and voucher preference controls,
- wallet home shows “Merchants in My Pool” data.
- Updated admin and merchant dashboards:
- voucher compatibility rule management in admin,
- merchant voucher liquidity panels in admin/merchant,
- explicit UI copy and source labels clarifying voucher issue limits and liquidity requirements are read from Sarafu on-chain contracts and shown read-only in Genero.
- Added/updated test coverage:
- voucher route API tests,
- indexer status tests for voucher summary payload,
- voucher preference precedence unit test.

### Files Edited
- `supabase/migrations/20260311130000_v0.97_merchant_liquidity_layer.sql`
- `app/api/vouchers/portfolio/route.ts`
- `app/api/vouchers/merchants/route.ts`
- `app/api/vouchers/route/route.ts`
- `app/api/vouchers/route/route.test.ts`
- `app/api/vouchers/preferences/route.ts`
- `app/api/vouchers/compatibility/route.ts`
- `app/api/vouchers/payment-record/route.ts`
- `app/api/bias/list/route.ts`
- `app/api/bias/select/route.ts`
- `shared/lib/vouchers/index.ts`
- `shared/lib/vouchers/onchain.ts`
- `shared/lib/vouchers/preferences.ts`
- `shared/lib/vouchers/preferences.test.ts`
- `shared/lib/vouchers/routing.ts`
- `shared/lib/vouchers/types.ts`
- `shared/lib/vouchers/valuation.ts`
- `shared/hooks/useVoucherPortfolio.ts`
- `shared/hooks/useSendMoney.tsx`
- `shared/lib/indexer/types.ts`
- `services/indexer/src/vouchers.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/state/runControl.ts`
- `services/indexer/src/types.ts`
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `app/api/indexer/status/route.test.ts`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-7-merchant-liquidity-layer.md`
- `agent-context/session-log.md`

## v1.13
### Timestamp
- 2026-03-11 01:43:49 EDT

### Objective
- Realign the Neighbourhood/BIA PRD and alignment docs to the locked v1 scope: off-chain BIA operations with Sarafu on-chain pools, permissive cross-pool user spend, manual merchant approval/settlement, and explicit future-phase labeling for deferred on-chain TCOIN pool features.

### What Changed
- Added explicit v1 implementation baseline sections across PRD documents 1, 2, 4, 5, and 6.
- Re-scoped PRD document 3 (`contract changes`) to a phased model:
- `Required in v1`: Sarafu pool compatibility + app/indexer-derived attribution model.
- `Optional / Future Phase`: TCOIN-native on-chain BIA registry, pool-tagged mint/redeem attribution, and on-chain pool governance controls.
- Updated wallet/merchant/governance requirements to codify:
- cross-pool permissive user payments city-wide,
- wallet discovery/filter requirement for "merchants in my pool",
- merchant redemption flow as request -> manual approval -> queued settlement.
- Updated data-model requirements to mark center-point geospatial as v1 baseline and polygon containment as optional future phase.
- Added a `Decision Lock (v1)` section to the BIA/indexer architecture doc reflecting all locked decisions and current operational limits.
- Added TorontoCoin alignment note clarifying P0/P1 contract fixes remain important but are not a hard release gate for BIA v1 (off-chain + Sarafu model).

### Files Edited
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-1-architecture.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-2-data-mode.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-3-contract-changes.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-4-wallet-us.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-5-merchants.md`
- `docs/20260310-neighbourhood-pools/neighbourhood-pools-6-governance.md`
- `docs/bia-pools-indexer-architecture.md`
- `docs/torontocoin-contracts-current-state.md`
- `agent-context/session-log.md`

## v1.12
### Timestamp
- 2026-03-10 23:54:38 EDT

### Objective
- Complete BIA/redeem/governance control-plane integration in wallet admin/merchant UI, fix dynamic API routing in local dev, add route integration tests, and validate local Supabase + API smoke paths.

### What Changed
- Extended wallet admin UI to call the new BIA/redeem/governance endpoints directly for BIA creation, pool mapping, BIA controls, redemption approve/settle actions, and governance feed visibility.
- Added a new merchant dashboard at `/merchant` for store profile/BIA assignment and redemption request workflows powered by `/api/stores*`, `/api/redemptions/*`, and `/api/governance/actions`.
- Added merchant navigation entry from wallet `More` tab.
- Fixed dynamic API route resolution by narrowing app rewrites to non-API paths, preventing the catch-all rewrite from swallowing `app/api` dynamic routes.
- Added route integration tests for:
- `POST /api/pools/buy`
- `/api/redemptions/*` (request, list validation, approve, settle)
- `GET /api/indexer/status` including `biaSummary`
- Hardened the `v0.91` share-credential migration to be backward compatible with legacy schemas by adding missing columns (`user_share_encrypted.created_at`, `wallet_keys.user_share_encrypted`) when absent.
- Added neighbourhood/BIA architecture and runbook documents under `/docs`.
- Re-ran local Supabase reset and dynamic API smoke checks; dynamic endpoints now resolve (method/auth responses instead of 404).

### Files Edited
- `app/tcoin/wallet/admin/page.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `next.config.js`
- `app/api/pools/buy/route.test.ts`
- `app/api/redemptions/routes.test.ts`
- `app/api/indexer/status/route.test.ts`
- `supabase/migrations/20260212150000_v0.91_user_share_credentials.sql`
- `docs/bia-pools-indexer-architecture.md`
- `docs/bia-pools-runbook.md`
- `agent-context/session-log.md`

## v1.11
### Timestamp
- 2026-03-10 21:39:19 EDT

### Objective
- Implement the Neighbourhood/BIA Pools + Indexer tandem release foundations across Supabase schema, backend APIs, indexer BIA attribution/health, and wallet buy/redeem integration points.

### What Changed
- Added the BIA/pool operational migration (`v0.96`) with BIA registry/mappings/affiliations, store profile and affiliation tables, purchase/redemption workflow tables, risk-control and governance audit tables, BIA rollup/risk indexer tables, and analytics views.
- Added shared BIA + Sarafu server modules for auth context, app/city resolution, role/store guards, pool routing, pool/token validation, and redemption risk checks.
- Added new API routes for BIA and operations workflows:
- `POST /api/bias/create`
- `GET|POST /api/bias/mappings`
- `GET|POST /api/bias/controls`
- `POST /api/stores`, `POST /api/stores/[id]/bia`, `POST /api/stores/risk`
- `POST /api/pools/buy`
- `POST /api/redemptions/request`, `GET /api/redemptions/list`, `POST /api/redemptions/[id]/approve`, `POST /api/redemptions/[id]/settle`
- `GET /api/governance/actions`
- Extended indexer service with BIA tandem logic:
- mapping validation sync (`valid/stale/mismatch`) against discovery outputs,
- per-range BIA rollup derivation from indexed raw events,
- BIA risk signal upserts (`pending_redemption`, `redemption_pressure`, `stress_level`),
- status summary expansion with `biaSummary` (active BIAs, mapped/unmapped pools, stale mappings, per-BIA activity).
- Extended shared/client-facing indexer response types to include BIA summary and BIA ingestion payloads.
- Wired wallet buy/redeem entry points to the new BIA APIs:
- Top-up confirmation now triggers `/api/pools/buy` to create BIA-attributed purchase requests.
- Off-ramp flow now creates `/api/redemptions/request` for store owners after burn/accounting operations.
- Applied app-instance scoping fixes to new store/BIA endpoints so role/store checks and inserts are isolated per app instance.
- Verified indexer unit tests still pass:
- `services/indexer/src/state/cooldown.test.ts`
- `services/indexer/src/discovery/pools.test.ts`
- `services/indexer/src/normalize/fingerprint.test.ts`

### Files Edited
- `supabase/migrations/20260311110000_v0.96_bia_pools.sql`
- `shared/lib/bia/apiAuth.ts`
- `shared/lib/bia/server.ts`
- `shared/lib/bia/types.ts`
- `shared/lib/bia/index.ts`
- `shared/lib/sarafu/abis.ts`
- `shared/lib/sarafu/client.ts`
- `shared/lib/sarafu/routing.ts`
- `shared/lib/sarafu/guards.ts`
- `shared/lib/sarafu/index.ts`
- `app/api/bias/list/route.ts`
- `app/api/bias/suggest/route.ts`
- `app/api/bias/select/route.ts`
- `app/api/bias/create/route.ts`
- `app/api/bias/mappings/route.ts`
- `app/api/bias/controls/route.ts`
- `app/api/stores/route.ts`
- `app/api/stores/[id]/bia/route.ts`
- `app/api/stores/risk/route.ts`
- `app/api/pools/buy/route.ts`
- `app/api/redemptions/request/route.ts`
- `app/api/redemptions/list/route.ts`
- `app/api/redemptions/[id]/approve/route.ts`
- `app/api/redemptions/[id]/settle/route.ts`
- `app/api/governance/actions/route.ts`
- `services/indexer/src/bia.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/state/runControl.ts`
- `services/indexer/src/types.ts`
- `shared/lib/indexer/types.ts`
- `app/tcoin/wallet/components/modals/TopUpModal.tsx`
- `app/tcoin/wallet/components/modals/OffRampModal.tsx`
- `agent-context/session-log.md`

## v0.92
- Hardened `v0.91` passkey migration by inferring `app_instance_id` from each user’s latest `app_user_profiles` row before falling back to wallet/tcoin, preserving legacy app context where possible.
- Added deterministic legacy credential backfill tokens plus a `credential_id NOT NULL` enforcement, deduplicated `user_encrypted_share` rows by `(wallet_key_id, app_instance_id, credential_id)`, and kept only the most recent record before the unique constraint is applied.
- Updated `useSendMoney` credential selection to support legacy cross-app share fallback when app-scoped lookups are empty and to fallback to the most recent share when a stored active credential no longer matches.
- Added unit tests for share selection logic covering active credential matching, fallback selection, app-scoped no-share errors, and candidate list normalisation.

## v0.91
- Added a reversible Supabase migration expanding `user_encrypted_share` with app/credential/device/audit metadata (`credential_id`, `app_instance_id`, `device_info`, `last_used_at`, `revoked_at`), plus backfills for credential IDs and the default Wallet app instance.
- Updated Wallet and SpareChange onboarding wallet callbacks to persist decoded credential IDs, resolved app instance IDs, and device metadata alongside encrypted user shares.
- Updated send-money key reconstruction to resolve encrypted shares by `wallet_key_id` + active credential/app context, falling back to most recent usage while exposing available credential candidates when no active match exists.
- Extended shared Supabase service helper tests for credential and device metadata serialisation utilities.

## v1.10
### Timestamp
- 2026-03-10 00:36:07 EDT

### Objective
- Finalize wallet UX/runtime fixes after local validation: resolve hydration and dark-mode behavior, unify footer behavior across public pages, fix contact form submission UX/backend compatibility, and ensure auth redirects land on `/dashboard`.

### What Changed
- Reworked wallet layout font loading to avoid SSR/CSR text mismatch and added an early theme bootstrap script so first paint honors saved/system dark mode.
- Updated dark-mode hook persistence semantics (`theme_user_set`) so system preference is used until the user explicitly toggles theme.
- Added footer theme toggle text link (`Dark Mode`/`Light Mode`), updated GitHub link to open in a new tab safely, and expanded footer tests.
- Updated contact page UX: submit loading/error states, deterministic feedback, aligned `Return Home` + `Send` row, and shared footer render.
- Hardened `/api/user_requests` insertion to attach `app_instance_id` when resolvable and gracefully proceed on older schemas without app-instance tables.
- Added migration to create/backfill `public.user_requests` for environments missing that table.
- Unified footer usage across `/contact`, `/resources`, and `/ecosystem`; updated ecosystem tests accordingly.
- Changed sign-in OTP success flow to immediately route new and existing users to `/dashboard` (removed delayed timeout behavior), with corresponding test updates.
- Updated home dark-mode background gradient to black top/bottom with darker center gray.

### Files Edited
- `app/tcoin/wallet/layout.tsx`
- `shared/hooks/useDarkMode.tsx`
- `app/tcoin/wallet/components/footer/Footer.tsx`
- `app/tcoin/wallet/components/footer/Footer.test.tsx`
- `app/tcoin/wallet/contact/page.tsx`
- `app/api/user_requests/route.ts`
- `supabase/migrations/20260309233800_create_user_requests_if_missing.sql`
- `app/tcoin/wallet/resources/page.tsx`
- `app/tcoin/wallet/ecosystem/page.tsx`
- `app/tcoin/wallet/ecosystem/page.test.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.tsx`
- `app/tcoin/wallet/components/modals/SignInModal.test.tsx`
- `app/tcoin/wallet/page.tsx`
- `agent-context/session-log.md`

## v1.09
### Timestamp
- 2026-03-10 00:31:40 EDT

### Objective
- Recover from a wrong-project Supabase push by resetting the linked `GeneroDev` remote (`uyopiuwmlhbevoxmfvfx`) and making the migration chain runnable from a true empty database.

### What Changed
- Stopped a local Docker Postgres container that was occupying port `54322` and interfering with Supabase CLI workflows.
- Added an idempotent `cron_logs` baseline migration and fixed UUID default resolution for Supabase extension schema usage.
- Added a legacy bootstrap migration (`v0.66`) to create required pre-existing tables/types/seed records that later ALTER-based migrations assume.
- Removed embedded `-- migrate:down` sections from SQL migration files so Supabase applies forward-only SQL cleanly during `db reset`.
- Fixed `auth.uid()` type mismatch in app-user-profile RLS policies by casting to text where `users.auth_user_id` is compared.
- Successfully ran `supabase db reset --linked --yes` against `uyopiuwmlhbevoxmfvfx` through all migrations.
- Verified with `supabase db push --linked --yes` returning `Remote database is up to date.`

### Files Edited
- `supabase/migrations/20250718111419_remote_schema.sql`
- `supabase/migrations/20260114000000_v0.66_legacy_bootstrap.sql`
- `supabase/migrations/20260120093000_v0.67_app_user_profiles.sql`
- `supabase/migrations/20260125094500_v0.68_app_registry.sql`
- `supabase/migrations/20260130100000_v0.69_app_user_profiles_rls.sql`
- `supabase/migrations/20260201101500_v0.70_connections_profile_fks.sql`
- `supabase/migrations/20260211180453_v0.72_connections_profile_fks.sql`
- `supabase/migrations/20260212123000_v0.89_wallet_keys.sql`
- `agent-context/session-log.md`

## v1.08
### Timestamp
- 2026-03-09 22:47:55 EDT

### Objective
- Replace remaining hardcoded Supabase runtime parameters with environment variables, remove legacy Supabase local config artifacts, and document the updated env setup.

### What Changed
- Replaced `NEXT_PUBLIC_SUPABASE_ANON_KEY` usage with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` across browser, server, and middleware Supabase client initialization.
- Added shared Supabase asset env helpers and removed hardcoded Supabase storage URLs from wallet landing banners and wallet welcome funding video.
- Updated Next.js remote image host configuration to derive allowed hostnames from environment-provided Supabase URLs instead of hardcoded project hostnames.
- Expanded `.env.local.example` with grouped explanatory comments and concrete examples for Supabase, Cubid, wallet assets, app runtime, and indexer variables.
- Added explicit `.env.local` ignore entry in `.gitignore`.
- Removed legacy `supabase/config.toml` and `supabase/sql-schema.sql` files per updated repo direction, and updated workflow guidance to rely on migration files only.

### Files Edited
- `.env.local.example`
- `.gitignore`
- `next.config.js`
- `shared/lib/supabase/client.ts`
- `shared/lib/supabase/server.ts`
- `shared/lib/supabase/middleware.ts`
- `shared/lib/supabase/assets.ts`
- `app/tcoin/wallet/components/landing-header/LandingHeader.tsx`
- `app/tcoin/wallet/welcome/page.tsx`
- `agent-context/workflow.md`
- `supabase/config.toml` (deleted)
- `supabase/sql-schema.sql` (deleted)
- `agent-context/session-log.md`

## v1.07
### Timestamp
- 2026-03-09 20:04:28 EDT

### Objective
- Implement a user-triggered Genero contract indexer with 5-minute start/complete cooldowns, Sarafu pool overlap discovery, tracker-first ingestion with RPC fallback, and app/login trigger wiring.

### What Changed
- Added a new Supabase migration that creates the `indexer` and `chain_data` schemas, run-control/checkpoint tables, pool link/token discovery tables, idempotent raw event storage, normalized chain-data tables, RLS policies, authenticated grants, and RPC helpers `indexer_try_start_run` + `indexer_complete_run`.
- Added a new TypeScript indexer service under `services/indexer` covering run lifecycle control, city contract resolution (registry-first with DB override fallback), Sarafu pool discovery by token overlap, tracker pull ingestion, RPC log fallback ingestion, event fingerprinting, and normalized/idempotent persistence.
- Added new API endpoints `POST /api/indexer/touch` and `GET /api/indexer/status` with authenticated access and scope-key execution.
- Added shared indexer client utilities and a `useIndexerTrigger` hook with local dedupe TTL; wired triggers into login (`SIGNED_IN`) and app-use surfaces for wallet, sparechange, and contracts flows.
- Added focused tests for cooldown logic, overlap detection, fingerprint stability, and updated auth-hook tests for login-trigger behavior.
- Added indexer environment variable examples and TypeScript path alias for `@services/*`.

### Files Edited
- `supabase/migrations/20260309191000_v0.95_user_triggered_indexer.sql`
- `services/indexer/src/config.ts`
- `services/indexer/src/types.ts`
- `services/indexer/src/index.ts`
- `services/indexer/src/state/cooldown.ts`
- `services/indexer/src/state/runControl.ts`
- `services/indexer/src/discovery/abis.ts`
- `services/indexer/src/discovery/cityContracts.ts`
- `services/indexer/src/discovery/pools.ts`
- `services/indexer/src/ingest/trackerClient.ts`
- `services/indexer/src/ingest/rpcFallback.ts`
- `services/indexer/src/normalize/fingerprint.ts`
- `services/indexer/src/normalize/persist.ts`
- `services/indexer/src/state/cooldown.test.ts`
- `services/indexer/src/discovery/pools.test.ts`
- `services/indexer/src/normalize/fingerprint.test.ts`
- `app/api/indexer/touch/route.ts`
- `app/api/indexer/status/route.ts`
- `shared/lib/indexer/types.ts`
- `shared/lib/indexer/trigger.ts`
- `shared/lib/indexer/index.ts`
- `shared/hooks/useIndexerTrigger.ts`
- `shared/api/hooks/useAuth.ts`
- `shared/api/hooks/useAuth.test.tsx`
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/tcoin/sparechange/ContentLayout.tsx`
- `app/tcoin/contracts/hooks/useManagementContext.ts`
- `.env.local.example`
- `tsconfig.json`
- `agent-context/session-log.md`

## v1.06
### Timestamp
- 2026-03-09 16:29:49 EDT

### Objective
- Record the current implementation state in the session log and commit all pending contract-management and supporting changes.

### What Changed
- Added this `v96` session-log entry with timestamp, objective, and change summary headings.
- Prepared the repository for a single commit that captures the full pending implementation set plus updated session documentation.

### Files Edited
- `agent-context/session-log.md`

## v1.05
### Timestamp
- 2026-03-09 16:28:46 EDT

### Objective
- Implement the new `app/tcoin/contracts` contract-management app with role-based interfaces, add required V2 governance/orchestrator Solidity functionality for charity and reserve-currency proposals, wire shared contract-management clients, and add Supabase metadata storage for proposal UX.

### What Changed
- Added `VotingV2` and `OrchestratorV2` contracts with steward voting, owner-executed proposal lifecycle, reserve-currency management, governance value application, and role/management helper methods.
- Added V2 Solidity unit tests covering charity proposal lifecycle, reserve proposal lifecycle, quorum behavior, one-vote enforcement, expiry handling, owner-only execute/cancel, peg vote behavior, and status pagination.
- Patched `TCOIN` correctness issues (`transfer` semantics and `balanceOf` recursion) and added `pause/unpause` controls to `CAD`.
- Added a new contract-management app at `app/tcoin/contracts` with pages for governance, city-manager proposals, steward nomination, charity-operator minting, treasury controls, token-admin controls, registry operations, and proposal detail actions.
- Added shared management contract modules (ABIs, city context/client helpers, role resolution, Cubid signer transaction path, proposal and registry operation clients, and shared management types).
- Added Supabase service methods for creating/listing proposal metadata, linking on-chain proposal IDs, and uploading images for proposal content.
- Added a new Supabase migration to create contract-management metadata/link tables with RLS policies, seed the `contracts` app registry entry, and provision a public `contract-management` storage bucket.
- Added a new TypeScript alias for `@tcoin/contracts/*`.

### Files Edited
- `contracts/foundry/src/torontocoin/v2/OrchestratorV2.sol`
- `contracts/foundry/src/torontocoin/v2/VotingV2.sol`
- `contracts/foundry/src/torontocoin/v2/interfaces/IOrchestratorV2.sol`
- `contracts/foundry/src/torontocoin/v2/interfaces/IVotingV2.sol`
- `contracts/foundry/test/unit/torontocoin-v2/VotingV2.t.sol`
- `contracts/foundry/src/torontocoin/TCOIN.sol`
- `contracts/foundry/src/torontocoin/CADCOIN.sol`
- `app/tcoin/contracts/layout.tsx`
- `app/tcoin/contracts/page.tsx`
- `app/tcoin/contracts/governance/page.tsx`
- `app/tcoin/contracts/city-manager/page.tsx`
- `app/tcoin/contracts/stewards/page.tsx`
- `app/tcoin/contracts/charity-operator/page.tsx`
- `app/tcoin/contracts/treasury/page.tsx`
- `app/tcoin/contracts/token-admin/page.tsx`
- `app/tcoin/contracts/registry/page.tsx`
- `app/tcoin/contracts/proposals/[id]/page.tsx`
- `app/tcoin/contracts/hooks/useManagementContext.ts`
- `app/tcoin/contracts/styles/app.scss`
- `shared/lib/contracts/management/abis/orchestratorV2Abi.ts`
- `shared/lib/contracts/management/abis/votingV2Abi.ts`
- `shared/lib/contracts/management/abis/accessControlTokenAbi.ts`
- `shared/lib/contracts/management/abis/cityImplementationRegistryAbi.ts`
- `shared/lib/contracts/management/abis/index.ts`
- `shared/lib/contracts/management/types.ts`
- `shared/lib/contracts/management/clients.ts`
- `shared/lib/contracts/management/cubidSigner.ts`
- `shared/lib/contracts/management/proposals.ts`
- `shared/lib/contracts/management/registryOps.ts`
- `shared/lib/contracts/management/roles.ts`
- `shared/lib/contracts/management/index.ts`
- `shared/lib/contracts/management/proposals.test.ts`
- `shared/api/services/contractManagementService.ts`
- `supabase/migrations/20260309163000_v0.94_contract_management.sql`
- `tsconfig.json`

## v1.04
### Timestamp
- 2026-03-09 15:28:22 EDT

### Objective
- Implement the City Contract Version Registry + promotion workflow plan end-to-end, wire app transaction hooks to on-chain registry resolution, document the implementation, and validate with targeted Solidity/TypeScript tests.

### What Changed
- Implemented `CityImplementationRegistry` with version history, active promotion, owner-only mutation, required-address validation, and registration/promotion events.
- Added Foundry deploy and promotion scripts to deploy the registry, parse deployment JSON artifacts, derive lowercase `cityId`, call `registerAndPromote`, and persist promotion outputs.
- Added OpenZeppelin Foundry dependencies and remappings to support reliable local `forge build/test` for current sources and new registry tests.
- Added app-side shared registry ABI/client/resolver modules and `ActiveCityContracts` lookup flow with 60-second memory/localStorage caching.
- Rewired `useTokenBalance` and `useSendMoney` to resolve token/RPC at runtime from the on-chain registry instead of hardcoded token address and RPC constants.
- Added/updated unit tests for registry resolver modules and hooks; fixed Vitest hoisted mock usage and excluded Foundry lib tests from repo Vitest discovery.
- Added implementation documentation with architecture, runbook, verification, and follow-up notes.

### Files Edited
- `contracts/foundry/src/registry/CityImplementationRegistry.sol`
- `contracts/foundry/script/deploy/DeployCityImplementationRegistry.s.sol`
- `contracts/foundry/script/deploy/PromoteCityVersion.s.sol`
- `contracts/foundry/test/unit/CityImplementationRegistry.t.sol`
- `contracts/foundry/foundry.toml`
- `contracts/foundry/.env.example`
- `contracts/foundry/README.md`
- `contracts/foundry/lib/openzeppelin-contracts/` (added)
- `contracts/foundry/lib/openzeppelin-contracts-upgradeable/` (added)
- `shared/lib/contracts/cityRegistryAbi.ts`
- `shared/lib/contracts/cityRegistryClient.ts`
- `shared/lib/contracts/cityContracts.ts`
- `shared/lib/contracts/cityContracts.test.ts`
- `shared/hooks/useTokenBalance.ts`
- `shared/hooks/useTokenBalance.test.tsx`
- `shared/hooks/useSendMoney.tsx`
- `shared/hooks/useSendMoney.test.ts`
- `vitest.config.ts`
- `vitest.setup.ts`
- `package.json`
- `contracts/foundry/src/torontocoin/TCOIN.sol`
- `contracts/foundry/src/torontocoin/sampleERC20.sol`
- `contracts/foundry/src/torontocoin/Voting.sol`
- `contracts/foundry/src/torontocoin/Orchestration.sol`
- `contracts/foundry/src/torontocoin/PlainERC20.sol`
- `docs/city-contract-version-registry-implementation.md`

## v1.03
### Timestamp
- 2026-03-09 14:18:24 EDT

### Objective
- Document the current TorontoCoin Solidity system state, provide a corrected interaction diagram, and define a concrete patch list to make deployment possible end-to-end.

### What Changed
- Added a new architecture and deployability document for the imported TorontoCoin contracts.
- Documented current non-deployable status and root causes (dependency/import blockers + critical contract logic issues).
- Added a corrected Mermaid interaction diagram for user/store redemption, governance flow, and charity mint-credit loop.
- Added a prioritized patch list (`P0`, `P1`, `P2`) covering correctness fixes, bootstrap/roles/deployability fixes, and hardening tasks.
- Added a suggested deployment sequence after fixes are applied.

### Files Edited
- `docs/torontocoin-contracts-current-state.md`

## v1.02
### Timestamp
- 2026-03-09 13:53:31 EDT

### Objective
- Import TorontoCoin contract artifacts into the Foundry workspace and place the TorontoCoin README and whitepaper in `app/tcoin/`.

### What Changed
- Imported TorontoCoin Solidity and ABI artifacts into `contracts/foundry/src/torontocoin/` (copy-only, no git history).
- Moved the imported TorontoCoin `README.md` from the Foundry source folder to `app/tcoin/README.md`.
- Moved the TorontoCoin whitepaper PDF from `docs/torontocoin/` to `app/tcoin/T-Coin Whitepaper.pdf`.

### Files Edited
- `contracts/foundry/src/torontocoin/CADCOIN.sol`
- `contracts/foundry/src/torontocoin/Orchestration.sol`
- `contracts/foundry/src/torontocoin/PlainERC20.abi`
- `contracts/foundry/src/torontocoin/PlainERC20.sol`
- `contracts/foundry/src/torontocoin/TCOIN.sol`
- `contracts/foundry/src/torontocoin/TTCCOIN.sol`
- `contracts/foundry/src/torontocoin/Voting.sol`
- `contracts/foundry/src/torontocoin/sampleERC20.sol`
- `app/tcoin/README.md`
- `app/tcoin/T-Coin Whitepaper.pdf`

## v1.01
### Timestamp
- 2026-03-09 13:29:44 EDT

### Objective
- Scaffold a Foundry workspace in this repository with a clean, production-oriented folder layout and baseline configuration.

### What Changed
- Initialized a new Forge project at `contracts/foundry`.
- Removed default sample files (`Counter.sol`, `Counter.t.sol`, `Counter.s.sol`) to avoid placeholder code in mainline.
- Added Solidity source subfolders for common separation of concerns: `errors`, `interfaces`, `libraries`, `mocks`, and `types`.
- Added test subfolders for `unit`, `integration`, `invariant`, and shared `helpers`.
- Added script subfolders (`script/deploy`, `script/helpers`) and a `deployments` directory for deployment artifacts.
- Updated Foundry config to include explicit `test` and `script` paths, optimizer settings, cache path, remapping detection, and filesystem permission for deployment outputs.
- Added local workspace helpers: `.gitignore`, `.env.example`, and a workspace README documenting layout and conventions.

### Files Edited
- `contracts/foundry/foundry.toml`
- `contracts/foundry/README.md`
- `contracts/foundry/.gitignore`
- `contracts/foundry/.env.example`
- `contracts/foundry/src/Counter.sol` (deleted)
- `contracts/foundry/test/Counter.t.sol` (deleted)
- `contracts/foundry/script/Counter.s.sol` (deleted)
- `contracts/foundry/src/errors/.gitkeep`
- `contracts/foundry/src/interfaces/.gitkeep`
- `contracts/foundry/src/libraries/.gitkeep`
- `contracts/foundry/src/mocks/.gitkeep`
- `contracts/foundry/src/types/.gitkeep`
- `contracts/foundry/test/unit/.gitkeep`
- `contracts/foundry/test/integration/.gitkeep`
- `contracts/foundry/test/invariant/.gitkeep`
- `contracts/foundry/test/helpers/.gitkeep`
- `contracts/foundry/script/deploy/.gitkeep`
- `contracts/foundry/script/helpers/.gitkeep`
- `contracts/foundry/deployments/.gitkeep`


## v0.90
- Fixed `v0.89` migration to support legacy `wallet_list` rows with `user_id IS NULL` by replacing a full-table `wallet_key_id NOT NULL` constraint with a conditional check (`user_id IS NULL OR wallet_key_id IS NOT NULL`), while preserving foreign-key integrity.
- Updated the SQL schema snapshot to keep `wallet_list.wallet_key_id` nullable for non-user rows.

## v0.89
- Added a reversible Supabase migration introducing `wallet_keys`, migrating `wallet_list.app_share` into per-user wallet keys, linking both `wallet_list` and `user_encrypted_share` via `wallet_key_id`, and refreshing the SQL schema snapshot.
- Updated wallet and SpareChange welcome wallet-connect flows to upsert/reuse `wallet_keys` before writing `wallet_list` and `user_encrypted_share` rows.
- Updated send-money share retrieval to resolve `app_share` from `wallet_keys` plus encrypted shares by `wallet_key_id`, and refreshed/extended Supabase service tests with a shared-key regression fixture.

## v0.88
- Made wallet landing dark mode changes significantly more visible by deepening the page gradient, making main/intro sections transparent in dark mode so the gradient actually shows through, and strengthening CTA button contrast with a brighter light-grey gradient plus border.

## v0.87
- Softened wallet landing dark mode by applying a near-black to charcoal background gradient, differentiating headings to white against light-grey body copy, and switching wallet CTA buttons to a light-grey gradient fill in dark mode.

## v0.86
- Tuned wallet landing header breakpoints by capping banner growth between 535-767px (`max-w-[535px]`) and reducing tagline size with nowrap between 1023-1163px to prevent multi-line overflow.

## v0.85
- Centred the tablet-portrait header CTA by switching it to a portrait-only block element with fit-content width and auto margins, preventing left alignment drift.

## v0.84
- Updated tablet portrait wallet header layout to center-align the tagline and place the wallet CTA in a third row below it, while keeping side-column CTA behaviour for larger desktop layouts.

## v0.83
- Increased wallet landing midsize banner prominence by widening the header middle column (`15/70/15`) and setting banner width to `md:w-[75%]`, keeping it narrower than the body text column but above half-width.

## v0.82
- Eliminated initial large-screen fade-gap drift by recalculating wallet header height with `ResizeObserver`, `requestAnimationFrame`, and load/resize hooks, then offsetting the fade strip by 1px so no fully visible band appears between the fixed header and gradient.

## v0.81
- Kept the wallet landing header and fade overlay stationary during scroll by splitting them into separate `fixed` layers and positioning the gradient strip using measured header height.

## v0.80
- Fixed the wallet landing header fade effect by moving the gradient strip to an absolute overlay below the fixed header (`top-full`) with stronger height/opacity ramp so body content visibly fades while scrolling upward.

## v0.79
- Refined wallet landing presentation by setting footer links to body-sized text, adding a header fade gradient for scroll transitions, and increasing heading spacing so pre-heading whitespace is about 50% larger than post-heading whitespace.

## v0.78
- Updated the wallet landing responsiveness: banner images now always render fully on small screens, unauthenticated tagline + CTA stack moves into the scrollable body on small screens and tablet landscape, and the footer switches to a one-column portrait-mobile layout with right-aligned links above left-aligned branding.

## v0.77
- Updated the wallet landing header for small screens by removing the hamburger drawer, surfacing its copy and CTA inline under the banner for unauthenticated users, and tightening mobile banner height and section widths for portrait and landscape readability.

## v0.76
- Hardened `20260211180453_v0.72_connections_profile_fks.sql` to follow idempotency guard-rails (`ALTER TABLE IF EXISTS` plus constraint existence checks before adds) and renamed legacy Supabase migration files to timestamp-prefixed names for Supabase ordering compatibility.

## v0.75
- Hardened `v0.72` migration idempotency by dropping existing `connections_*_profile_fkey` constraints before re-adding them, preventing duplicate-constraint failures on already-migrated databases.

## v0.74
- Reverted the `public.interac_transfer` app-profile foreign-key experiment so transfer records continue referencing `public.users(id)` and follow the user across app profiles.

## v0.73
- Added a Supabase migration to move `public.interac_transfer` user relationships from `public.users(id)` to app-scoped composite foreign keys on `public.app_user_profiles(user_id, app_instance_id)`, with a reversible rollback path.

## v0.72
- Added a new Supabase migration that reaffirms `public.connections` composite foreign keys to `public.app_user_profiles` and includes a reversible down migration back to `public.users(id)`.

## v0.71
- Added `docs/webauthn-passkey-storage.md` documenting how WebAuthn passkeys are created and stored, including that `rp.id` is sourced from `window.location.hostname`.

## v0.70
- Refreshed the Supabase SQL snapshot to include the app instance foreign key on `interac_transfer` and the new `app_user_profiles` security policies.

## v0.69
- Added a dedicated Supabase migration enabling row-level security on `app_user_profiles` with self-service select/insert/update policies tied to the owning auth user.

## v0.68
- Updated Supabase app registry migrations, profile backfill, shared Supabase helpers, and specs to use `ref_apps`, `ref_citycoins`, and `ref_app_instances` table names.

## v0.67
- Normalised Cubid data around per-app profiles by adding a reversible Supabase migration, updating shared typings/service helpers, and wiring wallet and SpareChange flows to read and write the scoped profile payloads.

## v0.66
- Added Supabase migrations for `apps`, `citycoins`, and `app_instances`, seeded wallet/sparechange pairings, refreshed the SQL schema snapshot, and exposed a cached helper to resolve the active app instance by environment variables.

## v0.65
- Styled the incoming request modal with a pink Pay button and white Ignore button, renamed outgoing requests to "Payment requests I have sent" with delete actions, and routed new users to `/welcome` with username availability checks, clearer continue guidance, and phone verification feedback.

## v0.64
- Finalised the `/admin` wallet dashboard by fixing the ramp request save test with explicit DOM cleanup and ensuring admin-only routing remains enforced.

## v0.63
- Pulled the Supabase OpenAPI metadata and generated `sql-schema-v0.sql` capturing tables, enums, and exposed RPC signatures.

## v0.62
- Secured Ecosystem links with `rel="noopener noreferrer"` and added tests.

## v0.61
- Added public Ecosystem page listing related projects and linked it from resources and the landing footer for SEO.

## v0.60
- OTP form auto-submits once all six digits are entered, removing the need for a Verify button.
- Send tab opens the shared QR scan modal instead of embedding a scanner, and the amount input is borderless with oversized text and two-decimal conversions.

## v0.59
- Converted Send tab token balances from strings to numbers and added a unit test confirming `SendCard` receives a numeric `userBalance` prop.

## v0.58
- Parsed token balance strings before arithmetic to avoid `toFixed` runtime errors and added a unit test ensuring `SendCard` receives a numeric balance.

## v0.57
- Manual Send flow shows an oversized amount input with available balance, Use Max shortcut and reveals contact or scan options only after amount entry.

## v0.56
- Restored Send tab to include QR camera plus options to select a contact or paste a link, with amount entry and send button available on the page.

## v0.55
- Refined sign-in modal to show a spam warning with a hyperlink for resending codes.

## v0.54
- Guarded dashboard send flows against null recipient data, hardened Supabase fetches, and wrapped the page in an error boundary.

## v0.53
- Ensured contact selection passes full recipient data to send flow and added unit test covering the behaviour.

## v0.52
- Refined wallet dashboard footer and send flow: centered tab icons, inline QR scanner with contact option, white receive QR background and persistent dark mode.

## v0.51
- Guarded wallet dashboard deep-link scans to run only when the URL includes a `pay` payload and trigger success toasts after user lookup and connection insertion.

## v0.50
- Ensured Send tab supplies sender and receiver IDs to `useSendMoney` and added a unit test to prevent regressions.

## v0.49
- Deferred browser storage access like localStorage to `useEffect` hooks to silence build-time warnings in Node.

## v0.48
- Configured Vitest to run tests in a jsdom environment for DOM APIs.

## v0.47
- Switched wallet dashboard to system fonts and added functional tabs for contacts, sending, and receiving.

## v0.46
- Replaced custom 48% slide animations with built-in half-screen variants and cleared Tailwind's ambiguous class warnings.

## v0.45
- Established a Tailwind preset and per-app configs to remove ambiguous class warnings for wallet and sparechange builds.

## v0.44
- Refactored wallet dashboard into reusable components with a dedicated footer navigation and added unit tests.

## v0.43
- Added React imports and escape-key handling to wallet modals and wrapped modal tests with a QueryClient provider so unit tests pass.

## v0.42
- Replaced single verification field with six auto-advancing inputs in sign-in modals and added a unit test.

## v0.41
- Closed modals with the Escape key and confirmed missing request amounts with a follow-up modal.
- Restored camera access for QR payments and ensured top ups display their modal again.

## v0.40
- Added Vitest testing framework with path alias support and a script to run unit tests.

## v0.39
- Made `/dashboard` a public wallet route so it no longer requires authentication.

## v0.38
- Removed '/tcoin/wallet' prefix from wallet links so routes serve from the domain root.

## v0.37
- Capitalised wallet dashboard branding to TCOIN and added optional QR padding.

## v0.36
- Locked wallet dashboard QR code colours to black on white.

## v0.35
- Lightened dark-mode highlight backgrounds to Tailwind gray-700 on landing, resources and contact pages.

## v0.34
- Corrected Tailwind dark mode configuration so highlight and banner styles switch properly.

## v0.33
- Swapped landing page highlights for light grey in light mode and dark grey in dark mode.

## v0.32
- Added a cache-busting query to the dark-mode banner image so the updated asset renders correctly.

## v0.31
- Routed main panels to theme background and applied the dark class to the root element so dark mode renders panels black.

## v0.30
- Switched highlighted phrases on the landing page to a very light teal in light mode and #05656F in dark mode.

## v0.29
- Shifted "<open my wallet>" buttons to #05656F in light mode, teal send buttons on the contact page and teal hamburger icons.
- Ensured landing, resources and contact panels darken in dark mode.

## v0.28
- Styled "<open my wallet>" links as rectangular buttons with inverted colours for light and dark modes.
- Switched themed backgrounds to pure white or black and set landing, resources and contact panels to black in dark mode.

## v0.27
- CI workflow installs dependencies without enforcing the lockfile.

## v0.26
- Widened landing, resources and contact pages to 60% width and trimmed top spacing on the landing page.
- Added return-home links and extra spacing on Resources and Contact pages.
- Fixed dark mode by attaching the `dark` class to the body so backgrounds and banner images toggle correctly.

## v0.25
- Switched landing header to light and dark banner images and updated image host configuration.

## v0.24
- Set page backgrounds to white or black according to theme while panels use themed background colour.
- Centred the top-right call-to-action with the banner and duplicated the "<open my wallet>" link beneath the closing copy.

## v0.23
- Hid landing page tagline on small screens and replaced the open-wallet link with a hamburger menu that reveals a slide-out panel containing the tagline and "<open my wallet>" link.

## v0.22
- Applied system-preferring dark mode hook and extended theme across landing, resources and contact pages.
- Centralised footer rendering in layout to avoid duplication and ensure consistent theming.
- Dashboard background now follows the selected theme.

## v0.21
- Made Resources and Contact pages public with landing page styling and shared header and footer.
- Fixed landing page links to point to the whitepaper, Telegram chat, presentation and source code.
- Footer now links to Resources and GitHub repo; Twilio routes initialise clients only when env vars exist.

## v0.20
- Added Resources page linking to external project materials and open source repository.
- Expanded Contact page with WhatsApp invite and submission form saving requests and IP addresses to Supabase.

## v0.19
- Split the fixed header into three columns with empty left area.
- Centre column matches body width and holds the banner and right-aligned tagline.
- Right column shows "<open my wallet>" left aligned at the top.
- Minimized bottom padding of the header.

## v0.18
- Aligned the "<open my wallet>" link within the right margin.
- Tagline changed to plain text with margin underneath.
- Added padding before the first section and updated copy on how to get involved.
- Footer now links to Whitepaper, Github and Contact, with a new contact page.

## v0.17
- Placed tagline beneath the banner image in the fixed header.
- Positioned the "<open my wallet>" link at the far right of the page.

## v0.16

- Narrowed body text and banner to 40% width on large screens.
- Updated tagline: "Local Currency. Value = $3.35. Proceeds to charity." and right-aligned it below the banner.
- Headings now use extra-bold styling.

## v0.15

- Moved banner image and "Local Currency, Global Example." tagline into the fixed header so content scrolls underneath.
- Removed the dark top border by clearing shadow styles.
- Footer now displays white background with black text.

## v0.14

- Trimmed section padding on wallet homepage so headings have exactly one blank line above and below.
- Updated functional and technical specs to reflect the refined spacing.

## v0.13

- Added equal spacing above and below each heading on TCOIN wallet homepage.
- Documented heading spacing in functional and technical specs.

## v0.12

- Updated home page copy with regular dashes and revised closing line.

## v0.11

- Imported Special Elite via style tag with system-ui fallback, ensuring font loads without monospace fallback.
- Updated functional and technical specs to reflect new font approach.

## v0.10

- Ensured Special Elite font falls back only to typewriter fonts and updated nav link text to "<open my wallet>".
- Reduced spacing around headings for a cleaner layout.
- Updated functional and technical specs to match.

## v0.8

- Switched wallet homepage font to Special Elite for a typewriter feel.

## v0.9

- Applied Special Elite using next/font and global styles in wallet layout.
- Simplified ContentLayout for landing page without navbar or footer.
- Updated nav text to "/open your wallet/" linking to dashboard.

## v0.7

- Replaced Michroma with Courier New and added underline styling.
- Removed "A project by Toronto DAO" text and dark top line.
- Updated copy to use TCOIN wording and darker highlight.

## v0.6

- Applied Michroma font across new wallet homepage and unified text size.
- Slimmed spacing and limited banner width to match content.
- Simplified navbar to single "open your wallet" link and removed blue top line.

## v0.5

- Refined wallet homepage design with white background, dark text, and centered headings.
- Converted bullet lists to prose and highlighted first sentences.
- Adjusted layout to 50% width with 25% margins and fixed banner path.

## v0.4

- Added remote banner image and allowed domain in Next.js config.

## v0.3

- Adjusted ESLint rules to silence quote errors so build passes.

## v0.2

- Redesigned wallet home page using mission-driven copy and Thinking Machines layout.

## v0.1

- Initial bootstrap: added agent-context folder and CI workflow.

## v1.18
### Timestamp
- 2026-03-12 12:45:00 EDT

### Objective
- Implement the Buy TCOIN checkout orchestrator flow in wallet + backend (Transak sessioning, managed deposit wallets, webhook ingestion, auto-mint via `TcoinMintRouter`, session status APIs, and admin retry visibility), with new persistence schema and feature-flagged UI entry points.

### What Changed
- Added Supabase migration `v0.98` for onramp orchestration:
- `onramp_deposit_wallets`, `onramp_checkout_sessions`, `onramp_settlement_attempts`, `onramp_provider_events`, and `onramp_operation_locks`.
- lock RPCs: `onramp_try_acquire_lock(...)`, `onramp_release_lock(...)`.
- admin projection view: `v_onramp_checkout_admin`.
- RLS/grants for user-scoped session visibility and service-role settlement writes.
- Added new onramp service module under `services/onramp/src`:
- env/config resolver for provider/chain/router/gas/HD settings.
- deterministic per-user deposit wallet derivation + allocation.
- Transak session builder + webhook signature validation + event normalization.
- settlement runner with idempotent lock, USDC detection, quote/min-output guards, gas top-up, router mint execution, attempt/session persistence, and manual-review fallback.
- status projection helpers for timeline rendering.
- Added wallet-facing and ops-facing API routes:
- `POST /api/onramp/session`
- `GET|POST /api/onramp/session/[id]`
- `POST /api/onramp/session/[id]/retry`
- `POST /api/onramp/webhooks/transak`
- `POST /api/onramp/touch`
- `GET /api/onramp/admin/sessions`
- Added shared onramp types/feature flag helpers in `shared/lib/onramp/*`.
- Added new wallet modal `BuyTcoinModal` with checkout session creation, embedded widget frame, timeline polling, and deterministic status toasts.
- Wired Buy TCOIN entry points into `WalletHome` and `MoreTab` behind `NEXT_PUBLIC_BUY_TCOIN_CHECKOUT_V1` while preserving Interac top-up/off-ramp actions.
- Extended admin dashboard with a new Buy TCOIN checkout sessions panel and manual retry action.
- Updated `.env.local.example` with all required onramp env variables and examples.
- Corrected a critical provider-status mapping bug so provider `completed/success` maps to `crypto_sent` (not `mint_complete`), preventing premature terminal session status.
- Ran targeted verification:
- `npm run test -- app/api/onramp/session/route.test.ts app/api/onramp/webhooks/transak/route.test.ts app/tcoin/wallet/components/dashboard/MoreTab.test.tsx` (all passing).
- `npx tsc --noEmit` checked for touched-file regressions (resolved for changed files).

### Files Edited
- `supabase/migrations/20260312113000_v0.98_onramp_checkout.sql`
- `services/onramp/src/config.ts`
- `services/onramp/src/depositWallets.ts`
- `services/onramp/src/index.ts`
- `services/onramp/src/provider/transak.ts`
- `services/onramp/src/settlement.ts`
- `services/onramp/src/status.ts`
- `services/onramp/src/types.ts`
- `shared/lib/onramp/feature.ts`
- `shared/lib/onramp/types.ts`
- `app/api/onramp/session/route.ts`
- `app/api/onramp/session/route.test.ts`
- `app/api/onramp/session/[id]/route.ts`
- `app/api/onramp/session/[id]/retry/route.ts`
- `app/api/onramp/webhooks/transak/route.ts`
- `app/api/onramp/webhooks/transak/route.test.ts`
- `app/api/onramp/touch/route.ts`
- `app/api/onramp/admin/sessions/route.ts`
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/tcoin/wallet/components/modals/index.ts`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/admin/page.tsx`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.19
### Timestamp
- 2026-03-12 12:58:00 EDT

### Objective
- Add a detailed architecture writeup for the Buy TCOIN checkout orchestrator and document this documentation pass in session-log.

### What Changed
- Added a dedicated architecture document for the implemented onramp checkout stack:
- component model (wallet, API routes, service layer, chain execution, persistence),
- sequence and state-machine flows,
- settlement algorithm and guard rails,
- webhook/idempotency/security controls,
- API/data contracts,
- operations/SLA/failure-mode handling,
- deferred hardening and next-phase items.
- Captured this documentation-only update as a new log entry.

### Files Edited
- `docs/buy-tcoin-checkout-orchestrator-architecture.md`
- `agent-context/session-log.md`

## v1.20
### Timestamp
- 2026-03-12 13:08:00 EDT

### Objective
- Reduce hyperlink visual intensity in wallet light/dark themes.

### What Changed
- Updated wallet link color token to match requested values:
- light mode link color set to `#4d004d`.
- dark mode link color set to `#ffe6ff`.
- Updated base link styling so anchors and `.link-btn` use `--link-color` instead of `--primary`, preventing bright-pink primary color from overriding hyperlink tone.

### Files Edited
- `app/tcoin/wallet/styles/app.scss`
- `agent-context/session-log.md`

## v1.21
### Timestamp
- 2026-03-12 13:11:00 EDT

### Objective
- Adjust wallet dark-mode hyperlink color to the requested softer pink.

### What Changed
- Updated wallet dark-mode `--link-color` from `#ffe6ff` to `#ffccff`.

### Files Edited
- `app/tcoin/wallet/styles/app.scss`
- `agent-context/session-log.md`

## v1.22
### Timestamp
- 2026-03-12 19:23:00 EDT

### Objective
- Align Buy TCOIN onramp with Transak’s secure backend widget URL generation requirement.

### What Changed
- Refactored Transak session creation to call the secure backend endpoint (`/api/v2/auth/session`) instead of building public query-string widget URLs.
- Added backend request with required secure headers:
- `access-token` (partner access token)
- `authorization` (user auth token)
- Added robust response parsing and failure handling for missing/invalid `widgetUrl` from provider response.
- Updated session creation route to await async secure widget generation.
- Extended onramp config/env requirements with new Transak secure widget settings.
- Updated `.env.local.example` with new variables and staging/production endpoint examples.
- Verified with targeted API tests and touched-file TypeScript checks.

### Files Edited
- `services/onramp/src/provider/transak.ts`
- `services/onramp/src/config.ts`
- `app/api/onramp/session/route.ts`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.23
### Timestamp
- 2026-03-12 19:41:00 EDT

### Objective
- Make Transak user authorization token optional for secure widget URL generation while preserving partner-token security flow.

### What Changed
- Updated onramp config type and parsing so `ONRAMP_TRANSAK_USER_AUTH_TOKEN` is optional (`string | null`) instead of required.
- Updated Transak secure widget request headers to include `authorization` only when `ONRAMP_TRANSAK_USER_AUTH_TOKEN` is present.
- Updated `.env.local.example` docs to clarify user auth token is optional unless user-authenticated Transak sessions are being used.
- Verified with targeted onramp API tests.

### Files Edited
- `services/onramp/src/config.ts`
- `services/onramp/src/provider/transak.ts`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.24
### Timestamp
- 2026-03-12 19:42:00 EDT

### Objective
- Migrate Transak webhook verification from required webhook secret to access-token/JWT verification, while keeping legacy HMAC as optional fallback.

### What Changed
- Made `ONRAMP_TRANSAK_WEBHOOK_SECRET` optional in onramp config.
- Added JWT webhook verification path using `ONRAMP_TRANSAK_ACCESS_TOKEN` (HS256 verify + payload decode).
- Updated webhook route to use unified verification+decode function:
- accepts JWT payload verification via access token,
- supports legacy signature mode if webhook secret is configured,
- rejects unverifiable payloads with 401.
- Updated service exports and webhook tests for new verification API.
- Updated `.env.local.example` to mark webhook secret as optional legacy input.

### Files Edited
- `services/onramp/src/config.ts`
- `services/onramp/src/provider/transak.ts`
- `services/onramp/src/index.ts`
- `app/api/onramp/webhooks/transak/route.ts`
- `app/api/onramp/webhooks/transak/route.test.ts`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.25
### Timestamp
- 2026-03-12 19:50:00 EDT

### Objective
- Bypass authentication requirements in local/development environments for faster wallet/onramp iteration.

### What Changed
- Added environment-gated auth bypass support when `NEXT_PUBLIC_APP_ENVIRONMENT` is `local` or `development`.
- Updated shared API auth resolver to:
- return normal auth context when Supabase session exists,
- fallback to a service-role resolved user row when unauthenticated in local/dev,
- optionally honor `AUTH_BYPASS_USER_ID` to pin bypass identity,
- otherwise fallback to the first user in `public.users`.
- Updated wallet content layout to skip non-public redirect-to-home for unauthenticated users in local/dev.
- Updated indexer touch/status endpoints to allow unauthenticated invocation in local/dev only.
- Added env template documentation for `AUTH_BYPASS_USER_ID`.
- Verified touched files with TypeScript and reran onramp route tests.

### Files Edited
- `shared/lib/bia/apiAuth.ts`
- `app/tcoin/wallet/ContentLayout.tsx`
- `app/api/indexer/touch/route.ts`
- `app/api/indexer/status/route.ts`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.26
### Timestamp
- 2026-03-12 19:55:00 EDT

### Objective
- Reorganize `/dashboard` actions so Interac top-up appears under Buy TCOIN, and remove the Other panel from dashboard while keeping off-ramp in More.

### What Changed
- Updated `WalletHome` to remove `OtherCard` from both mobile and desktop dashboard layouts.
- Added `Top Up with Interac eTransfer` button into the `Buy TCOIN` panel in `WalletHome`.
- Kept `Buy TCOIN` checkout button in the same panel (feature-flagged behavior unchanged).
- Left `Convert to CAD and Cash Out` untouched in the More tab flow.
- Verified with `WalletHome` component test.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `agent-context/session-log.md`

## v1.27
### Timestamp
- 2026-03-12 20:07:00 EDT

### Objective
- Simplify `/dashboard` so initial view emphasizes balance and clearly separates user intent flows: pay, top-up/buy, and request.

### What Changed
- Refactored `WalletHome` to remove the always-visible send amount form from initial load.
- New default dashboard home now shows:
- balance-first account surface,
- explicit intent actions (`Pay To`, `Request`),
- dedicated `Top Up / Buy` panel with Buy TCOIN + Interac top-up actions.
- Added intent gating so `SendCard` only appears after user explicitly chooses `Pay To` (or deep-link scan intent), eliminating the ambiguous `Amount` panel at initial load.
- Wired `Request` intent to switch to the Receive tab from dashboard parent.
- Removed off-ramp as a dashboard-home action (off-ramp remains in More tab).
- Updated `WalletHome` tests to match the new intent-driven behavior and verify send flow appears only after selecting Pay To.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `agent-context/session-log.md`

## v1.28
### Timestamp
- 2026-03-12 20:31:10 EDT

### Objective
- Revert the dashboard to the previous layout and keep only one UX adjustment: merge the separate `Amount` section into the `Send To` panel.

### What Changed
- Restored dashboard files from the pre-redesign state so `/dashboard` behavior and structure match the prior layout.
- Removed the standalone `Amount` card section in `SendCard` and embedded its amount input/conversion block directly inside the `Send To` card.
- Kept all other dashboard behavior unchanged relative to the pre-redesign baseline.
- Re-ran focused dashboard tests to confirm no regressions in restored layout and send flow interactions.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendCard.tsx`
- `agent-context/session-log.md`

## v1.29
### Timestamp
- 2026-03-12 20:32:55 EDT

### Objective
- Increase contrast of the dashboard header `TCOIN` logo in both light and dark mode.

### What Changed
- Added a dedicated navbar brand-logo class (`wallet-brand-logo`) so the header logo is not constrained by generic link colors.
- Applied theme-specific logo color tokens:
- light mode: white logo on teal navbar.
- dark mode: deep purple logo on white navbar.
- Forced the brand logo to full opacity in navbar (`!opacity-100`) so non-active route dimming does not reduce readability.
- Verified with targeted navbar tests.

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/styles/app.scss`
- `agent-context/session-log.md`

## v1.30
### Timestamp
- 2026-03-12 20:37:51 EDT

### Objective
- Improve Buy TCOIN modal UX clarity and error handling for checkout startup failures.

### What Changed
- Removed duplicate modal heading text (`Buy TCOIN`) from modal body so the modal title is shown only once.
- Switched modal content typography to dashboard style via `font-sans` (instead of inheriting homepage-style font).
- Replaced fiat-first amount fields with a send-style dual-currency amount flow:
- default editable input is `TCOIN`.
- live preview shows equivalent `CAD`.
- toggle lets user switch to editing `CAD` with equivalent `TCOIN` preview.
- Added clearer checkout locale fields:
- fixed checkout currency display (`CAD`),
- country code field with explicit explanation (`CA` default used by Transak for compliance/payment methods).
- Improved checkout startup error UX:
- user-facing, non-technical error toast/message,
- optional “Show technical details” expansion for debugging.
- Hardened `POST /api/onramp/session` error responses:
- classify config/auth/wallet/not-found session errors,
- return user-safe error message + `errorCode`,
- include `technicalError` only in `local/development` environments for debug UI.
- Verified with targeted tests:
- `app/api/onramp/session/route.test.ts`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/components/dashboard/SendCard.test.tsx`

### Files Edited
- `app/tcoin/wallet/components/modals/BuyTcoinModal.tsx`
- `app/api/onramp/session/route.ts`
- `agent-context/session-log.md`

## v1.31
### Timestamp
- 2026-03-12 20:40:25 EDT

### Objective
- Move BIA and Voucher Routing preference editors off the More tab surface into dedicated modals with user-facing explanatory preambles.

### What Changed
- Added two new dedicated modal components:
- `BiaPreferencesModal` with preamble explaining primary vs secondary BIAs, personalization impact, and non-restrictive spending behavior.
- `VoucherRoutingPreferencesModal` with preamble explaining trust/default/blocked routing behavior and merchant/token scope.
- Updated More tab actions:
- removed inline `BIA Preferences` and `Voucher Routing Preferences` detail panels,
- added button actions that open each preference flow in its own modal.
- Wired modal exports through the shared modal barrel.
- Expanded MoreTab tests to verify both new modal entry points open correctly.

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/components/modals/BiaPreferencesModal.tsx`
- `app/tcoin/wallet/components/modals/VoucherRoutingPreferencesModal.tsx`
- `app/tcoin/wallet/components/modals/index.ts`
- `agent-context/session-log.md`

## v1.32
### Timestamp
- 2026-03-12 20:41:32 EDT

### Objective
- Increase horizontal margins and center the Contacts tab content to match the spacing style of other dashboard tabs.

### What Changed
- Updated the Contacts tab root container to use desktop-centered padding (`lg:px-[25vw]`), aligning it with Send/Receive/More layout patterns.
- Preserved existing mobile behavior and all contact interactions.
- Verified with focused Contacts tab tests.

### Files Edited
- `app/tcoin/wallet/components/dashboard/ContactsTab.tsx`
- `agent-context/session-log.md`

## v1.33
### Timestamp
- 2026-03-12 20:43:04 EDT

### Objective
- Move the dashboard send action button into the `Send To` panel so action placement matches panel context.

### What Changed
- Relocated the primary send CTA (`Send...` / `Pay this request`) from below the card to inside the `Send To` section in `SendCard`.
- Kept existing validation, modal confirmation, and disabled-state behavior unchanged.
- Added top margin to maintain spacing inside the panel.
- Verified with focused send-flow tests.

### Files Edited
- `app/tcoin/wallet/components/dashboard/SendCard.tsx`
- `agent-context/session-log.md`

## v1.34
### Timestamp
- 2026-03-12 20:52:27 EDT

### Objective
- Add dashboard Recents panel and a dedicated contact profile page with send/request actions and transaction history.

### What Changed
- Added a new `Recents` panel to `/dashboard` home (mobile + desktop cards).
- Recents logic now resolves up to 4 most recent interaction users by combining:
- contact recency (`connections` via `fetchContactsForOwner`),
- recent transfer counterparties (`act_transaction_entries` + wallet/user joins),
- request counterparties (`invoice_pay_request`).
- Recents avatars now navigate to a new contact profile route: `/dashboard/contacts/[id]`.
- Added new contact profile page at `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx` with:
- public profile details (name, username, avatar, bio/country/address when available, wallet),
- transaction history between current user and contact,
- inline amount input + `Send` button for direct payment,
- `Request money from [user]` button opening a separate amount-entry modal that creates `invoice_pay_request`.
- Updated WalletHome tests to support new recents data loading and routing behavior.
- Added test coverage for opening a contact profile from the Recents panel.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.test.tsx`
- `app/tcoin/wallet/dashboard/contacts/[id]/page.tsx`
- `agent-context/session-log.md`

## v1.35
### Timestamp
- 2026-03-12 20:53:34 EDT

### Objective
- Simplify Receive tab caption copy by removing the token suffix from the default “any amount” state.

### What Changed
- Updated Receive QR caption fallback text from `Receive any amount TCOIN` to `Receive any amount`.
- Kept amount-specific caption behavior unchanged (`Receive {amount} TCOIN`).
- Verified with focused ReceiveCard tests.

### Files Edited
- `app/tcoin/wallet/components/dashboard/ReceiveCard.tsx`
- `agent-context/session-log.md`

## v1.36
### Timestamp
- 2026-03-12 20:59:23 EDT

### Objective
- Improve dashboard navigation responsiveness and refactor Send tab action modes into inline, panel-based flows.

### What Changed
- Updated dashboard navigation behavior:
- kept the bottom footer for phone/tablet (`lg:hidden`).
- added a desktop left sidebar (`lg:block`) with `Home` pinned to top, `More` pinned to bottom, and middle tabs (`Receive`, `Send`, `Contacts`) vertically centered.
- adjusted dashboard page spacing to avoid sidebar overlap on large screens (`lg:pl-28`, `lg:pb-8`).
- Refactored Send tab mode controls:
- moved `Manual / Scan QR Code / Pay Link / Requests` into a dedicated tab row above the main panel.
- changed `Scan QR Code` to render inline in-panel using `QrScanModal` (no modal launch).
- changed `Requests` to render inline as an `Incoming Requests To Pay` panel (no modal launch), including refresh and pay/ignore actions.
- kept request-to-send flow intact by switching back to the manual send card after selecting a request.
- preserved pay-link sending behavior by showing link input first, then rendering the locked send card once recipient/amount are loaded.
- Updated Send tab tests for inline QR/requests behavior and validated both affected suites.

### Files Edited
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.tsx`
- `app/tcoin/wallet/components/dashboard/SendTab.test.tsx`
- `agent-context/session-log.md`

## v1.37
### Timestamp
- 2026-03-12 21:01:00 EDT

### Objective
- Enlarge the header camera QR scanner modal so the camera feed has enough space on open.

### What Changed
- Updated the header camera button modal config to open the QR scanner with:
- `elSize: "4xl"` for a larger modal width.
- `isResponsive: true` so layout adapts better across viewport sizes.
- Added an explicit camera button accessibility label (`aria-label="Open QR scanner"`).
- Added navbar test coverage verifying the camera button opens a large, responsive QR modal with expected modal options.

### Files Edited
- `app/tcoin/wallet/components/navbar/Navbar.tsx`
- `app/tcoin/wallet/components/navbar/Navbar.test.tsx`
- `agent-context/session-log.md`

## v1.38
### Timestamp
- 2026-03-13 12:18:51 EDT

### Objective
- Prevent wallet/dashboard crashes caused by unhandled WalletConnect disconnect errors (`this.provider.disconnect is not a function`).

### What Changed
- Added a new client-side runtime guard provider that listens to `error` and `unhandledrejection` events and suppresses only the known WalletConnect disconnect error signature.
- Guard matching is narrow and requires both:
- message containing `this.provider.disconnect is not a function`
- WalletConnect markers in stack trace.
- Mounted this guard in both app shells that include Cubid providers:
- wallet layout
- contracts layout
- Verified no regressions with focused wallet/nav test runs.

### Files Edited
- `shared/providers/walletconnect-error-guard.tsx`
- `app/tcoin/wallet/layout.tsx`
- `app/tcoin/contracts/layout.tsx`
- `agent-context/session-log.md`

## v1.39
### Timestamp
- 2026-03-13 12:52:07 EDT

### Objective
- Split dashboard cleanup into smaller changes: simplify `My Account`, move experimental graphs to a modal in `More`, and introduce a dedicated `Transaction History` dashboard tab.

### What Changed
- Simplified `My Account` panel:
- removed the four internal tab buttons.
- removed in-panel graph views and in-panel transaction history.
- kept balance summary and wallet/explorer details.
- added a new `View transaction history` button.
- Added `Future app features` modal:
- created `FutureAppFeaturesModal` containing the two existing experimental charts.
- added `Future app features` button to `More` tab to open that modal.
- Added a dedicated `Transaction History` dashboard tab:
- new `TransactionHistoryTab` component fetches and displays recent `TCOIN` transfers from `act_transaction_entries` using the current user’s wallets.
- wired dashboard state so `My Account` button opens this tab.
- added a top-right back arrow button on small/medium screens only (`lg:hidden`) to return to main dashboard home.
- Updated dashboard navigation:
- desktop left sidebar now includes `History`.
- mobile/tablet bottom footer remains unchanged (no `History` tab added there).
- Updated/added tests for the modified dashboard/footer/more/account behavior.

### Files Edited
- `app/tcoin/wallet/components/dashboard/AccountCard.tsx`
- `app/tcoin/wallet/components/dashboard/TransactionHistoryTab.tsx`
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `app/tcoin/wallet/dashboard/page.tsx`
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `app/tcoin/wallet/components/modals/FutureAppFeaturesModal.tsx`
- `app/tcoin/wallet/components/modals/index.ts`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/index.ts`
- `app/tcoin/wallet/components/DashboardFooter.test.tsx`
- `app/tcoin/wallet/components/dashboard/AccountCard.test.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `agent-context/session-log.md`

## v1.40
### Timestamp
- 2026-03-13 13:12:27 EDT

### Objective
- Eliminate recurring dashboard crash caused by WalletConnect runtime disconnect errors (`this.provider.disconnect is not a function`).

### What Changed
- Updated wallet layout provider bootstrapping to make Cubid WalletConnect provider stack opt-in instead of always-on.
- Added env-controlled switch:
- `NEXT_PUBLIC_ENABLE_CUBID_WALLET_PROVIDERS=true` to explicitly enable `cubid-sdk` + `cubid-wallet` providers.
- default behavior is now disabled (`false`) to avoid initializing the problematic WalletConnect path in normal wallet/dashboard usage.
- Preserved all existing app providers and rendering flow when Cubid providers are disabled.
- Kept existing `WalletConnectErrorGuard` in place for defense-in-depth.
- Verified no regressions on focused wallet tests (`wallet page`, `navbar`, `wallet home`).

### Files Edited
- `app/tcoin/wallet/layout.tsx`
- `agent-context/session-log.md`

## v1.41
### Timestamp
- 2026-03-13 13:39:05 EDT

### Objective
- Stop stale local dev instance on `3000` and swap `My Account` / `Charitable Contributions` panel positions on dashboard.

### What Changed
- Stopped the old server still listening on `:3000` so only the current app instance remains active.
- Updated `WalletHome` card order for both mobile and desktop dashboard grids:
- `My Account` now appears before `Charitable Contributions`.
- `Charitable Contributions` now appears where `My Account` previously appeared.
- Verified with focused dashboard home tests.

### Files Edited
- `app/tcoin/wallet/components/dashboard/WalletHome.tsx`
- `agent-context/session-log.md`

## v1.42
### Timestamp
- 2026-03-13 13:41:23 EDT

### Objective
- Adjust large-screen left sidebar grouping so `Home` appears with the central nav button stack (above `Receive`).

### What Changed
- Updated desktop sidebar composition in `DashboardFooter`:
- removed the separate top-pinned `Home` item.
- included `Home` in the centered middle group and kept button order so it appears directly above `Receive`.
- kept `More` pinned at the bottom.
- Verified with focused footer tests.

### Files Edited
- `app/tcoin/wallet/components/DashboardFooter.tsx`
- `agent-context/session-log.md`

## v1.43
### Timestamp
- 2026-03-13 15:27:57 EDT

### Objective
- Simplify `More` actions and add explicit system-theme fallback in theme settings, then fix merchant dashboard redirect behavior in local/development environments.

### What Changed
- Removed `Buy TCOIN` and `Top Up with Interac eTransfer` actions from the wallet `More` tab.
- Added a third theme option in `Select Theme`:
- `Remove theme override` now clears local theme preference and follows system light/dark mode again.
- Extended dark-mode hook capabilities:
- added explicit theme override setter.
- added override-clear method.
- tracked whether current mode is following system preference.
- Updated merchant dashboard local-dev access guard:
- `/merchant` no longer redirects to `/` in `NEXT_PUBLIC_APP_ENVIRONMENT=local|development` when profile name is absent.
- data loading on `/merchant` is allowed in local/dev bypass mode.
- Updated `MoreTab` tests to reflect removed actions.
- Ran focused wallet tests for modified areas.

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/components/modals/ThemeSelectModal.tsx`
- `shared/hooks/useDarkMode.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.44
### Timestamp
- 2026-03-13 19:05:37 EDT

### Objective
- Implement merchant signup workflow with draft/pending/live/rejected lifecycle, per-city slug uniqueness, and city-manager approval APIs/UI in wallet app.

### What Changed
- Added new merchant signup schema migration (`v0.99`) with:
- store lifecycle + signup progression fields on `stores`.
- app-scoped slug/media/profile fields on `store_profiles`.
- `is_admin` on `store_employees`.
- `store_signup_events` audit table.
- Added merchant signup backend APIs:
- `GET /api/merchant/application/status`
- `POST /api/merchant/application/start`
- `POST /api/merchant/application/restart`
- `POST /api/merchant/application/step`
- `POST /api/merchant/application/submit`
- `GET /api/merchant/slug-availability`
- `POST /api/merchant/geocode` (Nominatim)
- Added city-manager backend APIs:
- `GET /api/city-manager/stores`
- `POST /api/city-manager/stores/:id/approve`
- `POST /api/city-manager/stores/:id/reject`
- Added shared merchant-signup server/types helpers.
- Updated store mutation APIs to require store-admin access for sensitive updates and seed first employee as admin.
- Updated wallet More tab merchant CTA to dynamic label based on merchant application state:
- `Sign up as Merchant`
- `Continue Merchant Application`
- `Open Merchant Dashboard`
- Added admin shortcut to wallet `/city-manager`.
- Refactored wallet merchant route:
- moved existing live merchant workspace into `LiveMerchantDashboard`.
- new `merchant/page.tsx` now orchestrates lifecycle states and guided 5-step signup flow with continue/restart draft handling.
- Added wallet city-manager page at `app/tcoin/wallet/city-manager/page.tsx` with pending/live/rejected filters and approve/reject actions.
- Extended `.env.local.example` with merchant signup feature flag and Nominatim user-agent configuration.

### Verification
- Ran `pnpm test app/tcoin/wallet/components/dashboard/MoreTab.test.tsx` (pass).
- Ran `pnpm exec tsc --noEmit` (fails due pre-existing unrelated TS issues outside this feature scope; no filtered errors from new merchant/city-manager files).

### Files Edited
- `supabase/migrations/20260313161000_v0.99_merchant_signup_city_manager.sql`
- `shared/lib/bia/server.ts`
- `shared/lib/merchantSignup/types.ts`
- `shared/lib/merchantSignup/server.ts`
- `shared/lib/merchantSignup/application.ts`
- `app/api/stores/route.ts`
- `app/api/stores/[id]/bia/route.ts`
- `app/api/merchant/application/status/route.ts`
- `app/api/merchant/application/start/route.ts`
- `app/api/merchant/application/restart/route.ts`
- `app/api/merchant/application/step/route.ts`
- `app/api/merchant/application/submit/route.ts`
- `app/api/merchant/slug-availability/route.ts`
- `app/api/merchant/geocode/route.ts`
- `app/api/city-manager/stores/route.ts`
- `app/api/city-manager/stores/[id]/approve/route.ts`
- `app/api/city-manager/stores/[id]/reject/route.ts`
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/merchant/LiveMerchantDashboard.tsx`
- `app/tcoin/wallet/merchant/page.tsx`
- `app/tcoin/wallet/city-manager/page.tsx`
- `.env.local.example`
- `agent-context/session-log.md`

## v1.45
### Timestamp
- 2026-03-13 20:28:59 EDT

### Objective
- Apply the new merchant-signup migration to the linked Supabase DB, document the architecture in `/docs`, and prepare a follow-up commit.

### What Changed
- Applied linked DB migration with `supabase db push --linked`:
- `20260313161000_v0.99_merchant_signup_city_manager.sql`.
- Added architecture write-up for the implemented merchant signup + city-manager solution:
- `docs/merchant-signup-city-manager-architecture.md`.
- Updated session log with this follow-up execution record.

### Verification
- `supabase db push --linked` completed with migration applied.

### Files Edited
- `docs/merchant-signup-city-manager-architecture.md`
- `agent-context/session-log.md`

## v1.46
### Timestamp
- 2026-03-13 20:45:52 EDT

### Objective
- Improve merchant signup step-1 UX content and controls.

### What Changed
- Updated merchant signup step-1 introduction copy to clearly explain:
- merchants accept TCOIN (including partial payments),
- each merchant belongs to one neighbourhood/BIA,
- payments may arrive as TCOIN or local merchant tokens within the same BIA,
- only TCOIN is redeemable to CADm on CELO,
- redemptions are at 97% of par (3% below par), with 3% retained for charitable donations.
- Added a `Cancel` button on step 1 of the signup wizard.
- Step-1 cancel now closes the wizard and returns the user to the draft-application state view.

### Verification
- Reviewed rendered diff for `merchant/page.tsx` to confirm updated copy and step-1 cancel/back behavior.

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.47
### Timestamp
- 2026-03-13 21:01:56 EDT

### Objective
- Upgrade merchant signup UX with image uploads, live store preview, strict per-step completion gating, and clearer geocode/map behavior.

### What Changed
- Replaced step-2 image URL inputs with image upload functionality supporting both:
- file browsing,
- drag-and-drop upload.
- Added Supabase storage upload flow for step-2 logo/banner assets (`profile_pictures` bucket, `merchant_assets/...` paths).
- Added immediate visual preview handling for uploaded images and wired preview state cleanup for local blob URLs.
- Split step 2 into two halves:
- left side: store details + image upload controls,
- right side: live store page preview (banner frame + overlaid circular logo frame + live name/description).
- Added step validation gating so `Save and continue`/`Submit application` remain disabled until each step is fulfilled.
- Enforced step-2 gating to require both banner and logo uploads (and no in-flight upload) before continue.
- Updated step 3:
- lat/lng are now read-only display values (no editable input fields),
- editing address clears old coordinates until geocoded again,
- map preview is displayed after successful geocode.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass, no errors/warnings).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.48
### Timestamp
- 2026-03-13 21:12:51 EDT

### Objective
- Fix step-2 merchant preview overlap behavior and align image uploads to a dedicated merchant bucket.

### What Changed
- Updated merchant signup preview layout so the logo circle is overlaid across the bottom edge of the banner (clear partial overlap).
- Added spacing adjustments so preview text sits correctly below the overlaid logo.
- Switched merchant image uploads to dedicated Supabase bucket constant:
- `merchant_assets`.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.49
### Timestamp
- 2026-03-13 21:18:25 EDT

### Objective
- Add a migration that provisions the merchant image storage bucket and required policies.

### What Changed
- Added idempotent Supabase migration to create bucket:
- `merchant_assets` (public).
- Added `storage.objects` policies scoped to `merchant_assets`:
- public `SELECT`,
- authenticated `INSERT`,
- authenticated `UPDATE` (required for upload upserts),
- authenticated `DELETE`.

### Files Edited
- `supabase/migrations/20260313211500_v1.00_merchant_assets_bucket.sql`
- `agent-context/session-log.md`

## v1.50
### Timestamp
- 2026-03-13 21:30:40 EDT

### Objective
- Refine merchant signup step-3 address UX and CTA placement.

### What Changed
- Updated step-3 address placeholder to sample text:
- `123 Main St, Smallville, England`.
- Hid latitude/longitude display until geocoding succeeds.
- Removed inline geocode button from step body and moved it into the bottom action row.
- Added pink primary CTA in step 3:
- button text `Find this address`,
- positioned immediately left of `Save and continue`.
- Added geocoding loading state for this CTA (`Finding...`) and disabled it when address is empty or while requests are in flight.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.51
### Timestamp
- 2026-03-13 21:51:23 EDT

### Objective
- Align step-3 geocode CTA/button styling and improve address/map usability.

### What Changed
- Removed hardcoded color override from step-3 `Find this address` button so it uses the standard app button styling (shared CSS theme pink).
- Lightened step-3 address placeholder text styling for better visual distinction from user-entered text.
- Updated OSM embed URL generation to include a computed neighborhood-scale bbox (~1000m span) centered on the geocoded coordinates.
- Kept marker centered on the resolved address while defaulting initial view to local neighborhood scale instead of global zoom.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.52
### Timestamp
- 2026-03-13 22:03:35 EDT

### Objective
- Improve step-3 address flow by locking geocoded addresses and adding explicit edit/re-geocode behavior.

### What Changed
- Added address edit/lock state to step 3:
- after successful geocode, address field becomes read-only display,
- geocoded address is rendered as multi-line rows (split by comma segments),
- input frame is removed in read-only mode.
- Added `Edit address` button in action row for step 3:
- reenables address editing,
- clears lat/lng so re-geocoding is required,
- disables `Save and continue` until address is geocoded again.
- Updated step-completion gate for step 3 to require both geocoded coordinates and non-editing (locked) state.
- Kept map/coordinate display only after geocoding succeeds.

### Verification
- Ran `pnpm exec eslint app/tcoin/wallet/merchant/page.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/merchant/page.tsx`
- `agent-context/session-log.md`

## v1.53
### Timestamp
- 2026-03-13 22:23:43 EDT

### Objective
- Expand Supabase seed data substantially across project tables and use it to reset/populate the linked database.

### What Changed
- Added new comprehensive seed file:
- `supabase/seed.sql`.
- Seed now includes representative dummy data across:
- core public app tables (`users`, app registry tables, wallet/share tables, transactions, notifications, stores, merchant signup, approvals),
- BIA/voucher/onramp tables,
- contract management metadata tables,
- indexer control + derived tables (`indexer.*`),
- chain event/materialized data tables (`chain_data.*`),
- cron logging table.
- Included deterministic IDs/UUIDs and conflict-safe upserts to keep seed rerunnable.
- Added sequence sync statements for identity-backed tables seeded with explicit IDs.
- Fixed seed compatibility with current migrated schema by removing non-portable `user_encrypted_share` column assumptions (`credential_id` was not present at runtime schema state).

### Verification
- Ran linked remote reset with seed execution:
- `printf 'y\n' | supabase db reset --linked`
- Reset completed successfully and seeded data from `supabase/seed.sql`.

### Files Edited
- `supabase/seed.sql`
- `agent-context/session-log.md`

## v1.54
### Timestamp
- 2026-03-13 22:25:06 EDT

### Objective
- Add explicit City Admin access from the wallet More tab.

### What Changed
- Updated More tab admin controls to include a dedicated button:
- `Open City Admin`.
- Routed button to new wallet route alias:
- `/city-admin`.
- Added new route:
- `app/tcoin/wallet/city-admin/page.tsx` which redirects to existing city manager workspace (`/city-manager`).
- Updated More tab tests to assert city-admin button visibility for admin users and route navigation behavior.

### Verification
- Ran `pnpm test app/tcoin/wallet/components/dashboard/MoreTab.test.tsx` (pass, 10 tests).
- Ran `pnpm exec eslint app/tcoin/wallet/components/dashboard/MoreTab.tsx app/tcoin/wallet/city-admin/page.tsx app/tcoin/wallet/components/dashboard/MoreTab.test.tsx` (pass).

### Files Edited
- `app/tcoin/wallet/components/dashboard/MoreTab.tsx`
- `app/tcoin/wallet/components/dashboard/MoreTab.test.tsx`
- `app/tcoin/wallet/city-admin/page.tsx`
- `agent-context/session-log.md`

## v1.55
### Timestamp
- 2026-03-13 22:46:29 EDT

### Objective
- Add a seeded admin user for `hubert.cormac@gmail.com`.

### What Changed
- Updated `supabase/seed.sql` to include:
- new user row with email `hubert.cormac@gmail.com`,
- `is_admin = true`,
- deterministic seeded identity values (`id=1004`, username `hubert-cormac`).
- Added matching seeded admin role assignment in wallet dev app instance.
- Added matching seeded `app_user_profiles` row for consistency.

### Files Edited
- `supabase/seed.sql`
- `agent-context/session-log.md`
