-- migrate:up
BEGIN;

ALTER TABLE IF EXISTS public.invoice_pay_request
  ADD COLUMN IF NOT EXISTS citycoin_id bigint,
  ADD COLUMN IF NOT EXISTS request_by bigint,
  ADD COLUMN IF NOT EXISTS amount_requested numeric,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

UPDATE public.invoice_pay_request ipr
SET citycoin_id = rai.citycoin_id
FROM public.ref_app_instances rai
WHERE ipr.citycoin_id IS NULL
  AND ipr.app_instance_id = rai.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoice_pay_request'
      AND column_name = 'is_active'
  ) THEN
    EXECUTE $update$
      UPDATE public.invoice_pay_request
      SET status = CASE
        WHEN paid_at IS NOT NULL OR transaction_id IS NOT NULL THEN 'paid'
        WHEN is_active = false THEN 'cancelled'
        ELSE 'pending'
      END
      WHERE status IS NULL
         OR status = ''
         OR status = 'pending'
    $update$;
  END IF;
END
$$;

UPDATE public.invoice_pay_request
SET status = 'pending'
WHERE status IS NULL
   OR btrim(status) = '';

UPDATE public.invoice_pay_request
SET closed_at = COALESCE(closed_at, paid_at, updated_at, created_at)
WHERE status IN ('paid', 'dismissed', 'cancelled', 'expired')
  AND closed_at IS NULL;

UPDATE public.invoice_pay_request ipr
SET request_from = NULL
WHERE request_from IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = ipr.request_from
  );

