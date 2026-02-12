-- Supabase schema snapshot generated on 2025-09-22T15:28:15.957Z
-- Source: https://kyxsjnwkvddgjqigdpsv.supabase.co
SET search_path TO public;

DO $$
BEGIN
  CREATE TYPE public."connection_state" AS ENUM ('new', 'added', 'removed', 'declined');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."invite_status" AS ENUM ('unused', 'used');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."invite_type" AS ENUM ('ephemeral', 'email');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."namespace" AS ENUM ('EVM', 'Solana', 'Near', 'Cardano');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."trx_status" AS ENUM ('initiated', 'completed', 'failed', 'aborted', 'burned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public."trx_type" AS ENUM ('credit', 'debit');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public."act_balances" (
  "wallet_account" text NOT NULL,
  "currency" text DEFAULT 'CAD'::text NOT NULL,
  "balance" numeric NOT NULL,
  "previous_balance" numeric NOT NULL,
  "last_trx_id" bigint NOT NULL,
  "as_of_date" timestamp with time zone DEFAULT now() NOT NULL,
  "sequential_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "bookkeeping_account" text DEFAULT 'user-wallet' NOT NULL,
  PRIMARY KEY ("wallet_account", "currency", "bookkeeping_account"),
  FOREIGN KEY ("wallet_account") REFERENCES public."wallet_list"("public_key"),
  FOREIGN KEY ("currency") REFERENCES public."ref_currencies"("symbol"),
  FOREIGN KEY ("last_trx_id") REFERENCES public."act_transactions"("id"),
  FOREIGN KEY ("bookkeeping_account") REFERENCES public."ref_bookkeeping_accounts"("account")
);

CREATE TABLE IF NOT EXISTS public."act_transaction_entries" (
  "id" bigint NOT NULL,
  "transaction_id" bigint NOT NULL,
  "wallet_account_to" text,
  "amount" numeric NOT NULL,
  "trx_type" public.trx_type NOT NULL,
  "currency" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "bookkeeping_account" text,
  "memo" text,
  "wallet_account_from" text,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("transaction_id") REFERENCES public."act_transactions"("id"),
  FOREIGN KEY ("wallet_account_to") REFERENCES public."wallet_list"("public_key"),
  FOREIGN KEY ("currency") REFERENCES public."ref_currencies"("symbol"),
  FOREIGN KEY ("bookkeeping_account") REFERENCES public."ref_bookkeeping_accounts"("account"),
  FOREIGN KEY ("wallet_account_from") REFERENCES public."wallet_list"("public_key")
);

CREATE TABLE IF NOT EXISTS public."act_transactions" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" bigint,
  "transaction_category" text DEFAULT 'transfer' NOT NULL,
  "onramp_request_id" bigint,
  "offramp_request_id" bigint,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("created_by") REFERENCES public."users"("id"),
  FOREIGN KEY ("transaction_category") REFERENCES public."ref_trx_categories"("category"),
  FOREIGN KEY ("onramp_request_id") REFERENCES public."interac_transfer"("id"),
  FOREIGN KEY ("offramp_request_id") REFERENCES public."off_ramp_req"("id")
);

CREATE TABLE IF NOT EXISTS public."addresses_deprecated" (
  "public_key" text NOT NULL,
  "user_id" bigint NOT NULL,
  "sequential_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "namespace" public.namespace DEFAULT 'EVM' NOT NULL,
  "store_parent" bigint,
  PRIMARY KEY ("public_key"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id"),
  FOREIGN KEY ("store_parent") REFERENCES public."stores"("id")
);

CREATE TABLE IF NOT EXISTS public."app_admin_notifications" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "notification_name" text,
  "user_id" bigint,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id")
);

CREATE TABLE IF NOT EXISTS public."app_user_profiles" (
  "user_id" bigint NOT NULL,
  "app_instance_id" bigint NOT NULL,
  "persona" text,
  "tipping_preferences" jsonb,
  "charity_preferences" jsonb,
  "onboarding_state" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "app_instance_id"),
  CONSTRAINT app_user_profiles_tipping_json_check CHECK (("tipping_preferences" IS NULL) OR (jsonb_typeof("tipping_preferences") = 'object')),
  CONSTRAINT app_user_profiles_charity_json_check CHECK (("charity_preferences" IS NULL) OR (jsonb_typeof("charity_preferences") = 'object')),
  CONSTRAINT app_user_profiles_onboarding_json_check CHECK (("onboarding_state" IS NULL) OR (jsonb_typeof("onboarding_state") = 'object')),
  CONSTRAINT app_user_profiles_metadata_json_check CHECK (("metadata" IS NULL) OR (jsonb_typeof("metadata") = 'object')),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("app_instance_id") REFERENCES public."ref_app_instances"("id") ON DELETE CASCADE,
  FOREIGN KEY ("persona") REFERENCES public."ref_personas"("persona")
);

