-- Relax the INSERT policy on stock_confirmations so admins/branch_admins can
-- create confirmations even when their auth session doesn't map to the same
-- worker_id as the manager_id being recorded (e.g. branch admins acting on
-- behalf of the warehouse manager workflow).

DROP POLICY IF EXISTS "Managers can create confirmations" ON public.stock_confirmations;

CREATE POLICY "Managers can create confirmations"
ON public.stock_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND worker_id IS NOT NULL
  AND manager_id IS NOT NULL
  AND (
    public.is_admin()
    OR public.is_branch_admin()
    OR public.get_user_role() = ANY (ARRAY['warehouse_manager'::public.app_role, 'supervisor'::public.app_role])
    OR public.has_custom_role('warehouse_manager')
    OR public.has_custom_role('supervisor')
  )
  AND (
    -- Admin/branch admin can record any active worker as the manager
    public.is_admin()
    OR public.is_branch_admin()
    -- Otherwise the caller must be the manager themselves
    OR manager_id = public.get_worker_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.workers mw
    WHERE mw.id = stock_confirmations.manager_id
      AND mw.is_active = true
  )
);