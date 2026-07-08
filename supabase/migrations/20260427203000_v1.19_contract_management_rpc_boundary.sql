-- v1.19: contract-management metadata RPC boundary

BEGIN;

CREATE OR REPLACE FUNCTION public.create_contract_mgmt_proposal_metadata_v1(
  p_city_slug text,
  p_proposal_type text,
  p_title text,
  p_description text,
  p_image_url text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_created_by_user_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id bigint;
  v_is_admin boolean := false;
  v_creator_user_id bigint;
  v_city_slug text := lower(btrim(coalesce(p_city_slug, '')));
  v_proposal_type text := lower(btrim(coalesce(p_proposal_type, '')));
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_row public.contract_mgmt_proposal_metadata%ROWTYPE;
BEGIN
  IF v_city_slug = '' THEN
    RAISE EXCEPTION 'city_slug is required' USING ERRCODE = '22023';
  END IF;

  IF v_proposal_type NOT IN ('charity', 'reserve') THEN
    RAISE EXCEPTION 'proposal_type must be charity or reserve' USING ERRCODE = '22023';
  END IF;

  IF v_title = '' THEN
    RAISE EXCEPTION 'title is required' USING ERRCODE = '22023';
  END IF;

  IF v_description = '' THEN
    RAISE EXCEPTION 'description is required' USING ERRCODE = '22023';
  END IF;

  SELECT u.id, COALESCE(u.is_admin, false)
    INTO v_current_user_id, v_is_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()::text
  LIMIT 1;

  IF auth.role() = 'service_role' THEN
    v_creator_user_id := COALESCE(p_created_by_user_id, v_current_user_id);
  ELSE
    IF v_current_user_id IS NULL THEN
      RAISE EXCEPTION 'authenticated user is not linked to an app user'
        USING ERRCODE = '42501';
    END IF;

    IF p_created_by_user_id IS NOT NULL AND p_created_by_user_id <> v_current_user_id THEN
      RAISE EXCEPTION 'created_by_user_id must match the authenticated user'
        USING ERRCODE = '42501';
    END IF;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'contract proposal metadata writes require an admin user'
        USING ERRCODE = '42501';
    END IF;

    v_creator_user_id := v_current_user_id;
  END IF;

  IF v_creator_user_id IS NULL THEN
    RAISE EXCEPTION 'created_by_user_id could not be resolved' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.contract_mgmt_proposal_metadata (
    city_slug,
    proposal_type,
    title,
    description,
    image_url,
    payload,
    created_by_user_id,
    created_at,
    updated_at
  )
  VALUES (
    v_city_slug,
    v_proposal_type,
    v_title,
    v_description,
    NULLIF(btrim(coalesce(p_image_url, '')), ''),
    COALESCE(p_payload, '{}'::jsonb),
    v_creator_user_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.link_contract_mgmt_proposal_v1(
  p_proposal_id bigint,
  p_city_slug text,
  p_metadata_id uuid,
  p_tx_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id bigint;
  v_is_admin boolean := false;
  v_city_slug text := lower(btrim(coalesce(p_city_slug, '')));
  v_tx_hash text := btrim(coalesce(p_tx_hash, ''));
  v_row public.contract_mgmt_proposal_links%ROWTYPE;
BEGIN
  IF p_proposal_id IS NULL OR p_proposal_id <= 0 THEN
    RAISE EXCEPTION 'proposal_id must be positive' USING ERRCODE = '22023';
  END IF;

  IF v_city_slug = '' THEN
    RAISE EXCEPTION 'city_slug is required' USING ERRCODE = '22023';
  END IF;

  IF p_metadata_id IS NULL THEN
    RAISE EXCEPTION 'metadata_id is required' USING ERRCODE = '22023';
  END IF;

  IF v_tx_hash = '' THEN
    RAISE EXCEPTION 'tx_hash is required' USING ERRCODE = '22023';
  END IF;

  SELECT u.id, COALESCE(u.is_admin, false)
    INTO v_current_user_id, v_is_admin
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()::text
  LIMIT 1;

  IF auth.role() <> 'service_role' THEN
    IF v_current_user_id IS NULL THEN
      RAISE EXCEPTION 'authenticated user is not linked to an app user'
        USING ERRCODE = '42501';
    END IF;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'contract proposal links require an admin user'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.contract_mgmt_proposal_metadata m
      WHERE m.id = p_metadata_id
        AND m.city_slug = v_city_slug
        AND m.created_by_user_id = v_current_user_id
    ) THEN
      RAISE EXCEPTION 'metadata record is not available for this user and city'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.contract_mgmt_proposal_links (
    proposal_id,
    city_slug,
    metadata_id,
    tx_hash,
    created_at
  )
  VALUES (
    p_proposal_id,
    v_city_slug,
    p_metadata_id,
    v_tx_hash,
    timezone('utc', now())
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contract_mgmt_proposal_metadata_v1(p_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT to_jsonb(m)
  FROM public.contract_mgmt_proposal_metadata m
  WHERE m.id = p_id
    AND auth.role() IN ('authenticated', 'service_role')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.list_contract_mgmt_proposal_metadata_v1(p_city_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.created_at DESC), '[]'::jsonb)
  FROM public.contract_mgmt_proposal_metadata m
  WHERE m.city_slug = lower(btrim(coalesce(p_city_slug, '')))
    AND auth.role() IN ('authenticated', 'service_role');
$$;

REVOKE ALL ON FUNCTION public.create_contract_mgmt_proposal_metadata_v1(text, text, text, text, text, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_contract_mgmt_proposal_v1(bigint, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contract_mgmt_proposal_metadata_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_contract_mgmt_proposal_metadata_v1(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_contract_mgmt_proposal_metadata_v1(text, text, text, text, text, jsonb, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_contract_mgmt_proposal_v1(bigint, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_contract_mgmt_proposal_metadata_v1(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_contract_mgmt_proposal_metadata_v1(text) TO authenticated, service_role;

COMMIT;

-- DOWN:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.list_contract_mgmt_proposal_metadata_v1(text);
-- DROP FUNCTION IF EXISTS public.get_contract_mgmt_proposal_metadata_v1(uuid);
-- DROP FUNCTION IF EXISTS public.link_contract_mgmt_proposal_v1(bigint, text, uuid, text);
-- DROP FUNCTION IF EXISTS public.create_contract_mgmt_proposal_metadata_v1(text, text, text, text, text, jsonb, bigint);
-- COMMIT;
