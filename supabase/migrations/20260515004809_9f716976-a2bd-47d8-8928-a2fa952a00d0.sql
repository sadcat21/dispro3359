DROP POLICY IF EXISTS pending_offer_delete_admin ON public.pending_offer_confirmations;
CREATE POLICY pending_offer_delete_pending_auth ON public.pending_offer_confirmations
  FOR DELETE TO authenticated
  USING (status = 'pending' OR is_admin());

-- Clean up duplicates: keep the most recent pending row per (order_id, order_item_id, offer_id, product_id)
DELETE FROM public.pending_offer_confirmations p
USING public.pending_offer_confirmations q
WHERE p.status = 'pending' AND q.status = 'pending'
  AND p.product_id = q.product_id
  AND p.order_id IS NOT DISTINCT FROM q.order_id
  AND p.order_item_id IS NOT DISTINCT FROM q.order_item_id
  AND p.offer_id IS NOT DISTINCT FROM q.offer_id
  AND p.created_at < q.created_at;