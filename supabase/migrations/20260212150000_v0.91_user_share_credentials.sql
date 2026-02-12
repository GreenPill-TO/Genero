-- migrate:up
BEGIN;

ALTER TABLE IF EXISTS public.user_encrypted_share
  ADD COLUMN IF NOT EXISTS credential_id text;

ALTER TABLE IF EXISTS public.user_encrypted_share
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

ALTER TABLE IF EXISTS public.user_encrypted_share
  ADD COLUMN IF NOT EXISTS device_info jsonb;

ALTER TABLE IF EXISTS public.user_encrypted_share
  ADD COLUMN IF NOT EXISTS last_used_at timestamp with time zone;

ALTER TABLE IF EXISTS public.user_encrypted_share
  ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone;

ALTER TABLE IF EXISTS public.user_encrypted_share
  ALTER COLUMN wallet_key_id SET NOT NULL;

WITH default_instance AS (
  SELECT rai.id
  FROM public.ref_app_instances AS rai
  INNER JOIN public.ref_apps AS ra ON ra.id = rai.app_id
  INNER JOIN public.ref_citycoins AS rc ON rc.id = rai.citycoin_id
  WHERE ra.slug = 'wallet'
    AND rc.slug = 'tcoin'
  ORDER BY rai.created_at ASC
  LIMIT 1
),
backfill_source AS (
  SELECT
    ues.id,
    CASE
      WHEN jsonb_typeof(ues.user_share_encrypted) = 'object'
        AND (ues.user_share_encrypted->>'credentialId') ~ '^[A-Za-z0-9+/]+={0,2}$'
      THEN lower(encode(decode(ues.user_share_encrypted->>'credentialId', 'base64'), 'hex'))
      ELSE NULL
    END AS credential_id_hex
  FROM public.user_encrypted_share AS ues
)
UPDATE public.user_encrypted_share AS ues
SET
  credential_id = COALESCE(ues.credential_id, backfill_source.credential_id_hex),
  app_instance_id = COALESCE(ues.app_instance_id, default_instance.id),
  device_info = COALESCE(ues.device_info, '{}'::jsonb),
  last_used_at = COALESCE(ues.last_used_at, ues.created_at)
FROM backfill_source
LEFT JOIN default_instance ON TRUE
WHERE ues.id = backfill_source.id;

ALTER TABLE IF EXISTS public.user_encrypted_share
  ALTER COLUMN app_instance_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS user_encrypted_share_wallet_key_id_idx
  ON public.user_encrypted_share (wallet_key_id);

CREATE INDEX IF NOT EXISTS user_encrypted_share_app_instance_id_idx
  ON public.user_encrypted_share (app_instance_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_encrypted_share_app_instance_id_fkey'
      AND conrelid = 'public.user_encrypted_share'::regclass
  ) THEN
    ALTER TABLE public.user_encrypted_share
      ADD CONSTRAINT user_encrypted_share_app_instance_id_fkey
      FOREIGN KEY (app_instance_id)
      REFERENCES public.ref_app_instances(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_encrypted_share_wallet_key_app_credential_key'
      AND conrelid = 'public.user_encrypted_share'::regclass
  ) THEN
    ALTER TABLE public.user_encrypted_share
      ADD CONSTRAINT user_encrypted_share_wallet_key_app_credential_key
      UNIQUE (wallet_key_id, app_instance_id, credential_id);
  END IF;
END
$$;

COMMIT;

-- migrate:down
BEGIN;

ALTER TABLE IF EXISTS public.user_encrypted_share
  DROP CONSTRAINT IF EXISTS user_encrypted_share_wallet_key_app_credential_key;

ALTER TABLE IF EXISTS public.user_encrypted_share
  DROP CONSTRAINT IF EXISTS user_encrypted_share_app_instance_id_fkey;

DROP INDEX IF EXISTS public.user_encrypted_share_app_instance_id_idx;
DROP INDEX IF EXISTS public.user_encrypted_share_wallet_key_id_idx;

ALTER TABLE IF EXISTS public.user_encrypted_share
  DROP COLUMN IF EXISTS revoked_at;

ALTER TABLE IF EXISTS public.user_encrypted_share
  DROP COLUMN IF EXISTS last_used_at;

ALTER TABLE IF EXISTS public.user_encrypted_share
  DROP COLUMN IF EXISTS device_info;

ALTER TABLE IF EXISTS public.user_encrypted_share
  DROP COLUMN IF EXISTS app_instance_id;

ALTER TABLE IF EXISTS public.user_encrypted_share
  DROP COLUMN IF EXISTS credential_id;

COMMIT;
