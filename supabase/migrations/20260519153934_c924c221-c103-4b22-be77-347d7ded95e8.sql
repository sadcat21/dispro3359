
-- Prevent duplicate pending offer confirmation cards for the same deferred gift.
-- Existing guard missed cases where an earlier card was created without order_item_id.

CREATE OR REPLACE FUNCTION public.ensure_pending_offer_cards_for_worker(p_worker_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.pending_offer_confirmations (
      order_id, order_item_id, offer_id, product_id, product_name, pieces_per_box,
      gift_product_id, gift_product_name, gift_boxes, gift_pieces,
      purchased_boxes, purchased_pieces,
      customer_id, customer_name, worker_id, worker_name,
      branch_id, branch_name, source, status,
      notes
    )
    SELECT
      o.id, oi.id, po.id, oi.product_id, lp.name,
      GREATEST(COALESCE(oi.pieces_per_box, lp.pieces_per_box, 1), 1),
      po.gift_product_id, COALESCE(gp.name, lp.name),
      GREATEST(COALESCE(oi.gift_quantity, 0), 0),
      GREATEST(COALESCE(oi.gift_pieces, 0), 0),
      GREATEST(COALESCE(oi.quantity, 0), 0), 0,
      o.customer_id, c.name, o.assigned_worker_id, w.full_name,
      o.branch_id, b.name, 'order', 'pending',
      'إعادة إنشاء تلقائية بعد تصحيح رصيد الشاحنة'
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.product_offers po ON po.id = oi.gift_offer_id
      AND po.is_deferred_confirmation = true
    LEFT JOIN public.products lp ON lp.id = oi.product_id
    LEFT JOIN public.products gp ON gp.id = po.gift_product_id
    LEFT JOIN public.customers c ON c.id = o.customer_id
    LEFT JOIN public.workers w ON w.id = o.assigned_worker_id
    LEFT JOIN public.branches b ON b.id = o.branch_id
    WHERE o.assigned_worker_id = p_worker_id
      AND COALESCE(o.status, '') NOT IN ('cancelled')
      AND (COALESCE(oi.gift_quantity, 0) > 0 OR COALESCE(oi.gift_pieces, 0) > 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.pending_offer_confirmations poc
        WHERE poc.status IN ('pending', 'confirmed')
          AND poc.order_id = o.id
          AND poc.offer_id = po.id
          AND poc.product_id = oi.product_id
          AND (poc.order_item_id = oi.id OR poc.order_item_id IS NULL)
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;
  RETURN v_inserted;
END;
$$;

-- Cleanup: reject pending duplicates whose deferred gift was already confirmed.
UPDATE public.pending_offer_confirmations poc
SET status = 'rejected',
    notes = COALESCE(notes, '') || ' [auto-rejected: duplicate of already-confirmed card]'
WHERE poc.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.pending_offer_confirmations poc2
    WHERE poc2.status = 'confirmed'
      AND poc2.order_id = poc.order_id
      AND poc2.offer_id = poc.offer_id
      AND poc2.product_id = poc.product_id
      AND poc2.id <> poc.id
  );
