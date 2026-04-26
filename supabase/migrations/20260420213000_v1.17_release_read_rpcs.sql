-- v1.17: release-safe stats and indexer read RPCs
BEGIN;

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

  RETURN jsonb_build_object(
    'scopeKey', target_scope_key,
    'citySlug', normalized_city_slug,
    'chainId', p_chain_id,
    'runControl', run_control_payload,
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
  'Returns aggregate indexer scope health for app/API/ops reads without raw wallet rows or service-role table access.';

REVOKE ALL ON FUNCTION public.indexer_scope_status_v1(text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.indexer_scope_status_v1(text, bigint, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.wallet_stats_summary_v1(
  p_city_slug text,
  p_chain_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, indexer, chain_data
AS $$
DECLARE
  normalized_city_slug text := lower(trim(p_city_slug));
  target_scope_key text;
  generated_at timestamptz := timezone('utc', now());
  generated_at_text text := generated_at::text;
  user_count integer := 0;
  wallet_count integer := 0;
  transaction_count integer := 0;
  transaction_volume numeric := 0;
  open_payment_request_count integer := 0;
  indexed_tcoin_balance numeric := 0;
  indexed_voucher_balance numeric := 0;
  merchant_commitments_issued numeric := 0;
  required_liquidity_absolute numeric := 0;
  current_rate_citycoin_id bigint := NULL;
  current_rate_value numeric := NULL;
  current_rate_source text := NULL;
  current_rate_observed_at timestamptz := NULL;
  current_rate_freshness_seconds integer := NULL;
  current_rate_is_stale boolean := NULL;
  current_rate_used_fallback boolean := NULL;
  recent_exchange_rates jsonb := '[]'::jsonb;
  daily_transactions jsonb := '[]'::jsonb;
  daily_payment_requests jsonb := '[]'::jsonb;
  transaction_categories jsonb := '[]'::jsonb;
  asset_balances jsonb := '[]'::jsonb;
  bia_rows jsonb := '[]'::jsonb;
  indexer_status jsonb := NULL;
BEGIN
  IF normalized_city_slug IS NULL OR normalized_city_slug = '' THEN
    RAISE EXCEPTION 'city slug is required';
  END IF;

  IF p_chain_id IS NULL OR p_chain_id <= 0 THEN
    RAISE EXCEPTION 'chain id must be positive';
  END IF;

  target_scope_key := normalized_city_slug || ':' || p_chain_id::text;

  SELECT count(*)::integer INTO user_count FROM public.users;

  SELECT count(*)::integer
  INTO wallet_count
  FROM public.v_wallet_identities_v1 wi
  WHERE wi.namespace = 'EVM'
    AND wi.wallet_ready = true;

  SELECT
    count(*)::integer,
    COALESCE(sum(abs(COALESCE(at.amount, 0))), 0)
  INTO transaction_count, transaction_volume
  FROM public.act_transactions at;

  SELECT count(*)::integer
  INTO open_payment_request_count
  FROM public.v_payment_requests_v1 pr
  WHERE pr.city_slug = normalized_city_slug
    AND lower(COALESCE(pr.status, '')) = 'pending';

  SELECT COALESCE(sum(COALESCE(wtb.balance, 0)), 0)
  INTO indexed_tcoin_balance
  FROM indexer.wallet_tcoin_balances wtb
  WHERE wtb.scope_key = target_scope_key
    AND wtb.chain_id = p_chain_id;

  SELECT COALESCE(sum(COALESCE(wvb.balance, 0)), 0)
  INTO indexed_voucher_balance
  FROM indexer.wallet_voucher_balances wvb
  WHERE wvb.scope_key = target_scope_key
    AND wvb.chain_id = p_chain_id;

  SELECT
    COALESCE(sum(COALESCE(mcs.credit_issued, 0)), 0),
    COALESCE(sum(COALESCE(mcs.required_liquidity_absolute, 0)), 0)
  INTO merchant_commitments_issued, required_liquidity_absolute
  FROM indexer.merchant_credit_state mcs
  WHERE mcs.scope_key = target_scope_key
    AND mcs.chain_id = p_chain_id;

  SELECT
    rate.citycoin_id,
    rate.rate,
    rate.source,
    rate.observed_at,
    rate.freshness_seconds,
    rate.is_stale,
    rate.used_fallback
  INTO
    current_rate_citycoin_id,
    current_rate_value,
    current_rate_source,
    current_rate_observed_at,
    current_rate_freshness_seconds,
    current_rate_is_stale,
    current_rate_used_fallback
  FROM public.v_citycoin_exchange_rates_current_v1 rate
  WHERE rate.city_slug = normalized_city_slug
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'observedAt', history.observed_at,
        'rate', COALESCE(history.rate, 0),
        'source', history.source,
        'usedFallback', COALESCE(history.used_fallback, false)
      )
      ORDER BY history.observed_at
    ),
    '[]'::jsonb
  )
  INTO recent_exchange_rates
  FROM (
    SELECT cer.observed_at, cer.rate, cer.source, cer.used_fallback
    FROM public.citycoin_exchange_rates cer
    WHERE current_rate_citycoin_id IS NOT NULL
      AND cer.citycoin_id = current_rate_citycoin_id
    ORDER BY cer.observed_at DESC
    LIMIT 14
  ) history;

  WITH days AS (
    SELECT generate_series(
      (generated_at::date - interval '29 days')::date,
      generated_at::date,
      interval '1 day'
    )::date AS day
  ),
  tx AS (
    SELECT
      at.created_at::date AS day,
      count(*)::integer AS count,
      COALESCE(sum(abs(COALESCE(at.amount, 0))), 0) AS volume
    FROM public.act_transactions at
    WHERE at.created_at::date >= (generated_at::date - interval '29 days')::date
      AND at.created_at::date <= generated_at::date
    GROUP BY at.created_at::date
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', days.day::text,
        'count', COALESCE(tx.count, 0),
        'volume', COALESCE(tx.volume, 0)
      )
      ORDER BY days.day
    ),
    '[]'::jsonb
  )
  INTO daily_transactions
  FROM days
  LEFT JOIN tx ON tx.day = days.day;

  WITH days AS (
    SELECT generate_series(
      (generated_at::date - interval '29 days')::date,
      generated_at::date,
      interval '1 day'
    )::date AS day
  ),
  created AS (
    SELECT pr.created_at::date AS day, count(*)::integer AS count
    FROM public.v_payment_requests_v1 pr
    WHERE pr.city_slug = normalized_city_slug
      AND pr.created_at::date >= (generated_at::date - interval '29 days')::date
      AND pr.created_at::date <= generated_at::date
    GROUP BY pr.created_at::date
  ),
  paid AS (
    SELECT pr.paid_at::date AS day, count(*)::integer AS count
    FROM public.v_payment_requests_v1 pr
    WHERE pr.city_slug = normalized_city_slug
      AND pr.paid_at IS NOT NULL
      AND pr.paid_at::date >= (generated_at::date - interval '29 days')::date
      AND pr.paid_at::date <= generated_at::date
    GROUP BY pr.paid_at::date
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', days.day::text,
        'createdCount', COALESCE(created.count, 0),
        'paidCount', COALESCE(paid.count, 0)
      )
      ORDER BY days.day
    ),
    '[]'::jsonb
  )
  INTO daily_payment_requests
  FROM days
  LEFT JOIN created ON created.day = days.day
  LEFT JOIN paid ON paid.day = days.day;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'category', category,
        'count', count,
        'volume', volume
      )
      ORDER BY volume DESC, count DESC, category
    ),
    '[]'::jsonb
  )
  INTO transaction_categories
  FROM (
    SELECT
      COALESCE(NULLIF(trim(at.transaction_category), ''), 'uncategorized') AS category,
      count(*)::integer AS count,
      COALESCE(sum(abs(COALESCE(at.amount, 0))), 0) AS volume
    FROM public.act_transactions at
    GROUP BY COALESCE(NULLIF(trim(at.transaction_category), ''), 'uncategorized')
  ) categories;

  asset_balances := jsonb_build_array(
    jsonb_build_object('assetType', 'tcoin', 'label', 'Indexed TCOIN', 'value', indexed_tcoin_balance),
    jsonb_build_object('assetType', 'voucher', 'label', 'Indexed vouchers', 'value', indexed_voucher_balance)
  );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'biaId', row.bia_id,
        'code', row.code,
        'name', row.name,
        'activeUsers', row.active_users,
        'activeStores', row.active_stores,
        'indexedEventCount', row.indexed_event_count,
        'purchaseCount', row.purchase_count,
        'purchasedTokenVolume', row.purchased_token_volume,
        'pendingRedemptionCount', row.pending_redemption_count,
        'pendingRedemptionVolume', row.pending_redemption_volume,
        'stressLevel', row.stress_level,
        'redemptionPressure', row.redemption_pressure,
        'lastIndexedBlock', row.last_indexed_block
      )
      ORDER BY row.indexed_event_count DESC, row.active_users DESC, row.pending_redemption_volume DESC, row.name
    ),
    '[]'::jsonb
  )
  INTO bia_rows
  FROM (
    SELECT
      COALESCE(activity.bia_id, health.bia_id) AS bia_id,
      COALESCE(activity.code, health.code, 'n/a') AS code,
      COALESCE(activity.name, health.name, 'Unknown BIA') AS name,
      COALESCE(activity.active_users, 0) AS active_users,
      COALESCE(activity.active_stores, 0) AS active_stores,
      COALESCE(activity.indexed_event_count, health.indexed_events, 0) AS indexed_event_count,
      COALESCE(health.purchase_count, 0) AS purchase_count,
      COALESCE(health.purchased_token_volume, 0) AS purchased_token_volume,
      COALESCE(health.pending_redemption_count, 0) AS pending_redemption_count,
      COALESCE(health.pending_redemption_volume, 0) AS pending_redemption_volume,
      COALESCE(health.stress_level, 'low') AS stress_level,
      COALESCE(health.redemption_pressure, 0) AS redemption_pressure,
      COALESCE(activity.last_indexed_block, health.last_indexed_block) AS last_indexed_block
    FROM public.v_bia_activity_summary activity
    FULL OUTER JOIN public.v_bia_pool_health health
      ON health.bia_id = activity.bia_id
    WHERE COALESCE(activity.city_slug, health.city_slug) = normalized_city_slug
  ) row;

  indexer_status := public.indexer_scope_status_v1(normalized_city_slug, p_chain_id, NULL);

  RETURN jsonb_build_object(
    'generatedAt', generated_at_text,
    'overview', jsonb_build_object(
      'userCount', COALESCE(user_count, 0),
      'walletCount', COALESCE(wallet_count, 0),
      'transactionCount', COALESCE(transaction_count, 0),
      'transactionVolume', COALESCE(transaction_volume, 0),
      'openPaymentRequestCount', COALESCE(open_payment_request_count, 0),
      'indexedTcoinBalance', COALESCE(indexed_tcoin_balance, 0),
      'indexedVoucherBalance', COALESCE(indexed_voucher_balance, 0),
      'merchantCommitmentsIssued', COALESCE(merchant_commitments_issued, 0),
      'requiredLiquidityAbsolute', COALESCE(required_liquidity_absolute, 0),
      'currentExchangeRate', current_rate_value,
      'exchangeRateFreshnessSeconds', current_rate_freshness_seconds,
      'exchangeRateSource', current_rate_source,
      'exchangeRateObservedAt', current_rate_observed_at,
      'exchangeRateIsStale', current_rate_is_stale
    ),
    'timeseries', jsonb_build_object(
      'dailyTransactions', daily_transactions,
      'dailyPaymentRequests', daily_payment_requests,
      'recentExchangeRates', recent_exchange_rates
    ),
    'breakdowns', jsonb_build_object(
      'biaLeaderboard', (
        SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
        FROM (
          SELECT item
          FROM jsonb_array_elements(bia_rows) AS entries(item)
          LIMIT 6
        ) limited
      ),
      'transactionCategories', transaction_categories,
      'assetBalances', asset_balances,
      'biaHealth', bia_rows
    ),
    'ops', jsonb_build_object(
      'indexer', jsonb_build_object(
        'lastRunStatus', indexer_status #>> '{runControl,lastStatus}',
        'lastCompletedAt', indexer_status #>> '{runControl,lastCompletedAt}',
        'activePoolCount', COALESCE(NULLIF(indexer_status #>> '{activePoolCount}', '')::integer, 0),
        'activeTokenCount', COALESCE(NULLIF(indexer_status #>> '{activeTokenCount}', '')::integer, 0),
        'trackedPoolCount', 0,
        'healthyTrackedPoolCount', 0,
        'cplTcoinTracked', COALESCE(NULLIF(indexer_status #>> '{torontoCoinTracking,cplTcoinTracked}', '')::boolean, false),
        'trackedVoucherTokens', COALESCE(NULLIF(indexer_status #>> '{voucherSummary,trackedVoucherTokens}', '')::integer, 0),
        'walletsWithVoucherBalances', COALESCE(NULLIF(indexer_status #>> '{voucherSummary,walletsWithVoucherBalances}', '')::integer, 0),
        'lastVoucherBlock', NULLIF(indexer_status #>> '{voucherSummary,lastVoucherBlock}', '')::bigint
      ),
      'reserveRouteHealth', jsonb_build_object(
        'reserveAssetActive', NULL,
        'mentoUsdcRouteConfigured', NULL,
        'liquidityRouterPointerHealthy', NULL,
        'treasuryControllerPointerHealthy', NULL
      ),
      'rate', jsonb_build_object(
        'source', current_rate_source,
        'observedAt', current_rate_observed_at,
        'freshnessSeconds', current_rate_freshness_seconds,
        'isStale', current_rate_is_stale,
        'usedFallback', current_rate_used_fallback
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.wallet_stats_summary_v1(text, bigint) IS
  'Returns aggregate wallet stats for signed-in app/API reads without exposing raw wallet, user, payment-link, or indexer rows.';

REVOKE ALL ON FUNCTION public.wallet_stats_summary_v1(text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wallet_stats_summary_v1(text, bigint) TO authenticated, service_role;

COMMIT;

-- DOWN (manual rollback SQL; keep commented so Supabase forward migrations only apply the new read contracts)
-- BEGIN;
-- REVOKE ALL ON FUNCTION public.wallet_stats_summary_v1(text, bigint) FROM authenticated, service_role;
-- DROP FUNCTION IF EXISTS public.wallet_stats_summary_v1(text, bigint);
-- REVOKE ALL ON FUNCTION public.indexer_scope_status_v1(text, bigint, text) FROM anon, authenticated, service_role;
-- DROP FUNCTION IF EXISTS public.indexer_scope_status_v1(text, bigint, text);
-- COMMIT;
