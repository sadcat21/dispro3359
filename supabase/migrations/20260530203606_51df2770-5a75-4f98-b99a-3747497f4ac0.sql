
DELETE FROM public.visit_tracking vt
USING public.orders o, public.visit_tracking vt2
WHERE vt.operation_id = o.id
  AND vt.operation_type = 'direct_sale'
  AND vt.notes IN ('auto: server fallback','auto: backfill')
  AND o.assigned_worker_id IS NOT NULL
  AND o.created_by IS NOT NULL
  AND o.assigned_worker_id <> o.created_by
  AND vt.worker_id = o.assigned_worker_id
  AND vt2.operation_id = o.id
  AND vt2.operation_type = 'order'
  AND vt2.id <> vt.id;
