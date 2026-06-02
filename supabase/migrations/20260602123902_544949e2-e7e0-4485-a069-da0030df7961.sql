DELETE FROM public.order_items
WHERE order_id IN (
  SELECT id FROM public.orders
  WHERE assigned_worker_id='d1023b86-ed15-42f9-9a0a-3edf2b29dc78'
    AND created_by='06817d3e-0539-485e-9ffe-55b7d8727fdc'
    AND created_at::date = '2026-06-01'
    AND delivery_date = '2026-06-02'
    AND status = 'assigned'
);
DELETE FROM public.orders
WHERE assigned_worker_id='d1023b86-ed15-42f9-9a0a-3edf2b29dc78'
  AND created_by='06817d3e-0539-485e-9ffe-55b7d8727fdc'
  AND created_at::date = '2026-06-01'
  AND delivery_date = '2026-06-02'
  AND status = 'assigned';
SELECT * FROM public.recalibrate_worker_stock('d1023b86-ed15-42f9-9a0a-3edf2b29dc78');