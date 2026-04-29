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
        OR (
          public.is_branch_admin()
          AND o.branch_id IN (SELECT id FROM public.branches WHERE admin_id = public.get_worker_id())
        )
        -- جديد: مدير الفرع يرى عناصر طلبيات أي عامل ينتمي لفرعه
        OR EXISTS (
          SELECT 1 FROM public.workers w
          WHERE (w.id = o.created_by OR w.id = o.assigned_worker_id)
            AND public.current_worker_manages_branch(w.branch_id)
        )
      )
  )
);