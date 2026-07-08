BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.current_user_row_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_user_id::text = auth.uid()::text
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_role(p_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.user_id = public.current_user_row_id()
      AND lower(r.role) = lower(p_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_admin_or_operator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.user_has_role('admin') OR public.user_has_role('operator');
$$;

CREATE OR REPLACE FUNCTION public.user_has_store_access(p_store_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_employees se
    WHERE se.store_id = p_store_id
      AND se.user_id = public.current_user_row_id()
  ) OR public.user_is_admin_or_operator();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_row_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_is_admin_or_operator() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_store_access(bigint) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.bia_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  center_lat numeric(10, 7) NOT NULL,
  center_lng numeric(10, 7) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (city_slug, code),
  UNIQUE (city_slug, name)
);

CREATE INDEX IF NOT EXISTS bia_registry_city_status_idx
  ON public.bia_registry (city_slug, status);

CREATE TABLE IF NOT EXISTS public.bia_pool_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bia_id uuid NOT NULL REFERENCES public.bia_registry(id) ON DELETE CASCADE,
  chain_id bigint NOT NULL,
  pool_address text NOT NULL,
  token_registry text,
  token_limiter text,
  quoter text,
  fee_address text,
  mapping_status text NOT NULL DEFAULT 'pending' CHECK (mapping_status IN ('active', 'inactive', 'pending')),
  validation_status text NOT NULL DEFAULT 'unknown' CHECK (validation_status IN ('unknown', 'valid', 'stale', 'mismatch')),
  validation_notes text,
  effective_from timestamptz NOT NULL DEFAULT timezone('utc', now()),
  effective_to timestamptz,
  created_by bigint REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS bia_pool_mappings_bia_chain_idx
  ON public.bia_pool_mappings (bia_id, chain_id);

CREATE UNIQUE INDEX IF NOT EXISTS bia_pool_mappings_active_bia_chain_uidx
  ON public.bia_pool_mappings (bia_id, chain_id)
  WHERE mapping_status = 'active' AND effective_to IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bia_pool_mappings_active_pool_uidx
  ON public.bia_pool_mappings (chain_id, lower(pool_address))
  WHERE mapping_status = 'active' AND effective_to IS NULL;

CREATE TABLE IF NOT EXISTS public.user_bia_affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_instance_id bigint NOT NULL REFERENCES public.ref_app_instances(id) ON DELETE CASCADE,
  bia_id uuid NOT NULL REFERENCES public.bia_registry(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('user_selected', 'suggested', 'admin_assigned', 'migrated')),
  confidence text,
  effective_from timestamptz NOT NULL DEFAULT timezone('utc', now()),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS user_bia_affiliations_active_uidx
  ON public.user_bia_affiliations (user_id, app_instance_id)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS user_bia_affiliations_bia_idx
  ON public.user_bia_affiliations (bia_id);

CREATE TABLE IF NOT EXISTS public.store_profiles (
  store_id bigint PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  display_name text,
  wallet_address text,
  address_text text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.store_bia_affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bia_id uuid NOT NULL REFERENCES public.bia_registry(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('merchant_selected', 'suggested', 'admin_assigned', 'migrated')),
  effective_from timestamptz NOT NULL DEFAULT timezone('utc', now()),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS store_bia_affiliations_active_uidx
  ON public.store_bia_affiliations (store_id)
  WHERE effective_to IS NULL;

CREATE TABLE IF NOT EXISTS public.pool_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_instance_id bigint REFERENCES public.ref_app_instances(id) ON DELETE SET NULL,
  bia_id uuid NOT NULL REFERENCES public.bia_registry(id) ON DELETE RESTRICT,
  chain_id bigint NOT NULL,
  pool_address text NOT NULL,
  token_address text,
  fiat_amount numeric(20, 6) NOT NULL DEFAULT 0,
  token_amount numeric(20, 6) NOT NULL DEFAULT 0,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'submitted', 'confirmed', 'failed', 'cancelled')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS pool_purchase_requests_user_idx
  ON public.pool_purchase_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pool_purchase_requests_bia_idx
  ON public.pool_purchase_requests (bia_id, status);

CREATE TABLE IF NOT EXISTS public.pool_redemption_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  requester_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  bia_id uuid NOT NULL REFERENCES public.bia_registry(id) ON DELETE RESTRICT,
  chain_id bigint NOT NULL,
  pool_address text NOT NULL,
  settlement_asset text NOT NULL DEFAULT 'CAD',
  token_amount numeric(20, 6) NOT NULL,
  settlement_amount numeric(20, 6),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'settled', 'failed')),
  approved_by bigint REFERENCES public.users(id),
  approved_at timestamptz,
  settled_by bigint REFERENCES public.users(id),
  settled_at timestamptz,
  tx_hash text,
  rejection_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS pool_redemption_requests_store_idx
  ON public.pool_redemption_requests (store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS pool_redemption_requests_bia_idx
  ON public.pool_redemption_requests (bia_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pool_redemption_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_request_id uuid NOT NULL REFERENCES public.pool_redemption_requests(id) ON DELETE CASCADE,
  settled_by bigint REFERENCES public.users(id),
  chain_id bigint,
  tx_hash text,
  settlement_amount numeric(20, 6),
  settlement_asset text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'confirmed', 'failed')),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS pool_redemption_settlements_request_idx
  ON public.pool_redemption_settlements (redemption_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bia_pool_controls (
  bia_id uuid PRIMARY KEY REFERENCES public.bia_registry(id) ON DELETE CASCADE,
  max_daily_redemption numeric(20, 6),
  max_tx_amount numeric(20, 6),
  queue_only_mode boolean NOT NULL DEFAULT false,
  is_frozen boolean NOT NULL DEFAULT false,
  updated_by bigint REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.store_risk_flags (
  store_id bigint PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  is_suspended boolean NOT NULL DEFAULT false,
  reason text,
  updated_by bigint REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.governance_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  city_slug text,
  bia_id uuid REFERENCES public.bia_registry(id) ON DELETE SET NULL,
  store_id bigint REFERENCES public.stores(id) ON DELETE SET NULL,
  actor_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS governance_actions_log_created_idx
  ON public.governance_actions_log (created_at DESC);

CREATE TABLE IF NOT EXISTS indexer.bia_event_rollups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope_key text NOT NULL,
  bia_id uuid NOT NULL,
  chain_id bigint NOT NULL,
  pool_address text NOT NULL,
  block_number bigint NOT NULL,
  transaction_type text NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  volume_in numeric NOT NULL DEFAULT 0,
  volume_out numeric NOT NULL DEFAULT 0,
  last_tx_hash text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (scope_key, bia_id, chain_id, pool_address, block_number, transaction_type)
);

CREATE INDEX IF NOT EXISTS bia_event_rollups_scope_block_idx
  ON indexer.bia_event_rollups (scope_key, block_number DESC);

CREATE TABLE IF NOT EXISTS indexer.bia_risk_signals (
  scope_key text NOT NULL,
  bia_id uuid NOT NULL,
  chain_id bigint NOT NULL,
  pending_redemption_count integer NOT NULL DEFAULT 0,
  pending_redemption_amount numeric NOT NULL DEFAULT 0,
  recent_swap_volume numeric NOT NULL DEFAULT 0,
  redemption_pressure numeric NOT NULL DEFAULT 0,
  concentration_score numeric NOT NULL DEFAULT 0,
  stress_level text NOT NULL DEFAULT 'low' CHECK (stress_level IN ('low', 'medium', 'high')),
  generated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (scope_key, bia_id, chain_id)
);

CREATE OR REPLACE VIEW public.v_bia_pool_health AS
WITH purchase AS (
  SELECT
    bia_id,
    COUNT(*) AS purchase_count,
    COALESCE(SUM(token_amount), 0)::numeric AS purchased_token_volume
  FROM public.pool_purchase_requests
  WHERE status IN ('submitted', 'confirmed')
  GROUP BY bia_id
),
redemption AS (
  SELECT
    bia_id,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_redemption_count,
    COALESCE(SUM(token_amount) FILTER (WHERE status = 'pending'), 0)::numeric AS pending_redemption_volume,
    COUNT(*) FILTER (WHERE status = 'settled') AS settled_redemption_count,
    COALESCE(SUM(token_amount) FILTER (WHERE status = 'settled'), 0)::numeric AS settled_redemption_volume
  FROM public.pool_redemption_requests
  GROUP BY bia_id
),
activity AS (
  SELECT
    bia_id,
    COALESCE(SUM(event_count), 0)::bigint AS indexed_events,
    COALESCE(SUM(volume_in), 0)::numeric AS indexed_volume_in,
    COALESCE(SUM(volume_out), 0)::numeric AS indexed_volume_out,
    MAX(block_number) AS last_indexed_block
  FROM indexer.bia_event_rollups
  GROUP BY bia_id
),
risk AS (
  SELECT
    bia_id,
    MAX(generated_at) AS generated_at,
    MAX(pending_redemption_count) AS pending_redemption_count_signal,
    MAX(pending_redemption_amount) AS pending_redemption_amount_signal,
    MAX(redemption_pressure) AS redemption_pressure,
    MAX(concentration_score) AS concentration_score,
    MAX(stress_level) AS stress_level
  FROM indexer.bia_risk_signals
  GROUP BY bia_id
)
SELECT
  b.id AS bia_id,
  b.city_slug,
  b.code,
  b.name,
  b.status,
  m.chain_id,
  m.pool_address,
  m.mapping_status,
  m.validation_status,
  COALESCE(p.purchase_count, 0) AS purchase_count,
  COALESCE(p.purchased_token_volume, 0) AS purchased_token_volume,
  COALESCE(r.pending_redemption_count, 0) AS pending_redemption_count,
  COALESCE(r.pending_redemption_volume, 0) AS pending_redemption_volume,
  COALESCE(r.settled_redemption_count, 0) AS settled_redemption_count,
  COALESCE(r.settled_redemption_volume, 0) AS settled_redemption_volume,
  COALESCE(a.indexed_events, 0) AS indexed_events,
  COALESCE(a.indexed_volume_in, 0) AS indexed_volume_in,
  COALESCE(a.indexed_volume_out, 0) AS indexed_volume_out,
  a.last_indexed_block,
  COALESCE(risk.redemption_pressure, 0) AS redemption_pressure,
  COALESCE(risk.concentration_score, 0) AS concentration_score,
  COALESCE(risk.stress_level, 'low') AS stress_level,
  risk.generated_at AS risk_generated_at
FROM public.bia_registry b
LEFT JOIN public.bia_pool_mappings m
  ON m.bia_id = b.id
 AND m.mapping_status = 'active'
 AND m.effective_to IS NULL
LEFT JOIN purchase p ON p.bia_id = b.id
LEFT JOIN redemption r ON r.bia_id = b.id
LEFT JOIN activity a ON a.bia_id = b.id
LEFT JOIN risk ON risk.bia_id = b.id;

CREATE OR REPLACE VIEW public.v_bia_activity_summary AS
WITH active_user_affiliation AS (
  SELECT bia_id, COUNT(*)::bigint AS active_users
  FROM public.user_bia_affiliations
  WHERE effective_to IS NULL
  GROUP BY bia_id
),
active_store_affiliation AS (
  SELECT sba.bia_id, COUNT(*)::bigint AS active_stores
  FROM public.store_bia_affiliations sba
  JOIN public.store_profiles sp ON sp.store_id = sba.store_id
  WHERE sba.effective_to IS NULL
    AND sp.status = 'active'
  GROUP BY sba.bia_id
),
indexer_activity AS (
  SELECT
    bia_id,
    COUNT(*)::bigint AS rollup_rows,
    COALESCE(SUM(event_count), 0)::bigint AS total_events,
    MAX(block_number) AS last_indexed_block
  FROM indexer.bia_event_rollups
  GROUP BY bia_id
)
SELECT
  b.id AS bia_id,
  b.city_slug,
  b.code,
  b.name,
  COALESCE(u.active_users, 0) AS active_users,
  COALESCE(s.active_stores, 0) AS active_stores,
  COALESCE(i.rollup_rows, 0) AS indexed_rollup_rows,
  COALESCE(i.total_events, 0) AS indexed_event_count,
  i.last_indexed_block
FROM public.bia_registry b
LEFT JOIN active_user_affiliation u ON u.bia_id = b.id
LEFT JOIN active_store_affiliation s ON s.bia_id = b.id
LEFT JOIN indexer_activity i ON i.bia_id = b.id;

GRANT SELECT ON public.v_bia_pool_health TO authenticated;
GRANT SELECT ON public.v_bia_activity_summary TO authenticated;

GRANT SELECT ON TABLE
  public.bia_registry,
  public.bia_pool_mappings,
  public.user_bia_affiliations,
  public.store_profiles,
  public.store_bia_affiliations,
  public.pool_purchase_requests,
  public.pool_redemption_requests,
  public.pool_redemption_settlements,
  public.bia_pool_controls,
  public.store_risk_flags,
  public.governance_actions_log
TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.bia_registry,
  public.bia_pool_mappings,
  public.user_bia_affiliations,
  public.store_profiles,
  public.store_bia_affiliations,
  public.pool_purchase_requests,
  public.pool_redemption_requests,
  public.pool_redemption_settlements,
  public.bia_pool_controls,
  public.store_risk_flags,
  public.governance_actions_log
FROM authenticated;

GRANT SELECT ON TABLE indexer.bia_event_rollups, indexer.bia_risk_signals TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE indexer.bia_event_rollups, indexer.bia_risk_signals FROM authenticated;

ALTER TABLE IF EXISTS public.bia_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bia_pool_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_bia_affiliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_bia_affiliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pool_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pool_redemption_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pool_redemption_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bia_pool_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.governance_actions_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bia_registry' AND policyname = 'bia_registry_read_authenticated'
  ) THEN
    CREATE POLICY bia_registry_read_authenticated
      ON public.bia_registry
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bia_pool_mappings' AND policyname = 'bia_pool_mappings_read_authenticated'
  ) THEN
    CREATE POLICY bia_pool_mappings_read_authenticated
      ON public.bia_pool_mappings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_bia_affiliations' AND policyname = 'user_bia_affiliations_read_own'
  ) THEN
    CREATE POLICY user_bia_affiliations_read_own
      ON public.user_bia_affiliations
      FOR SELECT
      TO authenticated
      USING (
        user_id = public.current_user_row_id() OR public.user_is_admin_or_operator()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'store_profiles' AND policyname = 'store_profiles_read_authenticated'
  ) THEN
    CREATE POLICY store_profiles_read_authenticated
      ON public.store_profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'store_bia_affiliations' AND policyname = 'store_bia_affiliations_read_authenticated'
  ) THEN
    CREATE POLICY store_bia_affiliations_read_authenticated
      ON public.store_bia_affiliations
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pool_purchase_requests' AND policyname = 'pool_purchase_requests_read_own'
  ) THEN
    CREATE POLICY pool_purchase_requests_read_own
      ON public.pool_purchase_requests
      FOR SELECT
      TO authenticated
      USING (
        user_id = public.current_user_row_id() OR public.user_is_admin_or_operator()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pool_redemption_requests' AND policyname = 'pool_redemption_requests_read_scope'
  ) THEN
    CREATE POLICY pool_redemption_requests_read_scope
      ON public.pool_redemption_requests
      FOR SELECT
      TO authenticated
      USING (
        requester_user_id = public.current_user_row_id()
        OR public.user_has_store_access(store_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pool_redemption_settlements' AND policyname = 'pool_redemption_settlements_read_scope'
  ) THEN
    CREATE POLICY pool_redemption_settlements_read_scope
      ON public.pool_redemption_settlements
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.pool_redemption_requests prr
          WHERE prr.id = redemption_request_id
            AND (
              prr.requester_user_id = public.current_user_row_id()
              OR public.user_has_store_access(prr.store_id)
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bia_pool_controls' AND policyname = 'bia_pool_controls_read_authenticated'
  ) THEN
    CREATE POLICY bia_pool_controls_read_authenticated
      ON public.bia_pool_controls
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'store_risk_flags' AND policyname = 'store_risk_flags_read_authenticated'
  ) THEN
    CREATE POLICY store_risk_flags_read_authenticated
      ON public.store_risk_flags
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'governance_actions_log' AND policyname = 'governance_actions_log_read_authenticated'
  ) THEN
    CREATE POLICY governance_actions_log_read_authenticated
      ON public.governance_actions_log
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

COMMIT;
