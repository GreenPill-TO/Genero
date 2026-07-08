-- Idempotent remote schema bootstrap for cron logging.
-- Accepts existing table/columns/constraint without failing.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.cron_logs (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "timestamp" timestamp with time zone DEFAULT now(),
  status text,
  note text
);

ALTER TABLE public.cron_logs
  ADD COLUMN IF NOT EXISTS id uuid,
  ADD COLUMN IF NOT EXISTS "timestamp" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.cron_logs
  ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4(),
  ALTER COLUMN "timestamp" SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cron_logs_pkey'
      AND conrelid = 'public.cron_logs'::regclass
  ) THEN
    ALTER TABLE public.cron_logs
      ADD CONSTRAINT cron_logs_pkey PRIMARY KEY (id);
  END IF;
END
$$;
