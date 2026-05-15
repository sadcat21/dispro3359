DROP POLICY IF EXISTS "Managers can create their accounting sessions" ON public.accounting_sessions;
DROP POLICY IF EXISTS "Managers can update their accounting sessions" ON public.accounting_sessions;
DROP POLICY IF EXISTS "Admins can manage accounting_sessions" ON public.accounting_sessions;

CREATE POLICY "Insert accounting sessions"
ON public.accounting_sessions FOR INSERT TO authenticated
WITH CHECK (
  manager_id = public.get_worker_id()
  OR public.is_admin()
  OR public.is_branch_admin()
);

CREATE POLICY "Update accounting sessions"
ON public.accounting_sessions FOR UPDATE TO authenticated
USING (
  manager_id = public.get_worker_id()
  OR public.is_admin()
  OR public.is_branch_admin()
)
WITH CHECK (
  manager_id = public.get_worker_id()
  OR public.is_admin()
  OR public.is_branch_admin()
);

CREATE POLICY "Delete accounting sessions"
ON public.accounting_sessions FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_branch_admin());