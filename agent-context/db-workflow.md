# Database CI/CD Flow

## How it flows

- **Feature PR opened/updated**
  → If the PR targets `dev`, CI runs a **dry-run migration validation against Preview – tcoin** using the preview session-pooler connection string.
  → If the PR targets `main`, CI runs a **dry-run migration validation against Production – tcoin** using the production session-pooler connection string.
  → These checks are non-destructive and do not reset shared remote databases.

- **Push to `dev` branch**
  → Migrations in `supabase/migrations/` are automatically applied to the **Preview – tcoin** Supabase database after the GitHub Environment gate passes.

- **Push to `main` branch**
  → Migrations are automatically applied to the **Production – tcoin** Supabase database after the GitHub Environment gate passes.

- **UI changes made directly in Supabase**
  → Run the **`db-pull-env`** workflow for the target environment (PREVIEW / PRODUCTION).
  → This generates a migration file capturing drift. Merge the auto-PR to bring Git back in sync.
