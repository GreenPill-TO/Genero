-- Ensure contact form submissions have a destination table across older/newer schemas.

CREATE TABLE IF NOT EXISTS public.user_requests (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_addresses TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  app_instance_id BIGINT
);

ALTER TABLE public.user_requests
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS ip_addresses TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS app_instance_id BIGINT;

CREATE INDEX IF NOT EXISTS user_requests_email_idx
  ON public.user_requests (email);

CREATE INDEX IF NOT EXISTS user_requests_created_at_idx
  ON public.user_requests (created_at);

CREATE INDEX IF NOT EXISTS user_requests_app_instance_id_idx
  ON public.user_requests (app_instance_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ref_app_instances'
  ) THEN
    BEGIN
      ALTER TABLE public.user_requests
        ADD CONSTRAINT user_requests_app_instance_id_fkey
        FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;
