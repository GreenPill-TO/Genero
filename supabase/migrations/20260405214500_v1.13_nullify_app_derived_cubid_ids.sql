BEGIN;

CREATE TABLE IF NOT EXISTS public._migration_v1_13_users_cubid_cleanup_backup (
  user_id bigint PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  cubid_id text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public._migration_v1_13_users_cubid_cleanup_backup (user_id, cubid_id, captured_at)
SELECT
  u.id,
  u.cubid_id,
  timezone('utc', now())
FROM public.users AS u
WHERE u.cubid_id IS NOT NULL
  AND u.auth_user_id IS NOT NULL
  AND u.cubid_id = u.auth_user_id
ON CONFLICT (user_id) DO UPDATE
SET cubid_id = EXCLUDED.cubid_id,
    captured_at = EXCLUDED.captured_at;

UPDATE public.users AS u
SET cubid_id = NULL,
    updated_at = timezone('utc', now())
WHERE u.id IN (
  SELECT backup.user_id
  FROM public._migration_v1_13_users_cubid_cleanup_backup AS backup
);

COMMIT;

-- DOWN
-- BEGIN;
-- UPDATE public.users AS u
-- SET cubid_id = backup.cubid_id,
--     updated_at = timezone('utc', now())
-- FROM public._migration_v1_13_users_cubid_cleanup_backup AS backup
-- WHERE backup.user_id = u.id;
-- DROP TABLE IF EXISTS public._migration_v1_13_users_cubid_cleanup_backup;
-- COMMIT;
