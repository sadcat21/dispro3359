-- 1) Reverse the stock impact (each added +1 box of pieces_per_box pieces)
WITH targets AS (
  SELECT sm.id, sm.worker_id, sm.product_id,
         GREATEST(COALESCE(p.pieces_per_box, 1), 1) AS ppb,
         sm.signed_quantity
  FROM stock_movements sm
  JOIN products p ON p.id = sm.product_id
  WHERE sm.id IN (
    '70c7d8d0-ab46-4afe-97b5-210a3b56586b',
    '67b5d4ed-787b-49b6-964e-4ad93db7d324'
  )
)
UPDATE worker_stock ws
SET quantity = GREATEST(
  public.stock_qty_bp_to_pieces(ws.quantity, t.ppb) - (t.signed_quantity * t.ppb),
  0
)::numeric / 1, -- keep numeric
    updated_at = now()
FROM targets t
WHERE ws.worker_id = t.worker_id AND ws.product_id = t.product_id;

-- Recompute quantity back to box.pieces representation
UPDATE worker_stock ws
SET quantity = FLOOR(ws.quantity::numeric)
             + (MOD(FLOOR(ws.quantity::numeric)::int, 1))
WHERE worker_id IN ('d1023b86-ed15-42f9-9a0a-3edf2b29dc78','ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab')
  AND product_id = 'c51e3eda-047f-43f3-a9aa-caf367440fc2'
  AND false; -- no-op safeguard

-- 2) Delete the auto-correction movements
DELETE FROM stock_movements
WHERE id IN (
  '70c7d8d0-ab46-4afe-97b5-210a3b56586b',
  '67b5d4ed-787b-49b6-964e-4ad93db7d324'
);