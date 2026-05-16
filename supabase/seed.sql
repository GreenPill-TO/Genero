-- Genero comprehensive development seed
-- Adds representative rows across public/indexer/chain_data tables.

BEGIN;

-- ---------------------------------------------------------------------------
-- Reference scaffolding
-- ---------------------------------------------------------------------------
INSERT INTO public.ref_personas (persona)
VALUES ('builder'), ('merchant'), ('steward')
ON CONFLICT (persona) DO NOTHING;

INSERT INTO public.ref_apps (slug, name)
VALUES
  ('wallet', 'Wallet'),
  ('sparechange', 'Spare Change'),
  ('contracts', 'Contract Management')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.ref_citycoins (slug, display_name, symbol)
VALUES ('tcoin', 'Toronto Coin', 'TCOIN')
ON CONFLICT (slug) DO UPDATE
SET display_name = EXCLUDED.display_name,
    symbol = EXCLUDED.symbol;

INSERT INTO public.charities (id, name, value)
VALUES
  ('a1111111-1111-4111-8111-111111111111', 'Daily Bread Food Bank', 'daily-bread-food-bank'),
  ('a2222222-2222-4222-8222-222222222222', 'Native Women''s Resource Centre of Toronto', 'native-womens-resource-centre-of-toronto'),
  ('a3333333-3333-4333-8333-333333333333', 'Parkdale Community Food Bank', 'parkdale-community-food-bank'),
  ('a4444444-4444-4444-8444-444444444444', 'Universal Basic Income', 'Universal Basic Income')
ON CONFLICT (value) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = timezone('utc', now());

WITH apps AS (
  SELECT id, slug FROM public.ref_apps WHERE slug IN ('wallet', 'sparechange', 'contracts')
), city AS (
  SELECT id FROM public.ref_citycoins WHERE slug = 'tcoin'
), envs AS (
  SELECT * FROM (VALUES ('local'), ('development'), ('staging'), ('production')) AS e(environment)
)
INSERT INTO public.ref_app_instances (slug, app_id, citycoin_id, environment, site_url, notes)
SELECT
  apps.slug || '-tcoin-' || envs.environment,
  apps.id,
  city.id,
  envs.environment,
  CASE
    WHEN envs.environment IN ('local', 'development') THEN 'http://localhost:3001'
    ELSE NULL
  END,
  'seeded by supabase/seed.sql'
FROM apps
CROSS JOIN city
CROSS JOIN envs
ON CONFLICT (slug) DO UPDATE
SET app_id = EXCLUDED.app_id,
    citycoin_id = EXCLUDED.citycoin_id,
    environment = EXCLUDED.environment,
    site_url = EXCLUDED.site_url,
    notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- Users / profiles / auth-adjacent rows
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, cubid_id, username, email, full_name, is_admin, auth_user_id, country, created_at, updated_at)
VALUES
  (1001, 'cubid-seed-1', 'hubert.cormac', 'hubert.cormac@gmail.com', 'Hubert Cormac', true, 'seed-auth-user-1001', 'CA', now(), now()),
  (1002, 'cubid-seed-2', 'bob', 'bob@example.com', 'Bob Shopper', false, 'seed-auth-user-1002', 'CA', now(), now()),
  (1003, 'cubid-seed-3', 'carol', 'carol@example.com', 'Carol Operator', true, 'seed-auth-user-1003', 'CA', now(), now()),
  (1004, 'cubid-seed-4', 'hubert-cormac', 'hubert-cormac@example.com', 'Hubert Cormac', true, 'seed-auth-user-1004', 'CA', now(), now())
ON CONFLICT (id) DO UPDATE
SET username = EXCLUDED.username,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_admin = EXCLUDED.is_admin,
    auth_user_id = EXCLUDED.auth_user_id,
    country = EXCLUDED.country,
    updated_at = now();

INSERT INTO public.user_email_addresses (user_id, email, is_primary, created_at, updated_at)
SELECT
  u.id,
  lower(u.email),
  true,
  u.created_at,
  u.updated_at
FROM public.users u
WHERE u.id IN (1001, 1002, 1003, 1004)
  AND u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_email_addresses ue
    WHERE ue.user_id = u.id
      AND ue.email = lower(u.email)
      AND ue.deleted_at IS NULL
  );

INSERT INTO public.roles (user_id, role, assigned_by, app_instance_id, created_at)
SELECT 1001, 'admin', 1001, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (user_id, role, app_instance_id) DO NOTHING;

INSERT INTO public.roles (user_id, role, assigned_by, app_instance_id, created_at)
SELECT 1003, 'operator', 1001, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (user_id, role, app_instance_id) DO NOTHING;

INSERT INTO public.roles (user_id, role, assigned_by, app_instance_id, created_at)
SELECT 1004, 'admin', 1001, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (user_id, role, app_instance_id) DO NOTHING;

INSERT INTO public.app_user_profiles (user_id, app_instance_id, metadata, created_at, updated_at)
SELECT u.id, ai.id, jsonb_build_object('seeded', true), now(), now()
FROM (VALUES (1001), (1002), (1003)) AS u(id)
CROSS JOIN LATERAL (
  SELECT id
  FROM public.ref_app_instances
  WHERE slug = 'wallet-tcoin-development'
  LIMIT 1
) ai
ON CONFLICT (user_id, app_instance_id) DO UPDATE
SET metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.app_user_profiles (user_id, app_instance_id, metadata, created_at, updated_at)
SELECT 1004, ai.id, jsonb_build_object('seeded', true), now(), now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (user_id, app_instance_id) DO UPDATE
SET metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.wallet_keys (id, user_id, namespace, app_share, created_at, updated_at)
VALUES
  (3101, 1001, 'EVM', 'seed-app-share-1', now(), now()),
  (3102, 1002, 'EVM', 'seed-app-share-2', now(), now()),
  (3103, 1003, 'EVM', 'seed-app-share-3', now(), now()),
  (3104, 1004, 'EVM', 'seed-app-share-4', now(), now())
ON CONFLICT (id) DO UPDATE
SET app_share = EXCLUDED.app_share,
    updated_at = now();

INSERT INTO public.wallet_list (id, user_id, namespace, wallet_key_id, public_key)
VALUES
  (3001, 1001, 'EVM', 3101, '0x1111111111111111111111111111111111111001'),
  (3002, 1002, 'EVM', 3102, '0x2222222222222222222222222222222222222002'),
  (3003, 1003, 'EVM', 3103, '0x3333333333333333333333333333333333333003'),
  (3004, 1004, 'EVM', 3104, '0x4444444444444444444444444444444444444004')
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    namespace = EXCLUDED.namespace,
    wallet_key_id = EXCLUDED.wallet_key_id,
    public_key = EXCLUDED.public_key;

