
-- Fix RLS: allow branch managers to see disputes in their branch
DROP POLICY IF EXISTS "Workers can view their disputes" ON public.stock_disputes;
CREATE POLICY "Workers can view their disputes"
ON public.stock_disputes
FOR SELECT
USING (
  is_admin()
  OR is_branch_admin()
  OR (get_worker_id() = warehouse_worker_id)
  OR (get_worker_id() = delivery_worker_id)
  OR (get_worker_id() = raised_by)
  OR (branch_id = get_worker_branch_id())
);

-- Fix RLS: allow branch managers (by branch_id match) to also update/resolve disputes
DROP POLICY IF EXISTS "Admins and guilty can update disputes" ON public.stock_disputes;
CREATE POLICY "Admins and guilty can update disputes"
ON public.stock_disputes
FOR UPDATE
USING (
  is_admin()
  OR is_branch_admin()
  OR (get_worker_id() = guilty_worker_id)
  OR (branch_id = get_worker_branch_id())
);
