-- v1.20: scoped Edge Function read/write RPCs

BEGIN;

CREATE OR REPLACE FUNCTION public.edge_resolve_current_user_v1()
RETURNS TABLE (
  id bigint,
  email text,
  auth_user_id text,
  cubid_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_auth_user_id text := auth.uid()::text;
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_phone text := nullif(regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '\s+', '', 'g'), '');
  v_history_user_id bigint;
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.auth_user_id, u.cubid_id
  FROM public.users u
  WHERE u.auth_user_id = v_auth_user_id
  ORDER BY u.id ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT e.user_id
      INTO v_history_user_id
    FROM public.user_email_addresses e
    WHERE e.email = v_email
      AND e.deleted_at IS NULL
    ORDER BY e.id ASC
    LIMIT 1;

    IF v_history_user_id IS NOT NULL THEN
      RETURN QUERY
      SELECT u.id, u.email, u.auth_user_id, u.cubid_id
      FROM public.users u
      WHERE u.id = v_history_user_id
      ORDER BY u.id ASC
      LIMIT 1;

      IF FOUND THEN
        RETURN;
      END IF;
    END IF;

    RETURN QUERY
    SELECT u.id, u.email, u.auth_user_id, u.cubid_id
    FROM public.users u
    WHERE lower(u.email) = v_email
    ORDER BY u.id ASC
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT p.user_id
      INTO v_history_user_id
    FROM public.user_phone_addresses p
    WHERE regexp_replace(coalesce(p.phone, ''), '\s+', '', 'g') = v_phone
      AND p.deleted_at IS NULL
    ORDER BY p.id ASC
    LIMIT 1;

    IF v_history_user_id IS NOT NULL THEN
      RETURN QUERY
      SELECT u.id, u.email, u.auth_user_id, u.cubid_id
      FROM public.users u
      WHERE u.id = v_history_user_id
      ORDER BY u.id ASC
      LIMIT 1;

      IF FOUND THEN
        RETURN;
      END IF;
    END IF;

    RETURN QUERY
    SELECT u.id, u.email, u.auth_user_id, u.cubid_id
    FROM public.users u
    WHERE regexp_replace(coalesce(u.phone, ''), '\s+', '', 'g') = v_phone
    ORDER BY u.id ASC
    LIMIT 1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.edge_resolve_app_context_v1(
  p_app_slug text DEFAULT 'wallet',
  p_city_slug text DEFAULT 'tcoin',
  p_environment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_app_slug text := lower(btrim(coalesce(p_app_slug, 'wallet')));
  v_city_slug text := lower(btrim(coalesce(p_city_slug, 'tcoin')));
  v_environment text := lower(btrim(coalesce(p_environment, '')));
  v_row record;
  v_count integer;
BEGIN
  IF v_environment <> '' THEN
    SELECT i.id, i.environment
      INTO v_row
    FROM public.ref_app_instances i
    JOIN public.ref_apps a ON a.id = i.app_id
    JOIN public.ref_citycoins c ON c.id = i.citycoin_id
    WHERE a.slug = v_app_slug
      AND c.slug = v_city_slug
      AND lower(coalesce(i.environment, '')) = v_environment
    LIMIT 1;
  ELSE
    SELECT COUNT(*)
      INTO v_count
    FROM public.ref_app_instances i
    JOIN public.ref_apps a ON a.id = i.app_id
    JOIN public.ref_citycoins c ON c.id = i.citycoin_id
    WHERE a.slug = v_app_slug
      AND c.slug = v_city_slug;

    IF v_count > 1 THEN
      RAISE EXCEPTION 'Multiple app instances found for app=% city=%. Specify environment explicitly.', v_app_slug, v_city_slug
        USING ERRCODE = '22023';
    END IF;

    SELECT i.id, i.environment
      INTO v_row
    FROM public.ref_app_instances i
    JOIN public.ref_apps a ON a.id = i.app_id
    JOIN public.ref_citycoins c ON c.id = i.citycoin_id
    WHERE a.slug = v_app_slug
      AND c.slug = v_city_slug
    ORDER BY i.environment ASC
    LIMIT 1;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No app instance found for app=% city=% environment=%.', v_app_slug, v_city_slug, nullif(v_environment, '')
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'appSlug', v_app_slug,
    'citySlug', v_city_slug,
    'environment', lower(coalesce(v_row.environment, v_environment)),
    'appInstanceId', v_row.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.edge_user_is_admin_or_operator_v1(p_app_instance_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    JOIN public.edge_resolve_current_user_v1() u ON u.id = r.user_id
    WHERE lower(r.role) IN ('admin', 'operator')
      AND (
        p_app_instance_id IS NULL
        OR r.app_instance_id = p_app_instance_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.edge_list_voucher_preferences_v1(
  p_app_slug text DEFAULT 'wallet',
  p_city_slug text DEFAULT 'tcoin',
  p_environment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user record;
  v_context jsonb;
  v_app_instance_id bigint;
  v_city_slug text;
  v_preferences jsonb;
BEGIN
  SELECT * INTO v_user FROM public.edge_resolve_current_user_v1() LIMIT 1;
  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  v_context := public.edge_resolve_app_context_v1(p_app_slug, p_city_slug, p_environment);
  v_app_instance_id := (v_context ->> 'appInstanceId')::bigint;
  v_city_slug := v_context ->> 'citySlug';

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.updated_at DESC), '[]'::jsonb)
    INTO v_preferences
  FROM (
    SELECT
      id,
      city_slug,
      merchant_store_id,
      token_address,
      trust_status,
      created_at,
      updated_at
    FROM public.user_voucher_preferences
    WHERE user_id = v_user.id
      AND app_instance_id = v_app_instance_id
      AND city_slug = v_city_slug
    ORDER BY updated_at DESC
  ) p;

  RETURN jsonb_build_object(
    'citySlug', v_city_slug,
    'appInstanceId', v_app_instance_id,
    'preferences', v_preferences
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.edge_upsert_voucher_preference_v1(
  p_app_slug text DEFAULT 'wallet',
  p_city_slug text DEFAULT 'tcoin',
  p_environment text DEFAULT NULL,
  p_merchant_store_id bigint DEFAULT NULL,
  p_token_address text DEFAULT NULL,
  p_trust_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_context jsonb;
  v_app_instance_id bigint;
  v_city_slug text;
  v_token_address text := nullif(btrim(coalesce(p_token_address, '')), '');
  v_trust_status text := lower(btrim(coalesce(p_trust_status, '')));
  v_existing_id bigint;
  v_row public.user_voucher_preferences%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM public.edge_resolve_current_user_v1() LIMIT 1;
  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF v_trust_status NOT IN ('trusted', 'blocked', 'default') THEN
    RAISE EXCEPTION 'trustStatus must be trusted, blocked, or default.' USING ERRCODE = '22023';
  END IF;

  v_context := public.edge_resolve_app_context_v1(p_app_slug, p_city_slug, p_environment);
  v_app_instance_id := (v_context ->> 'appInstanceId')::bigint;
  v_city_slug := v_context ->> 'citySlug';

  SELECT id
    INTO v_existing_id
  FROM public.user_voucher_preferences
  WHERE user_id = v_user.id
    AND app_instance_id = v_app_instance_id
    AND city_slug = v_city_slug
    AND (
      (p_merchant_store_id IS NULL AND merchant_store_id IS NULL)
      OR merchant_store_id = p_merchant_store_id
    )
    AND (
      (v_token_address IS NULL AND token_address IS NULL)
      OR lower(token_address) = lower(v_token_address)
    )
  ORDER BY id ASC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.user_voucher_preferences
    SET trust_status = v_trust_status,
        updated_at = timezone('utc', now())
    WHERE id = v_existing_id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.user_voucher_preferences (
      user_id,
      app_instance_id,
      city_slug,
      merchant_store_id,
      token_address,
      trust_status,
      created_at,
      updated_at
    )
    VALUES (
      v_user.id,
      v_app_instance_id,
      v_city_slug,
      p_merchant_store_id,
      v_token_address,
      v_trust_status,
      timezone('utc', now()),
      timezone('utc', now())
    )
    RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.governance_actions_log (
    action_type,
    city_slug,
    actor_user_id,
    reason,
    payload
  )
  VALUES (
    'voucher_preference_updated',
    v_city_slug,
    v_user.id,
    'User updated voucher routing preferences',
    jsonb_build_object(
      'appInstanceId', v_app_instance_id,
      'merchantStoreId', p_merchant_store_id,
      'tokenAddress', v_token_address,
      'trustStatus', v_trust_status
    )
  );

  RETURN jsonb_build_object('preference', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.edge_bia_list_v1(
  p_app_slug text DEFAULT 'wallet',
  p_city_slug text DEFAULT 'tcoin',
  p_environment text DEFAULT NULL,
  p_include_mappings boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user record;
  v_context jsonb;
  v_app_instance_id bigint;
  v_city_slug text;
  v_can_administer boolean;
  v_bias jsonb;
  v_active jsonb;
  v_secondaries jsonb;
  v_mappings jsonb := '[]'::jsonb;
  v_controls jsonb := '[]'::jsonb;
  v_mappings_state text := 'empty';
BEGIN
  SELECT * INTO v_user FROM public.edge_resolve_current_user_v1() LIMIT 1;
  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  v_context := public.edge_resolve_app_context_v1(p_app_slug, p_city_slug, p_environment);
  v_app_instance_id := (v_context ->> 'appInstanceId')::bigint;
  v_city_slug := v_context ->> 'citySlug';
  v_can_administer := public.edge_user_is_admin_or_operator_v1(v_app_instance_id);

  SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.name ASC), '[]'::jsonb)
    INTO v_bias
  FROM public.bia_registry b
  WHERE b.city_slug = v_city_slug;

  SELECT to_jsonb(a)
    INTO v_active
  FROM (
    SELECT id, bia_id AS "biaId", source, effective_from AS "effectiveFrom"
    FROM public.user_bia_affiliations
    WHERE user_id = v_user.id
      AND app_instance_id = v_app_instance_id
      AND effective_to IS NULL
    LIMIT 1
  ) a;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s."effectiveFrom" ASC), '[]'::jsonb)
    INTO v_secondaries
  FROM (
    SELECT id, bia_id AS "biaId", source, effective_from AS "effectiveFrom"
    FROM public.user_bia_secondary_affiliations
    WHERE user_id = v_user.id
      AND app_instance_id = v_app_instance_id
      AND effective_to IS NULL
    ORDER BY effective_from ASC
  ) s;

  IF p_include_mappings AND v_can_administer THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.updated_at DESC), '[]'::jsonb)
      INTO v_mappings
    FROM public.v_bia_mappings_v1 m
    WHERE m.city_slug = v_city_slug;

    SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      INTO v_controls
    FROM public.bia_pool_controls c;

    v_mappings_state := CASE WHEN jsonb_array_length(v_mappings) = 0 THEN 'empty' ELSE 'ready' END;
  END IF;

  RETURN jsonb_build_object(
    'citySlug', v_city_slug,
    'appInstanceId', v_app_instance_id,
    'activeAffiliation', v_active,
    'secondaryAffiliations', v_secondaries,
    'bias', v_bias,
    'mappingsState', v_mappings_state,
    'mappingsSetupMessage', NULL,
    'mappings', v_mappings,
    'controls', v_controls,
    'canAdminister', v_can_administer
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.edge_bia_mappings_v1(
  p_app_slug text DEFAULT 'wallet',
  p_city_slug text DEFAULT 'tcoin',
  p_environment text DEFAULT NULL,
  p_chain_id bigint DEFAULT 42220,
  p_include_health boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user record;
  v_context jsonb;
  v_app_instance_id bigint;
  v_city_slug text;
  v_chain_id bigint := GREATEST(1, COALESCE(p_chain_id, 42220));
  v_can_administer boolean;
  v_mappings jsonb;
  v_health_row record;
  v_health jsonb := NULL;
  v_state text;
BEGIN
  SELECT * INTO v_user FROM public.edge_resolve_current_user_v1() LIMIT 1;
  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  v_context := public.edge_resolve_app_context_v1(p_app_slug, p_city_slug, p_environment);
  v_app_instance_id := (v_context ->> 'appInstanceId')::bigint;
  v_city_slug := v_context ->> 'citySlug';
  v_can_administer := public.edge_user_is_admin_or_operator_v1(v_app_instance_id);

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.updated_at DESC), '[]'::jsonb)
    INTO v_mappings
  FROM public.v_bia_mappings_v1 m
  WHERE m.city_slug = v_city_slug
    AND m.chain_id = v_chain_id;

  v_state := CASE WHEN jsonb_array_length(v_mappings) = 0 THEN 'empty' ELSE 'ready' END;

  IF p_include_health THEN
    SELECT *
      INTO v_health_row
    FROM public.v_bia_mapping_health_v1 h
    WHERE h.city_slug = v_city_slug
      AND h.chain_id = v_chain_id
    LIMIT 1;

    v_health := jsonb_build_object(
      'mappedPools', COALESCE(v_health_row.mapped_pools, 0),
      'discoveredPools', COALESCE(v_health_row.discovered_pools, 0),
      'unmappedPools', COALESCE(v_health_row.unmapped_pools, 0),
      'staleMappings', COALESCE(v_health_row.stale_mappings, 0)
    );
  END IF;

  RETURN jsonb_build_object(
    'citySlug', v_city_slug,
    'chainId', v_chain_id,
    'state', v_state,
    'setupMessage', NULL,
    'canAdminister', v_can_administer,
    'mappings', v_mappings,
    'health', v_health
  );
