---
description: GitHub Copilot instructions for the Genero repository
alwaysApply: true
---

# Genero - GitHub Copilot Instructions

## Repository Overview

Genero is a Next.js 14 monorepo implementing local "citycoins" on new monetary principles. The first implementation is **T-Coin**, a Toronto-focused digital currency. The repository contains two main app variants:
- `wallet` - For general payments and transfers
- `sparechange` - For micro-donations to panhandlers

**Tech Stack:**
- Next.js 14.2.16 (App Router)
- Node.js 20+
- TypeScript 5
- React 18
- TailwindCSS + Radix UI components
- Supabase (storage & auth)
- Cubid (identity & wallet management)
- Twilio (SMS verification)
- Vitest (testing)

**Package Manager:** pnpm 10.2.1+ (REQUIRED - do not use npm or yarn)

## Project Structure

```
.github/workflows/       # CI/CD pipelines (frontend, DB migrations)
agent-context/           # Design specs, session logs, workflow guides
├─ session-log.md        # Mandatory: append-only per-session log
├─ technical-spec.md     # Latest technical specification
├─ functional-spec.md    # Latest functional specification
├─ workflow.md           # Per-session checklist
├─ app-context.md        # Problem statement, approach
├─ style-guide.md        # UI/UX style guide
└─ db-workflow.md        # Database CI/CD workflow

app/
├─ [citycoins]/          # Dynamic routing for multiple cities
│  ├─ sparechange/       # Tipping app for panhandlers
│  └─ wallet/            # General transfer wallet
└─ api/                  # API routes (Twilio OTP verification)

shared/                  # Reusable code across apps
├─ components/           # Shared React components
├─ hooks/                # Custom React hooks
├─ lib/                  # Utility functions
└─ types/                # TypeScript type definitions

supabase/
├─ sql-schema.sql        # Latest SQL schema (auto-synced on PR)
└─ migrations/           # Incremental SQL patches (versioned)

docs/                    # Technical documentation
public/                  # Static assets
```

**Path Aliases (tsconfig.json):**
- `@shared/*` → `./shared/*`
- `@tcoin/wallet/*` → `./app/tcoin/wallet/*`
- `@tcoin/sparechange/*` → `./app/tcoin/sparechange/*`

## Build & Development

### Environment Setup

1. **ALWAYS** copy `.env.local.example` to `.env.local` first
2. Required environment variables:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
   NEXT_PUBLIC_CUBID_API_KEY=<cubid-api-key>
   NEXT_PUBLIC_CUBID_APP_ID=<cubid-app-id>
   NEXT_PUBLIC_CITYCOIN=tcoin           # City identifier
   NEXT_PUBLIC_APP_NAME=wallet          # App variant (wallet|sparechange)
   NEXT_PUBLIC_APP_ENVIRONMENT=dev      # Environment (dev|prod)
   ```
3. Boolean environment flags MUST use strings: `'true'` or `'false'` (not boolean literals)

### Installation

```bash
pnpm install --no-frozen-lockfile
```

**Note:** The `--no-frozen-lockfile` flag is used in CI and development to allow dependency updates.

### Development Server

```bash
pnpm dev
```

Server runs on `http://localhost:3000`. The app served is determined by `NEXT_PUBLIC_CITYCOIN` and `NEXT_PUBLIC_APP_NAME`.

### Build

```bash
pnpm build
```

**Build time:** Approximately 30-60 seconds. Next.js performs TypeScript type-checking during build.

### Production Server

```bash
pnpm start
```

### Linting

```bash
pnpm lint
```

ESLint runs with Next.js configuration. **Known issue:** Some React Hook dependency warnings exist in legacy code - these are not blocking and can be ignored unless modifying those specific components.

### Type Checking

TypeScript checking happens automatically during `pnpm build`. For standalone type checking:

```bash
pnpm exec tsc --noEmit
```

### Testing

```bash
pnpm test
```

Runs Vitest test suite. Test files use `.test.tsx` or `.test.ts` extensions. Tests exist for:
- Components (`*.test.tsx`)
- Pages (`page.test.tsx`)
- Forms and modals

**Coverage:** Aim for test coverage on new components and logic, especially forms and modals.

## Coding Conventions

