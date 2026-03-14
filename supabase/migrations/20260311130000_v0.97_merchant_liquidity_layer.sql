BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_bia_secondary_affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_instance_id bigint NOT NULL REFERENCES public.ref_app_instances(id) ON DELETE CASCADE,
  bia_id uuid NOT NULL REFERENCES public.bia_registry(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('user_selected', 'suggested', 'admin_assigned', 'migrated')),
  effective_from timestamptz NOT NULL DEFAULT timezone('utc', now()),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS user_bia_secondary_affiliations_active_uidx
  ON public.user_bia_secondary_affiliations (user_id, app_instance_id, bia_id)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS user_bia_secondary_affiliations_user_app_idx
  ON public.user_bia_secondary_affiliations (user_id, app_instance_id, effective_to);

CREATE TABLE IF NOT EXISTS indexer.voucher_tokens (
  chain_id bigint NOT NULL,
  token_address text NOT NULL,
  pool_address text NOT NULL,
  merchant_wallet text,
  merchant_store_id bigint,
  token_name text,
  token_symbol text,
  token_decimals integer,
  is_active boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (chain_id, token_address, pool_address)
);

CREATE INDEX IF NOT EXISTS voucher_tokens_pool_idx
  ON indexer.voucher_tokens (chain_id, pool_address, is_active);

CREATE INDEX IF NOT EXISTS voucher_tokens_token_idx
  ON indexer.voucher_tokens (chain_id, token_address, is_active);

CREATE TABLE IF NOT EXISTS indexer.wallet_tcoin_balances (
  scope_key text NOT NULL,
  chain_id bigint NOT NULL,
  wallet_address text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  last_block bigint,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (scope_key, chain_id, wallet_address)
);

CREATE TABLE IF NOT EXISTS indexer.wallet_voucher_balances (
  scope_key text NOT NULL,
  chain_id bigint NOT NULL,
  wallet_address text NOT NULL,
  token_address text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  last_block bigint,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (scope_key, chain_id, wallet_address, token_address)
);

CREATE INDEX IF NOT EXISTS wallet_voucher_balances_wallet_idx
  ON indexer.wallet_voucher_balances (scope_key, chain_id, wallet_address);

CREATE TABLE IF NOT EXISTS indexer.merchant_credit_state (
  scope_key text NOT NULL,
  chain_id bigint NOT NULL,
  merchant_wallet text NOT NULL,
  token_address text NOT NULL,
  pool_address text NOT NULL,
  credit_limit numeric,
  required_liquidity_absolute numeric,
  required_liquidity_ratio numeric,
  credit_issued numeric NOT NULL DEFAULT 0,
  credit_remaining numeric,
  source_mode text NOT NULL CHECK (source_mode IN ('contract_field', 'derived_supply')),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (scope_key, chain_id, merchant_wallet, token_address, pool_address)
);

ALTER TABLE IF EXISTS indexer.merchant_credit_state
  ADD COLUMN IF NOT EXISTS required_liquidity_absolute numeric;

ALTER TABLE IF EXISTS indexer.merchant_credit_state
  ADD COLUMN IF NOT EXISTS required_liquidity_ratio numeric;

CREATE INDEX IF NOT EXISTS merchant_credit_state_pool_idx
  ON indexer.merchant_credit_state (scope_key, chain_id, pool_address);

CREATE TABLE IF NOT EXISTS public.voucher_compatibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug text NOT NULL,
  chain_id bigint NOT NULL,
  pool_address text NOT NULL,
  token_address text NOT NULL,
  merchant_store_id bigint REFERENCES public.stores(id) ON DELETE CASCADE,
  accepted_by_default boolean NOT NULL DEFAULT true,
  rule_status text NOT NULL DEFAULT 'active' CHECK (rule_status IN ('active', 'inactive')),
  created_by bigint REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS voucher_compatibility_rules_active_uidx
  ON public.voucher_compatibility_rules (
    city_slug,
    chain_id,
    lower(pool_address),
    lower(token_address),
    COALESCE(merchant_store_id, 0)
  )
  WHERE rule_status = 'active';

CREATE INDEX IF NOT EXISTS voucher_compatibility_rules_city_idx
  ON public.voucher_compatibility_rules (city_slug, chain_id, rule_status);

