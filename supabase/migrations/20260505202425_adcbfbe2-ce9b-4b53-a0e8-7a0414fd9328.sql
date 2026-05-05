
-- Allow warehouse_manager to view orders & order_items (needed for Final Review aggregation)
DROP POLICY IF EXISTS "View orders based on role" ON public.orders;
CREATE POLICY "View orders based on role"
ON public.orders FOR SELECT
USING (
  is_admin()
  OR has_custom_role('company_manager'::text)
  OR has_custom_role('internal_supervisor'::text)
  OR has_custom_role('warehouse_manager'::text)
  OR (get_user_role() = 'supervisor'::app_role)
  OR (is_branch_admin() AND (branch_id IN (SELECT branches.id FROM branches WHERE branches.admin_id = get_worker_id())))
  OR (created_by = get_worker_id())
  OR (assigned_worker_id = get_worker_id())
  OR (EXISTS (
    SELECT 1 FROM workers w
    WHERE ((w.id = orders.created_by) OR (w.id = orders.assigned_worker_id))
      AND current_worker_manages_branch(w.branch_id)
  ))
);

DROP POLICY IF EXISTS "View order items" ON public.order_items;
CREATE POLICY "View order items"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (
        is_admin()
        OR has_custom_role('company_manager'::text)
        OR has_custom_role('internal_supervisor'::text)
        OR has_custom_role('warehouse_manager'::text)
        OR (get_user_role() = 'supervisor'::app_role)
        OR (o.created_by = get_worker_id())
        OR (o.assigned_worker_id = get_worker_id())
        OR (is_branch_admin() AND o.branch_id IN (SELECT branches.id FROM branches WHERE branches.admin_id = get_worker_id()))
        OR EXISTS (
          SELECT 1 FROM workers w
          WHERE ((w.id = o.created_by) OR (w.id = o.assigned_worker_id))
            AND current_worker_manages_branch(w.branch_id)
        )
      )
  )
);
