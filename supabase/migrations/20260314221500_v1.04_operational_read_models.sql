-- migrate:up
BEGIN;

ALTER TABLE IF EXISTS public.interac_transfer
  ADD COLUMN IF NOT EXISTS app_instance_id bigint REFERENCES public.ref_app_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS amount_override numeric,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS bank_reference text,
  ADD COLUMN IF NOT EXISTS interac_code text,
  ADD COLUMN IF NOT EXISTS is_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_timestamp timestamptz;

ALTER TABLE IF EXISTS public.off_ramp_req
  ADD COLUMN IF NOT EXISTS app_instance_id bigint REFERENCES public.ref_app_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS cad_to_user numeric,
  ADD COLUMN IF NOT EXISTS tokens_burned numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS cad_off_ramp_fee numeric,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS bank_reference_number text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'initiated',
  ADD COLUMN IF NOT EXISTS interac_transfer_target text,
  ADD COLUMN IF NOT EXISTS wallet_account text;

CREATE INDEX IF NOT EXISTS interac_transfer_app_instance_idx
  ON public.interac_transfer (app_instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS off_ramp_req_app_instance_idx
  ON public.off_ramp_req (app_instance_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ref_request_statuses (
  status text PRIMARY KEY
);

INSERT INTO public.ref_request_statuses (status)
VALUES
  ('requested'),
  ('approved'),
  ('sent'),
  ('completed'),
  ('initiated'),
  ('failed'),
  ('aborted'),
  ('burned'),
  ('manual_review')
ON CONFLICT (status) DO NOTHING;

ALTER TABLE IF EXISTS public.wallet_list
  ADD COLUMN IF NOT EXISTS wallet_key_id bigint,
  ADD COLUMN IF NOT EXISTS public_key text;

CREATE OR REPLACE VIEW public.v_wallet_identities_v1 AS
WITH share_rollup AS (
  SELECT
    ues.wallet_key_id,
    COUNT(*)::bigint AS encrypted_share_count,
    (COUNT(*) > 0) AS has_active_share,
    NULL::timestamptz AS last_share_used_at,
    NULL::bigint AS latest_share_app_instance_id
  FROM public.user_encrypted_share ues
  GROUP BY ues.wallet_key_id
)
SELECT
  wl.id AS wallet_row_id,
  wl.user_id,
  wl.namespace,
  wl.wallet_key_id,
  lower(wl.public_key) AS public_key,
  TRUE AS has_wallet,
  COALESCE(sr.encrypted_share_count, 0)::bigint AS encrypted_share_count,
  COALESCE(sr.has_active_share, false) AS has_encrypted_share,
  (wl.wallet_key_id IS NOT NULL AND wl.public_key IS NOT NULL AND COALESCE(sr.has_active_share, false)) AS wallet_ready,
  sr.latest_share_app_instance_id,
  sr.last_share_used_at
FROM public.wallet_list wl
LEFT JOIN share_rollup sr
  ON sr.wallet_key_id = wl.wallet_key_id
WHERE wl.user_id IS NOT NULL;

CREATE OR REPLACE VIEW public.v_admin_interac_onramp_ops_v1 AS
SELECT
  it.id,
  it.app_instance_id,
  it.user_id,
  u.full_name AS user_name,
  u.email AS user_email,
  it.created_at,
  it.updated_at,
  it.amount,
  it.amount_override,
  it.status,
  it.admin_notes,
  it.bank_reference,
  it.interac_code,
  it.is_sent,
  it.approved_timestamp
FROM public.interac_transfer it
LEFT JOIN public.users u
  ON u.id = it.user_id;

CREATE OR REPLACE VIEW public.v_admin_manual_offramp_ops_v1 AS
SELECT
  fr.id,
  fr.app_instance_id,
  fr.user_id,
  u.full_name AS user_name,
  u.email AS user_email,
  fr.created_at,
  fr.updated_at,
  fr.cad_to_user,
  fr.tokens_burned,
  fr.exchange_rate,
  fr.cad_off_ramp_fee,
  fr.admin_notes,
  fr.bank_reference_number,
  fr.status,
  fr.interac_transfer_target,
  fr.wallet_account
FROM public.off_ramp_req fr
LEFT JOIN public.users u
  ON u.id = fr.user_id;

GRANT SELECT ON public.v_wallet_identities_v1 TO authenticated;
GRANT SELECT ON public.v_admin_interac_onramp_ops_v1 TO authenticated;
GRANT SELECT ON public.v_admin_manual_offramp_ops_v1 TO authenticated;
GRANT SELECT ON public.ref_request_statuses TO authenticated;

COMMIT;

-- DOWN
-- BEGIN;
-- REVOKE SELECT ON public.ref_request_statuses FROM authenticated;
-- REVOKE SELECT ON public.v_admin_manual_offramp_ops_v1 FROM authenticated;
-- REVOKE SELECT ON public.v_admin_interac_onramp_ops_v1 FROM authenticated;
-- REVOKE SELECT ON public.v_wallet_identities_v1 FROM authenticated;
-- DROP VIEW IF EXISTS public.v_admin_manual_offramp_ops_v1;
-- DROP VIEW IF EXISTS public.v_admin_interac_onramp_ops_v1;
-- DROP VIEW IF EXISTS public.v_wallet_identities_v1;
-- DROP INDEX IF EXISTS off_ramp_req_app_instance_idx;
-- DROP INDEX IF EXISTS interac_transfer_app_instance_idx;
-- ALTER TABLE IF EXISTS public.off_ramp_req
--   DROP COLUMN IF EXISTS wallet_account,
--   DROP COLUMN IF EXISTS interac_transfer_target,
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS bank_reference_number,
--   DROP COLUMN IF EXISTS admin_notes,
--   DROP COLUMN IF EXISTS cad_off_ramp_fee,
--   DROP COLUMN IF EXISTS exchange_rate,
--   DROP COLUMN IF EXISTS tokens_burned,
--   DROP COLUMN IF EXISTS cad_to_user,
--   DROP COLUMN IF EXISTS updated_at,
--   DROP COLUMN IF EXISTS app_instance_id;
-- ALTER TABLE IF EXISTS public.interac_transfer
--   DROP COLUMN IF EXISTS approved_timestamp,
--   DROP COLUMN IF EXISTS is_sent,
--   DROP COLUMN IF EXISTS interac_code,
--   DROP COLUMN IF EXISTS bank_reference,
--   DROP COLUMN IF EXISTS admin_notes,
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS amount_override,
--   DROP COLUMN IF EXISTS amount,
--   DROP COLUMN IF EXISTS updated_at,
--   DROP COLUMN IF EXISTS app_instance_id;
-- ALTER TABLE IF EXISTS public.wallet_list
--   DROP COLUMN IF EXISTS public_key,
--   DROP COLUMN IF EXISTS wallet_key_id;
-- DROP TABLE IF EXISTS public.ref_request_statuses;
-- COMMIT;
