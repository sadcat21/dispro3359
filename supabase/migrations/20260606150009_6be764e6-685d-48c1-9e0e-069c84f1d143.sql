UPDATE public.accounting_sessions s
SET branch_id = COALESCE(
  (SELECT w.branch_id FROM public.workers w WHERE w.id = s.worker_id),
  (SELECT w.branch_id FROM public.workers w WHERE w.id = s.manager_id)
)
WHERE s.branch_id IS NULL;