END;
$$;

REVOKE ALL ON FUNCTION public.edge_resolve_current_user_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edge_resolve_app_context_v1(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edge_user_is_admin_or_operator_v1(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edge_list_voucher_preferences_v1(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edge_upsert_voucher_preference_v1(text, text, text, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edge_bia_list_v1(text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edge_bia_mappings_v1(text, text, text, bigint, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.edge_resolve_current_user_v1() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edge_resolve_app_context_v1(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edge_user_is_admin_or_operator_v1(bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edge_list_voucher_preferences_v1(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edge_upsert_voucher_preference_v1(text, text, text, bigint, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edge_bia_list_v1(text, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.edge_bia_mappings_v1(text, text, text, bigint, boolean) TO authenticated, service_role;

COMMIT;

-- DOWN:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.edge_bia_mappings_v1(text, text, text, bigint, boolean);
-- DROP FUNCTION IF EXISTS public.edge_bia_list_v1(text, text, text, boolean);
-- DROP FUNCTION IF EXISTS public.edge_upsert_voucher_preference_v1(text, text, text, bigint, text, text);
-- DROP FUNCTION IF EXISTS public.edge_list_voucher_preferences_v1(text, text, text);
-- DROP FUNCTION IF EXISTS public.edge_user_is_admin_or_operator_v1(bigint);
-- DROP FUNCTION IF EXISTS public.edge_resolve_app_context_v1(text, text, text);
-- DROP FUNCTION IF EXISTS public.edge_resolve_current_user_v1();
-- COMMIT;