UPDATE public.invoice_pay_request ipr
SET request_by = NULL
WHERE request_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = ipr.request_by
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_pay_request_citycoin_id_fkey'
      AND conrelid = 'public.invoice_pay_request'::regclass
  ) THEN
    ALTER TABLE public.invoice_pay_request
      ADD CONSTRAINT invoice_pay_request_citycoin_id_fkey
      FOREIGN KEY (citycoin_id) REFERENCES public.ref_citycoins(id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_pay_request_request_by_fkey'
      AND conrelid = 'public.invoice_pay_request'::regclass
  ) THEN
    ALTER TABLE public.invoice_pay_request
      ADD CONSTRAINT invoice_pay_request_request_by_fkey
      FOREIGN KEY (request_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_pay_request_request_from_fkey'
      AND conrelid = 'public.invoice_pay_request'::regclass
  ) THEN
    ALTER TABLE public.invoice_pay_request
      ADD CONSTRAINT invoice_pay_request_request_from_fkey
      FOREIGN KEY (request_from) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_pay_request_status_check'
      AND conrelid = 'public.invoice_pay_request'::regclass
  ) THEN
    ALTER TABLE public.invoice_pay_request
      ADD CONSTRAINT invoice_pay_request_status_check
      CHECK (status IN ('pending', 'paid', 'dismissed', 'cancelled', 'expired'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_pay_request_requester_recipient_check'
      AND conrelid = 'public.invoice_pay_request'::regclass
  ) THEN
    ALTER TABLE public.invoice_pay_request
      ADD CONSTRAINT invoice_pay_request_requester_recipient_check
      CHECK (request_by IS NULL OR request_from IS NULL OR request_by <> request_from);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS invoice_pay_request_city_requester_status_idx
  ON public.invoice_pay_request (citycoin_id, request_by, status, created_at DESC);

CREATE INDEX IF NOT EXISTS invoice_pay_request_city_recipient_status_idx
  ON public.invoice_pay_request (citycoin_id, request_from, status, created_at DESC);

CREATE INDEX IF NOT EXISTS invoice_pay_request_city_created_idx
  ON public.invoice_pay_request (citycoin_id, created_at DESC);

CREATE OR REPLACE VIEW public.v_payment_requests_v1 AS
WITH requester_wallets AS (
  SELECT DISTINCT ON (vwi.user_id)
    vwi.user_id,
    vwi.public_key
  FROM public.v_wallet_identities_v1 vwi
  WHERE vwi.public_key IS NOT NULL
  ORDER BY vwi.user_id, vwi.wallet_ready DESC, vwi.wallet_row_id ASC
),
recipient_wallets AS (
  SELECT DISTINCT ON (vwi.user_id)
    vwi.user_id,
    vwi.public_key
  FROM public.v_wallet_identities_v1 vwi
  WHERE vwi.public_key IS NOT NULL
  ORDER BY vwi.user_id, vwi.wallet_ready DESC, vwi.wallet_row_id ASC
)
SELECT
  ipr.id,
  ipr.citycoin_id,
  rc.slug AS city_slug,
  ipr.app_instance_id AS origin_app_instance_id,
  ra.slug AS origin_app_slug,
  ipr.request_by,
  ipr.request_from,
  ipr.amount_requested,
  ipr.transaction_id,
  ipr.status,
  (ipr.status = 'pending') AS is_open,
  (ipr.status = 'pending') AS is_active,
  ipr.created_at,
  ipr.updated_at,
  ipr.paid_at,
  ipr.closed_at,
  requester.full_name AS requester_full_name,
  requester.username AS requester_username,
  requester.profile_image_url AS requester_profile_image_url,
  requester_wallets.public_key AS requester_wallet_public_key,
  recipient.full_name AS recipient_full_name,
  recipient.username AS recipient_username,
  recipient.profile_image_url AS recipient_profile_image_url,
  recipient_wallets.public_key AS recipient_wallet_public_key
FROM public.invoice_pay_request ipr
LEFT JOIN public.ref_citycoins rc
  ON rc.id = ipr.citycoin_id
LEFT JOIN public.ref_app_instances rai
  ON rai.id = ipr.app_instance_id
LEFT JOIN public.ref_apps ra
  ON ra.id = rai.app_id
LEFT JOIN public.users requester
  ON requester.id = ipr.request_by
LEFT JOIN public.users recipient
  ON recipient.id = ipr.request_from
LEFT JOIN requester_wallets
  ON requester_wallets.user_id = requester.id
LEFT JOIN recipient_wallets
  ON recipient_wallets.user_id = recipient.id;

GRANT SELECT ON public.v_payment_requests_v1 TO authenticated;

COMMIT;

-- DOWN
-- BEGIN;
-- REVOKE SELECT ON public.v_payment_requests_v1 FROM authenticated;
-- DROP VIEW IF EXISTS public.v_payment_requests_v1;
-- DROP INDEX IF EXISTS invoice_pay_request_city_created_idx;
-- DROP INDEX IF EXISTS invoice_pay_request_city_recipient_status_idx;
-- DROP INDEX IF EXISTS invoice_pay_request_city_requester_status_idx;
-- ALTER TABLE public.invoice_pay_request
--   DROP CONSTRAINT IF EXISTS invoice_pay_request_requester_recipient_check;
-- ALTER TABLE public.invoice_pay_request
--   DROP CONSTRAINT IF EXISTS invoice_pay_request_status_check;
-- ALTER TABLE public.invoice_pay_request
--   DROP CONSTRAINT IF EXISTS invoice_pay_request_request_from_fkey;
-- ALTER TABLE public.invoice_pay_request
--   DROP CONSTRAINT IF EXISTS invoice_pay_request_request_by_fkey;
-- ALTER TABLE public.invoice_pay_request
--   DROP CONSTRAINT IF EXISTS invoice_pay_request_citycoin_id_fkey;
-- ALTER TABLE public.invoice_pay_request
--   DROP COLUMN IF EXISTS closed_at,
--   DROP COLUMN IF EXISTS paid_at,
--   DROP COLUMN IF EXISTS updated_at,
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS amount_requested,
--   DROP COLUMN IF EXISTS request_by,
--   DROP COLUMN IF EXISTS citycoin_id;
-- COMMIT;
