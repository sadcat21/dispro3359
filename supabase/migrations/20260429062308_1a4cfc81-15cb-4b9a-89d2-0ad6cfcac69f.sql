DROP POLICY IF EXISTS "View orders based on role" ON public.orders;

CREATE POLICY "View orders based on role"
ON public.orders
FOR SELECT
USING (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR public.get_user_role() = 'supervisor'::public.app_role
  OR (
    public.is_branch_admin()
    AND branch_id IN (SELECT id FROM public.branches WHERE admin_id = public.get_worker_id())
  )
  OR created_by = public.get_worker_id()
  OR assigned_worker_id = public.get_worker_id()
  -- جديد: مدير الفرع يرى طلبيات أي عامل ينتمي لفرعه
  OR EXISTS (
    SELECT 1 FROM public.workers w
    WHERE (w.id = orders.created_by OR w.id = orders.assigned_worker_id)
      AND public.current_worker_manages_branch(w.branch_id)
  )
);