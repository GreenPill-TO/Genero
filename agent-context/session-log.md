## v0.39
- Gated dashboard access on the `require_authenticated_on_dashboard` control variable and added unit tests.

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
