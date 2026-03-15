-- migrate:up
BEGIN;

ALTER TABLE IF EXISTS indexer.city_contract_overrides
  ADD COLUMN IF NOT EXISTS oracle_router_address text NULL;

CREATE TABLE IF NOT EXISTS public.citycoin_exchange_rates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  citycoin_id bigint NOT NULL REFERENCES public.ref_citycoins(id) ON DELETE CASCADE,
  source text NOT NULL,
  asset_id text NOT NULL,
  rate numeric NOT NULL,
  base_currency text NOT NULL DEFAULT 'CAD',
  quote_symbol text NOT NULL,
  observed_at timestamptz NOT NULL,
  indexed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  source_block_number bigint NULL,
  source_tx_hash text NULL,
  used_fallback boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS citycoin_exchange_rates_city_observed_idx
  ON public.citycoin_exchange_rates (citycoin_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS citycoin_exchange_rates_city_indexed_idx
  ON public.citycoin_exchange_rates (citycoin_id, indexed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS citycoin_exchange_rates_dedupe_idx
  ON public.citycoin_exchange_rates (citycoin_id, source, asset_id, observed_at, COALESCE(source_block_number, -1));

CREATE OR REPLACE VIEW public.v_citycoin_exchange_rates_current_v1 AS
WITH ranked_rates AS (
  SELECT
    cer.*,
    ROW_NUMBER() OVER (
      PARTITION BY cer.citycoin_id
      ORDER BY cer.observed_at DESC, cer.indexed_at DESC, cer.id DESC
    ) AS row_num
  FROM public.citycoin_exchange_rates cer
)
SELECT
  rc.id AS citycoin_id,
  rc.slug AS city_slug,
  rc.display_name,
  rc.symbol,
  rr.asset_id,
  rr.rate,
  rr.base_currency,
  rr.quote_symbol,
  rr.source,
  rr.observed_at,
  rr.indexed_at,
  rr.used_fallback,
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (timezone('utc', now()) - rr.observed_at))))::bigint AS freshness_seconds,
  (rr.observed_at < timezone('utc', now()) - interval '6 hours') AS is_stale
FROM public.ref_citycoins rc
LEFT JOIN ranked_rates rr
  ON rr.citycoin_id = rc.id
 AND rr.row_num = 1;

GRANT SELECT ON public.v_citycoin_exchange_rates_current_v1 TO authenticated;

COMMIT;

-- DOWN
-- BEGIN;
-- REVOKE SELECT ON public.v_citycoin_exchange_rates_current_v1 FROM authenticated;
-- DROP VIEW IF EXISTS public.v_citycoin_exchange_rates_current_v1;
-- DROP INDEX IF EXISTS citycoin_exchange_rates_dedupe_idx;
-- DROP INDEX IF EXISTS citycoin_exchange_rates_city_indexed_idx;
-- DROP INDEX IF EXISTS citycoin_exchange_rates_city_observed_idx;
-- DROP TABLE IF EXISTS public.citycoin_exchange_rates;
-- ALTER TABLE IF EXISTS indexer.city_contract_overrides
--   DROP COLUMN IF EXISTS oracle_router_address;
-- COMMIT;
