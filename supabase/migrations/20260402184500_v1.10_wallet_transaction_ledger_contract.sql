-- v1.10: formalize the local wallet transaction ledger contract used by history, recents, notifications, and simple transfer bookkeeping.

ALTER TABLE IF EXISTS public.act_transactions
  ADD COLUMN IF NOT EXISTS transaction_category text,
  ADD COLUMN IF NOT EXISTS amount numeric(20,8),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS token_price numeric(20,8),
  ADD COLUMN IF NOT EXISTS wallet_account_from text,
  ADD COLUMN IF NOT EXISTS wallet_account_to text;

UPDATE public.act_transactions
SET transaction_category = CASE
  WHEN onramp_request_id IS NOT NULL THEN 'onramp'
  WHEN offramp_request_id IS NOT NULL THEN 'offramp'
  ELSE 'transfer'
END
WHERE transaction_category IS NULL;

UPDATE public.act_transactions
SET currency = 'TCOIN'
WHERE currency IS NULL;

ALTER TABLE IF EXISTS public.act_transactions
  ALTER COLUMN transaction_category SET DEFAULT 'transfer';

ALTER TABLE IF EXISTS public.act_transactions
  ALTER COLUMN currency SET DEFAULT 'TCOIN';

CREATE INDEX IF NOT EXISTS act_transactions_wallet_from_created_idx
  ON public.act_transactions (wallet_account_from, created_at DESC)
  WHERE wallet_account_from IS NOT NULL;

CREATE INDEX IF NOT EXISTS act_transactions_wallet_to_created_idx
  ON public.act_transactions (wallet_account_to, created_at DESC)
  WHERE wallet_account_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS act_transactions_category_created_idx
  ON public.act_transactions (transaction_category, created_at DESC);

CREATE OR REPLACE VIEW public.act_transaction_entries AS
SELECT
  atx.id,
  atx.app_instance_id,
  atx.created_by,
  atx.transaction_category,
  atx.amount,
  atx.currency,
  atx.token_price,
  atx.wallet_account_from,
  atx.wallet_account_to,
  atx.created_at
FROM public.act_transactions atx
WHERE atx.wallet_account_from IS NOT NULL
   OR atx.wallet_account_to IS NOT NULL;

GRANT SELECT ON public.act_transaction_entries TO authenticated;

CREATE OR REPLACE FUNCTION public.simple_transfer(
  recipient_wallet text,
  sender_wallet text,
  token_price numeric,
  transfer_amount numeric,
  transfer_user_id bigint
)
RETURNS public.act_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_app_instance_id bigint;
  inserted_row public.act_transactions;
BEGIN
  IF recipient_wallet IS NULL OR btrim(recipient_wallet) = '' THEN
    RAISE EXCEPTION 'recipient_wallet is required';
  END IF;

  IF sender_wallet IS NULL OR btrim(sender_wallet) = '' THEN
    RAISE EXCEPTION 'sender_wallet is required';
  END IF;

  IF transfer_user_id IS NULL OR transfer_user_id <= 0 THEN
    RAISE EXCEPTION 'transfer_user_id must be a positive integer';
  END IF;

  IF transfer_amount IS NULL OR transfer_amount <= 0 THEN
    RAISE EXCEPTION 'transfer_amount must be a positive number';
  END IF;

  SELECT aup.app_instance_id
  INTO resolved_app_instance_id
  FROM public.app_user_profiles aup
  JOIN public.ref_app_instances ai
    ON ai.id = aup.app_instance_id
  JOIN public.ref_apps ra
    ON ra.id = ai.app_id
  WHERE aup.user_id = transfer_user_id
    AND ra.slug = 'wallet'
  ORDER BY COALESCE(aup.updated_at, aup.created_at) DESC, aup.app_instance_id DESC
  LIMIT 1;

  IF resolved_app_instance_id IS NULL THEN
    SELECT ai.id
    INTO resolved_app_instance_id
    FROM public.ref_app_instances ai
    JOIN public.ref_apps ra
      ON ra.id = ai.app_id
    JOIN public.ref_citycoins rc
      ON rc.id = ai.citycoin_id
    WHERE ra.slug = 'wallet'
      AND rc.slug = 'tcoin'
    ORDER BY
      CASE
        WHEN ai.environment = 'local' THEN 0
        WHEN ai.environment = 'development' THEN 1
        ELSE 2
      END,
      ai.id ASC
    LIMIT 1;
  END IF;

  IF resolved_app_instance_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve an app instance for wallet transfer bookkeeping';
  END IF;

  INSERT INTO public.act_transactions (
    created_by,
    app_instance_id,
    transaction_category,
    amount,
    currency,
    token_price,
    wallet_account_from,
    wallet_account_to
  )
  VALUES (
    transfer_user_id,
    resolved_app_instance_id,
    'transfer',
    transfer_amount,
    'TCOIN',
    COALESCE(token_price, 3.35),
    lower(btrim(sender_wallet)),
    lower(btrim(recipient_wallet))
  )
  RETURNING *
  INTO inserted_row;

  RETURN inserted_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.simple_transfer(text, text, numeric, numeric, bigint) TO service_role;

-- DOWN
-- REVOKE EXECUTE ON FUNCTION public.simple_transfer(text, text, numeric, numeric, bigint) FROM service_role;
-- DROP FUNCTION IF EXISTS public.simple_transfer(text, text, numeric, numeric, bigint);
-- REVOKE SELECT ON public.act_transaction_entries FROM authenticated;
-- DROP VIEW IF EXISTS public.act_transaction_entries;
-- DROP INDEX IF EXISTS public.act_transactions_category_created_idx;
-- DROP INDEX IF EXISTS public.act_transactions_wallet_to_created_idx;
-- DROP INDEX IF EXISTS public.act_transactions_wallet_from_created_idx;
-- ALTER TABLE IF EXISTS public.act_transactions ALTER COLUMN currency DROP DEFAULT;
-- ALTER TABLE IF EXISTS public.act_transactions ALTER COLUMN transaction_category DROP DEFAULT;
-- ALTER TABLE IF EXISTS public.act_transactions DROP COLUMN IF EXISTS wallet_account_to;
-- ALTER TABLE IF EXISTS public.act_transactions DROP COLUMN IF EXISTS wallet_account_from;
-- ALTER TABLE IF EXISTS public.act_transactions DROP COLUMN IF EXISTS token_price;
-- ALTER TABLE IF EXISTS public.act_transactions DROP COLUMN IF EXISTS currency;
-- ALTER TABLE IF EXISTS public.act_transactions DROP COLUMN IF EXISTS amount;
-- ALTER TABLE IF EXISTS public.act_transactions DROP COLUMN IF EXISTS transaction_category;
