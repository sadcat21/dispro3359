ALTER TABLE public.worker_roles ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_roles_one_primary_active
ON public.worker_roles(worker_id)
WHERE is_primary = true AND is_active = true;