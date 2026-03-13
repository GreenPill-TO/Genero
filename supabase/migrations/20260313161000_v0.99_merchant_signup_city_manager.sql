BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS lifecycle_status text;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS signup_step smallint;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS signup_progress_count integer;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS signup_started_at timestamptz;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS approved_by bigint;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS rejected_by bigint;

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE IF EXISTS public.stores
  ALTER COLUMN lifecycle_status SET DEFAULT 'draft';

ALTER TABLE IF EXISTS public.stores
  ALTER COLUMN signup_step SET DEFAULT 1;

ALTER TABLE IF EXISTS public.stores
  ALTER COLUMN signup_progress_count SET DEFAULT 0;

ALTER TABLE IF EXISTS public.stores
  ALTER COLUMN signup_started_at SET DEFAULT timezone('utc', now());

UPDATE public.stores
SET
  lifecycle_status = COALESCE(lifecycle_status, 'draft'),
  signup_step = COALESCE(signup_step, 1),
  signup_progress_count = COALESCE(signup_progress_count, 0),
  signup_started_at = COALESCE(signup_started_at, timezone('utc', now()));

-- Preserve current behavior for existing active stores by marking them live.
UPDATE public.stores s
SET lifecycle_status = 'live'
FROM public.store_profiles sp
WHERE sp.store_id = s.id
  AND sp.status = 'active'
  AND s.lifecycle_status = 'draft';

ALTER TABLE IF EXISTS public.stores
  ALTER COLUMN lifecycle_status SET NOT NULL;

ALTER TABLE IF EXISTS public.stores
  ALTER COLUMN signup_step SET NOT NULL;

ALTER TABLE IF EXISTS public.stores
  ALTER COLUMN signup_progress_count SET NOT NULL;

ALTER TABLE IF EXISTS public.stores
  ALTER COLUMN signup_started_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stores_lifecycle_status_check'
      AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_lifecycle_status_check
      CHECK (lifecycle_status IN ('draft', 'pending', 'live', 'rejected'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stores_signup_step_check'
      AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_signup_step_check
      CHECK (signup_step BETWEEN 1 AND 5);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stores_approved_by_fkey'
      AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES public.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stores_rejected_by_fkey'
      AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_rejected_by_fkey
      FOREIGN KEY (rejected_by) REFERENCES public.users(id);
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.store_profiles
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

UPDATE public.store_profiles sp
SET app_instance_id = s.app_instance_id
FROM public.stores s
WHERE s.id = sp.store_id
  AND sp.app_instance_id IS NULL;

ALTER TABLE IF EXISTS public.store_profiles
  ADD COLUMN IF NOT EXISTS slug text;

ALTER TABLE IF EXISTS public.store_profiles
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE IF EXISTS public.store_profiles
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE IF EXISTS public.store_profiles
  ADD COLUMN IF NOT EXISTS banner_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'store_profiles_app_instance_id_fkey'
      AND conrelid = 'public.store_profiles'::regclass
  ) THEN
    ALTER TABLE public.store_profiles
      ADD CONSTRAINT store_profiles_app_instance_id_fkey
      FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id) ON DELETE CASCADE;
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.store_profiles
  ALTER COLUMN app_instance_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS store_profiles_app_instance_slug_uidx
  ON public.store_profiles (app_instance_id, lower(slug))
  WHERE slug IS NOT NULL;

ALTER TABLE IF EXISTS public.store_employees
  ADD COLUMN IF NOT EXISTS is_admin boolean;

UPDATE public.store_employees
SET is_admin = true
WHERE is_admin IS NULL;

ALTER TABLE IF EXISTS public.store_employees
  ALTER COLUMN is_admin SET DEFAULT false;

ALTER TABLE IF EXISTS public.store_employees
  ALTER COLUMN is_admin SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.store_signup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  step smallint,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS store_signup_events_store_idx
  ON public.store_signup_events (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stores_lifecycle_status_idx
  ON public.stores (lifecycle_status, created_at DESC);

CREATE INDEX IF NOT EXISTS stores_signup_step_idx
  ON public.stores (signup_step, signup_started_at DESC);

COMMIT;
