-- migrate:up
BEGIN;

ALTER TABLE IF EXISTS public.wallet_list
  ADD COLUMN IF NOT EXISTS public_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wallet_list_public_key_format_chk'
      AND conrelid = 'public.wallet_list'::regclass
  ) THEN
    ALTER TABLE public.wallet_list
      ADD CONSTRAINT wallet_list_public_key_format_chk
      CHECK (
        public_key IS NULL
        OR public_key ~* '^0x[a-f0-9]{40}$'
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_list_public_key_namespace_uidx
  ON public.wallet_list (namespace, lower(public_key))
  WHERE public_key IS NOT NULL;

CREATE OR REPLACE VIEW public.v_bia_mappings_v1 AS
SELECT
  m.id AS mapping_id,
  m.bia_id,
  b.city_slug,
  b.code AS bia_code,
  b.name AS bia_name,
  m.chain_id,
  lower(m.pool_address) AS pool_address,
  m.mapping_status,
  m.validation_status,
  m.effective_from,
  m.effective_to,
  m.updated_at,
  COALESCE(discovered.is_active, false) AS discovered_on_chain
FROM public.bia_pool_mappings m
JOIN public.bia_registry b
  ON b.id = m.bia_id
LEFT JOIN LATERAL (
  SELECT true AS is_active
  FROM indexer.pool_links pl
  WHERE pl.city_slug = b.city_slug
    AND pl.chain_id = m.chain_id
    AND pl.is_active = true
    AND lower(pl.pool_address) = lower(m.pool_address)
  ORDER BY pl.updated_at DESC NULLS LAST
  LIMIT 1
) AS discovered ON true;

CREATE OR REPLACE VIEW public.v_bia_mapping_health_v1 AS
WITH scope_pairs AS (
  SELECT city_slug, chain_id
  FROM public.v_bia_mappings_v1
  UNION
  SELECT city_slug, chain_id
  FROM indexer.pool_links
  WHERE is_active = true
),
mapped AS (
  SELECT
    city_slug,
    chain_id,
    COUNT(DISTINCT pool_address)::bigint AS mapped_pools
  FROM public.v_bia_mappings_v1
  WHERE mapping_status = 'active'
    AND effective_to IS NULL
  GROUP BY city_slug, chain_id
),
stale AS (
  SELECT
    city_slug,
    chain_id,
    COUNT(*)::bigint AS stale_mappings
  FROM public.v_bia_mappings_v1
  WHERE mapping_status = 'active'
    AND effective_to IS NULL
    AND lower(COALESCE(validation_status, '')) IN ('stale', 'mismatch')
  GROUP BY city_slug, chain_id
),
discovered AS (
  SELECT
    city_slug,
    chain_id,
    COUNT(DISTINCT lower(pool_address))::bigint AS discovered_pools
  FROM indexer.pool_links
  WHERE is_active = true
  GROUP BY city_slug, chain_id
)
SELECT
  scopes.city_slug,
  scopes.chain_id,
  COALESCE(mapped.mapped_pools, 0)::bigint AS mapped_pools,
  COALESCE(discovered.discovered_pools, 0)::bigint AS discovered_pools,
  GREATEST(COALESCE(discovered.discovered_pools, 0) - COALESCE(mapped.mapped_pools, 0), 0)::bigint AS unmapped_pools,
  COALESCE(stale.stale_mappings, 0)::bigint AS stale_mappings
FROM scope_pairs AS scopes
LEFT JOIN mapped
  ON mapped.city_slug = scopes.city_slug
 AND mapped.chain_id = scopes.chain_id
LEFT JOIN stale
  ON stale.city_slug = scopes.city_slug
 AND stale.chain_id = scopes.chain_id
LEFT JOIN discovered
  ON discovered.city_slug = scopes.city_slug
 AND discovered.chain_id = scopes.chain_id;

CREATE OR REPLACE VIEW public.v_voucher_liquidity_rows_v1 AS
WITH active_store_bia AS (
  SELECT
    sba.store_id,
    sba.bia_id
  FROM public.store_bia_affiliations sba
  WHERE sba.effective_to IS NULL
)
SELECT
  sp.store_id AS merchant_store_id,
  sp.display_name,
  lower(sp.wallet_address) AS wallet_address,
  b.id AS bia_id,
  b.city_slug,
  b.code AS bia_code,
  b.name AS bia_name,
  m.chain_id,
  lower(m.pool_address) AS pool_address,
  lower(vt.token_address) AS token_address,
  vt.token_symbol,
  vt.token_name,
  vt.token_decimals,
  mcs.credit_limit::text AS voucher_issue_limit,
  mcs.required_liquidity_absolute::text AS required_liquidity_absolute,
  mcs.required_liquidity_ratio::text AS required_liquidity_ratio,
  mcs.credit_issued::text AS credit_issued,
  mcs.credit_remaining::text AS credit_remaining,
  COALESCE(mcs.source_mode, 'derived_supply') AS source_mode,
  (vt.token_address IS NOT NULL) AS available
FROM public.store_profiles sp
LEFT JOIN active_store_bia sba
  ON sba.store_id = sp.store_id
LEFT JOIN public.bia_registry b
  ON b.id = sba.bia_id
LEFT JOIN public.bia_pool_mappings m
  ON m.bia_id = b.id
 AND m.mapping_status = 'active'
 AND m.effective_to IS NULL
LEFT JOIN indexer.voucher_tokens vt
  ON vt.chain_id = m.chain_id
 AND vt.is_active = true
 AND lower(vt.pool_address) = lower(m.pool_address)
LEFT JOIN indexer.merchant_credit_state mcs
  ON mcs.scope_key = b.city_slug || ':' || m.chain_id::text
 AND mcs.chain_id = m.chain_id
 AND lower(mcs.pool_address) = lower(m.pool_address)
 AND lower(mcs.merchant_wallet) = lower(sp.wallet_address)
 AND lower(mcs.token_address) = lower(vt.token_address)
WHERE sp.status = 'active';

CREATE OR REPLACE FUNCTION public.get_voucher_merchants_v1(
  p_city_slug text,
  p_chain_id integer,
  p_user_id bigint,
  p_app_instance_id bigint,
  p_scope text DEFAULT 'city'
)
RETURNS TABLE (
  merchant_store_id bigint,
  display_name text,
  wallet_address text,
  bia_id uuid,
  bia_code text,
  bia_name text,
  chain_id integer,
  pool_address text,
  token_address text,
  token_symbol text,
  token_name text,
  token_decimals integer,
  voucher_issue_limit text,
  required_liquidity_absolute text,
  required_liquidity_ratio text,
  credit_issued text,
  credit_remaining text,
  source_mode text,
  available boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH base_stores AS (
    SELECT
      sp.store_id AS merchant_store_id,
      sp.display_name,
      lower(sp.wallet_address) AS wallet_address,
      b.id AS bia_id,
      b.code AS bia_code,
      b.name AS bia_name
    FROM public.store_profiles sp
    LEFT JOIN public.store_bia_affiliations sba
      ON sba.store_id = sp.store_id
     AND sba.effective_to IS NULL
    LEFT JOIN public.bia_registry b
      ON b.id = sba.bia_id
    WHERE sp.status = 'active'
      AND b.city_slug = p_city_slug
  ),
  user_scope AS (
    SELECT bia_id
    FROM public.user_bia_affiliations
    WHERE user_id = p_user_id
      AND app_instance_id = p_app_instance_id
      AND effective_to IS NULL
    UNION
    SELECT bia_id
    FROM public.user_bia_secondary_affiliations
    WHERE user_id = p_user_id
      AND app_instance_id = p_app_instance_id
      AND effective_to IS NULL
  ),
  user_scope_count AS (
    SELECT COUNT(*)::bigint AS total FROM user_scope
  ),
  scoped_base AS (
    SELECT *
    FROM base_stores
    CROSS JOIN user_scope_count
    WHERE (
      p_scope <> 'my_pool'
      OR user_scope_count.total = 0
      OR base_stores.bia_id IN (SELECT bia_id FROM user_scope)
    )
  )
  SELECT
    base.merchant_store_id,
    COALESCE(rows.display_name, base.display_name) AS display_name,
    COALESCE(rows.wallet_address, base.wallet_address) AS wallet_address,
    COALESCE(rows.bia_id, base.bia_id) AS bia_id,
    COALESCE(rows.bia_code, base.bia_code) AS bia_code,
    COALESCE(rows.bia_name, base.bia_name) AS bia_name,
    COALESCE(rows.chain_id, p_chain_id) AS chain_id,
    rows.pool_address,
    rows.token_address,
    rows.token_symbol,
    rows.token_name,
    rows.token_decimals,
    rows.voucher_issue_limit,
    rows.required_liquidity_absolute,
    rows.required_liquidity_ratio,
    rows.credit_issued,
    rows.credit_remaining,
    rows.source_mode,
    COALESCE(rows.available, false) AS available
  FROM scoped_base AS base
  LEFT JOIN public.v_voucher_liquidity_rows_v1 AS rows
    ON rows.city_slug = p_city_slug
   AND rows.chain_id = p_chain_id
   AND rows.merchant_store_id = base.merchant_store_id
  ORDER BY base.merchant_store_id ASC, COALESCE(rows.token_symbol, '') ASC;
$$;

GRANT SELECT ON public.v_bia_mappings_v1 TO authenticated;
GRANT SELECT ON public.v_bia_mapping_health_v1 TO authenticated;
GRANT SELECT ON public.v_voucher_liquidity_rows_v1 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_voucher_merchants_v1(text, integer, bigint, bigint, text) TO authenticated;

COMMIT;

-- migrate:down
BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_voucher_merchants_v1(text, integer, bigint, bigint, text) FROM authenticated;
DROP FUNCTION IF EXISTS public.get_voucher_merchants_v1(text, integer, bigint, bigint, text);

REVOKE SELECT ON public.v_voucher_liquidity_rows_v1 FROM authenticated;
DROP VIEW IF EXISTS public.v_voucher_liquidity_rows_v1;

REVOKE SELECT ON public.v_bia_mapping_health_v1 FROM authenticated;
DROP VIEW IF EXISTS public.v_bia_mapping_health_v1;

REVOKE SELECT ON public.v_bia_mappings_v1 FROM authenticated;
DROP VIEW IF EXISTS public.v_bia_mappings_v1;

DROP INDEX IF EXISTS wallet_list_public_key_namespace_uidx;

ALTER TABLE IF EXISTS public.wallet_list
  DROP CONSTRAINT IF EXISTS wallet_list_public_key_format_chk;

ALTER TABLE IF EXISTS public.wallet_list
  DROP COLUMN IF EXISTS public_key;

COMMIT;
