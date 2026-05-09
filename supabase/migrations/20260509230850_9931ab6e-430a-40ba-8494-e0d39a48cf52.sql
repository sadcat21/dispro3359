UPDATE public.warehouse_stock ws
SET quantity = ROUND((
  COALESCE((SELECT SUM(sri.quantity) FROM public.stock_receipt_items sri
            JOIN public.stock_receipts sr ON sr.id = sri.receipt_id
            WHERE sr.branch_id = ws.branch_id AND sri.product_id = ws.product_id), 0)
  - COALESCE((SELECT SUM(quantity) FROM public.stock_movements
              WHERE branch_id = ws.branch_id AND product_id = ws.product_id
                AND movement_type = 'load'), 0)
  + COALESCE((SELECT SUM(quantity) FROM public.stock_movements
              WHERE branch_id = ws.branch_id AND product_id = ws.product_id
                AND movement_type = 'return'), 0)
  - COALESCE((SELECT SUM(total_boxes + total_pieces::numeric / NULLIF(pieces_per_box, 0))
              FROM public.sales_tracking
              WHERE branch_id = ws.branch_id AND product_id = ws.product_id
                AND source = 'warehouse_sale'), 0)
)::numeric, 2),
updated_at = now();