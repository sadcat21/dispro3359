CREATE OR REPLACE FUNCTION public.can_create_stock_confirmation_for_session(
  _worker_id uuid,
  _manager_id uuid,
  _source_session_id uuid,
  _branch_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.loading_sessions ls
    JOIN public.workers manager_worker
      ON manager_worker.id = _manager_id
     AND manager_worker.is_active = true
    JOIN public.workers target_worker
      ON target_worker.id = _worker_id
     AND target_worker.is_active = true
    WHERE ls.id = _source_session_id
      AND ls.manager_id = _manager_id
      AND ls.worker_id = _worker_id
      AND (
        _branch_id IS NULL
        OR ls.branch_id IS NULL
        OR ls.branch_id = _branch_id
      )
      AND (
        _branch_id IS NULL
        OR target_worker.branch_id = _branch_id
        OR manager_worker.branch_id = _branch_id
      )
  );
$$;

DROP POLICY IF EXISTS "Managers can create confirmations" ON public.stock_confirmations;

CREATE POLICY "Managers can create confirmations"
ON public.stock_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND worker_id IS NOT NULL
  AND manager_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.workers mw
    WHERE mw.id = stock_confirmations.manager_id
      AND mw.is_active = true
  )
  AND EXISTS (
    SELECT 1
    FROM public.workers tw
    WHERE tw.id = stock_confirmations.worker_id
      AND tw.is_active = true
  )
  AND (
    public.is_admin()
    OR public.is_branch_admin()
    OR (
      manager_id = public.get_worker_id()
      AND (
        public.get_user_role() = ANY (ARRAY['warehouse_manager'::public.app_role, 'supervisor'::public.app_role])
        OR public.has_custom_role('warehouse_manager')
        OR public.has_custom_role('supervisor')
        OR public.can_create_stock_confirmation_for_session(
          stock_confirmations.worker_id,
          stock_confirmations.manager_id,
          stock_confirmations.source_session_id,
          stock_confirmations.branch_id
        )
      )
    )
  )
  AND (
    branch_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workers target_worker
      WHERE target_worker.id = stock_confirmations.worker_id
        AND target_worker.branch_id = stock_confirmations.branch_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.workers manager_worker
      WHERE manager_worker.id = stock_confirmations.manager_id
        AND manager_worker.branch_id = stock_confirmations.branch_id
    )
  )
);