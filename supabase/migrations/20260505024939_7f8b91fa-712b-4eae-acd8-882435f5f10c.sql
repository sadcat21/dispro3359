DROP POLICY IF EXISTS "Insert order items" ON public.order_items;
CREATE POLICY "Insert order items" ON public.order_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_items.order_id
  AND (
    is_admin()
    OR (o.created_by = get_worker_id() AND o.status = ANY (ARRAY['pending'::text,'pending_branch'::text,'assigned'::text,'in_progress'::text,'delivered'::text]))
    OR (o.assigned_worker_id = get_worker_id() AND o.status = ANY (ARRAY['assigned'::text,'in_progress'::text,'delivered'::text,'pending_branch'::text]))
    OR (is_branch_admin() AND o.branch_id IN (SELECT branches.id FROM branches WHERE branches.admin_id = get_worker_id()))
  )
));

DROP POLICY IF EXISTS "Update order items" ON public.order_items;
CREATE POLICY "Update order items" ON public.order_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_items.order_id
  AND (
    is_admin()
    OR (o.created_by = get_worker_id() AND o.status = ANY (ARRAY['pending'::text,'pending_branch'::text,'assigned'::text,'in_progress'::text,'delivered'::text]))
    OR (o.assigned_worker_id = get_worker_id() AND o.status = ANY (ARRAY['assigned'::text,'in_progress'::text,'delivered'::text,'pending_branch'::text]))
    OR (is_branch_admin() AND o.branch_id IN (SELECT branches.id FROM branches WHERE branches.admin_id = get_worker_id()))
  )
));

DROP POLICY IF EXISTS "Delete order items" ON public.order_items;
CREATE POLICY "Delete order items" ON public.order_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM orders o
  WHERE o.id = order_items.order_id
  AND (
    is_admin()
    OR (o.created_by = get_worker_id() AND o.status = ANY (ARRAY['pending'::text,'pending_branch'::text,'assigned'::text,'in_progress'::text,'delivered'::text]))
    OR (o.assigned_worker_id = get_worker_id() AND o.status = ANY (ARRAY['assigned'::text,'in_progress'::text,'delivered'::text,'pending_branch'::text]))
    OR (is_branch_admin() AND o.branch_id IN (SELECT branches.id FROM branches WHERE branches.admin_id = get_worker_id()))
  )
));