-- migrate:up
BEGIN;

ALTER TABLE IF EXISTS public.connections
  DROP CONSTRAINT IF EXISTS connections_owner_user_id_fkey,
  DROP CONSTRAINT IF EXISTS connections_connected_user_id_fkey;

ALTER TABLE IF EXISTS public.connections
  ADD CONSTRAINT connections_owner_profile_fkey
    FOREIGN KEY (owner_user_id, app_instance_id)
    REFERENCES public.app_user_profiles (user_id, app_instance_id)
    ON DELETE CASCADE,
  ADD CONSTRAINT connections_connected_profile_fkey
    FOREIGN KEY (connected_user_id, app_instance_id)
    REFERENCES public.app_user_profiles (user_id, app_instance_id)
    ON DELETE CASCADE;

COMMIT;

-- migrate:down
BEGIN;

ALTER TABLE IF EXISTS public.connections
  DROP CONSTRAINT IF EXISTS connections_owner_profile_fkey,
  DROP CONSTRAINT IF EXISTS connections_connected_profile_fkey;

ALTER TABLE IF EXISTS public.connections
  ADD CONSTRAINT connections_owner_user_id_fkey
    FOREIGN KEY (owner_user_id)
    REFERENCES public.users (id),
  ADD CONSTRAINT connections_connected_user_id_fkey
    FOREIGN KEY (connected_user_id)
    REFERENCES public.users (id);

COMMIT;