### Language & Style
- **Canadian English** for all documentation, comments, and user-facing text
- **TypeScript**: Strict mode enabled, 2-space indentation
- **React**: Functional components with hooks (no class components)
- **Imports**: Use path aliases (`@shared/*`, `@tcoin/wallet/*`) over relative paths

### Code Formatting
- 2 spaces for indentation (no tabs)
- ESLint + Prettier (auto-formatted on save in most IDEs)
- Run `pnpm lint` before committing

### Component Patterns
- Use Radix UI primitives for accessible components
- TailwindCSS for styling (utility-first approach)
- Custom components in `shared/components/`
- Feature-specific components in app directories

### Data Fetching
- Use `@tanstack/react-query` for data fetching and caching
- Supabase client from `@supabase/ssr` for server components
- Custom hooks for common data operations (in `shared/hooks/`)

### Error Handling
- Use `react-toastify` for user notifications
- Proper error boundaries for component errors
- Never log sensitive data (tokens, keys, user IDs) even in dev mode

## Security Requirements

### Secrets Management
- **NEVER** commit secrets, API keys, or credentials
- **ALWAYS** use environment variables for sensitive data
- Add new variable names (not values) to `.env.local.example`
- Use pattern matching for env vars (e.g., `NEXT_PUBLIC_*` for client-side)

### Code Security
- No hardcoded credentials or tokens
- Input validation on all forms (using `react-hook-form` + `zod`)
- Sanitize user inputs before database operations
- Use Supabase RLS (Row Level Security) for data access control

## Database & Migrations

### Supabase Schema
- Current schema in `supabase/sql-schema.sql`
- GitHub Action automatically runs `db pull` on PRs to sync schema

### Creating Migrations
1. Migrations go in `supabase/migrations/`
2. File naming: `<session-version>_<description>.sql`
3. **MUST be idempotent and reversible**
4. Include `-- DOWN` section to revert changes
5. Use `IF EXISTS` / `IF NOT EXISTS` for all DDL statements

Example:
```sql
-- UP
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

-- DOWN
ALTER TABLE users DROP COLUMN IF EXISTS phone_verified;
```

### Database Workflows
- `db-push-dev.yml` - Push migrations to dev environment
- `db-push-prod.yml` - Push migrations to production
- `pr-migrations.yml` - Validate migrations on PRs

Refer to `agent-context/db-workflow.md` for detailed CI/CD process.

## Testing Strategy

### Unit Tests
- Use Vitest with React Testing Library
- Test files alongside source files (`.test.tsx`)
- Mock Supabase, Cubid, and Twilio clients in tests
- Focus on user interactions and edge cases

### Integration Tests
- API route tests in `app/api/` directories
- Test authentication flows
- Verify database operations

### Manual Testing Checklist
1. Test both `wallet` and `sparechange` apps
2. Verify SMS OTP flow (requires Twilio credentials)
3. Test QR code scanning and generation
4. Validate payment flows end-to-end
5. Check mobile responsiveness

## CI/CD Workflows

### Frontend CI (`ci-frontend.yml`)
Runs on all PRs and pushes to `main` or `dev` (except changes to `supabase/**` or `*.md` files):

1. **Setup:** Node 20 + pnpm 8
2. **Install:** `pnpm install --no-frozen-lockfile`
3. **Lint:** `pnpm lint`
4. **Type Check:** `pnpm exec tsc --noEmit`
5. **Build:** `pnpm build`
6. **Test:** `pnpm test`

**Pipeline time:** ~3-5 minutes

### Database Workflows
- `db-pull-env.yml` - Sync schema from Supabase
- `db-push-dev.yml` - Deploy migrations to dev
- `db-push-prod.yml` - Deploy migrations to production
- `pr-migrations.yml` - Validate SQL syntax on PRs

## Pull Request Guidelines

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/modifications
- `chore:` Maintenance tasks

Examples:
```
feat: add QR code scanning to sparechange app
fix: resolve OTP verification timeout issue
docs: update API documentation for payment endpoints
```

### PR Description
- Keep descriptions concise and focused
- Reference related issues: `Issues: #10, #11`
- Explain what changed and why
- Include screenshots for UI changes

