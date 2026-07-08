BEGIN;

CREATE OR REPLACE FUNCTION public.cleanup_payment_request_links()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH deleted AS (
    DELETE FROM public.payment_request_links
    WHERE (
      mode = 'rotating_multi_use'
      AND expires_at < timezone('utc', now()) - interval '1 day'
    ) OR (
      mode = 'single_use'
      AND (
        (consumed_at IS NOT NULL AND consumed_at < timezone('utc', now()) - interval '30 days')
        OR (consumed_at IS NULL AND expires_at < timezone('utc', now()) - interval '30 days')
      )
    )
    RETURNING 1
  )
  SELECT count(*)::integer INTO deleted_count
  FROM deleted;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_payment_request_links() IS
  'Deletes expired wallet pay links using the repo retention policy: rotating links after 1 day and single-use expired or consumed links after 30 days.';

DO $$
DECLARE
  cron_available boolean := false;
  job_name constant text := 'wallet-payment-request-links-cleanup';
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) INTO cron_available;

  IF NOT cron_available OR to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron is not available; skipped scheduling job %.', job_name;
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = job_name;

  PERFORM cron.schedule(
    job_name,
    '15 6 * * *',
    'select public.cleanup_payment_request_links();'
  );
END;
$$;

COMMIT;

-- DOWN
-- BEGIN;
-- DO $$
-- DECLARE
--   job_name constant text := 'wallet-payment-request-links-cleanup';
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
--      AND to_regclass('cron.job') IS NOT NULL THEN
--     PERFORM cron.unschedule(jobid)
--     FROM cron.job
--     WHERE jobname = job_name;
--   END IF;
-- END;
-- $$;
-- DROP FUNCTION IF EXISTS public.cleanup_payment_request_links();
-- COMMIT;
