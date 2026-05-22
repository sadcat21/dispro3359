CREATE POLICY "Company manager can update orders"
ON public.orders
FOR UPDATE
USING (has_custom_role('company_manager') OR has_custom_role('internal_supervisor') OR has_custom_role('warehouse_manager'))
WITH CHECK (has_custom_role('company_manager') OR has_custom_role('internal_supervisor') OR has_custom_role('warehouse_manager'));