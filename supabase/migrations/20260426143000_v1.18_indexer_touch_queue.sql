-- v1.18: async indexer touch queue and release-safe queue health reads
BEGIN;

CREATE TABLE IF NOT EXISTS indexer.touch_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope_key text NOT NULL,
  city_slug text NOT NULL,
  chain_id bigint NOT NULL,
  source text NOT NULL DEFAULT 'next-api',
  requested_by uuid NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  requested_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  claimed_at timestamptz NULL,
  completed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text NULL,
  last_run_status text NULL CHECK (last_run_status IS NULL OR last_run_status IN ('success', 'error', 'skipped')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS touch_requests_scope_status_requested_idx
  ON indexer.touch_requests (scope_key, status, requested_at);

CREATE INDEX IF NOT EXISTS touch_requests_status_requested_idx
  ON indexer.touch_requests (status, requested_at);

CREATE INDEX IF NOT EXISTS touch_requests_completed_at_idx
  ON indexer.touch_requests (completed_at DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS touch_requests_one_open_per_scope_idx
  ON indexer.touch_requests (scope_key)
  WHERE status IN ('queued', 'running');

ALTER TABLE IF EXISTS indexer.touch_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.request_indexer_touch_v1(
  p_city_slug text,
  p_chain_id bigint DEFAULT NULL,
  p_source text DEFAULT 'next-api'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, indexer
AS $$
DECLARE
  normalized_city_slug text := lower(trim(p_city_slug));
  normalized_source text := lower(trim(COALESCE(NULLIF(p_source, ''), 'next-api')));
  resolved_chain_id bigint := p_chain_id;
  target_scope_key text;
  now_utc timestamptz := timezone('utc', now());
  run_row indexer.run_control%ROWTYPE;
  open_request indexer.touch_requests%ROWTYPE;
  inserted_request indexer.touch_requests%ROWTYPE;
  next_eligible_at timestamptz := NULL;
BEGIN
  IF normalized_city_slug IS NULL OR normalized_city_slug = '' THEN
    RAISE EXCEPTION 'city slug is required';
  END IF;

  IF resolved_chain_id IS NULL OR resolved_chain_id <= 0 THEN
    SELECT rc.chain_id
    INTO resolved_chain_id
    FROM indexer.run_control rc
    WHERE rc.city_slug = normalized_city_slug
    ORDER BY rc.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF resolved_chain_id IS NULL OR resolved_chain_id <= 0 THEN
    SELECT pl.chain_id
    INTO resolved_chain_id
    FROM indexer.pool_links pl
    WHERE pl.city_slug = normalized_city_slug
    ORDER BY pl.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF resolved_chain_id IS NULL OR resolved_chain_id <= 0 THEN
    resolved_chain_id := 42220;
  END IF;

  target_scope_key := normalized_city_slug || ':' || resolved_chain_id::text;

  IF NOT pg_try_advisory_xact_lock(hashtext(target_scope_key)) THEN
    RETURN jsonb_build_object(
      'scopeKey', target_scope_key,
      'runStatus', 'queued',
      'queued', false,
      'skipped', true,
      'reason', 'locked'
    );
  END IF;

  INSERT INTO indexer.run_control (
    scope_key,
    city_slug,
    chain_id,
    last_status,
    next_eligible_start_at,
    next_eligible_complete_at
  )
  VALUES (
    target_scope_key,
    normalized_city_slug,
    resolved_chain_id,
    'idle',
    now_utc,
    now_utc
  )
  ON CONFLICT (scope_key) DO NOTHING;

  SELECT *
  INTO run_row
  FROM indexer.run_control
  WHERE scope_key = target_scope_key
  FOR UPDATE;

  SELECT *
  INTO open_request
  FROM indexer.touch_requests
  WHERE scope_key = target_scope_key
    AND status IN ('queued', 'running')
  ORDER BY requested_at ASC, id ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'scopeKey', target_scope_key,
      'runStatus', CASE WHEN open_request.status = 'running' THEN 'running' ELSE 'queued' END,
      'queued', false,
      'skipped', true,
      'reason', CASE WHEN open_request.status = 'running' THEN 'already_running' ELSE 'already_queued' END,
      'requestId', open_request.id,
      'requestedAt', open_request.requested_at
    );
  END IF;

  next_eligible_at := GREATEST(
    COALESCE(run_row.next_eligible_start_at, now_utc - interval '1 second'),
    COALESCE(run_row.next_eligible_complete_at, now_utc - interval '1 second')
  );

  IF COALESCE(run_row.last_status, 'idle') = 'running' THEN
    RETURN jsonb_build_object(
      'scopeKey', target_scope_key,
      'runStatus', 'running',
      'queued', false,
      'skipped', true,
      'reason', 'run_in_progress',
      'nextEligibleAt', next_eligible_at
    );
  END IF;

  IF next_eligible_at > now_utc THEN
    RETURN jsonb_build_object(
      'scopeKey', target_scope_key,
      'runStatus', 'skipped',
      'queued', false,
      'skipped', true,
      'reason', CASE
        WHEN COALESCE(run_row.next_eligible_start_at, now_utc - interval '1 second') > now_utc
          AND COALESCE(run_row.next_eligible_complete_at, now_utc - interval '1 second') > now_utc
          THEN 'start_and_complete_cooldown'
        WHEN COALESCE(run_row.next_eligible_start_at, now_utc - interval '1 second') > now_utc
          THEN 'start_cooldown'
        ELSE 'complete_cooldown'
      END,
      'nextEligibleAt', next_eligible_at
    );
  END IF;

  INSERT INTO indexer.touch_requests (
    scope_key,
    city_slug,
    chain_id,
    source,
    requested_by,
    status,
    requested_at,
    updated_at
  )
  VALUES (
    target_scope_key,
    normalized_city_slug,
    resolved_chain_id,
    normalized_source,
    auth.uid(),
    'queued',
    now_utc,
    now_utc
  )
  RETURNING *
  INTO inserted_request;

  RETURN jsonb_build_object(
    'scopeKey', target_scope_key,
    'runStatus', 'queued',
    'queued', true,
    'skipped', false,
    'requestId', inserted_request.id,
    'requestedAt', inserted_request.requested_at
  );
END;
$$;

COMMENT ON FUNCTION public.request_indexer_touch_v1(text, bigint, text) IS
  'Queues a scoped indexer touch request without exposing service-role database access to the Next.js runtime.';

REVOKE ALL ON FUNCTION public.request_indexer_touch_v1(text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_indexer_touch_v1(text, bigint, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION indexer.claim_touch_request_v1(
  p_scope_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, indexer
AS $$
DECLARE
  claim_row indexer.touch_requests%ROWTYPE;
BEGIN
  WITH candidate AS (
    SELECT tr.id
    FROM indexer.touch_requests tr
    WHERE tr.status = 'queued'
      AND (p_scope_key IS NULL OR tr.scope_key = trim(p_scope_key))
    ORDER BY tr.requested_at ASC, tr.id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE indexer.touch_requests tr
  SET
    status = 'running',
    claimed_at = timezone('utc', now()),
    updated_at = timezone('utc', now()),
    attempt_count = tr.attempt_count + 1
  FROM candidate
  WHERE tr.id = candidate.id
  RETURNING tr.*
  INTO claim_row;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'requestId', claim_row.id,
    'scopeKey', claim_row.scope_key,
    'citySlug', claim_row.city_slug,
    'chainId', claim_row.chain_id,
    'source', claim_row.source,
    'requestedAt', claim_row.requested_at,
    'claimedAt', claim_row.claimed_at,
    'attemptCount', claim_row.attempt_count
  );
END;
$$;

COMMENT ON FUNCTION indexer.claim_touch_request_v1(text) IS
  'Claims the next queued indexer touch request for a worker process.';

REVOKE ALL ON FUNCTION indexer.claim_touch_request_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION indexer.claim_touch_request_v1(text) TO service_role;

CREATE OR REPLACE FUNCTION indexer.complete_touch_request_v1(
  p_request_id bigint,
  p_status text,
  p_run_status text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, indexer
AS $$
DECLARE
  normalized_status text := lower(trim(p_status));
  normalized_run_status text := NULLIF(lower(trim(COALESCE(p_run_status, ''))), '');
BEGIN
  IF p_request_id IS NULL OR p_request_id <= 0 THEN
    RAISE EXCEPTION 'request id must be positive';
  END IF;

  IF normalized_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'invalid queue completion status: %', p_status;
  END IF;

  IF normalized_run_status IS NOT NULL AND normalized_run_status NOT IN ('success', 'error', 'skipped') THEN
    RAISE EXCEPTION 'invalid run status: %', p_run_status;
  END IF;

  UPDATE indexer.touch_requests
  SET
    status = normalized_status,
    completed_at = timezone('utc', now()),
    updated_at = timezone('utc', now()),
    last_run_status = normalized_run_status,
    last_error = NULLIF(trim(COALESCE(p_error, '')), '')
  WHERE id = p_request_id
    AND status = 'running';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'running touch request not found for id %', p_request_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION indexer.complete_touch_request_v1(bigint, text, text, text) IS
  'Marks a claimed indexer touch request as completed or failed after the worker finishes its scoped run.';

REVOKE ALL ON FUNCTION indexer.complete_touch_request_v1(bigint, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION indexer.complete_touch_request_v1(bigint, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.indexer_scope_status_v1(
  p_city_slug text,
  p_chain_id bigint,
  p_required_token_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, indexer, chain_data
AS $$
DECLARE
  normalized_city_slug text := lower(trim(p_city_slug));
  target_scope_key text;
  now_utc timestamptz := timezone('utc', now());
  run_control_payload jsonb := NULL;
  checkpoints_payload jsonb := '[]'::jsonb;
  active_pool_count integer := 0;
  active_token_count integer := 0;
  active_pool_details jsonb := '[]'::jsonb;
  active_bias integer := 0;
  mapped_pools integer := 0;
  unmapped_pools integer := 0;
  stale_mappings integer := 0;
  component_mismatches integer := 0;
  bia_activity_payload jsonb := '[]'::jsonb;
  tracked_voucher_tokens integer := 0;
  wallets_with_voucher_balances integer := 0;
  merchant_credit_rows integer := 0;
  last_voucher_block bigint := NULL;
  required_token_tracked boolean := NULL;
  pending_request_count integer := 0;
  oldest_pending_requested_at timestamptz := NULL;
  last_completed_request_at timestamptz := NULL;
  last_completed_request_status text := NULL;
  queue_stale boolean := false;
  queue_blocked boolean := false;
BEGIN
  IF normalized_city_slug IS NULL OR normalized_city_slug = '' THEN
    RAISE EXCEPTION 'city slug is required';
  END IF;

  IF p_chain_id IS NULL OR p_chain_id <= 0 THEN
    RAISE EXCEPTION 'chain id must be positive';
  END IF;

  target_scope_key := normalized_city_slug || ':' || p_chain_id::text;

  SELECT jsonb_build_object(
    'lastStartedAt', rc.last_started_at,
    'lastCompletedAt', rc.last_completed_at,
    'lastStatus', rc.last_status,
    'lastError', NULL,
    'nextEligibleStartAt', rc.next_eligible_start_at,
    'nextEligibleCompleteAt', rc.next_eligible_complete_at,
    'updatedAt', rc.updated_at
  )
  INTO run_control_payload
  FROM indexer.run_control rc
  WHERE rc.scope_key = target_scope_key
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'source', cp.source,
        'lastBlock', cp.last_block,
        'lastTxHash', NULL,
        'updatedAt', cp.updated_at
      )
      ORDER BY cp.source
    ),
    '[]'::jsonb
  )
  INTO checkpoints_payload
  FROM indexer.checkpoints cp
  WHERE cp.scope_key = target_scope_key;

  SELECT count(*)::integer
  INTO active_pool_count
  FROM indexer.pool_links pl
  WHERE pl.city_slug = normalized_city_slug
    AND pl.chain_id = p_chain_id
    AND pl.is_active = true;

  WITH active_pool_tokens AS (
    SELECT
      lower(pl.pool_address) AS pool_address,
      lower(pt.token_address) AS token_address
    FROM indexer.pool_links pl
    LEFT JOIN indexer.pool_tokens pt
      ON lower(pt.pool_address) = lower(pl.pool_address)
    WHERE pl.city_slug = normalized_city_slug
      AND pl.chain_id = p_chain_id
      AND pl.is_active = true
  ),
  tokens AS (
    SELECT count(DISTINCT token_address)::integer AS total
    FROM active_pool_tokens
    WHERE token_address IS NOT NULL
  ),
  pools AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'poolAddress', pool_address,
          'tokenAddresses', token_addresses
        )
        ORDER BY pool_address
      ),
      '[]'::jsonb
    ) AS payload
    FROM (
      SELECT
        pool_address,
        COALESCE(
          jsonb_agg(token_address ORDER BY token_address) FILTER (WHERE token_address IS NOT NULL),
          '[]'::jsonb
        ) AS token_addresses
      FROM active_pool_tokens
      GROUP BY pool_address
    ) grouped
  )
  SELECT tokens.total, pools.payload
  INTO active_token_count, active_pool_details
  FROM tokens, pools;

  SELECT count(*)::integer
  INTO active_bias
  FROM public.bia_registry b
  WHERE b.city_slug = normalized_city_slug
    AND b.status = 'active';

  WITH mappings AS (
    SELECT
      lower(m.pool_address) AS pool_address,
      lower(COALESCE(m.validation_status, 'unknown')) AS validation_status
    FROM public.bia_pool_mappings m
    JOIN public.bia_registry b
      ON b.id = m.bia_id
    WHERE b.city_slug = normalized_city_slug
      AND m.chain_id = p_chain_id
      AND m.mapping_status = 'active'
      AND m.effective_to IS NULL
  ),
  discovered AS (
    SELECT lower(pl.pool_address) AS pool_address
    FROM indexer.pool_links pl
    WHERE pl.city_slug = normalized_city_slug
      AND pl.chain_id = p_chain_id
      AND pl.is_active = true
  )
  SELECT
    (SELECT count(DISTINCT pool_address)::integer FROM mappings),
    (
      SELECT count(*)::integer
      FROM discovered d
      WHERE NOT EXISTS (
        SELECT 1 FROM mappings m WHERE m.pool_address = d.pool_address
      )
    ),
    (SELECT count(*)::integer FROM mappings WHERE validation_status = 'stale'),
    (SELECT count(*)::integer FROM mappings WHERE validation_status = 'mismatch')
  INTO mapped_pools, unmapped_pools, stale_mappings, component_mismatches;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'biaId', activity.bia_id,
        'biaCode', COALESCE(activity.code, ''),
        'biaName', COALESCE(activity.name, ''),
        'lastIndexedBlock', activity.last_indexed_block,
        'indexedEventCount', COALESCE(activity.indexed_event_count, 0)
      )
      ORDER BY COALESCE(activity.indexed_event_count, 0) DESC, COALESCE(activity.name, '')
    ),
    '[]'::jsonb
  )
  INTO bia_activity_payload
  FROM public.v_bia_activity_summary activity
  WHERE activity.city_slug = normalized_city_slug;

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

  SELECT count(*)::integer, min(tr.requested_at)
  INTO pending_request_count, oldest_pending_requested_at
  FROM indexer.touch_requests tr
  WHERE tr.scope_key = target_scope_key
    AND tr.status = 'queued';

  SELECT tr.completed_at, COALESCE(tr.last_run_status, CASE WHEN tr.status = 'failed' THEN 'error' ELSE NULL END)
  INTO last_completed_request_at, last_completed_request_status
  FROM indexer.touch_requests tr
  WHERE tr.scope_key = target_scope_key
    AND tr.status IN ('completed', 'failed')
  ORDER BY tr.completed_at DESC NULLS LAST, tr.id DESC
  LIMIT 1;

  queue_stale := oldest_pending_requested_at IS NOT NULL
    AND oldest_pending_requested_at <= now_utc - interval '15 minutes';

  queue_blocked := queue_stale
    AND NOT EXISTS (
      SELECT 1
      FROM indexer.touch_requests tr
      WHERE tr.scope_key = target_scope_key
        AND tr.status = 'running'
    )
    AND COALESCE(run_control_payload #>> '{lastStatus}', 'idle') <> 'running';

  RETURN jsonb_build_object(
    'scopeKey', target_scope_key,
    'citySlug', normalized_city_slug,
    'chainId', p_chain_id,
    'runControl', run_control_payload,
    'queue', jsonb_build_object(
      'pendingRequestCount', COALESCE(pending_request_count, 0),
      'oldestPendingRequestedAt', oldest_pending_requested_at,
      'lastCompletedRequestAt', last_completed_request_at,
      'lastCompletedRequestStatus', last_completed_request_status,
      'blocked', queue_blocked,
      'stale', queue_stale
    ),
    'checkpoints', checkpoints_payload,
    'activePoolCount', COALESCE(active_pool_count, 0),
    'activeTokenCount', COALESCE(active_token_count, 0),
    'biaSummary', jsonb_build_object(
      'activeBias', COALESCE(active_bias, 0),
      'mappedPools', COALESCE(mapped_pools, 0),
      'unmappedPools', COALESCE(unmapped_pools, 0),
      'staleMappings', COALESCE(stale_mappings, 0),
      'componentMismatches', COALESCE(component_mismatches, 0),
      'lastActivityByBia', bia_activity_payload
    ),
    'voucherSummary', jsonb_build_object(
      'trackedVoucherTokens', COALESCE(tracked_voucher_tokens, 0),
      'walletsWithVoucherBalances', COALESCE(wallets_with_voucher_balances, 0),
      'merchantCreditRows', COALESCE(merchant_credit_rows, 0),
      'lastVoucherBlock', last_voucher_block
    ),
    'torontoCoinTracking', jsonb_build_object(
      'requiredTokenAddress', p_required_token_address,
      'cplTcoinTracked', COALESCE(required_token_tracked, COALESCE(active_token_count, 0) > 0),
      'trackedPools', '[]'::jsonb
    ),
    'activePoolDetails', active_pool_details
  );
END;
$$;

COMMENT ON FUNCTION public.indexer_scope_status_v1(text, bigint, text) IS
  'Returns aggregate indexer scope health, including async queue status, for app/API/ops reads without raw wallet rows or service-role table access.';

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
  pending_request_count integer := 0;
  oldest_pending_requested_at timestamptz := NULL;
  last_completed_request_at timestamptz := NULL;
  last_completed_request_status text := NULL;
  queue_stale boolean := false;
  queue_blocked boolean := false;
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

  SELECT count(*)::integer, min(tr.requested_at)
  INTO pending_request_count, oldest_pending_requested_at
  FROM indexer.touch_requests tr
  WHERE tr.scope_key = target_scope_key
    AND tr.status = 'queued';

  SELECT tr.completed_at, COALESCE(tr.last_run_status, CASE WHEN tr.status = 'failed' THEN 'error' ELSE NULL END)
  INTO last_completed_request_at, last_completed_request_status
  FROM indexer.touch_requests tr
  WHERE tr.scope_key = target_scope_key
    AND tr.status IN ('completed', 'failed')
  ORDER BY tr.completed_at DESC NULLS LAST, tr.id DESC
  LIMIT 1;

  queue_stale := oldest_pending_requested_at IS NOT NULL
    AND oldest_pending_requested_at <= timezone('utc', now()) - interval '15 minutes';

  queue_blocked := queue_stale
    AND NOT EXISTS (
      SELECT 1
      FROM indexer.touch_requests tr
      WHERE tr.scope_key = target_scope_key
        AND tr.status = 'running'
    )
    AND COALESCE(run_last_status, 'idle') <> 'running';

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
      'queue', jsonb_build_object(
        'pendingRequestCount', COALESCE(pending_request_count, 0),
        'oldestPendingRequestedAt', oldest_pending_requested_at,
        'lastCompletedRequestAt', last_completed_request_at,
        'lastCompletedRequestStatus', last_completed_request_status,
        'blocked', queue_blocked,
        'stale', queue_stale
      ),
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
  'Returns release-safe aggregate wallet, pay-link cleanup, and async indexer queue health fields for preflight checks without exposing raw rows or requiring service-role table reads.';

COMMIT;

-- DOWN (manual rollback SQL; keep commented so Supabase forward migrations only apply the new queue and read contracts)
-- BEGIN;
-- REVOKE ALL ON FUNCTION indexer.complete_touch_request_v1(bigint, text, text, text) FROM service_role;
-- DROP FUNCTION IF EXISTS indexer.complete_touch_request_v1(bigint, text, text, text);
-- REVOKE ALL ON FUNCTION indexer.claim_touch_request_v1(text) FROM service_role;
-- DROP FUNCTION IF EXISTS indexer.claim_touch_request_v1(text);
-- REVOKE ALL ON FUNCTION public.request_indexer_touch_v1(text, bigint, text) FROM authenticated, service_role;
-- DROP FUNCTION IF EXISTS public.request_indexer_touch_v1(text, bigint, text);
-- DROP INDEX IF EXISTS indexer.touch_requests_one_open_per_scope_idx;
-- DROP INDEX IF EXISTS indexer.touch_requests_completed_at_idx;
-- DROP INDEX IF EXISTS indexer.touch_requests_status_requested_idx;
-- DROP INDEX IF EXISTS indexer.touch_requests_scope_status_requested_idx;
-- DROP TABLE IF EXISTS indexer.touch_requests;
-- COMMIT;
