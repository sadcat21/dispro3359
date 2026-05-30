-- Convert legacy fractional order_items.quantity (e.g. 0.5 = half box) into
-- B.P format (e.g. 0.10 = 10 pieces) used by the new stock/sales logic.
-- A value is "legacy fractional" when round((qty - floor(qty)) * 100) >= pieces_per_box
-- because BP-encoded values always store pieces < pieces_per_box in the decimal.
UPDATE public.order_items oi
SET quantity = floor(oi.quantity)::numeric
             + (round((oi.quantity - floor(oi.quantity)) * COALESCE(NULLIF(oi.pieces_per_box, 0), 20))::int)::numeric / 100
WHERE oi.quantity IS NOT NULL
  AND oi.quantity > 0
  AND round((oi.quantity - floor(oi.quantity)) * 100) >= COALESCE(NULLIF(oi.pieces_per_box, 0), 20);