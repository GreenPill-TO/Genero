BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.charities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'charities_name_key'
      AND conrelid = 'public.charities'::regclass
  ) THEN
    ALTER TABLE public.charities
      ADD CONSTRAINT charities_name_key UNIQUE (name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'charities_value_key'
      AND conrelid = 'public.charities'::regclass
  ) THEN
    ALTER TABLE public.charities
      ADD CONSTRAINT charities_value_key UNIQUE (value);
  END IF;
END
$$;

ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'charities'
      AND policyname = 'charities_read_authenticated'
  ) THEN
    CREATE POLICY charities_read_authenticated
      ON public.charities
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

GRANT SELECT ON public.charities TO authenticated;
GRANT ALL ON public.charities TO service_role;

INSERT INTO public.charities (id, name, value)
VALUES
  ('a1111111-1111-4111-8111-111111111111', 'Daily Bread Food Bank', 'daily-bread-food-bank')
ON CONFLICT (value) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = timezone('utc', now());

INSERT INTO public.charities (id, name, value)
VALUES
  ('a2222222-2222-4222-8222-222222222222', 'Native Women''s Resource Centre of Toronto', 'native-womens-resource-centre-of-toronto')
ON CONFLICT (value) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = timezone('utc', now());

INSERT INTO public.charities (id, name, value)
VALUES
  ('a3333333-3333-4333-8333-333333333333', 'Parkdale Community Food Bank', 'parkdale-community-food-bank')
ON CONFLICT (value) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = timezone('utc', now());

COMMIT;

-- DOWN
-- BEGIN;
-- DELETE FROM public.charities
-- WHERE id IN (
--   'a1111111-1111-4111-8111-111111111111',
--   'a2222222-2222-4222-8222-222222222222',
--   'a3333333-3333-4333-8333-333333333333'
-- );
-- DROP POLICY IF EXISTS charities_read_authenticated ON public.charities;
-- DROP TABLE IF EXISTS public.charities;
-- COMMIT;
