CREATE POLICY "Managers can create their accounting sessions"
ON public.accounting_sessions
FOR INSERT TO authenticated
WITH CHECK (manager_id = get_worker_id());

CREATE POLICY "Managers can update their accounting sessions"
ON public.accounting_sessions
FOR UPDATE TO authenticated
USING (manager_id = get_worker_id())
WITH CHECK (manager_id = get_worker_id());

CREATE POLICY "Managers can view sessions they created"
ON public.accounting_sessions
FOR SELECT TO authenticated
USING (manager_id = get_worker_id());

CREATE POLICY "Managers can insert items for their sessions"
ON public.accounting_session_items
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.accounting_sessions s
  WHERE s.id = session_id
    AND (s.manager_id = get_worker_id() OR is_admin() OR is_branch_admin())
));

CREATE POLICY "Managers can view items for their sessions"
ON public.accounting_session_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.accounting_sessions s
  WHERE s.id = session_id
    AND (s.manager_id = get_worker_id() OR s.worker_id = get_worker_id() OR is_admin() OR is_branch_admin())
));