CREATE INDEX IF NOT EXISTS app_user_profiles_app_instance_id_idx
  ON public."app_user_profiles" ("app_instance_id");

ALTER TABLE IF EXISTS public."app_user_profiles"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public."app_user_profiles"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY app_user_profiles_select_self
  ON public."app_user_profiles"
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."users" u
      WHERE u."id" = public."app_user_profiles"."user_id"
        AND u."auth_user_id" = auth.uid()
    )
  );

CREATE POLICY app_user_profiles_insert_self
  ON public."app_user_profiles"
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."users" u
      WHERE u."id" = public."app_user_profiles"."user_id"
        AND u."auth_user_id" = auth.uid()
    )
  );

CREATE POLICY app_user_profiles_update_self
  ON public."app_user_profiles"
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."users" u
      WHERE u."id" = public."app_user_profiles"."user_id"
        AND u."auth_user_id" = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."users" u
      WHERE u."id" = public."app_user_profiles"."user_id"
        AND u."auth_user_id" = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public."ref_apps" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT apps_slug_key UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS public."ref_citycoins" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "symbol" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT citycoins_slug_key UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS public."ref_app_instances" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "slug" text NOT NULL,
  "app_id" bigint NOT NULL,
  "citycoin_id" bigint NOT NULL,
  "environment" text DEFAULT 'development'::text NOT NULL,
  "site_url" text,
  "supabase_project_ref" text,
  "supabase_url" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT app_instances_slug_key UNIQUE ("slug"),
  CONSTRAINT app_instances_app_city_env_key UNIQUE ("app_id", "citycoin_id", "environment"),
  FOREIGN KEY ("app_id") REFERENCES public."ref_apps"("id") ON DELETE CASCADE,
  FOREIGN KEY ("citycoin_id") REFERENCES public."ref_citycoins"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."charities" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "name" text,
  "sc_identifier" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."connections" (
  "id" bigint NOT NULL,
  "owner_user_id" bigint NOT NULL,
  "connected_user_id" bigint NOT NULL,
  "state" public.connection_state DEFAULT 'new' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "modified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "app_instance_id" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT connections_app_instance_id_fkey FOREIGN KEY ("app_instance_id") REFERENCES public."ref_app_instances"("id"),
  CONSTRAINT connections_owner_profile_fkey FOREIGN KEY ("owner_user_id", "app_instance_id") REFERENCES public."app_user_profiles"("user_id", "app_instance_id") ON DELETE CASCADE,
  CONSTRAINT connections_connected_profile_fkey FOREIGN KEY ("connected_user_id", "app_instance_id") REFERENCES public."app_user_profiles"("user_id", "app_instance_id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."control_variables" (
  "variable" text NOT NULL,
  "value" text NOT NULL,
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("variable")
);

CREATE TABLE IF NOT EXISTS public."cron_logs" (
  "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now(),
  "status" text,
  "note" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."interac_transfer" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" bigint NOT NULL,
  "interac_code" text,
  "is_sent" boolean,
  "amount" numeric,
  "admin_notes" text,
  "bank_reference" text,
  "approved_by_user" bigint,
  "approved_timestamp" timestamp with time zone,
  "status" text DEFAULT 'requested',
  "amount_override" numeric,
  "app_instance_id" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT interac_transfer_id_app_instance_key UNIQUE ("id", "app_instance_id"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id"),
  FOREIGN KEY ("approved_by_user") REFERENCES public."users"("id"),
  FOREIGN KEY ("status") REFERENCES public."ref_request_statuses"("status"),
  CONSTRAINT interac_transfer_app_instance_id_fkey FOREIGN KEY ("app_instance_id") REFERENCES public."ref_app_instances"("id")
);

CREATE TABLE IF NOT EXISTS public."invites" (
  "id" bigint NOT NULL,
  "token" text DEFAULT public.nanoid(8) NOT NULL,
  "type" public.invite_type DEFAULT 'ephemeral' NOT NULL,
  "from_user_id" bigint NOT NULL,
  "used_by_user_id" bigint,
  "status" public.invite_status DEFAULT 'unused' NOT NULL,
  "expires_at" timestamp with time zone DEFAULT (now() + '00:01:00'::interval) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("from_user_id") REFERENCES public."users"("id"),
  FOREIGN KEY ("used_by_user_id") REFERENCES public."users"("id")
);

CREATE TABLE IF NOT EXISTS public."invoice_pay_request" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_from" bigint,
  "request_by" bigint,
  "amount_requested" real,
  "paid_at" timestamp with time zone,
  "transaction_id" bigint,
  "is_active" boolean DEFAULT true,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("request_from") REFERENCES public."users"("id"),
  FOREIGN KEY ("request_by") REFERENCES public."users"("id"),
  FOREIGN KEY ("transaction_id") REFERENCES public."act_transactions"("id")
);

CREATE TABLE IF NOT EXISTS public."notifications" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "notification" text,
  "user_id" bigint,
  "trx_entry_id" bigint,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id"),
  FOREIGN KEY ("trx_entry_id") REFERENCES public."act_transactions"("id")
);

