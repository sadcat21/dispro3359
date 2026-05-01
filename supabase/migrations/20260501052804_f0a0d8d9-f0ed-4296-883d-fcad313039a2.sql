-- Repair the accepted surplus decision for CAFE AROMA 250 Gr in Mostaganem branch
-- Review item: 5e8a616f-7a55-4f1c-a669-2f6f8c2c74ca
WITH target_review AS (
  SELECT
    wri.id AS item_id,
    wri.product_id,
    wrs.branch_id,
    wrs.reviewer_id AS worker_id,
    wrs.id AS session_id,
    p.pieces_per_box,
    wri.expected_quantity,
    wri.actual_quantity,
    ROUND(GREATEST(wri.actual_quantity - wri.expected_quantity, 0) * COALESCE(NULLIF(p.pieces_per_box, 0), 1))::integer AS surplus_pieces,
    ROUND(wri.expected_quantity * COALESCE(NULLIF(p.pieces_per_box, 0), 1))::integer AS expected_pieces
  FROM public.warehouse_review_items wri
  JOIN public.warehouse_review_sessions wrs ON wrs.id = wri.session_id
  JOIN public.products p ON p.id = wri.product_id
  WHERE wri.id = '5e8a616f-7a55-4f1c-a669-2f6f8c2c74ca'
    AND wri.item_type = 'product'
    AND wri.status = 'surplus'
    AND (wri.notes::jsonb ->> 'manager_decision') = 'accept_surplus'
), computed AS (
  SELECT
    *,
    ((expected_pieces / pieces_per_box)::numeric + ((expected_pieces % pieces_per_box)::numeric / 100)) AS expected_db_bp,
    ((surplus_pieces / pieces_per_box)::numeric + ((surplus_pieces % pieces_per_box)::numeric / 100)) AS surplus_db_bp
  FROM target_review
  WHERE pieces_per_box > 0 AND surplus_pieces > 0
)
UPDATE public.warehouse_stock ws
SET quantity = computed.expected_db_bp
FROM computed
WHERE ws.branch_id = computed.branch_id
  AND ws.product_id = computed.product_id;

WITH target_review AS (
  SELECT
    wri.id AS item_id,
    wri.product_id,
    wrs.branch_id,
    wrs.reviewer_id AS worker_id,
    wrs.id AS session_id,
    p.pieces_per_box,
    ROUND(GREATEST(wri.actual_quantity - wri.expected_quantity, 0) * COALESCE(NULLIF(p.pieces_per_box, 0), 1))::integer AS surplus_pieces
  FROM public.warehouse_review_items wri
  JOIN public.warehouse_review_sessions wrs ON wrs.id = wri.session_id
  JOIN public.products p ON p.id = wri.product_id
  WHERE wri.id = '5e8a616f-7a55-4f1c-a669-2f6f8c2c74ca'
    AND wri.item_type = 'product'
    AND wri.status = 'surplus'
    AND (wri.notes::jsonb ->> 'manager_decision') = 'accept_surplus'
), computed AS (
  SELECT
    *,
    ((surplus_pieces / pieces_per_box)::numeric + ((surplus_pieces % pieces_per_box)::numeric / 100)) AS surplus_db_bp
  FROM target_review
  WHERE pieces_per_box > 0 AND surplus_pieces > 0
)
INSERT INTO public.stock_discrepancies (
  worker_id,
  product_id,
  branch_id,
  discrepancy_type,
  quantity,
  remaining_quantity,
  source_session_id,
  notes
)
SELECT
  worker_id,
  product_id,
  branch_id,
  'surplus',
  surplus_db_bp,
  surplus_db_bp,
  session_id,
  'تم تسجيل الفائض المقبول من مراجعة مدير الفرع'
FROM computed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.stock_discrepancies sd
  WHERE sd.branch_id = computed.branch_id
    AND sd.product_id = computed.product_id
    AND sd.discrepancy_type = 'surplus'
    AND sd.source_session_id = computed.session_id
);