INSERT INTO public.user_encrypted_share (
  id,
  user_id,
  namespace,
  encrypted_share,
  wallet_key_id
)
VALUES
  (3201, 1001, 'EVM'::public.namespace, 'enc-share-1001', 3101),
  (3202, 1002, 'EVM'::public.namespace, 'enc-share-1002', 3102),
  (3203, 1003, 'EVM'::public.namespace, 'enc-share-1003', 3103),
  (3204, 1004, 'EVM'::public.namespace, 'enc-share-1004', 3104)
ON CONFLICT (id) DO UPDATE
SET encrypted_share = EXCLUDED.encrypted_share,
    wallet_key_id = EXCLUDED.wallet_key_id;

-- ---------------------------------------------------------------------------
-- Legacy wallet app operational tables
-- ---------------------------------------------------------------------------
INSERT INTO public.interac_transfer (id, user_id, app_instance_id, created_at)
SELECT 2001, 1002, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.interac_transfer (id, user_id, app_instance_id, created_at)
SELECT 2002, 1001, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.off_ramp_req (id, user_id, app_instance_id, created_at)
SELECT 2101, 1001, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.off_ramp_req (id, user_id, app_instance_id, created_at)
SELECT 2102, 1002, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.act_transactions (id, created_by, onramp_request_id, offramp_request_id, app_instance_id, created_at)
SELECT 2201, 1002, 2001, NULL, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET created_by = EXCLUDED.created_by,
    onramp_request_id = EXCLUDED.onramp_request_id,
    offramp_request_id = EXCLUDED.offramp_request_id,
    app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.act_transactions (id, created_by, onramp_request_id, offramp_request_id, app_instance_id, created_at)
SELECT 2202, 1001, NULL, 2101, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET created_by = EXCLUDED.created_by,
    onramp_request_id = EXCLUDED.onramp_request_id,
    offramp_request_id = EXCLUDED.offramp_request_id,
    app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.notifications (id, user_id, trx_entry_id, app_instance_id, created_at)
SELECT 2301, 1001, 2201, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    trx_entry_id = EXCLUDED.trx_entry_id,
    app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.notifications (id, user_id, trx_entry_id, app_instance_id, created_at)
SELECT 2302, 1002, 2202, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    trx_entry_id = EXCLUDED.trx_entry_id,
    app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.app_admin_notifications (id, user_id, app_instance_id, created_at)
SELECT 2401, 1001, ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.user_requests (id, name, email, message, app_instance_id, created_at)
SELECT 2901, 'Seed User A', 'seed-a@example.com', 'Please approve my request.', ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    email = EXCLUDED.email,
    message = EXCLUDED.message,
    app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.user_requests (id, name, email, message, app_instance_id, created_at)
SELECT 2902, 'Seed User B', 'seed-b@example.com', 'Need help with merchant onboarding.', ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    email = EXCLUDED.email,
    message = EXCLUDED.message,
    app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.connections (id, owner_user_id, connected_user_id, state, app_instance_id, created_at, modified_at)
SELECT 2701, 1001, 1002, 'accepted', ai.id, now(), now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET owner_user_id = EXCLUDED.owner_user_id,
    connected_user_id = EXCLUDED.connected_user_id,
    state = EXCLUDED.state,
    app_instance_id = EXCLUDED.app_instance_id,
    modified_at = now();

INSERT INTO public.connections (id, owner_user_id, connected_user_id, state, app_instance_id, created_at, modified_at)
SELECT 2702, 1002, 1003, 'pending', ai.id, now(), now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET owner_user_id = EXCLUDED.owner_user_id,
    connected_user_id = EXCLUDED.connected_user_id,
    state = EXCLUDED.state,
    app_instance_id = EXCLUDED.app_instance_id,
    modified_at = now();

INSERT INTO public.invites (id, token, from_user_id, used_by_user_id, expires_at, app_instance_id, created_at)
SELECT 2801, 'seed-invite-001', 1001, NULL, now() + interval '30 days', ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET token = EXCLUDED.token,
    from_user_id = EXCLUDED.from_user_id,
    used_by_user_id = EXCLUDED.used_by_user_id,
    expires_at = EXCLUDED.expires_at,
    app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.invites (id, token, from_user_id, used_by_user_id, expires_at, app_instance_id, created_at)
SELECT 2802, 'seed-invite-002', 1003, 1002, now() + interval '15 days', ai.id, now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET token = EXCLUDED.token,
    from_user_id = EXCLUDED.from_user_id,
    used_by_user_id = EXCLUDED.used_by_user_id,
    expires_at = EXCLUDED.expires_at,
    app_instance_id = EXCLUDED.app_instance_id;

INSERT INTO public.cron_logs (id, "timestamp", status, note)
VALUES
  ('90000000-0000-4000-8000-000000000001', now(), 'ok', 'seed: sample cron log 1'),
  ('90000000-0000-4000-8000-000000000002', now(), 'ok', 'seed: sample cron log 2')
ON CONFLICT (id) DO UPDATE SET
  "timestamp" = EXCLUDED."timestamp",
  status = EXCLUDED.status,
  note = EXCLUDED.note;

-- ---------------------------------------------------------------------------
-- Store + merchant signup domain
-- ---------------------------------------------------------------------------
INSERT INTO public.stores (
  id, app_instance_id, lifecycle_status, signup_step, signup_progress_count, signup_started_at, submitted_at, approved_at, approved_by, created_at
)
SELECT 2501, ai.id, 'live', 5, 6, now() - interval '20 days', now() - interval '19 days', now() - interval '18 days', 1001, now() - interval '20 days'
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET app_instance_id = EXCLUDED.app_instance_id,
    lifecycle_status = EXCLUDED.lifecycle_status,
    signup_step = EXCLUDED.signup_step,
    signup_progress_count = EXCLUDED.signup_progress_count,
    approved_by = EXCLUDED.approved_by;

INSERT INTO public.stores (
  id, app_instance_id, lifecycle_status, signup_step, signup_progress_count, signup_started_at, submitted_at, created_at
)
SELECT 2502, ai.id, 'pending', 5, 5, now() - interval '10 days', now() - interval '9 days', now() - interval '10 days'
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET app_instance_id = EXCLUDED.app_instance_id,
    lifecycle_status = EXCLUDED.lifecycle_status,
    signup_step = EXCLUDED.signup_step,
    signup_progress_count = EXCLUDED.signup_progress_count;

INSERT INTO public.stores (
  id, app_instance_id, lifecycle_status, signup_step, signup_progress_count, signup_started_at, created_at
)
SELECT 2503, ai.id, 'draft', 3, 3, now() - interval '3 days', now() - interval '3 days'
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET app_instance_id = EXCLUDED.app_instance_id,
    lifecycle_status = EXCLUDED.lifecycle_status,
    signup_step = EXCLUDED.signup_step,
    signup_progress_count = EXCLUDED.signup_progress_count;

