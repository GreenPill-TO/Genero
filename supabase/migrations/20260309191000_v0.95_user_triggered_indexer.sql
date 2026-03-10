-- v0.95: user-triggered Genero contract indexer (city overlap + cooldown)

CREATE SCHEMA IF NOT EXISTS indexer;
CREATE SCHEMA IF NOT EXISTS chain_data;

-- ---------------------------------------------------------------------------
-- Indexer control-plane tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS indexer.run_control (
  scope_key text PRIMARY KEY,
  city_slug text NOT NULL,
  chain_id bigint NOT NULL,
  last_started_at timestamptz NULL,
  last_completed_at timestamptz NULL,
  last_status text NOT NULL DEFAULT 'idle' CHECK (last_status IN ('idle', 'running', 'success', 'error', 'skipped')),
  last_error text NULL,
  next_eligible_start_at timestamptz NULL,
  next_eligible_complete_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS run_control_city_chain_idx
  ON indexer.run_control (city_slug, chain_id);

CREATE TABLE IF NOT EXISTS indexer.checkpoints (
  scope_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('tracker', 'rpc')),
  last_block bigint NOT NULL DEFAULT 0,
  last_tx_hash text NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (scope_key, source)
);

CREATE TABLE IF NOT EXISTS indexer.pool_links (
  city_slug text NOT NULL,
  city_version bigint NOT NULL,
  chain_id bigint NOT NULL,
  pool_address text NOT NULL,
  token_registry text NULL,
  token_limiter text NULL,
  quoter text NULL,
  owner_address text NULL,
  fee_address text NULL,
  is_active boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (city_slug, chain_id, pool_address)
);

CREATE INDEX IF NOT EXISTS pool_links_active_idx
  ON indexer.pool_links (city_slug, chain_id, is_active);

CREATE TABLE IF NOT EXISTS indexer.pool_tokens (
  pool_address text NOT NULL,
  token_address text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (pool_address, token_address)
);

CREATE TABLE IF NOT EXISTS indexer.raw_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('tracker', 'rpc')),
  chain_id bigint NOT NULL,
  block_number bigint NOT NULL,
  tx_hash text NOT NULL,
  log_index integer NOT NULL DEFAULT 0,
  contract_address text NOT NULL,
  transaction_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text NOT NULL,
  indexed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (fingerprint)
);

CREATE INDEX IF NOT EXISTS raw_events_scope_block_idx
  ON indexer.raw_events (scope_key, block_number DESC);

-- Fallback source of active contracts before city registry bootstrap is configured
CREATE TABLE IF NOT EXISTS indexer.city_contract_overrides (
  city_slug text NOT NULL,
  chain_id bigint NOT NULL,
  city_version bigint NOT NULL DEFAULT 1,
  tcoin_address text NOT NULL,
  ttc_address text NULL,
  cad_address text NULL,
  orchestrator_address text NULL,
  voting_address text NULL,
  metadata_uri text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (city_slug, chain_id)
);

-- ---------------------------------------------------------------------------
-- Chain data tables (Sarafu-compatible baseline)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chain_data.tx (
  chain_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  date_block timestamptz NOT NULL,
  success boolean NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (chain_id, tx_hash)
);

CREATE INDEX IF NOT EXISTS chain_data_tx_block_idx
  ON chain_data.tx (chain_id, block_number DESC);

CREATE TABLE IF NOT EXISTS chain_data.token_transfer (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  log_index integer NOT NULL DEFAULT 0,
  sender_address text NOT NULL,
  recipient_address text NOT NULL,
  contract_address text NOT NULL,
  transfer_value numeric NOT NULL,
  UNIQUE (chain_id, tx_hash, log_index, contract_address, sender_address, recipient_address, transfer_value)
);

CREATE TABLE IF NOT EXISTS chain_data.token_mint (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  log_index integer NOT NULL DEFAULT 0,
  minter_address text NOT NULL,
  recipient_address text NOT NULL,
  contract_address text NOT NULL,
  mint_value numeric NOT NULL,
  UNIQUE (chain_id, tx_hash, log_index, contract_address, minter_address, recipient_address, mint_value)
);

CREATE TABLE IF NOT EXISTS chain_data.token_burn (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  log_index integer NOT NULL DEFAULT 0,
  burner_address text NOT NULL,
  contract_address text NOT NULL,
  burn_value numeric NOT NULL,
  UNIQUE (chain_id, tx_hash, log_index, contract_address, burner_address, burn_value)
);

CREATE TABLE IF NOT EXISTS chain_data.pool_swap (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  log_index integer NOT NULL DEFAULT 0,
  initiator_address text NOT NULL,
  token_in_address text NOT NULL,
  token_out_address text NOT NULL,
  in_value numeric NOT NULL,
  out_value numeric NOT NULL,
  contract_address text NOT NULL,
  fee numeric NOT NULL,
  UNIQUE (chain_id, tx_hash, log_index, contract_address, initiator_address, token_in_address, token_out_address, in_value, out_value, fee)
);

