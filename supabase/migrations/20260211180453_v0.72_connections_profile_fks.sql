-- migrate:up
BEGIN;

ALTER TABLE IF EXISTS public.connections
  DROP CONSTRAINT IF EXISTS connections_owner_user_id_fkey,
  DROP CONSTRAINT IF EXISTS connections_connected_user_id_fkey,
  DROP CONSTRAINT IF EXISTS connections_owner_profile_fkey,
  DROP CONSTRAINT IF EXISTS connections_connected_profile_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'connections_owner_profile_fkey'
      AND conrelid = 'public.connections'::regclass
  ) THEN
    ALTER TABLE IF EXISTS public.connections
      ADD CONSTRAINT connections_owner_profile_fkey
      FOREIGN KEY (owner_user_id, app_instance_id)
      REFERENCES public.app_user_profiles (user_id, app_instance_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'connections_connected_profile_fkey'
      AND conrelid = 'public.connections'::regclass
  ) THEN
    ALTER TABLE IF EXISTS public.connections
      ADD CONSTRAINT connections_connected_profile_fkey
      FOREIGN KEY (connected_user_id, app_instance_id)
      REFERENCES public.app_user_profiles (user_id, app_instance_id)
      ON DELETE CASCADE;
  END IF;
END
$$;

COMMIT;

-- migrate:down
BEGIN;

ALTER TABLE IF EXISTS public.connections
  DROP CONSTRAINT IF EXISTS connections_owner_profile_fkey,
  DROP CONSTRAINT IF EXISTS connections_connected_profile_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'connections_owner_user_id_fkey'
      AND conrelid = 'public.connections'::regclass
  ) THEN
    ALTER TABLE IF EXISTS public.connections
      ADD CONSTRAINT connections_owner_user_id_fkey
      FOREIGN KEY (owner_user_id)
      REFERENCES public.users (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'connections_connected_user_id_fkey'
      AND conrelid = 'public.connections'::regclass
  ) THEN
    ALTER TABLE IF EXISTS public.connections
      ADD CONSTRAINT connections_connected_user_id_fkey
      FOREIGN KEY (connected_user_id)
      REFERENCES public.users (id);
  END IF;
END
$$;

COMMIT;
