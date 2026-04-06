-- v1.09: add created_at to wallet_list so legacy custody flows have a stable lifecycle timestamp.

BEGIN;

ALTER TABLE IF EXISTS public.wallet_list
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.wallet_list
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

ALTER TABLE IF EXISTS public.wallet_list
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE IF EXISTS public.wallet_list
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_list_user_namespace_created_at_idx
  ON public.wallet_list (user_id, namespace, created_at DESC, id DESC);

COMMIT;

-- DOWN
-- BEGIN;
-- DROP INDEX IF EXISTS public.wallet_list_user_namespace_created_at_idx;
-- ALTER TABLE IF EXISTS public.wallet_list ALTER COLUMN created_at DROP NOT NULL;
-- ALTER TABLE IF EXISTS public.wallet_list ALTER COLUMN created_at DROP DEFAULT;
-- ALTER TABLE IF EXISTS public.wallet_list DROP COLUMN IF EXISTS created_at;
-- COMMIT;
