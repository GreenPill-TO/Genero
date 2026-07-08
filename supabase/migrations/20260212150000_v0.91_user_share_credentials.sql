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
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();

-- Compatibility for legacy schemas where the JSON payload column is absent.
-- Some environments only have `encrypted_share`; in that case we keep this
-- nullable and fall back to deterministic legacy credential ids below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_encrypted_share'
      AND column_name = 'user_share_encrypted'
  ) THEN
    ALTER TABLE public.user_encrypted_share
      ADD COLUMN user_share_encrypted jsonb;
  END IF;
END
$$;

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
profile_candidates AS (
  SELECT
    aup.user_id,
    aup.app_instance_id,
    ROW_NUMBER() OVER (
      PARTITION BY aup.user_id
      ORDER BY aup.updated_at DESC NULLS LAST, aup.created_at DESC NULLS LAST, aup.app_instance_id DESC
    ) AS row_num
  FROM public.app_user_profiles AS aup
),
inferred_app_instances AS (
  SELECT
    profile_candidates.user_id,
    profile_candidates.app_instance_id
  FROM profile_candidates
  WHERE profile_candidates.row_num = 1
),
backfill_source AS (
  SELECT
    ues.id,
    COALESCE(ues.app_instance_id, inferred_app_instances.app_instance_id, default_instance.id) AS resolved_app_instance_id,
    CASE
      WHEN jsonb_typeof(ues.user_share_encrypted) = 'object'
        AND (ues.user_share_encrypted->>'credentialId') ~ '^[A-Za-z0-9+/]+={0,2}$'
      -- For malformed legacy credentialId values we later fall back to a deterministic legacy-{id} token.
      THEN lower(encode(decode(ues.user_share_encrypted->>'credentialId', 'base64'), 'hex'))
      ELSE NULL
    END AS credential_id_hex
  FROM public.user_encrypted_share AS ues
  LEFT JOIN public.wallet_keys AS wk ON wk.id = ues.wallet_key_id
  LEFT JOIN inferred_app_instances
    ON inferred_app_instances.user_id = COALESCE(ues.user_id, wk.user_id)
  LEFT JOIN default_instance ON TRUE
)
UPDATE public.user_encrypted_share AS ues
SET
  credential_id = COALESCE(ues.credential_id, backfill_source.credential_id_hex, concat('legacy-', ues.id::text)),
  app_instance_id = backfill_source.resolved_app_instance_id,
  device_info = COALESCE(ues.device_info, '{}'::jsonb),
  last_used_at = COALESCE(ues.last_used_at, ues.created_at)
FROM backfill_source
WHERE ues.id = backfill_source.id;

ALTER TABLE IF EXISTS public.user_encrypted_share
  ALTER COLUMN credential_id SET NOT NULL;

-- Validate that the default instance exists before setting NOT NULL constraint
DO $$
DECLARE
  v_has_default_instance boolean;
  v_has_null_app_instance_id boolean;
BEGIN
  -- Check if the default wallet/tcoin app instance exists
  SELECT EXISTS (
    SELECT 1
    FROM public.ref_app_instances AS rai
    INNER JOIN public.ref_apps AS ra ON ra.id = rai.app_id
    INNER JOIN public.ref_citycoins AS rc ON rc.id = rai.citycoin_id
    WHERE ra.slug = 'wallet'
      AND rc.slug = 'tcoin'
  ) INTO v_has_default_instance;

  IF NOT v_has_default_instance THEN
    RAISE NOTICE 'Skipping NOT NULL constraint on user_encrypted_share.app_instance_id: default wallet/tcoin app instance not found.';
    RETURN;
  END IF;

  -- Ensure there are no remaining NULL app_instance_id values before adding NOT NULL constraint
  SELECT EXISTS (
    SELECT 1
    FROM public.user_encrypted_share
    WHERE app_instance_id IS NULL
  ) INTO v_has_null_app_instance_id;

  IF v_has_null_app_instance_id THEN
    RAISE EXCEPTION 'Cannot set NOT NULL on user_encrypted_share.app_instance_id: some rows still have NULL app_instance_id after backfill.';
  END IF;

  ALTER TABLE IF EXISTS public.user_encrypted_share
    ALTER COLUMN app_instance_id SET NOT NULL;
END
$$;

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

-- Keep the most recent share row per logical credential key before uniqueness enforcement.
WITH ranked_rows AS (
  SELECT
    ues.id,
    ROW_NUMBER() OVER (
      PARTITION BY ues.wallet_key_id, ues.app_instance_id, ues.credential_id
      ORDER BY ues.last_used_at DESC NULLS LAST, ues.created_at DESC NULLS LAST, ues.id DESC
    ) AS row_num
  FROM public.user_encrypted_share AS ues
)
DELETE FROM public.user_encrypted_share AS ues
USING ranked_rows
WHERE ranked_rows.id = ues.id
  AND ranked_rows.row_num > 1;

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
