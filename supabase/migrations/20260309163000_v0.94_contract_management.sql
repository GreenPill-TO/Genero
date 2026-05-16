-- v0.94: contract management metadata + app registry seed

-- 1) Register new app slug for contract management
INSERT INTO public.ref_apps (slug, name)
VALUES ('contracts', 'Contract Management')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ref_app_instances (
  slug,
  app_id,
  citycoin_id,
  environment,
  notes
)
SELECT
  'contracts-tcoin-local',
  a.id,
  c.id,
  'local',
  'Contract management interface for TCOIN ecosystem'
FROM public.ref_apps a
JOIN public.ref_citycoins c ON c.slug = 'tcoin'
WHERE a.slug = 'contracts'
ON CONFLICT (slug) DO NOTHING;

-- 2) Proposal metadata storage
CREATE TABLE IF NOT EXISTS public.contract_mgmt_proposal_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_slug text NOT NULL,
  proposal_type text NOT NULL CHECK (proposal_type IN ('charity', 'reserve')),
  title text NOT NULL,
  description text NOT NULL,
  image_url text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS contract_mgmt_proposal_metadata_city_idx
  ON public.contract_mgmt_proposal_metadata(city_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS public.contract_mgmt_proposal_links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_id bigint NOT NULL,
  city_slug text NOT NULL,
  metadata_id uuid NOT NULL REFERENCES public.contract_mgmt_proposal_metadata(id) ON DELETE CASCADE,
  tx_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (proposal_id, city_slug)
);

CREATE INDEX IF NOT EXISTS contract_mgmt_proposal_links_city_idx
  ON public.contract_mgmt_proposal_links(city_slug, created_at DESC);

-- 3) Enable RLS
ALTER TABLE IF EXISTS public.contract_mgmt_proposal_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contract_mgmt_proposal_links ENABLE ROW LEVEL SECURITY;

-- 4) Policies: authenticated read; admin-only writes for metadata and links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_mgmt_proposal_metadata'
      AND policyname = 'contract_mgmt_proposal_metadata_select_authenticated'
  ) THEN
    CREATE POLICY contract_mgmt_proposal_metadata_select_authenticated
      ON public.contract_mgmt_proposal_metadata
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_mgmt_proposal_metadata'
      AND policyname = 'contract_mgmt_proposal_metadata_insert_admin'
  ) THEN
    CREATE POLICY contract_mgmt_proposal_metadata_insert_admin
      ON public.contract_mgmt_proposal_metadata
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = created_by_user_id
            AND u.auth_user_id = auth.uid()::text
            AND COALESCE(u.is_admin, false) = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_mgmt_proposal_metadata'
      AND policyname = 'contract_mgmt_proposal_metadata_update_admin'
  ) THEN
    CREATE POLICY contract_mgmt_proposal_metadata_update_admin
      ON public.contract_mgmt_proposal_metadata
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = created_by_user_id
            AND u.auth_user_id = auth.uid()::text
            AND COALESCE(u.is_admin, false) = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = created_by_user_id
            AND u.auth_user_id = auth.uid()::text
            AND COALESCE(u.is_admin, false) = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_mgmt_proposal_links'
      AND policyname = 'contract_mgmt_proposal_links_select_authenticated'
  ) THEN
    CREATE POLICY contract_mgmt_proposal_links_select_authenticated
      ON public.contract_mgmt_proposal_links
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contract_mgmt_proposal_links'
      AND policyname = 'contract_mgmt_proposal_links_insert_admin'
  ) THEN
    CREATE POLICY contract_mgmt_proposal_links_insert_admin
      ON public.contract_mgmt_proposal_links
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.contract_mgmt_proposal_metadata m
          JOIN public.users u ON u.id = m.created_by_user_id
          WHERE m.id = metadata_id
            AND u.auth_user_id = auth.uid()::text
            AND COALESCE(u.is_admin, false) = true
        )
      );
  END IF;
END $$;

-- 5) Storage bucket for charity images
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-management', 'contract-management', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'contract_mgmt_public_read'
  ) THEN
    CREATE POLICY contract_mgmt_public_read
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'contract-management');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'contract_mgmt_admin_write'
  ) THEN
    CREATE POLICY contract_mgmt_admin_write
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'contract-management');
  END IF;
END $$;
