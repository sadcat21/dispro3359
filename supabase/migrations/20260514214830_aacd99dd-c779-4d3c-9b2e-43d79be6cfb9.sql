CREATE OR REPLACE FUNCTION public.delete_promo_ledger_entries(p_promo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Promo ledger rows are audit rows only. The real stock restoration on order
  -- cancellation is handled from the original order stock_movements by the app.
  -- Re-adding promo_sale/promo_gift here double-restores stock and can make the
  -- truck remainder larger than the last loaded quantity.
  DELETE FROM public.stock_movements
  WHERE reference_type = 'promo'
    AND reference_id = p_promo_id;
END;
$$;

WITH recalculated AS (
  SELECT product_id, new_qty
  FROM public.preview_recalibrate_worker_stock('d1023b86-ed15-42f9-9a0a-3edf2b29dc78'::uuid)
  WHERE product_id = 'ba1f8b0d-f26d-4d5b-93e9-d8cea2f8279b'::uuid
)
UPDATE public.worker_stock ws
SET quantity = r.new_qty,
    updated_at = now()
FROM recalculated r
WHERE ws.worker_id = 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78'::uuid
  AND ws.product_id = r.product_id;