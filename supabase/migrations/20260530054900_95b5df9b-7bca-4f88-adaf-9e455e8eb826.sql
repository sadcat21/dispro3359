-- Add payment grouping metadata to sales_tracking so a single order can produce
-- multiple sales rows (one per payment method/sub-type) when the cart mixes
-- F1/F2 or different invoice payment sub-types.
ALTER TABLE public.sales_tracking
  ADD COLUMN IF NOT EXISTS payment_type text,
  ADD COLUMN IF NOT EXISTS invoice_payment_method text,
  ADD COLUMN IF NOT EXISTS invoice_payment_subtype text,
  ADD COLUMN IF NOT EXISTS payment_group_key text;

-- Replace the existing (order_id, product_id, source) unique constraint/index
-- with one that also includes the payment_group_key, so the same product can
-- appear in two payment groups of the same order.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.sales_tracking'::regclass
    AND contype = 'u'
    AND conname LIKE '%order_id%product_id%source%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sales_tracking DROP CONSTRAINT %I', cname);
  END IF;
END$$;

DROP INDEX IF EXISTS public.sales_tracking_order_product_source_key;
DROP INDEX IF EXISTS public.sales_tracking_order_id_product_id_source_idx;
DROP INDEX IF EXISTS public.sales_tracking_order_id_product_id_source_key;

CREATE UNIQUE INDEX IF NOT EXISTS sales_tracking_order_product_source_group_key
  ON public.sales_tracking (order_id, product_id, source, COALESCE(payment_group_key, ''))
  WHERE order_id IS NOT NULL;