CREATE TABLE IF NOT EXISTS chain_data.pool_deposit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  log_index integer NOT NULL DEFAULT 0,
  initiator_address text NOT NULL,
  token_in_address text NOT NULL,
  in_value numeric NOT NULL,
  contract_address text NOT NULL,
  UNIQUE (chain_id, tx_hash, log_index, contract_address, initiator_address, token_in_address, in_value)
);

CREATE TABLE IF NOT EXISTS chain_data.ownership_change (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id bigint NOT NULL,
  tx_hash text NOT NULL,
  block_number bigint NOT NULL,
  log_index integer NOT NULL DEFAULT 0,
  previous_owner text NOT NULL,
  new_owner text NOT NULL,
  contract_address text NOT NULL,
  UNIQUE (chain_id, tx_hash, log_index, contract_address, previous_owner, new_owner)
);

CREATE TABLE IF NOT EXISTS chain_data.tokens (
  chain_id bigint NOT NULL,
  contract_address text NOT NULL,
  token_name text NULL,
  token_symbol text NULL,
  token_decimals integer NULL,
  sink_address text NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (chain_id, contract_address)
);

CREATE TABLE IF NOT EXISTS chain_data.pools (
  chain_id bigint NOT NULL,
  contract_address text NOT NULL,
  pool_name text NULL,
  pool_symbol text NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (chain_id, contract_address)
);

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA indexer TO authenticated;
GRANT USAGE ON SCHEMA chain_data TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA indexer TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA chain_data TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA indexer TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA chain_data TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA indexer GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA indexer GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA chain_data GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA chain_data GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER TABLE IF EXISTS indexer.run_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS indexer.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS indexer.pool_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS indexer.pool_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS indexer.raw_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS indexer.city_contract_overrides ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS chain_data.tx ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chain_data.token_transfer ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chain_data.token_mint ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chain_data.token_burn ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chain_data.pool_swap ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chain_data.pool_deposit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chain_data.ownership_change ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chain_data.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chain_data.pools ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'indexer'
      AND tablename = 'run_control'
      AND policyname = 'indexer_run_control_rw_authenticated'
  ) THEN
    CREATE POLICY indexer_run_control_rw_authenticated
      ON indexer.run_control
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'indexer'
      AND tablename = 'checkpoints'
      AND policyname = 'indexer_checkpoints_rw_authenticated'
  ) THEN
    CREATE POLICY indexer_checkpoints_rw_authenticated
      ON indexer.checkpoints
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'indexer'
      AND tablename = 'pool_links'
      AND policyname = 'indexer_pool_links_rw_authenticated'
  ) THEN
    CREATE POLICY indexer_pool_links_rw_authenticated
      ON indexer.pool_links
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'indexer'
      AND tablename = 'pool_tokens'
      AND policyname = 'indexer_pool_tokens_rw_authenticated'
  ) THEN
    CREATE POLICY indexer_pool_tokens_rw_authenticated
      ON indexer.pool_tokens
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'indexer'
      AND tablename = 'raw_events'
      AND policyname = 'indexer_raw_events_rw_authenticated'
  ) THEN
    CREATE POLICY indexer_raw_events_rw_authenticated
      ON indexer.raw_events
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'indexer'
      AND tablename = 'city_contract_overrides'
      AND policyname = 'indexer_city_contract_overrides_rw_authenticated'
  ) THEN
    CREATE POLICY indexer_city_contract_overrides_rw_authenticated
      ON indexer.city_contract_overrides
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'tx'
      AND policyname = 'chain_data_tx_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_tx_rw_authenticated
      ON chain_data.tx
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'token_transfer'
      AND policyname = 'chain_data_token_transfer_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_token_transfer_rw_authenticated
      ON chain_data.token_transfer
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'token_mint'
      AND policyname = 'chain_data_token_mint_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_token_mint_rw_authenticated
      ON chain_data.token_mint
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'token_burn'
      AND policyname = 'chain_data_token_burn_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_token_burn_rw_authenticated
      ON chain_data.token_burn
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'pool_swap'
      AND policyname = 'chain_data_pool_swap_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_pool_swap_rw_authenticated
      ON chain_data.pool_swap
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'pool_deposit'
      AND policyname = 'chain_data_pool_deposit_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_pool_deposit_rw_authenticated
      ON chain_data.pool_deposit
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'ownership_change'
      AND policyname = 'chain_data_ownership_change_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_ownership_change_rw_authenticated
      ON chain_data.ownership_change
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'tokens'
      AND policyname = 'chain_data_tokens_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_tokens_rw_authenticated
      ON chain_data.tokens
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'chain_data'
      AND tablename = 'pools'
      AND policyname = 'chain_data_pools_rw_authenticated'
  ) THEN
    CREATE POLICY chain_data_pools_rw_authenticated
      ON chain_data.pools
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Atomic run lifecycle helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.indexer_try_start_run(
  p_scope_key text,
  p_city_slug text,
  p_chain_id bigint,
  p_now timestamptz DEFAULT timezone('utc', now()),
  p_cooldown_seconds integer DEFAULT 300
)
RETURNS TABLE (
  started boolean,
  skipped boolean,
  reason text,
  next_eligible_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, indexer
AS $$
DECLARE
  v_run indexer.run_control%ROWTYPE;
  v_cooldown interval;
  v_next_start timestamptz;
  v_next_complete timestamptz;
  v_start_ready boolean;
  v_complete_ready boolean;
BEGIN
  v_cooldown := make_interval(secs => GREATEST(p_cooldown_seconds, 1));

  IF p_scope_key IS NULL OR length(trim(p_scope_key)) = 0 THEN
    RAISE EXCEPTION 'scope key is required';
  END IF;

  IF p_city_slug IS NULL OR length(trim(p_city_slug)) = 0 THEN
    RAISE EXCEPTION 'city slug is required';
  END IF;

  IF p_chain_id <= 0 THEN
    RAISE EXCEPTION 'chain id must be positive';
  END IF;

  -- Per-scope lock to avoid concurrent starts from burst touches.
  IF NOT pg_try_advisory_xact_lock(hashtext(p_scope_key)) THEN
    RETURN QUERY SELECT false, true, 'locked'::text, p_now + v_cooldown;
    RETURN;
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
    p_scope_key,
    lower(trim(p_city_slug)),
    p_chain_id,
    'idle',
    p_now,
    p_now
  )
  ON CONFLICT (scope_key) DO NOTHING;

  SELECT *
  INTO v_run
  FROM indexer.run_control
  WHERE scope_key = p_scope_key
  FOR UPDATE;

  v_next_start := COALESCE(v_run.last_started_at + v_cooldown, p_now - v_cooldown);
  v_next_complete := COALESCE(v_run.last_completed_at + v_cooldown, p_now - v_cooldown);

  v_start_ready := p_now >= v_next_start;
  v_complete_ready := p_now >= v_next_complete;

  IF NOT v_start_ready OR NOT v_complete_ready THEN
    RETURN QUERY
    SELECT
      false,
      true,
      CASE
        WHEN NOT v_start_ready AND NOT v_complete_ready THEN 'start_and_complete_cooldown'
        WHEN NOT v_start_ready THEN 'start_cooldown'
        ELSE 'complete_cooldown'
      END,
      GREATEST(v_next_start, v_next_complete);
    RETURN;
  END IF;

  UPDATE indexer.run_control
  SET
    city_slug = lower(trim(p_city_slug)),
    chain_id = p_chain_id,
    last_started_at = p_now,
    last_status = 'running',
    last_error = NULL,
    next_eligible_start_at = p_now + v_cooldown,
    updated_at = p_now
  WHERE scope_key = p_scope_key;

  RETURN QUERY SELECT true, false, NULL::text, NULL::timestamptz;
