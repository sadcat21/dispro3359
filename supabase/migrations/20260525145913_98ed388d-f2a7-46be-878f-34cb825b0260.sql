INSERT INTO public.sales_tracking (
  source, order_id, order_item_id, product_id, product_name, pieces_per_box,
  sold_boxes, sold_pieces, gift_boxes, gift_pieces, unit_price, total_price,
  branch_id, worker_id, customer_id, worker_name, customer_name, branch_name,
  notes, sold_at
)
SELECT
  'direct_sale', NULL, NULL, p.product_id, pr.name, 20,
  COALESCE(p.vente_quantity, 0)::int, 0, COALESCE(p.gratuite_quantity, 0)::int, 0,
  0, 0,
  w.branch_id, p.worker_id, p.customer_id,
  w.full_name, c.name, b.name,
  'تسجيل البرومو اليدوي (مُعاد ملؤه)', p.promo_date
FROM public.promos p
LEFT JOIN public.products pr ON pr.id = p.product_id
LEFT JOIN public.workers w ON w.id = p.worker_id
LEFT JOIN public.customers c ON c.id = p.customer_id
LEFT JOIN public.branches b ON b.id = w.branch_id
WHERE p.id IN (
  'b20da7ec-731a-48d9-94be-b95996af25e2',
  '6720ced4-61ee-4e7b-b7f7-b083c077970b'
)
AND NOT EXISTS (
  SELECT 1 FROM public.sales_tracking st
  WHERE st.product_id = p.product_id
    AND st.worker_id = p.worker_id
    AND st.customer_id = p.customer_id
    AND st.sold_at = p.promo_date
);