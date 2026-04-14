
-- Drop and recreate the UPDATE policy to allow workers to update pending AND amended confirmations
DROP POLICY IF EXISTS "Update confirmations" ON public.stock_confirmations;

CREATE POLICY "Update confirmations" ON public.stock_confirmations
FOR UPDATE TO authenticated
USING (
  ((manager_id = get_worker_id()) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text, 'amended'::text])))
  OR ((worker_id = get_worker_id()) AND (status = ANY (ARRAY['pending'::text, 'amended'::text])))
  OR is_admin()
)
WITH CHECK (
  ((manager_id = get_worker_id()) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text, 'amended'::text, 'approved'::text])))
  OR ((worker_id = get_worker_id()) AND (status = ANY (ARRAY['approved'::text, 'rejected'::text])))
  OR is_admin()
);
