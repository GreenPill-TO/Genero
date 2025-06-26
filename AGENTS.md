# Repository Instructions

- Use 2 spaces for indentation.
- Run `pnpm lint` before committing. If linting fails or cannot be executed due to environment issues, note this in the PR description.
- Keep commit messages short and in the imperative mood (under 72 characters).
- Summarize changes clearly in the pull request body.

## Project Structure

- `app/` – Next.js routes and pages
  - `app/api/` – API endpoints
  - `app/[CITYCOIN]/wallet/` – Main wallet interface
  - `app/[CITYCOIN]/sparechange/` – Micro‑donation interface
- `shared/`
  - `components/` – Reusable UI pieces
  - `hooks/` – Custom React hooks
  - `lib/` – Helper utilities such as Supabase clients
- `public/` – Static assets like images and video
- `middleware.ts` – Injects headers used across both apps
- `next.config.js` – Defines rewrites using `NEXT_PUBLIC_CITYCOIN` and `NEXT_PUBLIC_APP_NAME`
