-- Fix legacy stock_movements where unit-sale quantities were stored as raw fractional boxes
-- instead of B.P (boxes.pieces). Reconcile against order_items.quantity which is correctly stored in B.P.
UPDATE stock_movements sm
SET quantity = oi.quantity,
    signed_quantity = CASE WHEN sm.signed_quantity IS NULL THEN NULL
                           ELSE -ABS(oi.quantity) END
FROM order_items oi
WHERE oi.order_id = sm.order_id
  AND oi.product_id = sm.product_id
  AND sm.movement_type IN ('delivery','direct_sale')
  AND sm.order_id IS NOT NULL
  AND ABS(sm.quantity) <> oi.quantity;

-- Recalibrate worker_stock for the affected worker(s) so the truck card matches the corrected movements.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT worker_id FROM stock_movements WHERE worker_id = '79240031-b627-4d69-b8e8-d29edfb25cde'
  LOOP
    PERFORM public.recalibrate_worker_stock(r.worker_id);
  END LOOP;
END $$;