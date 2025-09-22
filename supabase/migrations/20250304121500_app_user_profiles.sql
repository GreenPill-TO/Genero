-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS public.app_user_profiles (
  user_id bigint NOT NULL,
  app_instance_id bigint NOT NULL,
  persona text,
  tipping_preferences jsonb,
  charity_preferences jsonb,
  onboarding_state jsonb,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, app_instance_id),
  CONSTRAINT app_user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT app_user_profiles_app_instance_id_fkey FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id) ON DELETE CASCADE,
  CONSTRAINT app_user_profiles_persona_fkey FOREIGN KEY (persona) REFERENCES public.ref_personas(persona),
  CONSTRAINT app_user_profiles_tipping_json_check CHECK (tipping_preferences IS NULL OR jsonb_typeof(tipping_preferences) = 'object'),
  CONSTRAINT app_user_profiles_charity_json_check CHECK (charity_preferences IS NULL OR jsonb_typeof(charity_preferences) = 'object'),
  CONSTRAINT app_user_profiles_onboarding_json_check CHECK (onboarding_state IS NULL OR jsonb_typeof(onboarding_state) = 'object'),
  CONSTRAINT app_user_profiles_metadata_json_check CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS app_user_profiles_app_instance_id_idx
  ON public.app_user_profiles(app_instance_id);

WITH target_instances AS (
  SELECT ai.id AS app_instance_id
  FROM public.ref_app_instances ai
  JOIN public.ref_apps a ON a.id = ai.app_id
  WHERE a.slug IN ('sparechange', 'wallet')
),
profile_seed AS (
  SELECT
    u.id AS user_id,
    ti.app_instance_id,
    u.persona,
    NULLIF(
      jsonb_strip_nulls(
        jsonb_build_object(
          'preferred_donation_amount', u.preferred_donation_amount,
          'good_tip', u.good_tip,
          'default_tip', u.default_tip
        )
      ),
      '{}'::jsonb
    ) AS tipping_preferences,
    NULLIF(
      jsonb_strip_nulls(
        jsonb_build_object(
          'selected_cause', u.selected_cause,
          'charity', u.charity
        )
      ),
      '{}'::jsonb
    ) AS charity_preferences,
    NULLIF(
      jsonb_strip_nulls(
        jsonb_build_object(
          'current_step', u.current_step,
          'category', u.category,
          'style', u.style
        )
      ),
      '{}'::jsonb
    ) AS onboarding_state,
    NULL::jsonb AS metadata,
    u.created_at,
    u.updated_at
  FROM public.users u
  CROSS JOIN target_instances ti
)
INSERT INTO public.app_user_profiles (
  user_id,
  app_instance_id,
  persona,
  tipping_preferences,
  charity_preferences,
  onboarding_state,
  metadata,
  created_at,
  updated_at
)
SELECT
  ps.user_id,
  ps.app_instance_id,
  ps.persona,
  ps.tipping_preferences,
  ps.charity_preferences,
  ps.onboarding_state,
  ps.metadata,
  COALESCE(ps.created_at, now()),
  COALESCE(ps.updated_at, now())
FROM profile_seed ps
ON CONFLICT (user_id, app_instance_id) DO UPDATE
SET
  persona = EXCLUDED.persona,
  tipping_preferences = EXCLUDED.tipping_preferences,
  charity_preferences = EXCLUDED.charity_preferences,
  onboarding_state = EXCLUDED.onboarding_state,
  metadata = EXCLUDED.metadata,
  updated_at = now();

ALTER TABLE public.users
  DROP COLUMN IF EXISTS persona,
  DROP COLUMN IF EXISTS preferred_donation_amount,
  DROP COLUMN IF EXISTS selected_cause,
  DROP COLUMN IF EXISTS good_tip,
  DROP COLUMN IF EXISTS default_tip,
  DROP COLUMN IF EXISTS current_step,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS charity,
  DROP COLUMN IF EXISTS style;

COMMIT;

-- migrate:down
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS persona text,
  ADD COLUMN IF NOT EXISTS preferred_donation_amount numeric,
  ADD COLUMN IF NOT EXISTS selected_cause text,
  ADD COLUMN IF NOT EXISTS good_tip smallint,
  ADD COLUMN IF NOT EXISTS default_tip smallint,
  ADD COLUMN IF NOT EXISTS current_step smallint,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS charity text,
  ADD COLUMN IF NOT EXISTS style smallint;

ALTER TABLE public.users
  ADD CONSTRAINT IF NOT EXISTS users_persona_fkey FOREIGN KEY (persona) REFERENCES public.ref_personas(persona);

WITH ranked_profiles AS (
  SELECT
    ap.user_id,
    ap.persona,
    ap.tipping_preferences,
    ap.charity_preferences,
    ap.onboarding_state,
    ROW_NUMBER() OVER (
      PARTITION BY ap.user_id
      ORDER BY
        CASE
          WHEN ai.environment = 'development' THEN 0
          WHEN ai.environment = 'staging' THEN 1
          WHEN ai.environment = 'production' THEN 2
          ELSE 3
        END,
        ap.updated_at DESC NULLS LAST,
        ap.created_at DESC NULLS LAST,
        ap.app_instance_id
    ) AS env_rank
  FROM public.app_user_profiles ap
  JOIN public.ref_app_instances ai ON ai.id = ap.app_instance_id
  JOIN public.ref_apps a ON a.id = ai.app_id
  WHERE a.slug = 'sparechange'
)
UPDATE public.users u
SET
  persona = rp.persona,
  preferred_donation_amount = (rp.tipping_preferences ->> 'preferred_donation_amount')::numeric,
  selected_cause = rp.charity_preferences ->> 'selected_cause',
  good_tip = (rp.tipping_preferences ->> 'good_tip')::smallint,
  default_tip = (rp.tipping_preferences ->> 'default_tip')::smallint,
  charity = rp.charity_preferences ->> 'charity',
  current_step = (rp.onboarding_state ->> 'current_step')::smallint,
  category = rp.onboarding_state ->> 'category',
  style = (rp.onboarding_state ->> 'style')::smallint
FROM ranked_profiles rp
WHERE rp.env_rank = 1 AND rp.user_id = u.id;

DROP INDEX IF EXISTS public.app_user_profiles_app_instance_id_idx;
DROP TABLE IF EXISTS public.app_user_profiles;

COMMIT;
