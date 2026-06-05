DROP POLICY IF EXISTS "Accountant can update document/invoice stage" ON public.orders;
CREATE POLICY "Accountant can update document/invoice stage" ON public.orders
FOR UPDATE
USING (
  get_user_role() = ANY (ARRAY['accountant'::app_role, 'admin_assistant'::app_role])
  OR has_custom_role('accountant')
  OR has_custom_role('admin_assistant')
  OR is_branch_admin()
  OR (EXISTS (SELECT 1 FROM workers w WHERE ((w.id = orders.created_by) OR (w.id = orders.assigned_worker_id)) AND current_worker_manages_branch(w.branch_id)))
)
WITH CHECK (
  get_user_role() = ANY (ARRAY['accountant'::app_role, 'admin_assistant'::app_role])
  OR has_custom_role('accountant')
  OR has_custom_role('admin_assistant')
  OR is_branch_admin()
  OR (EXISTS (SELECT 1 FROM workers w WHERE ((w.id = orders.created_by) OR (w.id = orders.assigned_worker_id)) AND current_worker_manages_branch(w.branch_id)))
);