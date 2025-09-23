# Database CI/CD Flow

## How it flows

- **Feature PR opened/updated**  
  → The **PREVIEW** database is reset to a clean state and all PR migrations are applied.  
  → Your preview frontend always points at a fresh schema that matches the PR.

- **PR closed without merge**  
  → The **PREVIEW** database is reset back to the **DEV** baseline.  
  → This ensures PREVIEW reflects the current dev schema when no PR is active.

- **Push to `dev` branch**  
  → Migrations in `supabase/migrations/` are automatically applied to the **DEV** Supabase project.

- **Push to `main` branch**  
  → Migrations are automatically applied to the **PROD** Supabase project.  
  → Optionally, GitHub Environments can require approval before PROD deploys run.

- **UI changes made directly in Supabase**  
  → Run the **`db-pull-env`** workflow for the target environment (DEV / PREVIEW / PROD).  
  → This generates a migration file capturing drift. Merge the auto-PR to bring Git back in sync.