CREATE TABLE IF NOT EXISTS public.user_voucher_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_instance_id bigint NOT NULL REFERENCES public.ref_app_instances(id) ON DELETE CASCADE,
  city_slug text NOT NULL,
  merchant_store_id bigint REFERENCES public.stores(id) ON DELETE CASCADE,
  token_address text,
  trust_status text NOT NULL CHECK (trust_status IN ('trusted', 'blocked', 'default')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS user_voucher_preferences_uidx
  ON public.user_voucher_preferences (
    user_id,
    app_instance_id,
    city_slug,
    COALESCE(merchant_store_id, 0),
    COALESCE(lower(token_address), '')
  );

CREATE INDEX IF NOT EXISTS user_voucher_preferences_user_idx
  ON public.user_voucher_preferences (user_id, app_instance_id, city_slug);

CREATE TABLE IF NOT EXISTS public.voucher_payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug text NOT NULL,
  chain_id bigint NOT NULL,
  payer_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  payer_wallet text,
  recipient_wallet text,
  merchant_store_id bigint REFERENCES public.stores(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('voucher', 'tcoin_fallback')),
  token_address text,
  pool_address text,
  amount_tcoin numeric,
  amount_voucher numeric,
  swap_tx_hash text,
  transfer_tx_hash text,
  fallback_reason text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'completed', 'failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS voucher_payment_records_user_idx
  ON public.voucher_payment_records (payer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS voucher_payment_records_city_idx
  ON public.voucher_payment_records (city_slug, chain_id, created_at DESC);

CREATE OR REPLACE VIEW public.v_wallet_total_value AS
WITH voucher_rollup AS (
  SELECT
    wb.scope_key,
    wb.chain_id,
    lower(wb.wallet_address) AS wallet_address,
    SUM(wb.balance)::numeric AS voucher_total,
    jsonb_agg(
      jsonb_build_object(
        'tokenAddress', wb.token_address,
        'balance', wb.balance,
        'chainId', wb.chain_id,
        'updatedAt', wb.updated_at
      ) ORDER BY wb.updated_at DESC
    ) AS voucher_breakdown,
    MAX(wb.updated_at) AS voucher_updated_at
  FROM indexer.wallet_voucher_balances wb
  GROUP BY wb.scope_key, wb.chain_id, lower(wb.wallet_address)
),
tcoin_rollup AS (
  SELECT
    tb.scope_key,
    tb.chain_id,
    lower(tb.wallet_address) AS wallet_address,
    tb.balance::numeric AS tcoin_balance,
    tb.updated_at AS tcoin_updated_at
  FROM indexer.wallet_tcoin_balances tb
)
SELECT
  COALESCE(t.scope_key, v.scope_key) AS scope_key,
  COALESCE(t.chain_id, v.chain_id) AS chain_id,
  COALESCE(t.wallet_address, v.wallet_address) AS wallet_address,
  COALESCE(t.tcoin_balance, 0)::numeric AS tcoin_balance,
  COALESCE(v.voucher_total, 0)::numeric AS voucher_total,
  (COALESCE(t.tcoin_balance, 0) + COALESCE(v.voucher_total, 0))::numeric AS total_equivalent,
  COALESCE(v.voucher_breakdown, '[]'::jsonb) AS voucher_breakdown,
  GREATEST(
    COALESCE(t.tcoin_updated_at, to_timestamp(0)),
    COALESCE(v.voucher_updated_at, to_timestamp(0))
  ) AS updated_at
FROM tcoin_rollup t
FULL OUTER JOIN voucher_rollup v
  ON t.scope_key = v.scope_key
 AND t.chain_id = v.chain_id
 AND t.wallet_address = v.wallet_address;

GRANT SELECT ON TABLE
  public.user_bia_secondary_affiliations,
  public.voucher_compatibility_rules,
  public.user_voucher_preferences,
  public.voucher_payment_records
TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.user_bia_secondary_affiliations,
  public.voucher_compatibility_rules,
  public.user_voucher_preferences,
  public.voucher_payment_records
FROM authenticated;

GRANT SELECT ON TABLE
  indexer.voucher_tokens,
  indexer.wallet_tcoin_balances,
  indexer.wallet_voucher_balances,
  indexer.merchant_credit_state
TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  indexer.voucher_tokens,
  indexer.wallet_tcoin_balances,
  indexer.wallet_voucher_balances,
  indexer.merchant_credit_state
FROM authenticated;

GRANT SELECT ON public.v_wallet_total_value TO authenticated;

ALTER TABLE IF EXISTS public.user_bia_secondary_affiliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voucher_compatibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_voucher_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voucher_payment_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_bia_secondary_affiliations' AND policyname = 'user_bia_secondary_affiliations_read_own'
  ) THEN
    CREATE POLICY user_bia_secondary_affiliations_read_own
      ON public.user_bia_secondary_affiliations
      FOR SELECT
      TO authenticated
      USING (
        user_id = public.current_user_row_id() OR public.user_is_admin_or_operator()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'voucher_compatibility_rules' AND policyname = 'voucher_compatibility_rules_read_authenticated'
  ) THEN
    CREATE POLICY voucher_compatibility_rules_read_authenticated
      ON public.voucher_compatibility_rules
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_voucher_preferences' AND policyname = 'user_voucher_preferences_read_own'
  ) THEN
    CREATE POLICY user_voucher_preferences_read_own
      ON public.user_voucher_preferences
      FOR SELECT
      TO authenticated
      USING (
        user_id = public.current_user_row_id() OR public.user_is_admin_or_operator()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'voucher_payment_records' AND policyname = 'voucher_payment_records_read_scope'
  ) THEN
    CREATE POLICY voucher_payment_records_read_scope
      ON public.voucher_payment_records
      FOR SELECT
      TO authenticated
      USING (
        payer_user_id = public.current_user_row_id() OR public.user_is_admin_or_operator()
      );
  END IF;
END $$;

COMMIT;
