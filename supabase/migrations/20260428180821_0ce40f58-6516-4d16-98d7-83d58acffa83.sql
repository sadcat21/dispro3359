DROP POLICY IF EXISTS "Update confirmations" ON public.stock_confirmations;

CREATE POLICY "Update confirmations"
ON public.stock_confirmations
FOR UPDATE
TO authenticated
USING (
  (
    (manager_id = get_worker_id())
    AND (status = ANY (ARRAY['pending'::text, 'rejected'::text, 'amended'::text]))
    AND frozen_at IS NULL
  )
  OR (worker_id = get_worker_id())
  OR is_admin()
)
WITH CHECK (
  (
    (manager_id = get_worker_id())
    AND (status = ANY (ARRAY['pending'::text, 'rejected'::text, 'amended'::text, 'approved'::text]))
    AND frozen_at IS NULL
  )
  OR (worker_id = get_worker_id())
  OR is_admin()
);