-- Allow warehouse managers and workers to insert discrepancies
CREATE POLICY "Workers and managers can insert discrepancies"
ON public.stock_discrepancies
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin()
  OR is_branch_admin()
  OR has_custom_role('warehouse_manager')
  OR worker_id = get_worker_id()
);

-- Also allow warehouse managers to update discrepancies
CREATE POLICY "Managers can update discrepancies"
ON public.stock_discrepancies
FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR is_branch_admin()
  OR has_custom_role('warehouse_manager')
)
WITH CHECK (
  is_admin()
  OR is_branch_admin()
  OR has_custom_role('warehouse_manager')
);