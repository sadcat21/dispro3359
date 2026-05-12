WITH worker_periods AS (
  SELECT
    w.id AS worker_id,
    COALESCE((
      SELECT MAX(a.completed_at)
      FROM public.accounting_sessions a
      WHERE a.worker_id = w.id
        AND a.status = 'completed'
    ), 'epoch'::timestamptz) AS since_at
  FROM public.workers w
), anchors AS (
  SELECT DISTINCT ON (ls.worker_id, lsi.product_id)
    ls.worker_id,
    lsi.product_id,
    ls.branch_id,
    ls.created_at AS anchor_at,
    COALESCE(lsi.previous_quantity, 0)::numeric AS opening_qty
  FROM public.loading_sessions ls
  JOIN public.loading_session_items lsi ON lsi.session_id = ls.id
  JOIN worker_periods wp ON wp.worker_id = ls.worker_id
  WHERE ls.status IN ('completed', 'open', 'unloaded', 'review')
    AND ls.created_at >= wp.since_at
  ORDER BY ls.worker_id, lsi.product_id, ls.created_at ASC, lsi.created_at ASC
), expected AS (
  SELECT
    a.worker_id,
    a.product_id,
    a.branch_id,
    p.name AS product_name,
    GREATEST(1, COALESCE(p.pieces_per_box, 1))::integer AS ppb,
    GREATEST(
      0,
      FLOOR(ROUND(a.opening_qty, 2))::integer * GREATEST(1, COALESCE(p.pieces_per_box, 1))::integer
      + ROUND((ROUND(a.opening_qty, 2) - FLOOR(ROUND(a.opening_qty, 2))) * 100)::integer
      + COALESCE(SUM(
        CASE sm.movement_type
          WHEN 'load' THEN
            FLOOR(ROUND(COALESCE(sm.quantity, 0)::numeric, 2))::integer * GREATEST(1, COALESCE(p.pieces_per_box, 1))::integer
            + ROUND((ROUND(COALESCE(sm.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(sm.quantity, 0)::numeric, 2))) * 100)::integer
          WHEN 'return' THEN -(
            FLOOR(ROUND(COALESCE(sm.quantity, 0)::numeric, 2))::integer * GREATEST(1, COALESCE(p.pieces_per_box, 1))::integer
            + ROUND((ROUND(COALESCE(sm.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(sm.quantity, 0)::numeric, 2))) * 100)::integer
          )
          WHEN 'delivery' THEN -(
            FLOOR(ROUND(COALESCE(sm.quantity, 0)::numeric, 2))::integer * GREATEST(1, COALESCE(p.pieces_per_box, 1))::integer
            + ROUND((ROUND(COALESCE(sm.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(sm.quantity, 0)::numeric, 2))) * 100)::integer
          )
          ELSE 0
        END
      ), 0)
    ) AS expected_pieces
  FROM anchors a
  JOIN public.products p ON p.id = a.product_id
  LEFT JOIN public.stock_movements sm
    ON sm.worker_id = a.worker_id
   AND sm.product_id = a.product_id
   AND sm.created_at >= a.anchor_at
   AND COALESCE(sm.status, 'approved') <> 'rejected'
   AND sm.movement_type IN ('load', 'return', 'delivery')
  GROUP BY a.worker_id, a.product_id, a.branch_id, p.name, p.pieces_per_box, a.opening_qty
), differences AS (
  SELECT
    ws.id AS worker_stock_id,
    ws.worker_id,
    ws.product_id,
    ws.branch_id,
    ws.quantity AS old_quantity,
    e.product_name,
    e.ppb,
    FLOOR(e.expected_pieces / e.ppb) + MOD(e.expected_pieces, e.ppb) / 100.0 AS new_quantity,
    e.expected_pieces,
    FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))::integer * e.ppb
      + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)::integer AS old_pieces
  FROM expected e
  JOIN public.worker_stock ws
    ON ws.worker_id = e.worker_id
   AND ws.product_id = e.product_id
  WHERE FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))::integer * e.ppb
      + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)::integer
    <> e.expected_pieces
), updated AS (
  UPDATE public.worker_stock ws
  SET quantity = d.new_quantity,
      updated_at = now()
  FROM differences d
  WHERE ws.id = d.worker_stock_id
  RETURNING
    d.worker_id,
    d.product_id,
    COALESCE(d.branch_id, ws.branch_id) AS branch_id,
    d.product_name,
    d.ppb,
    d.old_quantity,
    d.new_quantity,
    d.old_pieces,
    d.expected_pieces
)
INSERT INTO public.stock_movements (
  product_id,
  branch_id,
  worker_id,
  quantity,
  signed_quantity,
  movement_type,
  status,
  created_by,
  approved_by,
  approved_at,
  reason,
  reference_type,
  notes
)
SELECT
  u.product_id,
  u.branch_id,
  u.worker_id,
  FLOOR(ABS(u.expected_pieces - u.old_pieces) / u.ppb) + MOD(ABS(u.expected_pieces - u.old_pieces), u.ppb) / 100.0,
  CASE WHEN u.expected_pieces >= u.old_pieces THEN 1 ELSE -1 END
    * (FLOOR(ABS(u.expected_pieces - u.old_pieces) / u.ppb) + MOD(ABS(u.expected_pieces - u.old_pieces), u.ppb) / 100.0),
  'adjustment',
  'approved',
  u.worker_id,
  u.worker_id,
  now(),
  'worker_stock_rebalance_from_movements',
  'worker_stock_rebalance',
  'إعادة توازن رصيد الشاحنة حسب الحركات الفعلية: من '
    || u.old_quantity::text || ' إلى ' || u.new_quantity::text
    || ' - ' || COALESCE(u.product_name, u.product_id::text)
FROM updated u;