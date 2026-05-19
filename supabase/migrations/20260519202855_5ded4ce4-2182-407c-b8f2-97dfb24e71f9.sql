-- Remove existing duplicates (keep earliest)
DELETE FROM public.sales_tracking a
USING public.sales_tracking b
WHERE a.order_id IS NOT NULL
  AND a.order_id = b.order_id
  AND a.product_id IS NOT DISTINCT FROM b.product_id
  AND a.source = b.source
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS sales_tracking_order_product_source_unique
ON public.sales_tracking (order_id, product_id, source)
WHERE order_id IS NOT NULL;