## v0.77
- Increased wallet landing midsize banner prominence by widening the header middle column (`15/70/15`) and setting banner width to `md:w-[75%]`, keeping it narrower than the body text column but above half-width.

## v0.76
- Eliminated initial large-screen fade-gap drift by recalculating wallet header height with `ResizeObserver`, `requestAnimationFrame`, and load/resize hooks, then offsetting the fade strip by 1px so no fully visible band appears between the fixed header and gradient.

## v0.75
- Kept the wallet landing header and fade overlay stationary during scroll by splitting them into separate `fixed` layers and positioning the gradient strip using measured header height.

## v0.74
- Fixed the wallet landing header fade effect by moving the gradient strip to an absolute overlay below the fixed header (`top-full`) with stronger height/opacity ramp so body content visibly fades while scrolling upward.

## v0.73
- Refined wallet landing presentation by setting footer links to body-sized text, adding a header fade gradient for scroll transitions, and increasing heading spacing so pre-heading whitespace is about 50% larger than post-heading whitespace.

## v0.72
- Updated the wallet landing responsiveness: banner images now always render fully on small screens, unauthenticated tagline + CTA stack moves into the scrollable body on small screens and tablet landscape, and the footer switches to a one-column portrait-mobile layout with right-aligned links above left-aligned branding.

## v0.71
- Updated the wallet landing header for small screens by removing the hamburger drawer, surfacing its copy and CTA inline under the banner for unauthenticated users, and tightening mobile banner height and section widths for portrait and landscape readability.

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
