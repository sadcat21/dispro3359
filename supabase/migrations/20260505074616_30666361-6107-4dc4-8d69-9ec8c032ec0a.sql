
-- Insert delivery stock movements for each order item (deducts from worker stock)
INSERT INTO public.stock_movements (
  branch_id, product_id, movement_type, quantity, signed_quantity,
  worker_id, order_id, status, created_by, notes
)
SELECT 
  o.branch_id,
  oi.product_id,
  'delivery',
  oi.quantity + COALESCE(oi.gift_quantity,0),
  -(oi.quantity + COALESCE(oi.gift_quantity,0)),
  o.assigned_worker_id,
  o.id,
  'approved',
  o.assigned_worker_id,
  'توصيل طلبية - شامل هدية محسوبة'
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.assigned_worker_id = '79240031-b627-4d69-b8e8-d29edfb25cde'
  AND o.delivery_date = '2026-05-05'
  AND o.status = 'pending';

-- Mark orders as delivered
UPDATE public.orders
SET status = 'delivered', updated_at = now()
WHERE assigned_worker_id = '79240031-b627-4d69-b8e8-d29edfb25cde'
  AND delivery_date = '2026-05-05'
  AND status = 'pending';
