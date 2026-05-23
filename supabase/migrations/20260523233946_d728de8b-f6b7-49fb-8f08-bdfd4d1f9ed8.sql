-- 1) Updated unload_session_atomic to record discrepancy when input != current worker_stock
CREATE OR REPLACE FUNCTION public.unload_session_atomic(p_session_id uuid, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_session public.loading_sessions%ROWTYPE;
  v_item jsonb;
  v_product_id uuid;
  v_return_qty numeric;
  v_pieces_per_box numeric;
  v_return_pieces numeric;
  v_worker_row RECORD;
  v_warehouse_row RECORD;
  v_new_worker_pieces numeric;
  v_new_warehouse_pieces numeric;
  v_product_name text;
  v_is_warehouse_manager boolean;
  v_count int := 0;
  v_diff_pieces numeric;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'No active worker session'; END IF;

  v_is_warehouse_manager := EXISTS (
    SELECT 1 FROM public.worker_roles wr
    JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
    WHERE wr.worker_id = v_actor AND cr.code = 'warehouse_manager'
  );

  IF NOT (
    public.is_admin()
    OR public.is_branch_admin()
    OR public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
    OR v_is_warehouse_manager
  ) THEN
    RAISE EXCEPTION 'Not allowed to unload sessions';
  END IF;

  SELECT * INTO v_session FROM public.loading_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loading session not found'; END IF;
  IF v_session.branch_id IS NULL THEN RAISE EXCEPTION 'Session branch missing'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_return_qty := COALESCE((v_item->>'return_qty')::numeric, 0);
    IF v_return_qty <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(pieces_per_box, 20), name INTO v_pieces_per_box, v_product_name
    FROM public.products WHERE id = v_product_id;

    v_return_pieces :=
      FLOOR(ROUND(v_return_qty::numeric, 2)) * v_pieces_per_box
      + ROUND((ROUND(v_return_qty::numeric, 2) - FLOOR(ROUND(v_return_qty::numeric, 2))) * 100);

    SELECT ws.id, ws.quantity,
      (FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box
       + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_worker_row
    FROM public.worker_stock ws
    WHERE ws.worker_id = v_session.worker_id AND ws.product_id = v_product_id
    FOR UPDATE;

    IF NOT FOUND OR v_worker_row.total_pieces < v_return_pieces THEN
      RAISE EXCEPTION 'Insufficient worker stock for %', COALESCE(v_product_name, v_product_id::text);
    END IF;

    -- DISCREPANCY LOG: if SM unloaded less than current worker stock, record the leftover as a discrepancy
    v_diff_pieces := v_worker_row.total_pieces - v_return_pieces;
    IF v_diff_pieces > 0 THEN
      INSERT INTO public.stock_discrepancies
        (worker_id, product_id, branch_id, discrepancy_type, quantity, remaining_quantity,
         source_session_id, status, reason_code, notes)
      VALUES
        (v_session.worker_id, v_product_id, v_session.branch_id, 'unload_mismatch',
         v_diff_pieces, v_diff_pieces, p_session_id, 'pending', 'unload_mismatch',
         'تباين تفريغ: المسير فرّغ ' || v_return_pieces::text || ' قطعة بينما الرصيد الفعلي كان ' || v_worker_row.total_pieces::text || ' (فارق ' || v_diff_pieces::text || ' قطعة)');
    END IF;

    v_new_worker_pieces := v_worker_row.total_pieces - v_return_pieces;
    UPDATE public.worker_stock
    SET quantity = FLOOR(v_new_worker_pieces / v_pieces_per_box) + MOD(v_new_worker_pieces, v_pieces_per_box) / 100.0,
        updated_at = now()
    WHERE id = v_worker_row.id;

    SELECT ws.id, ws.quantity,
      (FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box
       + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_warehouse_row
    FROM public.warehouse_stock ws
    WHERE ws.branch_id = v_session.branch_id AND ws.product_id = v_product_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_warehouse_pieces := v_warehouse_row.total_pieces + v_return_pieces;
      UPDATE public.warehouse_stock
      SET quantity = FLOOR(v_new_warehouse_pieces / v_pieces_per_box) + MOD(v_new_warehouse_pieces, v_pieces_per_box) / 100.0,
          updated_at = now()
      WHERE id = v_warehouse_row.id;
    ELSE
      INSERT INTO public.warehouse_stock (branch_id, product_id, quantity, updated_at)
      VALUES (v_session.branch_id, v_product_id, v_return_qty, now());
    END IF;

    INSERT INTO public.stock_movements
      (product_id, branch_id, quantity, movement_type, status, created_by, worker_id, notes,
       from_location_type, from_location_id, to_location_type, to_location_id,
       reason, reference_type, reference_id)
    VALUES
      (v_product_id, v_session.branch_id, v_return_qty, 'return', 'approved',
       v_actor, v_session.worker_id,
       'تفريغ شاحنة - ' || COALESCE(v_product_name, ''),
       'worker', v_session.worker_id, 'warehouse', v_session.branch_id,
       'truck_unload', 'loading_session', p_session_id);

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.loading_sessions
  SET status = 'unloaded', completed_at = COALESCE(completed_at, now())
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true, 'session_id', p_session_id, 'items_unloaded', v_count);
END;
$function$;

-- 2) Reconciliation view
CREATE OR REPLACE VIEW public.v_worker_stock_reconciliation AS
WITH last_acc AS (
  SELECT worker_id, MAX(completed_at) AS last_completed_at
  FROM public.accounting_sessions
  WHERE status = 'completed' AND completed_at IS NOT NULL
  GROUP BY worker_id
),
loads AS (
  SELECT ls.worker_id, lsi.product_id,
         SUM(COALESCE(lsi.quantity,0) + COALESCE(lsi.gift_quantity,0)) AS loaded_pieces
  FROM public.loading_sessions ls
  JOIN public.loading_session_items lsi ON lsi.session_id = ls.id
  LEFT JOIN last_acc la ON la.worker_id = ls.worker_id
  WHERE ls.status IN ('completed','unloaded')
    AND ls.created_at > COALESCE(la.last_completed_at, '1970-01-01'::timestamptz)
  GROUP BY ls.worker_id, lsi.product_id
),
sales AS (
  SELECT st.worker_id, st.product_id, SUM(COALESCE(st.total_pieces,0)) AS sold_pieces
  FROM public.sales_tracking st
  LEFT JOIN last_acc la ON la.worker_id = st.worker_id
  WHERE st.sold_at > COALESCE(la.last_completed_at, '1970-01-01'::timestamptz)
  GROUP BY st.worker_id, st.product_id
),
unloads AS (
  SELECT sm.worker_id, sm.product_id, SUM(COALESCE(sm.signed_quantity,0)) AS unloaded_pieces
  FROM public.stock_movements sm
  LEFT JOIN last_acc la ON la.worker_id = sm.worker_id
  WHERE sm.movement_type = 'return'
    AND sm.reference_type = 'loading_session'
    AND sm.created_at > COALESCE(la.last_completed_at, '1970-01-01'::timestamptz)
  GROUP BY sm.worker_id, sm.product_id
)
SELECT
  ws.worker_id,
  ws.product_id,
  p.name AS product_name,
  ws.quantity AS current_stock,
  COALESCE(l.loaded_pieces,0) AS loaded_since_acc,
  COALESCE(s.sold_pieces,0) AS sold_since_acc,
  COALESCE(u.unloaded_pieces,0) AS unloaded_since_acc,
  (COALESCE(l.loaded_pieces,0) - COALESCE(s.sold_pieces,0) - COALESCE(u.unloaded_pieces,0)) AS expected_stock,
  (ws.quantity - (COALESCE(l.loaded_pieces,0) - COALESCE(s.sold_pieces,0) - COALESCE(u.unloaded_pieces,0))) AS variance
FROM public.worker_stock ws
JOIN public.products p ON p.id = ws.product_id
LEFT JOIN loads l   ON l.worker_id = ws.worker_id AND l.product_id = ws.product_id
LEFT JOIN sales s   ON s.worker_id = ws.worker_id AND s.product_id = ws.product_id
LEFT JOIN unloads u ON u.worker_id = ws.worker_id AND u.product_id = ws.product_id
WHERE ws.quantity > 0
   OR COALESCE(l.loaded_pieces,0) > 0
   OR COALESCE(s.sold_pieces,0) > 0;

-- 3) Anomaly detector (manual or cron)
CREATE OR REPLACE FUNCTION public.detect_stock_anomalies()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM public.v_worker_stock_reconciliation WHERE ABS(variance) > 1
  LOOP
    INSERT INTO public.stock_discrepancies
      (worker_id, product_id, discrepancy_type, quantity, remaining_quantity,
       status, reason_code, notes)
    SELECT r.worker_id, r.product_id, 'reconciliation_variance',
           ABS(r.variance), ABS(r.variance), 'pending', 'auto_detect',
           'فحص تلقائي: رصيد=' || r.current_stock::text || ' متوقع=' || r.expected_stock::text || ' فارق=' || r.variance::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_discrepancies sd
      WHERE sd.worker_id = r.worker_id AND sd.product_id = r.product_id
        AND sd.reason_code = 'auto_detect' AND sd.status = 'pending'
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;