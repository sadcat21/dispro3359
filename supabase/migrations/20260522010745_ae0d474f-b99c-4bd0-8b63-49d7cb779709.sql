-- Unify accounting period per employee across managers:
-- allow any manager assigned to a worker (and admins/branch admins) to view
-- that worker's accounting sessions, not only sessions they themselves created.

CREATE POLICY "Managers of worker can view accounting sessions"
ON public.accounting_sessions
FOR SELECT
USING (
  is_admin()
  OR is_branch_admin()
  OR EXISTS (
    SELECT 1 FROM public.manager_workers mw
    WHERE mw.worker_id = accounting_sessions.worker_id
      AND mw.manager_id = get_worker_id()
  )
);
