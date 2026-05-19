-- Remove pending offer confirmations that already have a confirmed/rejected
-- twin for the same order line / offer / product (kept by the manager response).
DELETE FROM public.pending_offer_confirmations p
WHERE p.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.pending_offer_confirmations q
    WHERE q.status IN ('confirmed','rejected')
      AND q.product_id = p.product_id
      AND q.id <> p.id
      AND COALESCE(q.order_id::text, '') = COALESCE(p.order_id::text, '')
      AND COALESCE(q.order_item_id::text, '') = COALESCE(p.order_item_id::text, '')
      AND COALESCE(q.offer_id::text, '') = COALESCE(p.offer_id::text, '')
  );