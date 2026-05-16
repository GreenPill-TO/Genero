BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.onramp_deposit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_instance_id bigint NOT NULL REFERENCES public.ref_app_instances(id) ON DELETE CASCADE,
  city_slug text NOT NULL DEFAULT 'tcoin',
  chain_id bigint NOT NULL DEFAULT 42220,
  address text NOT NULL,
  derivation_index bigint NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS onramp_deposit_wallets_user_app_chain_uidx
  ON public.onramp_deposit_wallets (user_id, app_instance_id, chain_id);

CREATE UNIQUE INDEX IF NOT EXISTS onramp_deposit_wallets_chain_addr_uidx
  ON public.onramp_deposit_wallets (chain_id, lower(address));

CREATE TABLE IF NOT EXISTS public.onramp_checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_instance_id bigint NOT NULL REFERENCES public.ref_app_instances(id) ON DELETE CASCADE,
  city_slug text NOT NULL,
  provider text NOT NULL,
  provider_session_id text,
  provider_order_id text,
  fiat_currency text NOT NULL,
  fiat_amount numeric NOT NULL,
  country_code text,
  target_chain_id bigint NOT NULL DEFAULT 42220,
  target_input_asset text NOT NULL DEFAULT 'USDC',
  final_asset text NOT NULL DEFAULT 'TCOIN',
  deposit_address text NOT NULL,
  recipient_wallet text NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (
    status IN (
      'created',
      'widget_opened',
      'payment_submitted',
      'crypto_sent',
      'usdc_received',
      'mint_started',
      'mint_complete',
      'failed',
      'manual_review'
    )
  ),
  status_reason text,
  incoming_usdc_tx_hash text,
  mint_tx_hash text,
  tcoin_delivery_tx_hash text,
  usdc_received_amount numeric,
  tcoin_out_amount numeric,
  requested_charity_id bigint,
  quote_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS onramp_checkout_sessions_user_idx
  ON public.onramp_checkout_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS onramp_checkout_sessions_status_idx
  ON public.onramp_checkout_sessions (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS onramp_checkout_sessions_provider_idx
  ON public.onramp_checkout_sessions (provider, provider_order_id);

CREATE TABLE IF NOT EXISTS public.onramp_settlement_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.onramp_checkout_sessions(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL,
  mode text NOT NULL CHECK (mode IN ('auto', 'manual_operator')),
  state text NOT NULL CHECK (state IN ('started', 'succeeded', 'failed')),
  error_message text,
  router_address text,
  router_call_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  min_cadm_out numeric,
  min_tcoin_out numeric,
  deadline_unix bigint,
  mint_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (session_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS onramp_settlement_attempts_session_idx
  ON public.onramp_settlement_attempts (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.onramp_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.onramp_checkout_sessions(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_event_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS onramp_provider_events_uidx
  ON public.onramp_provider_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL AND provider_event_id <> '';

CREATE INDEX IF NOT EXISTS onramp_provider_events_session_idx
  ON public.onramp_provider_events (session_id, received_at DESC);

CREATE TABLE IF NOT EXISTS public.onramp_operation_locks (
  session_id uuid PRIMARY KEY REFERENCES public.onramp_checkout_sessions(id) ON DELETE CASCADE,
  lock_owner text NOT NULL,
  lock_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION public.onramp_try_acquire_lock(
  p_session_id uuid,
  p_lock_owner text,
  p_ttl_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
BEGIN
  INSERT INTO public.onramp_operation_locks (
    session_id,
    lock_owner,
    lock_expires_at,
    created_at,
    updated_at
  )
  VALUES (
    p_session_id,
    p_lock_owner,
    v_now + make_interval(secs => GREATEST(1, p_ttl_seconds)),
    v_now,
    v_now
  )
  ON CONFLICT (session_id)
  DO UPDATE
    SET lock_owner = EXCLUDED.lock_owner,
        lock_expires_at = EXCLUDED.lock_expires_at,
        updated_at = EXCLUDED.updated_at
  WHERE public.onramp_operation_locks.lock_expires_at <= v_now
     OR public.onramp_operation_locks.lock_owner = p_lock_owner;

  RETURN EXISTS (
    SELECT 1
    FROM public.onramp_operation_locks
    WHERE session_id = p_session_id
      AND lock_owner = p_lock_owner
      AND lock_expires_at > v_now
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.onramp_release_lock(
  p_session_id uuid,
  p_lock_owner text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.onramp_operation_locks
  WHERE session_id = p_session_id
    AND lock_owner = p_lock_owner;
END;
$$;

REVOKE ALL ON FUNCTION public.onramp_try_acquire_lock(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.onramp_release_lock(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onramp_try_acquire_lock(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.onramp_release_lock(uuid, text) TO service_role;

CREATE OR REPLACE VIEW public.v_onramp_checkout_admin AS
SELECT
  s.id,
  s.user_id,
  s.app_instance_id,
  s.city_slug,
  s.provider,
  s.provider_session_id,
  s.provider_order_id,
  s.fiat_currency,
  s.fiat_amount,
  s.country_code,
  s.target_chain_id,
  s.target_input_asset,
  s.final_asset,
  s.deposit_address,
  s.recipient_wallet,
  s.status,
  s.status_reason,
  s.incoming_usdc_tx_hash,
  s.mint_tx_hash,
  s.tcoin_delivery_tx_hash,
  s.usdc_received_amount,
  s.tcoin_out_amount,
  s.requested_charity_id,
  s.quote_payload,
  s.metadata,
  s.created_at,
  s.updated_at,
  a.attempt_no AS latest_attempt_no,
  a.mode AS latest_attempt_mode,
  a.state AS latest_attempt_state,
  a.error_message AS latest_attempt_error,
  a.mint_tx_hash AS latest_attempt_mint_tx_hash,
  a.created_at AS latest_attempt_created_at,
  e.event_type AS latest_event_type,
  e.provider_event_id AS latest_provider_event_id,
  e.signature_valid AS latest_event_signature_valid,
  e.received_at AS latest_event_received_at
FROM public.onramp_checkout_sessions s
LEFT JOIN LATERAL (
  SELECT *
  FROM public.onramp_settlement_attempts a
  WHERE a.session_id = s.id
  ORDER BY a.created_at DESC
  LIMIT 1
) a ON true
LEFT JOIN LATERAL (
  SELECT *
  FROM public.onramp_provider_events e
  WHERE e.session_id = s.id
  ORDER BY e.received_at DESC
  LIMIT 1
) e ON true;

GRANT SELECT ON TABLE
  public.onramp_deposit_wallets,
  public.onramp_checkout_sessions
TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.onramp_deposit_wallets,
  public.onramp_checkout_sessions,
  public.onramp_settlement_attempts,
  public.onramp_provider_events,
  public.onramp_operation_locks
FROM authenticated;

GRANT SELECT ON TABLE
  public.onramp_settlement_attempts,
  public.onramp_provider_events,
  public.v_onramp_checkout_admin
TO authenticated;

ALTER TABLE IF EXISTS public.onramp_deposit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.onramp_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.onramp_settlement_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.onramp_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.onramp_operation_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'onramp_deposit_wallets' AND policyname = 'onramp_deposit_wallets_read_scope'
  ) THEN
    CREATE POLICY onramp_deposit_wallets_read_scope
      ON public.onramp_deposit_wallets
      FOR SELECT
      TO authenticated
      USING (
        user_id = public.current_user_row_id() OR public.user_is_admin_or_operator()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'onramp_checkout_sessions' AND policyname = 'onramp_checkout_sessions_read_scope'
  ) THEN
    CREATE POLICY onramp_checkout_sessions_read_scope
      ON public.onramp_checkout_sessions
      FOR SELECT
      TO authenticated
      USING (
        user_id = public.current_user_row_id() OR public.user_is_admin_or_operator()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'onramp_settlement_attempts' AND policyname = 'onramp_settlement_attempts_read_admin'
  ) THEN
    CREATE POLICY onramp_settlement_attempts_read_admin
      ON public.onramp_settlement_attempts
      FOR SELECT
      TO authenticated
      USING (
        public.user_is_admin_or_operator() OR EXISTS (
          SELECT 1
          FROM public.onramp_checkout_sessions s
          WHERE s.id = onramp_settlement_attempts.session_id
            AND s.user_id = public.current_user_row_id()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'onramp_provider_events' AND policyname = 'onramp_provider_events_read_admin'
  ) THEN
    CREATE POLICY onramp_provider_events_read_admin
      ON public.onramp_provider_events
      FOR SELECT
      TO authenticated
      USING (
        public.user_is_admin_or_operator() OR EXISTS (
          SELECT 1
          FROM public.onramp_checkout_sessions s
          WHERE s.id = onramp_provider_events.session_id
            AND s.user_id = public.current_user_row_id()
        )
      );
  END IF;
END $$;

COMMIT;
