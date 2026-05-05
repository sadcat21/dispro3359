
CREATE OR REPLACE VIEW public.v_offer_ledger_full AS
SELECT ol.*,
  po.name        AS offer_name,
  pr.name        AS product_name,
  pr.pieces_per_box,
  w.full_name    AS worker_name,
  c.name         AS customer_name,
  b.name         AS branch_name,
  t.min_quantity        AS tier_min_quantity,
  t.min_quantity_unit   AS tier_min_quantity_unit,
  t.gift_quantity       AS tier_gift_quantity,
  t.gift_quantity_unit  AS tier_gift_quantity_unit,
  t.gift_type           AS tier_gift_type
FROM public.offer_ledger ol
LEFT JOIN public.product_offers po       ON po.id = ol.offer_id
LEFT JOIN public.products pr             ON pr.id = ol.product_id
LEFT JOIN public.workers w               ON w.id  = ol.worker_id
LEFT JOIN public.customers c             ON c.id  = ol.customer_id
LEFT JOIN public.branches b              ON b.id  = ol.branch_id
LEFT JOIN LATERAL (
  SELECT pt.*
  FROM public.product_offer_tiers pt
  WHERE pt.offer_id = ol.offer_id
    AND (
      ol.offer_tier_id IS NOT NULL AND pt.id = ol.offer_tier_id
      OR ol.offer_tier_id IS NULL
         AND (pt.min_quantity_unit = COALESCE(ol.sale_quantity_unit,'box'))
         AND pt.min_quantity <= ABS(COALESCE(ol.sale_quantity, 0))
    )
  ORDER BY (ol.offer_tier_id IS NOT NULL AND pt.id = ol.offer_tier_id) DESC,
           pt.min_quantity DESC
  LIMIT 1
) t ON TRUE;