CREATE TABLE IF NOT EXISTS public."off_ramp_req" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "cad_to_user" numeric NOT NULL,
  "user_id" bigint NOT NULL,
  "interac_transfer_target" text,
  "tokens_burned" numeric NOT NULL,
  "exchange_rate" numeric NOT NULL,
  "cad_off_ramp_fee" numeric,
  "admin_notes" text,
  "bank_reference_number" text,
  "status" public.trx_status DEFAULT 'initiated' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  "token_balance_before_burn" numeric,
  "is_store" boolean DEFAULT false NOT NULL,
  "wallet_account" text,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id")
);

CREATE TABLE IF NOT EXISTS public."ref_bookkeeping_accounts" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "account" text NOT NULL,
  "currency" text,
  "classification" text,
  "note" text,
  "is_system" boolean DEFAULT true NOT NULL,
  PRIMARY KEY ("account"),
  FOREIGN KEY ("currency") REFERENCES public."ref_currencies"("symbol")
);

CREATE TABLE IF NOT EXISTS public."ref_countries" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "country_name" text,
  "country_code" smallint,
  "combined" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."ref_currencies" (
  "sequential_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "symbol" text NOT NULL,
  "name" text,
  PRIMARY KEY ("symbol")
);

CREATE TABLE IF NOT EXISTS public."ref_personas" (
  "persona" text NOT NULL,
  "descr_short" text,
  "descr_long" text,
  "sequential_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("persona")
);

CREATE TABLE IF NOT EXISTS public."ref_request_statuses" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" text NOT NULL,
  "description" text,
  PRIMARY KEY ("status")
);

CREATE TABLE IF NOT EXISTS public."ref_roles" (
  "sequential_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "role" text NOT NULL,
  "is_store" boolean DEFAULT false NOT NULL,
  "can_mint" boolean DEFAULT false NOT NULL,
  "can_burn" boolean DEFAULT false NOT NULL,
  PRIMARY KEY ("role")
);

CREATE TABLE IF NOT EXISTS public."ref_trx_categories" (
  "category" text NOT NULL,
  "descr_short" text,
  "descr_long" text,
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("category")
);