INSERT INTO public.store_employees (store_id, user_id, app_instance_id, is_admin, created_at)
SELECT 2501, 1001, ai.id, true, now() - interval '20 days'
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (store_id, user_id, app_instance_id) DO UPDATE
SET is_admin = EXCLUDED.is_admin;

INSERT INTO public.store_employees (store_id, user_id, app_instance_id, is_admin, created_at)
SELECT 2502, 1002, ai.id, true, now() - interval '10 days'
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (store_id, user_id, app_instance_id) DO UPDATE
SET is_admin = EXCLUDED.is_admin;

INSERT INTO public.store_profiles (
  store_id, app_instance_id, display_name, wallet_address, address_text, lat, lng, status, slug, description, logo_url, banner_url, created_at, updated_at
)
SELECT
  2501,
  ai.id,
  'Seed Coffee House',
  '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
  '100 King St W, Toronto, Ontario, Canada',
  43.6487000,
  -79.3823000,
  'active',
  'seed-coffee-house',
  'Community cafe accepting TCOIN.',
  'https://placehold.co/256x256/png',
  'https://placehold.co/1200x300/png',
  now(),
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (store_id) DO UPDATE
SET app_instance_id = EXCLUDED.app_instance_id,
    display_name = EXCLUDED.display_name,
    wallet_address = EXCLUDED.wallet_address,
    address_text = EXCLUDED.address_text,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    status = EXCLUDED.status,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    logo_url = EXCLUDED.logo_url,
    banner_url = EXCLUDED.banner_url,
    updated_at = now();

INSERT INTO public.store_profiles (
  store_id, app_instance_id, display_name, wallet_address, address_text, lat, lng, status, slug, description, logo_url, banner_url, created_at, updated_at
)
SELECT
  2502,
  ai.id,
  'Seed Fresh Market',
  '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
  '250 Queen St E, Toronto, Ontario, Canada',
  43.6532000,
  -79.3720000,
  'active',
  'seed-fresh-market',
  'Neighbourhood produce and pantry store.',
  'https://placehold.co/256x256/png',
  'https://placehold.co/1200x300/png',
  now(),
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (store_id) DO UPDATE
SET app_instance_id = EXCLUDED.app_instance_id,
    display_name = EXCLUDED.display_name,
    wallet_address = EXCLUDED.wallet_address,
    address_text = EXCLUDED.address_text,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    status = EXCLUDED.status,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    logo_url = EXCLUDED.logo_url,
    banner_url = EXCLUDED.banner_url,
    updated_at = now();

INSERT INTO public.store_profiles (
  store_id, app_instance_id, display_name, address_text, status, description, created_at, updated_at
)
SELECT
  2503,
  ai.id,
  'Seed Draft Store',
  '500 Parliament St, Toronto, Ontario, Canada',
  'inactive',
  'Draft merchant application.',
  now(),
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (store_id) DO UPDATE
SET app_instance_id = EXCLUDED.app_instance_id,
    display_name = EXCLUDED.display_name,
    address_text = EXCLUDED.address_text,
    status = EXCLUDED.status,
    description = EXCLUDED.description,
    updated_at = now();

INSERT INTO public.store_signup_events (id, store_id, user_id, step, event_type, payload, created_at)
VALUES
  ('70000000-0000-4000-8000-000000000001', 2503, 1002, 1, 'step_saved', jsonb_build_object('consentAccepted', true), now() - interval '2 days'),
  ('70000000-0000-4000-8000-000000000002', 2503, 1002, 2, 'step_saved', jsonb_build_object('displayName', 'Seed Draft Store'), now() - interval '1 day')
ON CONFLICT (id) DO UPDATE
SET payload = EXCLUDED.payload,
    created_at = EXCLUDED.created_at;

INSERT INTO public.invoice_pay_request (
  id,
  transaction_id,
  request_from,
  request_by,
  amount_requested,
  status,
  paid_at,
  closed_at,
  citycoin_id,
  app_instance_id,
  created_at,
  updated_at
)
SELECT
  2601,
  2201,
  1001,
  1002,
  25,
  'paid',
  now(),
  now(),
  ai.citycoin_id,
  ai.id,
  now(),
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET transaction_id = EXCLUDED.transaction_id,
    request_from = EXCLUDED.request_from,
    request_by = EXCLUDED.request_by,
    amount_requested = EXCLUDED.amount_requested,
    status = EXCLUDED.status,
    paid_at = EXCLUDED.paid_at,
    closed_at = EXCLUDED.closed_at,
    citycoin_id = EXCLUDED.citycoin_id,
    app_instance_id = EXCLUDED.app_instance_id,
    updated_at = EXCLUDED.updated_at;

