-- v1.02: profile pictures storage bucket + access policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile_pictures', 'profile_pictures', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS profile_pictures_public_read ON storage.objects;
CREATE POLICY profile_pictures_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile_pictures');

DROP POLICY IF EXISTS profile_pictures_authenticated_insert ON storage.objects;
CREATE POLICY profile_pictures_authenticated_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile_pictures'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_pictures_authenticated_update ON storage.objects;
CREATE POLICY profile_pictures_authenticated_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile_pictures'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile_pictures'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_pictures_authenticated_delete ON storage.objects;
CREATE POLICY profile_pictures_authenticated_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile_pictures'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- DOWN
-- DROP POLICY IF EXISTS profile_pictures_authenticated_delete ON storage.objects;
-- DROP POLICY IF EXISTS profile_pictures_authenticated_update ON storage.objects;
-- DROP POLICY IF EXISTS profile_pictures_authenticated_insert ON storage.objects;
-- DROP POLICY IF EXISTS profile_pictures_public_read ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'profile_pictures';
