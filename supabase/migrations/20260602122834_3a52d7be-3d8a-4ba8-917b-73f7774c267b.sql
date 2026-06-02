-- Fix order_items for orders inserted on 2026-06-02 for worker BIG hichem
-- Convert quantity from kg to boxes and set pricing_unit='box'
UPDATE public.order_items oi
SET
  quantity = (oi.quantity / NULLIF(oi.weight_per_box, 0))::numeric,
  unit_price = oi.unit_price * oi.weight_per_box,
  pricing_unit = 'box'
FROM public.orders o
WHERE oi.order_id = o.id
  AND o.assigned_worker_id = 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78'
  AND o.delivery_date = DATE '2026-06-02'
  AND o.status = 'assigned'
  AND oi.pricing_unit = 'kg';