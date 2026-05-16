-- migrate:up
BEGIN;

ALTER TABLE IF EXISTS public.app_user_profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.app_user_profiles
  FORCE ROW LEVEL SECURITY;

CREATE POLICY app_user_profiles_select_self
  ON public.app_user_profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = app_user_profiles.user_id
        AND u.auth_user_id = auth.uid()::text
    )
  );

CREATE POLICY app_user_profiles_insert_self
  ON public.app_user_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = app_user_profiles.user_id
        AND u.auth_user_id = auth.uid()::text
    )
  );

CREATE POLICY app_user_profiles_update_self
  ON public.app_user_profiles
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = app_user_profiles.user_id
        AND u.auth_user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = app_user_profiles.user_id
        AND u.auth_user_id = auth.uid()::text
    )
  );

COMMIT;
