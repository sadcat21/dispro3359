-- 1) Remove duplicate pending_offer_confirmations
DELETE FROM public.pending_offer_confirmations dup
WHERE dup.notes LIKE '%إعادة إنشاء تلقائية بعد تصحيح رصيد الشاحنة%'
  AND EXISTS (
    SELECT 1 FROM public.pending_offer_confirmations orig
    WHERE orig.id <> dup.id
      AND orig.order_id = dup.order_id
      AND orig.product_id = dup.product_id
      AND orig.offer_id  = dup.offer_id
      AND (orig.notes IS NULL OR orig.notes NOT LIKE '%إعادة إنشاء تلقائية بعد تصحيح رصيد الشاحنة%')
  );

-- 2) For sales_tracking: merge gift quantities from duplicate (auto-recreated)
-- rows into the original same-order/same-product row when one exists for ANY source,
-- then delete the duplicates. Only operates on rows whose only purpose was the gift.
WITH dup AS (
  SELECT st.id, st.order_id, st.product_id, st.gift_boxes, st.gift_pieces
  FROM public.sales_tracking st
  WHERE st.notes LIKE '%إعادة إنشاء تلقائية بعد تصحيح رصيد الشاحنة%'
    AND COALESCE(st.gift_pieces,0) + COALESCE(st.gift_boxes,0) > 0
), merge_target AS (
  SELECT DISTINCT ON (d.id)
    d.id AS dup_id, orig.id AS orig_id, d.gift_boxes AS gb, d.gift_pieces AS gp
  FROM dup d
  JOIN public.sales_tracking orig
    ON orig.order_id = d.order_id
   AND orig.product_id = d.product_id
   AND orig.id <> d.id
   AND (orig.notes IS NULL OR orig.notes NOT LIKE '%إعادة إنشاء تلقائية بعد تصحيح رصيد الشاحنة%')
  ORDER BY d.id, orig.created_at ASC
)
UPDATE public.sales_tracking st
SET gift_boxes  = COALESCE(st.gift_boxes,0)  + mt.gb,
    gift_pieces = COALESCE(st.gift_pieces,0) + mt.gp,
    notes = COALESCE(st.notes,'') || ' [merged duplicate gift]'
FROM merge_target mt
WHERE st.id = mt.orig_id;

-- Now delete all auto-recreated duplicates (merged or not — drop unconditionally
-- when a same order/product row exists with a gift OR after our merge above)
DELETE FROM public.sales_tracking dup
WHERE dup.notes LIKE '%إعادة إنشاء تلقائية بعد تصحيح رصيد الشاحنة%'
  AND EXISTS (
    SELECT 1 FROM public.sales_tracking orig
    WHERE orig.id <> dup.id
      AND orig.order_id = dup.order_id
      AND orig.product_id = dup.product_id
  );