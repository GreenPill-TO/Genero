# Database CI/CD Flow

## How it flows

- **Feature PR opened/updated**
  → If the PR targets `dev`, CI runs a **dry-run migration validation against DEV** using the DEV session-pooler connection string.
  → If the PR targets `main`, CI runs a **dry-run migration validation against PROD** using the PROD session-pooler connection string.
  → These checks are non-destructive and do not reset shared remote databases.

- **Push to `dev` branch**
  → Migrations in `supabase/migrations/` are automatically applied to the **DEV** Supabase project.

- **Push to `main` branch**
  → Migrations are automatically applied to the **PROD** Supabase project.
  → Optionally, GitHub Environments can require approval before PROD deploys run.

- **UI changes made directly in Supabase**
  → Run the **`db-pull-env`** workflow for the target environment (DEV / PROD).
  → This generates a migration file capturing drift. Merge the auto-PR to bring Git back in sync.
