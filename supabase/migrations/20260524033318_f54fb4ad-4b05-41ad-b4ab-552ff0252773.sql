
WITH agg AS (
  SELECT
    poc.order_id,
    poc.product_id,
    SUM(COALESCE(poc.purchased_boxes,0))  AS paid_boxes,
    SUM(COALESCE(poc.purchased_pieces,0)) AS paid_pieces
  FROM public.pending_offer_confirmations poc
  WHERE poc.status = 'confirmed'
  GROUP BY poc.order_id, poc.product_id
)
UPDATE public.sales_tracking st
SET
  sold_boxes  = GREATEST(COALESCE(st.sold_boxes,0),  agg.paid_boxes),
  sold_pieces = GREATEST(COALESCE(st.sold_pieces,0), agg.paid_pieces),
  notes = COALESCE(st.notes,'') || ' [generalized paid alignment]'
FROM agg
WHERE agg.order_id IS NOT DISTINCT FROM st.order_id
  AND agg.product_id = st.product_id
  AND (
    COALESCE(st.sold_boxes,0)  < agg.paid_boxes
    OR COALESCE(st.sold_pieces,0) < agg.paid_pieces
  )
  AND COALESCE(st.notes,'') NOT LIKE '%[generalized paid alignment]%';
