# Repository Instructions

- Use 2 spaces for indentation.
- Run `pnpm lint` before committing. If linting fails or cannot be executed due to environment issues, note this in the PR description.
- Keep commit messages short and in the imperative mood (under 72 characters).
- Summarize changes clearly in the pull request body.

## Project Structure

- `app/` – Next.js routes
  - `api/` – serverless functions for Twilio OTP and SMS
  - `[CITYCOIN]/[APP_NAME]/` – contains `wallet` and `sparechange` apps
    - `components/`, `dashboard/`, `styles/`, `welcome/`, `home/`
- `shared/` – Common code
  - `api/` – service wrappers and mutations
  - `components/` – UI building blocks
  - `contexts/` – React contexts
  - `hooks/` – custom hooks
  - `lib/` – helper libraries (Supabase, etc.)
  - `providers/`, `styles/`, `types/`, `utils/`
- `public/` – Static assets
- `next.config.js` – defines rewrites using `NEXT_PUBLIC_CITYCOIN` and `NEXT_PUBLIC_APP_NAME`