-- ---------------------------------------------------------------------------
-- BIA and governance data
-- ---------------------------------------------------------------------------
INSERT INTO public.bia_registry (id, city_slug, code, name, center_lat, center_lng, status, metadata, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'tcoin', 'KING-WEST', 'King West', 43.6465000, -79.3923000, 'active', '{}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'tcoin', 'RIVERDALE', 'Riverdale', 43.6714000, -79.3520000, 'active', '{}'::jsonb, now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'tcoin', 'YONGE', 'Yonge Corridor', 43.6669000, -79.3849000, 'inactive', '{}'::jsonb, now(), now()),
  ('44444444-4444-4444-8444-444444444443', 'tcoin', 'REST-OF-TORONTO', 'Rest of Toronto', 43.6532000, -79.3832000, 'active', '{}'::jsonb, now(), now())
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    center_lat = EXCLUDED.center_lat,
    center_lng = EXCLUDED.center_lng,
    status = EXCLUDED.status,
    updated_at = now();

INSERT INTO public.bia_pool_mappings (
  id, bia_id, chain_id, pool_address, token_registry, token_limiter, quoter, fee_address,
  mapping_status, validation_status, validation_notes, effective_from, effective_to, created_by, created_at, updated_at
)
VALUES
  (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    42220,
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    '0xD3aE8C0f49680E53EF76546af18d45DF4654Af81',
    '0x9ac2fef4b3672825BB7560377c8bEd7E255e0FEF',
    '0xD870DEe32489b59Aa71723f6017812FB078EE371',
    '0xc9Bb94fbB9C93Dbf0058c2E2830F9E15567F6624',
    'active',
    'valid',
    'seed mapping',
    now() - interval '30 days',
    NULL,
    1001,
    now() - interval '30 days',
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',
    42220,
    '0x1111111111111111111111111111111111111222',
    '0x1111111111111111111111111111111111111333',
    '0x1111111111111111111111111111111111111444',
    '0x1111111111111111111111111111111111111555',
    '0x1111111111111111111111111111111111111666',
    'pending',
    'unknown',
    'awaiting validation',
    now() - interval '5 days',
    NULL,
    1003,
    now() - interval '5 days',
    now()
  )
ON CONFLICT (id) DO UPDATE
SET mapping_status = EXCLUDED.mapping_status,
    validation_status = EXCLUDED.validation_status,
    updated_at = now();

INSERT INTO public.user_bia_affiliations (
  id, user_id, app_instance_id, bia_id, source, confidence, effective_from, effective_to, created_at, updated_at
)
SELECT
  '66666666-6666-4666-8666-666666666661',
  1002,
  ai.id,
  '11111111-1111-4111-8111-111111111111',
  'user_selected',
  'high',
  now() - interval '14 days',
  NULL,
  now() - interval '14 days',
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET bia_id = EXCLUDED.bia_id,
    confidence = EXCLUDED.confidence,
    effective_to = EXCLUDED.effective_to,
    updated_at = now();

INSERT INTO public.user_bia_affiliations (
  id, user_id, app_instance_id, bia_id, source, confidence, effective_from, effective_to, created_at, updated_at
)
SELECT
  '66666666-6666-4666-8666-666666666662',
  1001,
  ai.id,
  '22222222-2222-4222-8222-222222222222',
  'admin_assigned',
  'medium',
  now() - interval '20 days',
  NULL,
  now() - interval '20 days',
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET bia_id = EXCLUDED.bia_id,
    confidence = EXCLUDED.confidence,
    effective_to = EXCLUDED.effective_to,
    updated_at = now();

INSERT INTO public.user_bia_secondary_affiliations (
  id, user_id, app_instance_id, bia_id, source, effective_from, effective_to, created_at, updated_at
)
SELECT
  '66666666-6666-4666-8666-666666666663',
  1002,
  ai.id,
  '22222222-2222-4222-8222-222222222222',
  'user_selected',
  now() - interval '7 days',
  NULL,
  now() - interval '7 days',
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET bia_id = EXCLUDED.bia_id,
    effective_to = EXCLUDED.effective_to,
    updated_at = now();

INSERT INTO public.store_bia_affiliations (id, store_id, bia_id, source, effective_from, effective_to, created_at, updated_at)
VALUES
  ('66666666-6666-4666-8666-666666666664', 2501, '11111111-1111-4111-8111-111111111111', 'merchant_selected', now() - interval '20 days', NULL, now() - interval '20 days', now()),
  ('66666666-6666-4666-8666-666666666665', 2502, '22222222-2222-4222-8222-222222222222', 'merchant_selected', now() - interval '10 days', NULL, now() - interval '10 days', now())
ON CONFLICT (id) DO UPDATE
SET bia_id = EXCLUDED.bia_id,
    effective_to = EXCLUDED.effective_to,
    updated_at = now();

INSERT INTO public.pool_purchase_requests (
  id, user_id, app_instance_id, bia_id, chain_id, pool_address, token_address, fiat_amount, token_amount,
  tx_hash, status, metadata, created_at, updated_at
)
SELECT
  '77777777-7777-4777-8777-777777777771',
  1002,
  ai.id,
  '11111111-1111-4111-8111-111111111111',
  42220,
  '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
  '0x298A698031e2fD7D8F0c830F3FD887601b40058C',
  50.00,
  50.00,
  '0xaaa0000000000000000000000000000000000000000000000000000000000001',
  'confirmed',
  jsonb_build_object('seeded', true),
  now() - interval '3 days',
  now() - interval '3 days'
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    token_amount = EXCLUDED.token_amount,
    updated_at = now();

INSERT INTO public.pool_purchase_requests (
  id, user_id, app_instance_id, bia_id, chain_id, pool_address, token_address, fiat_amount, token_amount,
  tx_hash, status, metadata, created_at, updated_at
)
SELECT
  '77777777-7777-4777-8777-777777777772',
  1001,
  ai.id,
  '22222222-2222-4222-8222-222222222222',
  42220,
  '0x1111111111111111111111111111111111111222',
  '0x2222222222222222222222222222222222222999',
  20.00,
  20.00,
  '0xaaa0000000000000000000000000000000000000000000000000000000000002',
  'pending',
  jsonb_build_object('seeded', true),
  now() - interval '1 day',
  now() - interval '1 day'
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    token_amount = EXCLUDED.token_amount,
    updated_at = now();

INSERT INTO public.pool_redemption_requests (
  id, store_id, requester_user_id, bia_id, chain_id, pool_address, settlement_asset,
  token_amount, settlement_amount, status, approved_by, approved_at, metadata, created_at, updated_at
)
VALUES
  (
    '88888888-8888-4888-8888-888888888881',
    2501,
    1001,
    '11111111-1111-4111-8111-111111111111',
    42220,
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    'CAD',
    75.000000,
    72.750000,
    'approved',
    1003,
    now() - interval '12 hours',
    '{}'::jsonb,
    now() - interval '1 day',
    now() - interval '12 hours'
  ),
  (
    '88888888-8888-4888-8888-888888888882',
    2502,
    1002,
    '22222222-2222-4222-8222-222222222222',
    42220,
    '0x1111111111111111111111111111111111111222',
    'CAD',
    30.000000,
    NULL,
    'pending',
    NULL,
    NULL,
    '{}'::jsonb,
    now() - interval '8 hours',
    now() - interval '8 hours'
  )
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    settlement_amount = EXCLUDED.settlement_amount,
    approved_by = EXCLUDED.approved_by,
    approved_at = EXCLUDED.approved_at,
    updated_at = now();

INSERT INTO public.pool_redemption_settlements (
  id, redemption_request_id, settled_by, chain_id, tx_hash, settlement_amount, settlement_asset, status, notes, metadata, created_at, updated_at
)
VALUES
  (
    '99999999-9999-4999-8999-999999999991',
    '88888888-8888-4888-8888-888888888881',
    1003,
    42220,
    '0xbbb0000000000000000000000000000000000000000000000000000000000001',
    72.750000,
    'CAD',
    'confirmed',
    'seed settlement',
    '{}'::jsonb,
    now() - interval '6 hours',
    now() - interval '6 hours'
  )
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    tx_hash = EXCLUDED.tx_hash,
    updated_at = now();

INSERT INTO public.bia_pool_controls (bia_id, max_daily_redemption, max_tx_amount, queue_only_mode, is_frozen, updated_by, created_at, updated_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', 5000, 500, false, false, 1001, now() - interval '14 days', now()),
  ('22222222-2222-4222-8222-222222222222', 2500, 250, true, false, 1003, now() - interval '7 days', now())
ON CONFLICT (bia_id) DO UPDATE
SET max_daily_redemption = EXCLUDED.max_daily_redemption,
    max_tx_amount = EXCLUDED.max_tx_amount,
    queue_only_mode = EXCLUDED.queue_only_mode,
    is_frozen = EXCLUDED.is_frozen,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

INSERT INTO public.store_risk_flags (store_id, is_suspended, reason, updated_by, created_at, updated_at)
VALUES
  (2501, false, NULL, 1003, now() - interval '5 days', now()),
  (2502, true, 'awaiting compliance docs', 1003, now() - interval '2 days', now())
ON CONFLICT (store_id) DO UPDATE
SET is_suspended = EXCLUDED.is_suspended,
    reason = EXCLUDED.reason,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

INSERT INTO public.governance_actions_log (id, action_type, city_slug, bia_id, store_id, actor_user_id, reason, payload, created_at)
VALUES
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'set_pool_control', 'tcoin', '11111111-1111-4111-8111-111111111111', NULL, 1001, 'seed controls', '{}'::jsonb, now() - interval '10 days'),
  ('aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'suspend_store', 'tcoin', NULL, 2502, 1003, 'seed suspension', '{}'::jsonb, now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET reason = EXCLUDED.reason,
    payload = EXCLUDED.payload,
    created_at = EXCLUDED.created_at;

-- ---------------------------------------------------------------------------
-- Contract management + voucher prefs/payments
-- ---------------------------------------------------------------------------
INSERT INTO public.contract_mgmt_proposal_metadata (
  id, city_slug, proposal_type, title, description, image_url, payload, created_by_user_id, created_at, updated_at
)
VALUES
  (
    'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'tcoin',
    'charity',
    'Add Park Community Kitchen',
    'Seed governance proposal for adding a charity.',
    'https://placehold.co/1200x630/png',
    jsonb_build_object('charityId', 101),
    1001,
    now() - interval '4 days',
    now() - interval '4 days'
  ),
  (
    'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'tcoin',
    'reserve',
    'Add USDC Reserve Token',
    'Seed reserve proposal.',
    NULL,
    jsonb_build_object('code', 'USDC'),
    1001,
    now() - interval '3 days',
    now() - interval '3 days'
  )
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    payload = EXCLUDED.payload,
    updated_at = now();

INSERT INTO public.contract_mgmt_proposal_links (proposal_id, city_slug, metadata_id, tx_hash, created_at)
VALUES
  (1, 'tcoin', 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '0xccc0000000000000000000000000000000000000000000000000000000000001', now() - interval '4 days'),
  (2, 'tcoin', 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '0xccc0000000000000000000000000000000000000000000000000000000000002', now() - interval '3 days')
ON CONFLICT (proposal_id, city_slug) DO UPDATE
SET metadata_id = EXCLUDED.metadata_id,
    tx_hash = EXCLUDED.tx_hash,
    created_at = EXCLUDED.created_at;

INSERT INTO public.voucher_compatibility_rules (
  id, city_slug, chain_id, pool_address, token_address, merchant_store_id, accepted_by_default, rule_status, created_by, created_at, updated_at
)
VALUES
  (
    'ccccccc1-cccc-4ccc-8ccc-ccccccccccc1',
    'tcoin',
    42220,
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    '0x3333333333333333333333333333333333333001',
    NULL,
    true,
    'active',
    1001,
    now() - interval '7 days',
    now()
  ),
  (
    'ccccccc2-cccc-4ccc-8ccc-ccccccccccc2',
    'tcoin',
    42220,
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    '0x3333333333333333333333333333333333333002',
    2501,
    false,
    'active',
    1003,
    now() - interval '2 days',
    now()
  )
ON CONFLICT (id) DO UPDATE
SET accepted_by_default = EXCLUDED.accepted_by_default,
    rule_status = EXCLUDED.rule_status,
    updated_at = now();

INSERT INTO public.user_voucher_preferences (
  id, user_id, app_instance_id, city_slug, merchant_store_id, token_address, trust_status, created_at, updated_at
)
SELECT
  'ddddddd1-dddd-4ddd-8ddd-ddddddddddd1',
  1002,
  ai.id,
  'tcoin',
  2501,
  '0x3333333333333333333333333333333333333001',
  'trusted',
  now() - interval '2 days',
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET trust_status = EXCLUDED.trust_status,
    updated_at = now();

INSERT INTO public.user_voucher_preferences (
  id, user_id, app_instance_id, city_slug, merchant_store_id, token_address, trust_status, created_at, updated_at
)
SELECT
  'ddddddd2-dddd-4ddd-8ddd-ddddddddddd2',
  1001,
  ai.id,
  'tcoin',
  2502,
  '0x3333333333333333333333333333333333333002',
  'blocked',
  now() - interval '1 day',
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET trust_status = EXCLUDED.trust_status,
    updated_at = now();

INSERT INTO public.voucher_payment_records (
  id, city_slug, chain_id, payer_user_id, payer_wallet, recipient_wallet, merchant_store_id,
  mode, token_address, pool_address, amount_tcoin, amount_voucher,
  swap_tx_hash, transfer_tx_hash, fallback_reason, status, metadata, created_at, updated_at
)
VALUES
  (
    'eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1',
    'tcoin',
    42220,
    1002,
    '0x1111111111111111111111111111111111111111',
    '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    2501,
    'voucher',
    '0x3333333333333333333333333333333333333001',
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    12.0,
    12.0,
    '0xddd0000000000000000000000000000000000000000000000000000000000001',
    '0xddd0000000000000000000000000000000000000000000000000000000000002',
    NULL,
    'completed',
    '{}'::jsonb,
    now() - interval '6 hours',
    now() - interval '6 hours'
  ),
  (
    'eeeeeee2-eeee-4eee-8eee-eeeeeeeeeee2',
    'tcoin',
    42220,
    1001,
    '0x2222222222222222222222222222222222222222',
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    2502,
    'tcoin_fallback',
    NULL,
    NULL,
    8.0,
    NULL,
    NULL,
    '0xddd0000000000000000000000000000000000000000000000000000000000003',
    'route_unavailable',
    'submitted',
    '{}'::jsonb,
    now() - interval '2 hours',
    now() - interval '2 hours'
  )
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    fallback_reason = EXCLUDED.fallback_reason,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Onramp orchestration
-- ---------------------------------------------------------------------------
INSERT INTO public.onramp_deposit_wallets (
  id, user_id, app_instance_id, city_slug, chain_id, address, derivation_index, status, created_at, updated_at
)
SELECT
  'f1111111-1111-4111-8111-111111111111',
  1002,
  ai.id,
  'tcoin',
  42220,
  '0x4444444444444444444444444444444444444001',
  1,
  'active',
  now() - interval '7 days',
  now()
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET address = EXCLUDED.address,
    status = EXCLUDED.status,
    updated_at = now();

INSERT INTO public.onramp_checkout_sessions (
  id, user_id, app_instance_id, city_slug, provider, provider_session_id, provider_order_id,
  fiat_currency, fiat_amount, country_code, target_chain_id, target_input_asset, final_asset,
  deposit_address, recipient_wallet, status, status_reason,
  incoming_usdc_tx_hash, mint_tx_hash, tcoin_delivery_tx_hash,
  usdc_received_amount, tcoin_out_amount, requested_charity_id,
  quote_payload, metadata, created_at, updated_at
)
SELECT
  'f2222222-2222-4222-8222-222222222222',
  1002,
  ai.id,
  'tcoin',
  'transak',
  'session-seed-001',
  'order-seed-001',
  'CAD',
  100,
  'CA',
  42220,
  'USDC',
  'TCOIN',
  '0x4444444444444444444444444444444444444001',
  '0x1111111111111111111111111111111111111111',
  'mint_complete',
  NULL,
  '0xeee0000000000000000000000000000000000000000000000000000000000001',
  '0xeee0000000000000000000000000000000000000000000000000000000000002',
  '0xeee0000000000000000000000000000000000000000000000000000000000002',
  100,
  99,
  0,
  jsonb_build_object('seeded', true),
  jsonb_build_object('execution_mode', 'seed'),
  now() - interval '5 days',
  now() - interval '5 days'
FROM public.ref_app_instances ai
WHERE ai.slug = 'wallet-tcoin-development'
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    mint_tx_hash = EXCLUDED.mint_tx_hash,
    tcoin_out_amount = EXCLUDED.tcoin_out_amount,
    updated_at = now();

INSERT INTO public.onramp_settlement_attempts (
  id, session_id, attempt_no, mode, state, error_message, router_address, router_call_payload,
  min_cadm_out, min_tcoin_out, deadline_unix, mint_tx_hash, created_at, updated_at
)
VALUES
  (
    'f3333333-3333-4333-8333-333333333333',
    'f2222222-2222-4222-8222-222222222222',
    1,
    'auto',
    'succeeded',
    NULL,
    '0x5555555555555555555555555555555555555001',
    jsonb_build_object('method', 'mintTcoinWithUSDC'),
    99,
    98,
    extract(epoch FROM now() + interval '15 minutes')::bigint,
    '0xeee0000000000000000000000000000000000000000000000000000000000002',
    now() - interval '5 days',
    now() - interval '5 days'
  )
ON CONFLICT (id) DO UPDATE
SET state = EXCLUDED.state,
    mint_tx_hash = EXCLUDED.mint_tx_hash,
    updated_at = now();

INSERT INTO public.onramp_provider_events (
  id, session_id, provider, provider_event_id, event_type, payload, signature_valid, received_at
)
VALUES
  (
    'f4444444-4444-4444-8444-444444444444',
    'f2222222-2222-4222-8222-222222222222',
    'transak',
    'evt-seed-001',
    'ORDER_COMPLETED',
    jsonb_build_object('seeded', true),
    true,
    now() - interval '5 days'
  )
ON CONFLICT (id) DO UPDATE
SET event_type = EXCLUDED.event_type,
    payload = EXCLUDED.payload,
    signature_valid = EXCLUDED.signature_valid,
    received_at = EXCLUDED.received_at;

INSERT INTO public.onramp_operation_locks (
  session_id, lock_owner, lock_expires_at, created_at, updated_at
)
VALUES
  (
    'f2222222-2222-4222-8222-222222222222',
    'seed-worker',
    now() + interval '5 minutes',
    now(),
    now()
  )
ON CONFLICT (session_id) DO UPDATE
SET lock_owner = EXCLUDED.lock_owner,
    lock_expires_at = EXCLUDED.lock_expires_at,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Indexer control + derived tables
-- ---------------------------------------------------------------------------
INSERT INTO indexer.run_control (
  scope_key, city_slug, chain_id, last_started_at, last_completed_at, last_status,
  last_error, next_eligible_start_at, next_eligible_complete_at, created_at, updated_at
)
VALUES
  (
    'tcoin:42220',
    'tcoin',
    42220,
    now() - interval '20 minutes',
    now() - interval '15 minutes',
    'success',
    NULL,
    now() - interval '10 minutes',
    now() - interval '10 minutes',
    now() - interval '10 days',
    now()
  )
ON CONFLICT (scope_key) DO UPDATE
SET last_status = EXCLUDED.last_status,
    last_completed_at = EXCLUDED.last_completed_at,
    updated_at = now();

INSERT INTO indexer.checkpoints (scope_key, source, last_block, last_tx_hash, updated_at)
VALUES
  ('tcoin:42220', 'tracker', 34567890, '0xaaa0000000000000000000000000000000000000000000000000000000000001', now()),
  ('tcoin:42220', 'rpc', 34567880, '0xaaa0000000000000000000000000000000000000000000000000000000000002', now())
ON CONFLICT (scope_key, source) DO UPDATE
SET last_block = EXCLUDED.last_block,
    last_tx_hash = EXCLUDED.last_tx_hash,
    updated_at = now();

INSERT INTO indexer.pool_links (
  city_slug, city_version, chain_id, pool_address, token_registry, token_limiter, quoter,
  owner_address, fee_address, is_active, first_seen_at, last_seen_at, updated_at
)
VALUES
  (
    'tcoin',
    1,
    42220,
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    '0xD3aE8C0f49680E53EF76546af18d45DF4654Af81',
    '0x9ac2fef4b3672825BB7560377c8bEd7E255e0FEF',
    '0xD870DEe32489b59Aa71723f6017812FB078EE371',
    '0xc9Bb94fbB9C93Dbf0058c2E2830F9E15567F6624',
    '0xc9Bb94fbB9C93Dbf0058c2E2830F9E15567F6624',
    true,
    now() - interval '30 days',
    now(),
    now()
  )
ON CONFLICT (city_slug, chain_id, pool_address) DO UPDATE
SET is_active = EXCLUDED.is_active,
    last_seen_at = EXCLUDED.last_seen_at,
    updated_at = now();

INSERT INTO indexer.pool_tokens (pool_address, token_address, first_seen_at, last_seen_at)
VALUES
  ('0xA6f024Ad53766d332057d5e40215b695522ee3dE', '0x298A698031e2fD7D8F0c830F3FD887601b40058C', now() - interval '30 days', now()),
  ('0xA6f024Ad53766d332057d5e40215b695522ee3dE', '0x3333333333333333333333333333333333333001', now() - interval '7 days', now())
ON CONFLICT (pool_address, token_address) DO UPDATE
SET last_seen_at = EXCLUDED.last_seen_at;

INSERT INTO indexer.raw_events (
  scope_key, source, chain_id, block_number, tx_hash, log_index, contract_address, transaction_type, payload, fingerprint, indexed_at
)
VALUES
  (
    'tcoin:42220',
    'rpc',
    42220,
    34567890,
    '0xaaa0000000000000000000000000000000000000000000000000000000000001',
    0,
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    'POOL_SWAP',
    jsonb_build_object('amountIn', '1000000', 'amountOut', '995000'),
    'seed-fingerprint-1',
    now()
  ),
  (
    'tcoin:42220',
    'tracker',
    42220,
    34567891,
    '0xaaa0000000000000000000000000000000000000000000000000000000000002',
    1,
    '0x298A698031e2fD7D8F0c830F3FD887601b40058C',
    'TOKEN_TRANSFER',
    jsonb_build_object('from', '0x1111', 'to', '0xaaaa'),
    'seed-fingerprint-2',
    now()
  )
ON CONFLICT (fingerprint) DO UPDATE
SET block_number = EXCLUDED.block_number,
    payload = EXCLUDED.payload,
    indexed_at = now();

INSERT INTO indexer.city_contract_overrides (
  city_slug, chain_id, city_version, tcoin_address, ttc_address, cad_address,
  orchestrator_address, voting_address, metadata_uri, created_at, updated_at
)
VALUES
  (
    'tcoin',
    42220,
    1,
    '0x298A698031e2fD7D8F0c830F3FD887601b40058C',
    '0x6666666666666666666666666666666666666001',
    '0x6666666666666666666666666666666666666002',
    '0x6666666666666666666666666666666666666003',
    '0x6666666666666666666666666666666666666004',
    'ipfs://seed-city-override',
    now() - interval '30 days',
    now()
  )
ON CONFLICT (city_slug, chain_id) DO UPDATE
SET city_version = EXCLUDED.city_version,
    tcoin_address = EXCLUDED.tcoin_address,
    updated_at = now();

INSERT INTO indexer.bia_event_rollups (
  scope_key, bia_id, chain_id, pool_address, block_number, transaction_type, event_count, volume_in, volume_out, last_tx_hash, updated_at
)
VALUES
  (
    'tcoin:42220',
    '11111111-1111-4111-8111-111111111111',
    42220,
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    34567890,
    'POOL_SWAP',
    3,
    300,
    297,
    '0xaaa0000000000000000000000000000000000000000000000000000000000001',
    now()
  ),
  (
    'tcoin:42220',
    '22222222-2222-4222-8222-222222222222',
    42220,
    '0x1111111111111111111111111111111111111222',
    34567891,
    'POOL_DEPOSIT',
    1,
    50,
    0,
    '0xaaa0000000000000000000000000000000000000000000000000000000000003',
    now()
  )
ON CONFLICT (scope_key, bia_id, chain_id, pool_address, block_number, transaction_type) DO UPDATE
SET event_count = EXCLUDED.event_count,
    volume_in = EXCLUDED.volume_in,
    volume_out = EXCLUDED.volume_out,
    updated_at = now();

INSERT INTO indexer.bia_risk_signals (
  scope_key, bia_id, chain_id, pending_redemption_count, pending_redemption_amount,
  recent_swap_volume, redemption_pressure, concentration_score, stress_level, generated_at
)
VALUES
  ('tcoin:42220', '11111111-1111-4111-8111-111111111111', 42220, 1, 30, 500, 0.2, 0.3, 'low', now()),
  ('tcoin:42220', '22222222-2222-4222-8222-222222222222', 42220, 2, 60, 250, 0.6, 0.8, 'high', now())
ON CONFLICT (scope_key, bia_id, chain_id) DO UPDATE
SET pending_redemption_count = EXCLUDED.pending_redemption_count,
    pending_redemption_amount = EXCLUDED.pending_redemption_amount,
    stress_level = EXCLUDED.stress_level,
    generated_at = EXCLUDED.generated_at;

INSERT INTO indexer.voucher_tokens (
  chain_id, token_address, pool_address, merchant_wallet, merchant_store_id,
  token_name, token_symbol, token_decimals, is_active, first_seen_at, last_seen_at, updated_at
)
VALUES
  (
    42220,
    '0x3333333333333333333333333333333333333001',
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    2501,
    'Seed Local Voucher A',
    'SLVA',
    6,
    true,
    now() - interval '10 days',
    now(),
    now()
  ),
  (
    42220,
    '0x3333333333333333333333333333333333333002',
    '0x1111111111111111111111111111111111111222',
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    2502,
    'Seed Local Voucher B',
    'SLVB',
    6,
    true,
    now() - interval '5 days',
    now(),
    now()
  )
ON CONFLICT (chain_id, token_address, pool_address) DO UPDATE
SET merchant_wallet = EXCLUDED.merchant_wallet,
    merchant_store_id = EXCLUDED.merchant_store_id,
    is_active = EXCLUDED.is_active,
    last_seen_at = EXCLUDED.last_seen_at,
    updated_at = now();

INSERT INTO indexer.wallet_tcoin_balances (scope_key, chain_id, wallet_address, balance, last_block, updated_at)
VALUES
  ('tcoin:42220', 42220, '0x1111111111111111111111111111111111111111', 250, 34567890, now()),
  ('tcoin:42220', 42220, '0x2222222222222222222222222222222222222222', 180, 34567890, now())
ON CONFLICT (scope_key, chain_id, wallet_address) DO UPDATE
SET balance = EXCLUDED.balance,
    last_block = EXCLUDED.last_block,
    updated_at = now();

INSERT INTO indexer.wallet_voucher_balances (scope_key, chain_id, wallet_address, token_address, balance, last_block, updated_at)
VALUES
  ('tcoin:42220', 42220, '0x1111111111111111111111111111111111111111', '0x3333333333333333333333333333333333333001', 12, 34567890, now()),
  ('tcoin:42220', 42220, '0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333002', 7, 34567890, now())
ON CONFLICT (scope_key, chain_id, wallet_address, token_address) DO UPDATE
SET balance = EXCLUDED.balance,
    last_block = EXCLUDED.last_block,
    updated_at = now();

INSERT INTO indexer.merchant_credit_state (
  scope_key, chain_id, merchant_wallet, token_address, pool_address,
  credit_limit, required_liquidity_absolute, required_liquidity_ratio,
  credit_issued, credit_remaining, source_mode, updated_at
)
VALUES
  (
    'tcoin:42220',
    42220,
    '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    '0x3333333333333333333333333333333333333001',
    '0xA6f024Ad53766d332057d5e40215b695522ee3dE',
    500,
    100,
    0.2,
    120,
    380,
    'contract_field',
    now()
  ),
  (
    'tcoin:42220',
    42220,
    '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    '0x3333333333333333333333333333333333333002',
    '0x1111111111111111111111111111111111111222',
    NULL,
    NULL,
    NULL,
    80,
    NULL,
    'derived_supply',
    now()
  )
ON CONFLICT (scope_key, chain_id, merchant_wallet, token_address, pool_address) DO UPDATE
SET credit_limit = EXCLUDED.credit_limit,
    credit_issued = EXCLUDED.credit_issued,
    credit_remaining = EXCLUDED.credit_remaining,
    source_mode = EXCLUDED.source_mode,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Raw chain_data rows for local analytics/testing
-- ---------------------------------------------------------------------------
INSERT INTO chain_data.tx (
  chain_id, tx_hash, block_number, date_block, success, first_seen_at, last_seen_at
)
VALUES
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000001', 34567890, now() - interval '1 day', true, now() - interval '1 day', now()),
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000002', 34567891, now() - interval '23 hours', true, now() - interval '23 hours', now())
ON CONFLICT (chain_id, tx_hash) DO UPDATE
SET block_number = EXCLUDED.block_number,
    date_block = EXCLUDED.date_block,
    success = EXCLUDED.success,
    last_seen_at = now();

INSERT INTO chain_data.tokens (chain_id, contract_address, token_name, token_symbol, token_decimals, sink_address, updated_at)
VALUES
  (42220, '0x298A698031e2fD7D8F0c830F3FD887601b40058C', 'Toronto Coin', 'TCOIN', 6, NULL, now()),
  (42220, '0x3333333333333333333333333333333333333001', 'Seed Local Voucher A', 'SLVA', 6, NULL, now())
ON CONFLICT (chain_id, contract_address) DO UPDATE
SET token_name = EXCLUDED.token_name,
    token_symbol = EXCLUDED.token_symbol,
    token_decimals = EXCLUDED.token_decimals,
    updated_at = now();

INSERT INTO chain_data.pools (chain_id, contract_address, pool_name, pool_symbol, updated_at)
VALUES
  (42220, '0xA6f024Ad53766d332057d5e40215b695522ee3dE', 'Seed Main Pool', 'SPOOL', now()),
  (42220, '0x1111111111111111111111111111111111111222', 'Seed Secondary Pool', 'SPOOL2', now())
ON CONFLICT (chain_id, contract_address) DO UPDATE
SET pool_name = EXCLUDED.pool_name,
    pool_symbol = EXCLUDED.pool_symbol,
    updated_at = now();

INSERT INTO chain_data.token_transfer (
  chain_id, tx_hash, block_number, log_index, sender_address, recipient_address, contract_address, transfer_value
)
VALUES
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000001', 34567890, 0, '0x1111111111111111111111111111111111111111', '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa', '0x298A698031e2fD7D8F0c830F3FD887601b40058C', 12),
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000002', 34567891, 0, '0x2222222222222222222222222222222222222222', '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB', '0x3333333333333333333333333333333333333001', 7)
ON CONFLICT (chain_id, tx_hash, log_index, contract_address, sender_address, recipient_address, transfer_value) DO NOTHING;

INSERT INTO chain_data.token_mint (
  chain_id, tx_hash, block_number, log_index, minter_address, recipient_address, contract_address, mint_value
)
VALUES
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000001', 34567890, 1, '0x5555555555555555555555555555555555555001', '0x1111111111111111111111111111111111111111', '0x298A698031e2fD7D8F0c830F3FD887601b40058C', 99),
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000002', 34567891, 1, '0x5555555555555555555555555555555555555001', '0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333001', 15)
ON CONFLICT (chain_id, tx_hash, log_index, contract_address, minter_address, recipient_address, mint_value) DO NOTHING;

INSERT INTO chain_data.token_burn (
  chain_id, tx_hash, block_number, log_index, burner_address, contract_address, burn_value
)
VALUES
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000001', 34567890, 2, '0x1111111111111111111111111111111111111111', '0x298A698031e2fD7D8F0c830F3FD887601b40058C', 1),
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000002', 34567891, 2, '0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333001', 0.5)
ON CONFLICT (chain_id, tx_hash, log_index, contract_address, burner_address, burn_value) DO NOTHING;

INSERT INTO chain_data.pool_swap (
  chain_id, tx_hash, block_number, log_index, initiator_address, token_in_address, token_out_address, in_value, out_value, contract_address, fee
)
VALUES
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000001', 34567890, 3, '0x1111111111111111111111111111111111111111', '0x298A698031e2fD7D8F0c830F3FD887601b40058C', '0x3333333333333333333333333333333333333001', 10, 9.95, '0xA6f024Ad53766d332057d5e40215b695522ee3dE', 0.05),
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000002', 34567891, 3, '0x2222222222222222222222222222222222222222', '0x298A698031e2fD7D8F0c830F3FD887601b40058C', '0x3333333333333333333333333333333333333002', 8, 7.92, '0x1111111111111111111111111111111111111222', 0.08)
ON CONFLICT (chain_id, tx_hash, log_index, contract_address, initiator_address, token_in_address, token_out_address, in_value, out_value, fee) DO NOTHING;

INSERT INTO chain_data.pool_deposit (
  chain_id, tx_hash, block_number, log_index, initiator_address, token_in_address, in_value, contract_address
)
VALUES
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000001', 34567890, 4, '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa', '0x3333333333333333333333333333333333333001', 100, '0xA6f024Ad53766d332057d5e40215b695522ee3dE'),
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000002', 34567891, 4, '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB', '0x3333333333333333333333333333333333333002', 50, '0x1111111111111111111111111111111111111222')
ON CONFLICT (chain_id, tx_hash, log_index, contract_address, initiator_address, token_in_address, in_value) DO NOTHING;

INSERT INTO chain_data.ownership_change (
  chain_id, tx_hash, block_number, log_index, previous_owner, new_owner, contract_address
)
VALUES
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000001', 34567890, 5, '0x9999999999999999999999999999999999999999', '0xc9Bb94fbB9C93Dbf0058c2E2830F9E15567F6624', '0xA6f024Ad53766d332057d5e40215b695522ee3dE'),
  (42220, '0xaaa0000000000000000000000000000000000000000000000000000000000002', 34567891, 5, '0x9999999999999999999999999999999999999998', '0xc9Bb94fbB9C93Dbf0058c2E2830F9E15567F6624', '0x1111111111111111111111111111111111111222')
ON CONFLICT (chain_id, tx_hash, log_index, contract_address, previous_owner, new_owner) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sequence sync for identity columns seeded with explicit IDs
-- ---------------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('public.users', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.users), 1), true);
SELECT setval(pg_get_serial_sequence('public.wallet_keys', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.wallet_keys), 1), true);
SELECT setval(pg_get_serial_sequence('public.wallet_list', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.wallet_list), 1), true);
SELECT setval(pg_get_serial_sequence('public.user_encrypted_share', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.user_encrypted_share), 1), true);
SELECT setval(pg_get_serial_sequence('public.interac_transfer', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.interac_transfer), 1), true);
SELECT setval(pg_get_serial_sequence('public.off_ramp_req', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.off_ramp_req), 1), true);
SELECT setval(pg_get_serial_sequence('public.act_transactions', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.act_transactions), 1), true);
SELECT setval(pg_get_serial_sequence('public.notifications', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.notifications), 1), true);
SELECT setval(pg_get_serial_sequence('public.app_admin_notifications', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.app_admin_notifications), 1), true);
SELECT setval(pg_get_serial_sequence('public.stores', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.stores), 1), true);
SELECT setval(pg_get_serial_sequence('public.invoice_pay_request', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.invoice_pay_request), 1), true);
SELECT setval(pg_get_serial_sequence('public.connections', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.connections), 1), true);
SELECT setval(pg_get_serial_sequence('public.invites', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.invites), 1), true);
SELECT setval(pg_get_serial_sequence('public.user_requests', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.user_requests), 1), true);

COMMIT;