### Before Submitting
1. ✅ Run `pnpm lint` (should pass with no errors)
2. ✅ Run `pnpm build` (should complete successfully)
3. ✅ Run `pnpm test` (all tests should pass)
4. ✅ Verify changes don't break existing functionality
5. ✅ Update relevant documentation (if applicable)
6. ✅ Add/update tests for new features or bug fixes

## Common Pitfalls & Solutions

### Build Failures
- **"Module not found"**: Check path aliases in `tsconfig.json`
- **"Cannot find module"**: Run `pnpm install --no-frozen-lockfile`
- **Type errors**: Ensure all dependencies are up to date

### Environment Issues
- **"Missing environment variable"**: Check `.env.local` exists and matches `.env.local.example`
- **App not loading**: Verify `NEXT_PUBLIC_CITYCOIN` and `NEXT_PUBLIC_APP_NAME` are set correctly
- **Boolean parsing errors**: Use string values `'true'`/`'false'`, not booleans

### Database Problems
- **Migration fails**: Ensure idempotency with `IF EXISTS`/`IF NOT EXISTS`
- **Schema out of sync**: Run `supabase db pull` to update local schema
- **RLS errors**: Check Row Level Security policies in Supabase dashboard

### Dependency Issues
- **"pnpm not found"**: Install globally with `npm install -g pnpm@10.2.1`
- **Lock file conflicts**: Use `pnpm install --no-frozen-lockfile` to resolve
- **Build script errors**: Some dependencies are ignored (see `pnpm install` output)

## Agent-Specific Instructions

### Session Workflow
For AI coding agents, **ALWAYS** follow the workflow in `agent-context/workflow.md`:
1. Update `session-log.md` with new entry
2. Update specs (`technical-spec.md`, `functional-spec.md`) as needed
3. Make code changes
4. Run lint and tests
5. Commit with conventional message

### Session Versioning
- Follow SemVer: `v2.0.0-alpha`
- Major versions (`v1.0`, `v2.0`) = new feature branches
- Minor versions (`v2.0`, `v2.1`) = different sessions on same branch

### Design Before Development
**Philosophy:** Design, then develop. Every session should:
1. Review and update design specifications
2. Implement changes based on specs
3. Validate against requirements

### Mandatory Files
Before making changes, ensure these files exist in `agent-context/`:
- `session-log.md` - Session history
- `technical-spec.md` - Technical requirements
- `functional-spec.md` - Feature specifications
- `workflow.md` - Session checklist

If missing, follow [agent-setup.md](https://raw.githubusercontent.com/KazanderDad/agent-context-seed-files/refs/heads/main/agent-setup.md).

## Additional Resources

### Key Documentation Files
- `AGENTS.md` - Comprehensive agent instructions (authoritative guide)
- `README.md` - Project introduction and quick start
- `agent-context/app-context.md` - Problem statement and approach
- `agent-context/style-guide.md` - UI/UX guidelines
- `docs/` - Technical deep-dives

### External Documentation
- Next.js 14: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Cubid SDK: Check SDK repository for API docs
- Radix UI: https://www.radix-ui.com/
- TailwindCSS: https://tailwindcss.com/docs

## Quick Reference

```bash
# Setup
pnpm install --no-frozen-lockfile

# Development
pnpm dev                          # Start dev server (localhost:3000)
pnpm build                        # Build for production (~30-60s)
pnpm start                        # Start production server
pnpm lint                         # Run ESLint
pnpm test                         # Run Vitest tests
pnpm exec tsc --noEmit            # Type check only

# Environment
cp .env.local.example .env.local  # Create env file (first time only)

# Testing specific apps
NEXT_PUBLIC_CITYCOIN=tcoin NEXT_PUBLIC_APP_NAME=wallet pnpm dev
NEXT_PUBLIC_CITYCOIN=tcoin NEXT_PUBLIC_APP_NAME=sparechange pnpm dev
```

**Remember:**
- Use pnpm, not npm or yarn
- Run `pnpm lint` before committing
- Keep changes minimal and focused
- Add tests for new features
- Never commit secrets or credentials
- Follow Canadian English spelling
- Use 2-space indentation for TypeScript
- Trust these instructions - search only if info is incomplete or incorrect
