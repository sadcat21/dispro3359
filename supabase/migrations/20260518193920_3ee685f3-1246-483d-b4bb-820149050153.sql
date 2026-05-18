
-- Allow worker who created or is assigned to a cancelled order to re-edit its items
DROP POLICY IF EXISTS "Insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Update order items" ON public.order_items;
DROP POLICY IF EXISTS "Delete order items" ON public.order_items;

CREATE POLICY "Insert order items"
ON public.order_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (
        is_admin()
        OR (o.created_by = get_worker_id() AND o.status = ANY (ARRAY['pending','pending_branch','assigned','in_progress','delivered','cancelled']))
        OR (o.assigned_worker_id = get_worker_id() AND o.status = ANY (ARRAY['assigned','in_progress','delivered','pending_branch','cancelled']))
        OR (is_branch_admin() AND o.branch_id IN (SELECT id FROM branches WHERE admin_id = get_worker_id()))
      )
  )
);

CREATE POLICY "Update order items"
ON public.order_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (
        is_admin()
        OR (o.created_by = get_worker_id() AND o.status = ANY (ARRAY['pending','pending_branch','assigned','in_progress','delivered','cancelled']))
        OR (o.assigned_worker_id = get_worker_id() AND o.status = ANY (ARRAY['assigned','in_progress','delivered','pending_branch','cancelled']))
        OR (is_branch_admin() AND o.branch_id IN (SELECT id FROM branches WHERE admin_id = get_worker_id()))
      )
  )
);

CREATE POLICY "Delete order items"
ON public.order_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND (
        is_admin()
        OR (o.created_by = get_worker_id() AND o.status = ANY (ARRAY['pending','pending_branch','assigned','in_progress','delivered','cancelled']))
        OR (o.assigned_worker_id = get_worker_id() AND o.status = ANY (ARRAY['assigned','in_progress','delivered','pending_branch','cancelled']))
        OR (is_branch_admin() AND o.branch_id IN (SELECT id FROM branches WHERE admin_id = get_worker_id()))
      )
  )
);
