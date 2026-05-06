INSERT INTO public.sales_tracking (
  source, order_id, order_item_id, product_id, product_name, pieces_per_box,
  sold_boxes, sold_pieces, gift_boxes, gift_pieces, total_boxes, total_pieces,
  unit_price, total_price, branch_id, worker_id, customer_id,
  worker_name, customer_name, branch_name, sold_at, created_at
)
SELECT
  CASE WHEN cb.role IN ('branch_admin','admin','supervisor') THEN 'warehouse_sale' ELSE 'direct_sale' END,
  o.id, oi.id, oi.product_id,
  COALESCE(p.app_name, p.name),
  COALESCE(NULLIF(oi.pieces_per_box,0), NULLIF(p.pieces_per_box,0), 1),
  FLOOR(COALESCE(oi.quantity,0))::int,
  ROUND((COALESCE(oi.quantity,0) - FLOOR(COALESCE(oi.quantity,0))) * 100)::int,
  FLOOR(COALESCE(oi.gift_quantity,0))::int,
  COALESCE(oi.gift_pieces, ROUND((COALESCE(oi.gift_quantity,0) - FLOOR(COALESCE(oi.gift_quantity,0))) * 100)::int),
  FLOOR(COALESCE(oi.quantity,0))::int + FLOOR(COALESCE(oi.gift_quantity,0))::int,
  ROUND((COALESCE(oi.quantity,0) - FLOOR(COALESCE(oi.quantity,0))) * 100)::int
    + COALESCE(oi.gift_pieces, ROUND((COALESCE(oi.gift_quantity,0) - FLOOR(COALESCE(oi.gift_quantity,0))) * 100)::int),
  oi.unit_price, oi.total_price,
  o.branch_id, o.assigned_worker_id, o.customer_id,
  w.full_name, c.name, b.name,
  COALESCE(o.delivery_date, o.created_at), oi.created_at
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
LEFT JOIN public.products p ON p.id = oi.product_id
LEFT JOIN public.workers w ON w.id = o.assigned_worker_id
LEFT JOIN public.workers cb ON cb.id = o.created_by
LEFT JOIN public.customers c ON c.id = o.customer_id
LEFT JOIN public.branches b ON b.id = o.branch_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.sales_tracking st WHERE st.order_item_id = oi.id
);