CREATE TABLE IF NOT EXISTS public."roles" (
  "sequential_id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" bigint NOT NULL,
  "role" text NOT NULL,
  "assigned_by" bigint NOT NULL,
  PRIMARY KEY ("user_id", "role"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id"),
  FOREIGN KEY ("role") REFERENCES public."ref_roles"("role"),
  FOREIGN KEY ("assigned_by") REFERENCES public."users"("id")
);

CREATE TABLE IF NOT EXISTS public."store_employees" (
  "id" bigint NOT NULL,
  "store_id" bigint NOT NULL,
  "user_id" bigint NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "store_account" text,
  PRIMARY KEY ("store_id", "user_id"),
  FOREIGN KEY ("store_id") REFERENCES public."stores"("id"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id"),
  FOREIGN KEY ("role") REFERENCES public."ref_roles"("role"),
  FOREIGN KEY ("store_account") REFERENCES public."addresses_deprecated"("public_key")
);

CREATE TABLE IF NOT EXISTS public."stores" (
  "id" bigint NOT NULL,
  "name" text NOT NULL,
  "descr_short" text,
  "descr_long" text,
  "primary_public_key" text NOT NULL,
  "lat" double precision NOT NULL,
  "long" double precision NOT NULL,
  "uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("primary_public_key") REFERENCES public."addresses_deprecated"("public_key")
);

CREATE TABLE IF NOT EXISTS public."wallet_keys" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "user_id" bigint NOT NULL,
  "namespace" public.namespace DEFAULT 'EVM' NOT NULL,
  "app_share" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("user_id", "namespace"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id")
);

CREATE TABLE IF NOT EXISTS public."user_encrypted_share" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" bigint,
  "wallet_key_id" bigint NOT NULL,
  "user_share_encrypted" jsonb,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id"),
  FOREIGN KEY ("wallet_key_id") REFERENCES public."wallet_keys"("id")
);

CREATE TABLE IF NOT EXISTS public."user_requests" (
  "id" bigint NOT NULL,
  "name" text,
  "email" text,
  "message" text,
  "ip_addresses" text[],
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."users" (
  "id" bigint NOT NULL,
  "cubid_id" uuid,
  "username" text,
  "email" text,
  "phone" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "has_completed_intro" boolean DEFAULT false NOT NULL,
  "auth_user_id" uuid DEFAULT auth.uid(),
  "is_new_user" boolean,
  "is_admin" boolean DEFAULT false,
  "cubid_score" jsonb,
  "cubid_identity" jsonb,
  "cubid_score_details" jsonb,
  "updated_at" timestamp with time zone DEFAULT now(),
  "full_name" text,
  "bio" text,
  "profile_image_url" text DEFAULT 'https://github.com/shadcn.png',
  "address" text,
  "user_identifier" text DEFAULT public.nanoid(6) NOT NULL,
  "given_names" text,
  "family_name" text,
  "nickname" text,
  "country" text,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("country") REFERENCES public."ref_countries"("combined")
);

CREATE TABLE IF NOT EXISTS public."wallet_list" (
  "id" bigint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "public_key" text,
  "user_id" bigint,
  "is_generated" boolean,
  "store_parent" bigint,
  "wallet_key_id" bigint NOT NULL,
  "namespace" public.namespace DEFAULT 'EVM' NOT NULL,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES public."users"("id"),
  FOREIGN KEY ("store_parent") REFERENCES public."stores"("id"),
  FOREIGN KEY ("wallet_key_id") REFERENCES public."wallet_keys"("id")
);

-- Functions exposed via PostgREST (signatures only)
-- Function: public.accounting_after_offramp_burn
--   p_offramp_req_id: bigint NOT NULL
--   Returns: not exposed via anon key
--   Body: not accessible via anon key

-- Function: public.create_off_ramp_request
--   p_current_token_balance: numeric NOT NULL
--   p_etransfer_target: text NOT NULL
--   p_exchange_rate: numeric NOT NULL
--   p_is_store: boolean NOT NULL
--   p_tokens_burned: numeric NOT NULL
--   p_user_id: bigint NOT NULL
--   p_wallet_account: text NOT NULL
--   Returns: not exposed via anon key
--   Body: not accessible via anon key

-- Function: public.mint_with_gasfees
--   admin_note_input: text NOT NULL
--   amount_changes: boolean
--   approver_user_id: bigint NOT NULL
--   bank_reference_input: text NOT NULL
--   fee_amount: numeric
--   gas_fee_allocation: numeric
--   gas_token_price: numeric
--   on_ramp_request_id: bigint NOT NULL
--   token_allocation: numeric
--   token_price: numeric
--   Returns: not exposed via anon key
--   Body: not accessible via anon key

-- Function: public.mint_without_gasfees
--   admin_note_input: text NOT NULL
--   amount_changes: boolean
--   approver_user_id: bigint NOT NULL
--   bank_reference_input: text NOT NULL
--   on_ramp_request_id: bigint NOT NULL
--   token_allocation: numeric
--   token_price: numeric
--   Returns: not exposed via anon key
--   Body: not accessible via anon key

-- Function: public.nanoid
--   alphabet: text
--   size: integer
--   Returns: not exposed via anon key
--   Body: not accessible via anon key

-- Function: public.simple_transfer
--   recipient_wallet: text NOT NULL
--   sender_wallet: text NOT NULL
--   token_price: numeric NOT NULL
--   transfer_amount: numeric NOT NULL
--   transfer_user_id: bigint NOT NULL
--   Returns: not exposed via anon key
--   Body: not accessible via anon key
