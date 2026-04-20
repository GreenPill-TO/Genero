-- v1.16: narrow read-only wallet release health contract
BEGIN;

CREATE OR REPLACE FUNCTION public.wallet_release_health_v1(
  p_city_slug text,
  p_chain_id bigint,
  p_required_token_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, indexer, chain_data, cron
AS $$
DECLARE
  normalized_city_slug text := lower(trim(p_city_slug));
  target_scope_key text;
  pay_link_table_present boolean := false;
  pay_link_cleanup_fn_present boolean := false;
  cron_extension_installed boolean := false;
  cleanup_job_present boolean := false;
  cleanup_job_active boolean := false;
  cleanup_job_schedule text := NULL;
  cleanup_job_command text := NULL;
  cleanup_job_schedule_matches boolean := false;
  cleanup_job_command_matches boolean := false;
  cleanup_recent_status text := NULL;
  cleanup_recent_started_at timestamptz := NULL;
  cleanup_recent_finished_at timestamptz := NULL;
  run_last_started_at timestamptz := NULL;
  run_last_completed_at timestamptz := NULL;
  run_last_status text := NULL;
  run_updated_at timestamptz := NULL;
  active_pool_count integer := 0;
  active_token_count integer := 0;
  tracked_voucher_tokens integer := 0;
  wallets_with_voucher_balances integer := 0;
  merchant_credit_rows integer := 0;
  last_voucher_block bigint := NULL;
  required_token_tracked boolean := NULL;
BEGIN
  IF normalized_city_slug IS NULL OR normalized_city_slug = '' THEN
    RAISE EXCEPTION 'city slug is required';
  END IF;

  IF p_chain_id IS NULL OR p_chain_id <= 0 THEN
    RAISE EXCEPTION 'chain id must be positive';
  END IF;

  target_scope_key := normalized_city_slug || ':' || p_chain_id::text;

  SELECT to_regclass('public.payment_request_links') IS NOT NULL
  INTO pay_link_table_present;

  SELECT to_regprocedure('public.cleanup_payment_request_links()') IS NOT NULL
  INTO pay_link_cleanup_fn_present;

  SELECT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  )
  INTO cron_extension_installed;

  IF cron_extension_installed AND to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $cron_job$
      SELECT
        true,
        COALESCE(active, false),
        schedule,
        command
      FROM cron.job
      WHERE jobname = 'wallet-payment-request-links-cleanup'
      LIMIT 1
    $cron_job$
    INTO cleanup_job_present, cleanup_job_active, cleanup_job_schedule, cleanup_job_command;

    cleanup_job_present := COALESCE(cleanup_job_present, false);
    cleanup_job_active := COALESCE(cleanup_job_active, false);
    cleanup_job_schedule_matches :=
      regexp_replace(trim(COALESCE(cleanup_job_schedule, '')), '\s+', ' ', 'g') = '15 6 * * *';
    cleanup_job_command_matches :=
      lower(regexp_replace(trim(COALESCE(cleanup_job_command, '')), '\s+', ' ', 'g')) =
      'select public.cleanup_payment_request_links();';
  END IF;

  IF cron_extension_installed AND to_regclass('cron.job_run_details') IS NOT NULL THEN
    EXECUTE $cron_runs$
      SELECT
        status,
        start_time,
        end_time
      FROM cron.job_run_details
      WHERE jobid = (
        SELECT jobid
        FROM cron.job
        WHERE jobname = 'wallet-payment-request-links-cleanup'
        LIMIT 1
      )
      ORDER BY start_time DESC NULLS LAST
      LIMIT 1
    $cron_runs$
    INTO cleanup_recent_status, cleanup_recent_started_at, cleanup_recent_finished_at;
  END IF;

  SELECT
    last_started_at,
    last_completed_at,
    last_status,
    updated_at
  INTO
    run_last_started_at,
    run_last_completed_at,
    run_last_status,
    run_updated_at
  FROM indexer.run_control
  WHERE indexer.run_control.scope_key = target_scope_key
  LIMIT 1;

  SELECT count(*)::integer
  INTO active_pool_count
  FROM indexer.pool_links pl
  WHERE pl.city_slug = normalized_city_slug
    AND pl.chain_id = p_chain_id
    AND pl.is_active = true;

  SELECT count(DISTINCT lower(pt.token_address))::integer
  INTO active_token_count
  FROM indexer.pool_links pl
  JOIN indexer.pool_tokens pt
    ON lower(pt.pool_address) = lower(pl.pool_address)
  WHERE pl.city_slug = normalized_city_slug
    AND pl.chain_id = p_chain_id
    AND pl.is_active = true;

  SELECT count(DISTINCT lower(vt.token_address))::integer
  INTO tracked_voucher_tokens
  FROM indexer.voucher_tokens vt
  WHERE vt.chain_id = p_chain_id
    AND vt.is_active = true
    AND EXISTS (
      SELECT 1
      FROM indexer.pool_links pl
      WHERE lower(pl.pool_address) = lower(vt.pool_address)
        AND pl.city_slug = normalized_city_slug
        AND pl.chain_id = p_chain_id
        AND pl.is_active = true
    );

  SELECT
    count(DISTINCT lower(wvb.wallet_address))::integer,
    max(wvb.last_block)
  INTO wallets_with_voucher_balances, last_voucher_block
  FROM indexer.wallet_voucher_balances wvb
  WHERE wvb.scope_key = target_scope_key
    AND wvb.chain_id = p_chain_id;

  SELECT count(*)::integer
  INTO merchant_credit_rows
  FROM indexer.merchant_credit_state mcs
  WHERE mcs.scope_key = target_scope_key
    AND mcs.chain_id = p_chain_id;

  IF p_required_token_address IS NOT NULL AND trim(p_required_token_address) <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM indexer.pool_links pl
      JOIN indexer.pool_tokens pt
        ON lower(pt.pool_address) = lower(pl.pool_address)
      WHERE pl.city_slug = normalized_city_slug
        AND pl.chain_id = p_chain_id
        AND pl.is_active = true
        AND lower(pt.token_address) = lower(trim(p_required_token_address))
    )
    INTO required_token_tracked;
  END IF;

  RETURN jsonb_build_object(
    'generatedAt', timezone('utc', now()),
    'paymentRequestLinks', jsonb_build_object(
      'tablePresent', pay_link_table_present,
      'cleanupFunctionPresent', pay_link_cleanup_fn_present
    ),
    'cleanupCron', jsonb_build_object(
      'extensionInstalled', cron_extension_installed,
      'jobPresent', cleanup_job_present,
      'active', cleanup_job_active,
      'schedule', cleanup_job_schedule,
      'scheduleMatchesExpected', cleanup_job_schedule_matches,
      'commandMatchesExpected', cleanup_job_command_matches,
      'recentStatus', cleanup_recent_status,
      'recentStartedAt', cleanup_recent_started_at,
      'recentFinishedAt', cleanup_recent_finished_at
    ),
    'indexer', jsonb_build_object(
      'scopeKey', target_scope_key,
      'lastStartedAt', run_last_started_at,
      'lastCompletedAt', run_last_completed_at,
      'lastStatus', run_last_status,
      'updatedAt', run_updated_at,
      'activePoolCount', active_pool_count,
      'activeTokenCount', active_token_count,
      'cplTcoinTracked', active_token_count > 0,
      'requiredTokenTracked', required_token_tracked,
      'voucherSummary', jsonb_build_object(
        'trackedVoucherTokens', tracked_voucher_tokens,
        'walletsWithVoucherBalances', COALESCE(wallets_with_voucher_balances, 0),
        'merchantCreditRows', merchant_credit_rows,
        'lastVoucherBlock', last_voucher_block
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.wallet_release_health_v1(text, bigint, text) IS
  'Returns release-safe aggregate wallet, pay-link cleanup, and indexer health fields for preflight checks without exposing raw rows or requiring service-role table reads.';

REVOKE ALL ON FUNCTION public.wallet_release_health_v1(text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_release_health_v1(text, bigint, text) TO anon, authenticated, service_role;

COMMIT;

-- DOWN (manual rollback SQL; keep commented so Supabase forward migrations only apply the new read contract)
-- BEGIN;
-- REVOKE ALL ON FUNCTION public.wallet_release_health_v1(text, bigint, text) FROM anon, authenticated, service_role;
-- DROP FUNCTION IF EXISTS public.wallet_release_health_v1(text, bigint, text);
-- COMMIT;
