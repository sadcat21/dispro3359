DROP POLICY IF EXISTS "Managers can create confirmations" ON public.stock_confirmations;

CREATE POLICY "Managers can create confirmations"
ON public.stock_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND worker_id IS NOT NULL
  AND manager_id IS NOT NULL
  AND (
    public.is_admin()
    OR public.is_branch_admin()
    OR public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
    OR public.has_custom_role('warehouse_manager')
    OR public.has_custom_role('supervisor')
  )
  AND (
    manager_id = public.get_worker_id()
    OR EXISTS (
      SELECT 1
      FROM public.workers w
      WHERE w.id = manager_id
        AND w.is_active = true
        AND w.id = public.get_worker_id()
    )
  )
  AND (
    branch_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workers target_worker
      WHERE target_worker.id = stock_confirmations.worker_id
        AND target_worker.is_active = true
        AND target_worker.branch_id = stock_confirmations.branch_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.workers manager_worker
      WHERE manager_worker.id = public.get_worker_id()
        AND manager_worker.is_active = true
        AND manager_worker.branch_id = stock_confirmations.branch_id
    )
  )
);