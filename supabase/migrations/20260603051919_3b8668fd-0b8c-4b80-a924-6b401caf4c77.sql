-- عكس أثر حركات التفريغ المكرَّرة (المعلَّمة rejected) على رصيد المخزن.
-- تلك الحركات أضافت كمياتها إلى warehouse_stock قبل إلغائها، فيجب خصمها الآن.
WITH bad AS (
  SELECT branch_id, product_id, SUM(quantity)::numeric AS qty
  FROM public.stock_movements
  WHERE movement_type = 'return'
    AND status = 'rejected'
    AND notes LIKE '%[مكرر — تم الإلغاء تلقائياً]'
  GROUP BY branch_id, product_id
)
UPDATE public.warehouse_stock ws
SET quantity = GREATEST(0, ws.quantity - bad.qty),
    updated_at = now()
FROM bad
WHERE ws.branch_id = bad.branch_id
  AND ws.product_id = bad.product_id;