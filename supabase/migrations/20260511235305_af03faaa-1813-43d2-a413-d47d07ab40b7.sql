ALTER TABLE public.loading_sessions
  ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_worker_frozen(_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.loading_sessions ls
    WHERE ls.worker_id = _worker_id
      AND ls.status = 'review'
      AND ls.is_final = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.accounting_sessions acs
        WHERE acs.worker_id = _worker_id
          AND acs.status = 'completed'
          AND acs.created_at >= ls.created_at
      )
  );
$$;