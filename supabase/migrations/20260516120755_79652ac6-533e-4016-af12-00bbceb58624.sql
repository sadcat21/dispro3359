DROP POLICY IF EXISTS "Managers can create confirmations" ON public.stock_confirmations;

CREATE POLICY "Managers can create confirmations"
ON public.stock_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.is_branch_admin()
  OR public.has_custom_role('company_manager')
  OR (
    manager_id = public.get_worker_id()
    AND (
      public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
      OR public.has_custom_role('warehouse_manager')
      OR public.has_custom_role('supervisor')
    )
    AND EXISTS (
      SELECT 1
      FROM public.workers tw
      WHERE tw.id = stock_confirmations.worker_id
        AND tw.is_active = true
        AND (
          stock_confirmations.branch_id IS NULL
          OR tw.branch_id = stock_confirmations.branch_id
          OR EXISTS (
            SELECT 1
            FROM public.workers mw
            WHERE mw.id = public.get_worker_id()
              AND mw.branch_id = stock_confirmations.branch_id
          )
          OR EXISTS (
            SELECT 1
            FROM public.worker_roles wr
            JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
            WHERE wr.worker_id = stock_confirmations.worker_id
              AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
              AND cr.code = 'delivery_rep'
              AND (wr.branch_id = stock_confirmations.branch_id OR wr.branch_id IS NULL)
          )
        )
    )
  )
);