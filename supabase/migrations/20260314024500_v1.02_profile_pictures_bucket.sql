-- v1.02: profile pictures storage bucket + access policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile_pictures', 'profile_pictures', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_pictures_public_read'
  ) THEN
    CREATE POLICY profile_pictures_public_read
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'profile_pictures');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_pictures_authenticated_insert'
  ) THEN
    CREATE POLICY profile_pictures_authenticated_insert
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'profile_pictures');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_pictures_authenticated_update'
  ) THEN
    CREATE POLICY profile_pictures_authenticated_update
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'profile_pictures')
      WITH CHECK (bucket_id = 'profile_pictures');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_pictures_authenticated_delete'
  ) THEN
    CREATE POLICY profile_pictures_authenticated_delete
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'profile_pictures');
  END IF;
END $$;

-- DOWN
-- DROP POLICY IF EXISTS profile_pictures_authenticated_delete ON storage.objects;
-- DROP POLICY IF EXISTS profile_pictures_authenticated_update ON storage.objects;
-- DROP POLICY IF EXISTS profile_pictures_authenticated_insert ON storage.objects;
-- DROP POLICY IF EXISTS profile_pictures_public_read ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'profile_pictures';
