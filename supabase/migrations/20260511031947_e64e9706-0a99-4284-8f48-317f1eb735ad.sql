ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_types jsonb DEFAULT '[]'::jsonb;

-- Backfill from existing comma-separated customer_type values
UPDATE public.customers
SET customer_types = (
  SELECT COALESCE(jsonb_agg(trim(t)), '[]'::jsonb)
  FROM regexp_split_to_table(customer_type, ',') AS t
  WHERE trim(t) <> ''
)
WHERE customer_type IS NOT NULL
  AND customer_type <> ''
  AND (customer_types IS NULL OR customer_types = '[]'::jsonb);