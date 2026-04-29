UPDATE public.manual_invoice_requests mir
SET branch_id = w.branch_id
FROM public.workers w
WHERE mir.branch_id IS NULL
  AND mir.worker_id = w.id
  AND w.branch_id IS NOT NULL;

UPDATE public.orders o
SET branch_id = w.branch_id
FROM public.workers w
WHERE o.branch_id IS NULL
  AND COALESCE(o.assigned_worker_id, o.created_by) = w.id
  AND w.branch_id IS NOT NULL;