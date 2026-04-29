-- استبدال سياسة الإنشاء على stock_confirmations بأخرى أكثر تسامحاً مع مسؤولي المخزن
DROP POLICY IF EXISTS "Managers can create confirmations" ON public.stock_confirmations;

CREATE POLICY "Managers can create confirmations"
ON public.stock_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  -- المسار 1: السماح إذا كان المستخدم admin أو مدير فرع أو يملك صلاحية warehouse_manager/supervisor
  public.is_admin()
  OR public.is_branch_admin()
  OR public.has_custom_role('company_manager')
  OR (
    -- المسؤول هو المنفّذ نفسه + لديه دور warehouse_manager/supervisor (custom أو base)
    manager_id = public.get_worker_id()
    AND (
      public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
      OR public.has_custom_role('warehouse_manager')
      OR public.has_custom_role('supervisor')
    )
    AND EXISTS (
      SELECT 1 FROM public.workers tw
      WHERE tw.id = stock_confirmations.worker_id
        AND tw.is_active = true
        AND (
          stock_confirmations.branch_id IS NULL
          OR tw.branch_id = stock_confirmations.branch_id
          OR EXISTS (
            SELECT 1 FROM public.workers mw
            WHERE mw.id = public.get_worker_id()
              AND mw.branch_id = stock_confirmations.branch_id
          )
        )
    )
  )
);
