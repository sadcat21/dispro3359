CREATE OR REPLACE FUNCTION public.unload_session_atomic(
  p_session_id uuid,
  p_items jsonb  -- [{product_id, return_qty}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    -- convert custom (box.piece) to total pieces
    v_return_pieces :=
      FLOOR(ROUND(v_return_qty::numeric, 2)) * v_pieces_per_box
      + ROUND((ROUND(v_return_qty::numeric, 2) - FLOOR(ROUND(v_return_qty::numeric, 2))) * 100);

    -- worker_stock: subtract
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

    v_new_worker_pieces := v_worker_row.total_pieces - v_return_pieces;
    UPDATE public.worker_stock
    SET quantity = FLOOR(v_new_worker_pieces / v_pieces_per_box) + MOD(v_new_worker_pieces, v_pieces_per_box) / 100.0,
        updated_at = now()
    WHERE id = v_worker_row.id;

    -- warehouse_stock: add
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

    -- ledger entry — fully populated
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
$$;