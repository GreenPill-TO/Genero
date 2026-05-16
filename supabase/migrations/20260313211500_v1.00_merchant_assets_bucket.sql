-- v1.00: merchant assets storage bucket + access policies

-- 1) Create bucket idempotently
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchant_assets', 'merchant_assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2) Public read policy for merchant assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'merchant_assets_public_read'
  ) THEN
    CREATE POLICY merchant_assets_public_read
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'merchant_assets');
  END IF;
END $$;

-- 3) Authenticated upload policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'merchant_assets_authenticated_insert'
  ) THEN
    CREATE POLICY merchant_assets_authenticated_insert
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'merchant_assets');
  END IF;
END $$;

-- 4) Authenticated update policy (needed for upload upserts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'merchant_assets_authenticated_update'
  ) THEN
    CREATE POLICY merchant_assets_authenticated_update
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'merchant_assets')
      WITH CHECK (bucket_id = 'merchant_assets');
  END IF;
END $$;

-- 5) Optional cleanup policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'merchant_assets_authenticated_delete'
  ) THEN
    CREATE POLICY merchant_assets_authenticated_delete
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'merchant_assets');
  END IF;
END $$;
