UPDATE public.loading_session_items
SET quantity = 20, gift_quantity = 10, gift_unit = 'piece'
WHERE id = 'c2343169-c5f2-4f44-b6bf-4db05c6e48e7';

INSERT INTO public.stock_movements (
  product_id, branch_id, quantity, movement_type, status,
  created_by, approved_by, approved_at, reason, notes
)
SELECT
  lsi.product_id, ws.branch_id, 0, 'adjustment', 'approved',
  ls.manager_id, ls.manager_id, now(),
  'gift_reclassification',
  'Reclassification of 10 pieces as gift instead of paid quantity (20 boxes + 10 gift pieces)'
FROM public.loading_session_items lsi
JOIN public.loading_sessions ls ON ls.id = lsi.session_id
JOIN public.worker_stock ws ON ws.product_id = lsi.product_id AND ws.worker_id = ls.worker_id
WHERE lsi.id = 'c2343169-c5f2-4f44-b6bf-4db05c6e48e7';