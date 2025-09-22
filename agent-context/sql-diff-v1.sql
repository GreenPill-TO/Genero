-- v0.67
CREATE TABLE public.app_user_profiles (
    user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    app_instance_id bigint NOT NULL REFERENCES public.ref_app_instances(id) ON DELETE CASCADE,
    persona text REFERENCES public.ref_personas(persona),
    tipping_preferences jsonb,
    charity_preferences jsonb,
    onboarding_state jsonb,
    metadata jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, app_instance_id)
);
CREATE INDEX app_user_profiles_app_instance_id_idx ON public.app_user_profiles(app_instance_id);
ALTER TABLE public.users DROP COLUMN IF EXISTS persona, DROP COLUMN IF EXISTS preferred_donation_amount, DROP COLUMN IF EXISTS selected_cause, DROP COLUMN IF EXISTS good_tip, DROP COLUMN IF EXISTS default_tip, DROP COLUMN IF EXISTS current_step, DROP COLUMN IF EXISTS category, DROP COLUMN IF EXISTS charity, DROP COLUMN IF EXISTS style;

-- SQL diff placeholder
