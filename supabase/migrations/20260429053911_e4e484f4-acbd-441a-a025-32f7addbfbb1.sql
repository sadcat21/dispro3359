-- Update orders SELECT policy to include company_manager via custom role
DROP POLICY IF EXISTS "View orders based on role" ON public.orders;
CREATE POLICY "View orders based on role"
ON public.orders
FOR SELECT
USING (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR public.get_user_role() = 'supervisor'::public.app_role
  OR (public.is_branch_admin() AND branch_id IN (SELECT id FROM public.branches WHERE admin_id = public.get_worker_id()))
  OR created_by = public.get_worker_id()
  OR assigned_worker_id = public.get_worker_id()
);

-- Update order_items SELECT policy similarly
DROP POLICY IF EXISTS "View order items" ON public.order_items;
CREATE POLICY "View order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        public.is_admin()
        OR public.has_custom_role('company_manager')
        OR public.get_user_role() = 'supervisor'::public.app_role
        OR o.created_by = public.get_worker_id()
        OR o.assigned_worker_id = public.get_worker_id()
        OR (public.is_branch_admin() AND o.branch_id IN (SELECT id FROM public.branches WHERE admin_id = public.get_worker_id()))
      )
  )
);