END;
$$;

CREATE OR REPLACE FUNCTION public.indexer_complete_run(
  p_scope_key text,
  p_status text,
  p_error text DEFAULT NULL,
  p_now timestamptz DEFAULT timezone('utc', now()),
  p_cooldown_seconds integer DEFAULT 300
)
RETURNS indexer.run_control
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, indexer
AS $$
DECLARE
  v_cooldown interval;
  v_row indexer.run_control%ROWTYPE;
BEGIN
  v_cooldown := make_interval(secs => GREATEST(p_cooldown_seconds, 1));

  IF p_scope_key IS NULL OR length(trim(p_scope_key)) = 0 THEN
    RAISE EXCEPTION 'scope key is required';
  END IF;

  IF p_status NOT IN ('success', 'error', 'skipped') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  UPDATE indexer.run_control
  SET
    last_status = p_status,
    last_error = p_error,
    last_completed_at = CASE WHEN p_status = 'success' THEN p_now ELSE last_completed_at END,
    next_eligible_complete_at = CASE WHEN p_status = 'success' THEN p_now + v_cooldown ELSE next_eligible_complete_at END,
    updated_at = p_now
  WHERE scope_key = p_scope_key
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run control record not found for scope %', p_scope_key;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.indexer_try_start_run(text, text, bigint, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.indexer_complete_run(text, text, text, timestamptz, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed first known city override (Celo tcoin)
-- ---------------------------------------------------------------------------

INSERT INTO indexer.city_contract_overrides (
  city_slug,
  chain_id,
  city_version,
  tcoin_address,
  metadata_uri
)
VALUES (
  'tcoin',
  42220,
  1,
  '0x298a698031e2fd7d8f0c830f3fd887601b40058c',
  'https://sarafu.network/pools/0xA6f024Ad53766d332057d5e40215b695522ee3dE'
)
ON CONFLICT (city_slug, chain_id) DO NOTHING;
