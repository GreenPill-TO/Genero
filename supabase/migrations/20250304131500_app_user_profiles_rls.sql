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
        AND u.auth_user_id = auth.uid()
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
        AND u.auth_user_id = auth.uid()
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
        AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = app_user_profiles.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

COMMIT;

-- migrate:down
BEGIN;

DROP POLICY IF EXISTS app_user_profiles_update_self ON public.app_user_profiles;
DROP POLICY IF EXISTS app_user_profiles_insert_self ON public.app_user_profiles;
DROP POLICY IF EXISTS app_user_profiles_select_self ON public.app_user_profiles;

ALTER TABLE IF EXISTS public.app_user_profiles
  NO FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.app_user_profiles
  DISABLE ROW LEVEL SECURITY;

COMMIT;
