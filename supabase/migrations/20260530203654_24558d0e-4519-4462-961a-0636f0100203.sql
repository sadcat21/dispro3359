
DELETE FROM public.visit_tracking vt
WHERE vt.operation_type IN ('order','direct_sale','delivery')
  AND vt.operation_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = vt.operation_id);
