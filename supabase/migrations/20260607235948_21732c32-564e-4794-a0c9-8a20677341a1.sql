DELETE FROM public.worker_permissions a USING public.worker_permissions b
WHERE a.ctid < b.ctid AND a.worker_id = b.worker_id AND a.permission_id = b.permission_id;

ALTER TABLE public.worker_permissions
  ADD CONSTRAINT worker_permissions_worker_permission_unique UNIQUE (worker_id, permission_id);