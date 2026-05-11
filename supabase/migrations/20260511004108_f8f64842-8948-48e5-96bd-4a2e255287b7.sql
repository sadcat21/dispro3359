CREATE OR REPLACE FUNCTION public.confirm_loading_session_atomic(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session                public.loading_sessions%ROWTYPE;
  v_item                   RECORD;
  v_actor_user_id          uuid := auth.uid();
  v_actor_worker_id        uuid;
  v_is_warehouse_manager   boolean := false;
  v_pieces_per_box         integer;
  v_item_qty_rounded       numeric;
  v_item_boxes             integer;
  v_item_piece_part        integer;
  v_gift_qty_rounded       numeric;
  v_gift_boxes             integer;
  v_gift_piece_part        integer;
  v_gift_pieces            integer;
  v_total_load_pieces      integer;
  v_warehouse_row          RECORD;
  v_worker_row             RECORD;
  v_new_warehouse_pieces   integer;
  v_new_worker_pieces      integer;
  v_load_qty               numeric;
BEGIN
  IF v_actor_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT worker_id INTO v_actor_worker_id
  FROM public.user_roles
  WHERE user_id = v_actor_user_id AND worker_id IS NOT NULL
  LIMIT 1;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_actor_user_id AND role = 'warehouse_manager'::public.app_role
  ) INTO v_is_warehouse_manager;

  IF NOT (
    public.is_admin()
    OR public.is_branch_admin()
    OR public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
    OR v_is_warehouse_manager
    OR v_actor_worker_id = (SELECT worker_id FROM public.loading_sessions WHERE id = p_session_id)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to confirm loading sessions';
  END IF;

  SELECT * INTO v_session FROM public.loading_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loading session not found'; END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true, 'session_id', v_session.id, 'status', v_session.status);
  END IF;

  IF v_session.status NOT IN ('open', 'pending_confirmation') THEN
    RAISE EXCEPTION 'Loading session is not in a confirmable state (current: %)', v_session.status;
  END IF;

  IF v_session.branch_id IS NULL THEN RAISE EXCEPTION 'Loading session branch is missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.loading_session_items WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'Loading session has no items';
  END IF;

  FOR v_item IN
    SELECT lsi.*, p.name AS product_name, COALESCE(p.pieces_per_box, 20) AS pieces_per_box
    FROM public.loading_session_items lsi
    JOIN public.products p ON p.id = lsi.product_id
    WHERE lsi.session_id = p_session_id
    ORDER BY lsi.created_at, lsi.id
  LOOP
    v_pieces_per_box := COALESCE(v_item.pieces_per_box, 20);
    v_item_qty_rounded := ROUND(COALESCE(v_item.quantity, 0)::numeric, 2);
    v_item_boxes := FLOOR(v_item_qty_rounded);
    v_item_piece_part := ROUND((v_item_qty_rounded - v_item_boxes) * 100);

    v_gift_qty_rounded := ROUND(COALESCE(v_item.gift_quantity, 0)::numeric, 2);
    v_gift_boxes := FLOOR(v_gift_qty_rounded);
    v_gift_piece_part := ROUND((v_gift_qty_rounded - v_gift_boxes) * 100);
    v_gift_pieces := CASE
      WHEN COALESCE(v_item.gift_unit, 'piece') = 'piece'
        THEN GREATEST(0, ROUND(COALESCE(v_item.gift_quantity, 0)::numeric))::integer
      ELSE (v_gift_boxes * v_pieces_per_box) + v_gift_piece_part
    END;

    v_total_load_pieces := (v_item_boxes * v_pieces_per_box) + v_item_piece_part + v_gift_pieces;

    SELECT ws.id, ws.quantity,
      (FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box
       + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_warehouse_row
    FROM public.warehouse_stock ws
    WHERE ws.branch_id = v_session.branch_id AND ws.product_id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_warehouse_row.total_pieces < v_total_load_pieces THEN
      RAISE EXCEPTION 'Insufficient warehouse stock for %', COALESCE(v_item.product_name, v_item.product_id::text);
    END IF;

    v_new_warehouse_pieces := v_warehouse_row.total_pieces - v_total_load_pieces;

    UPDATE public.warehouse_stock
    SET quantity = FLOOR(v_new_warehouse_pieces / v_pieces_per_box) + MOD(v_new_warehouse_pieces, v_pieces_per_box) / 100.0,
        updated_at = now()
    WHERE id = v_warehouse_row.id;

    SELECT ws.id, ws.quantity,
      (FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box
       + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_worker_row
    FROM public.worker_stock ws
    WHERE ws.worker_id = v_session.worker_id AND ws.product_id = v_item.product_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_worker_pieces := v_worker_row.total_pieces + v_total_load_pieces;
      UPDATE public.worker_stock
      SET quantity = FLOOR(v_new_worker_pieces / v_pieces_per_box) + MOD(v_new_worker_pieces, v_pieces_per_box) / 100.0,
          updated_at = now()
      WHERE id = v_worker_row.id;
    ELSE
      INSERT INTO public.worker_stock (worker_id, product_id, branch_id, quantity, updated_at)
      VALUES (v_session.worker_id, v_item.product_id, v_session.branch_id,
        FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0, now());
    END IF;

    v_load_qty := FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0;

    INSERT INTO public.stock_movements
      (product_id, branch_id, quantity, movement_type, status, created_by, worker_id, notes,
       from_location_type, from_location_id, to_location_type, to_location_id,
       reason, reference_type, reference_id)
    VALUES
      (v_item.product_id, v_session.branch_id, v_load_qty, 'load', 'approved',
       v_actor_worker_id, v_session.worker_id, 'شحن من جلسة - ' || COALESCE(v_item.product_name, ''),
       'warehouse', v_session.branch_id, 'worker', v_session.worker_id,
       'loading_session', 'loading_session', p_session_id);
  END LOOP;

  UPDATE public.loading_sessions
  SET status = 'completed', completed_at = now()
  WHERE id = p_session_id AND status IN ('open', 'pending_confirmation');

  RETURN jsonb_build_object('ok', true, 'already_processed', false, 'session_id', v_session.id, 'status', 'completed');
END;
$function$;

DO $$
DECLARE
  v_session_id uuid;
  v_worker_id uuid;
  v_manager_id uuid;
  v_branch_id uuid;
  r record;
  v_current_pieces integer;
  v_expected_pieces integer;
  v_new_pieces integer;
  v_delta_pieces integer;
  v_adjustment_qty numeric;
BEGIN
  SELECT ls.id, ls.worker_id, ls.manager_id, ls.branch_id
  INTO v_session_id, v_worker_id, v_manager_id, v_branch_id
  FROM public.loading_sessions ls
  JOIN public.workers w ON w.id = ls.worker_id
  WHERE lower(w.full_name) LIKE lower('%kassos%')
    AND ls.status = 'completed'
  ORDER BY ls.completed_at DESC NULLS LAST, ls.created_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT
      lsi.product_id,
      p.name AS product_name,
      COALESCE(p.pieces_per_box, 20)::integer AS ppb,
      lsi.quantity,
      lsi.gift_quantity,
      ws.id AS worker_stock_id,
      ws.quantity AS worker_stock_qty
    FROM public.loading_session_items lsi
    JOIN public.products p ON p.id = lsi.product_id
    JOIN public.worker_stock ws ON ws.worker_id = v_worker_id AND ws.product_id = lsi.product_id
    WHERE lsi.session_id = v_session_id
      AND COALESCE(lsi.gift_unit, 'piece') = 'piece'
      AND COALESCE(lsi.gift_quantity, 0) > 0
  LOOP
    v_current_pieces := (
      FLOOR(ROUND(COALESCE(r.worker_stock_qty, 0)::numeric, 2))::integer * r.ppb
      + ROUND((ROUND(COALESCE(r.worker_stock_qty, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(r.worker_stock_qty, 0)::numeric, 2))) * 100)::integer
    );

    v_expected_pieces := (
      FLOOR(ROUND(COALESCE(r.quantity, 0)::numeric, 2))::integer * r.ppb
      + ROUND((ROUND(COALESCE(r.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(r.quantity, 0)::numeric, 2))) * 100)::integer
      + GREATEST(0, ROUND(COALESCE(r.gift_quantity, 0)::numeric))::integer
    );

    IF v_current_pieces > v_expected_pieces THEN
      v_new_pieces := v_expected_pieces;
      v_delta_pieces := v_current_pieces - v_expected_pieces;
      v_adjustment_qty := FLOOR(v_delta_pieces / r.ppb) + MOD(v_delta_pieces, r.ppb) / 100.0;

      UPDATE public.worker_stock
      SET quantity = FLOOR(v_new_pieces / r.ppb) + MOD(v_new_pieces, r.ppb) / 100.0,
          updated_at = now()
      WHERE id = r.worker_stock_id;

      INSERT INTO public.stock_movements (
        product_id, branch_id, worker_id, quantity, signed_quantity, movement_type,
        status, created_by, approved_by, approved_at, reason, reference_type, reference_id, notes
      ) VALUES (
        r.product_id, v_branch_id, v_worker_id, v_adjustment_qty, -v_adjustment_qty, 'adjustment',
        'approved', COALESCE(v_manager_id, v_worker_id), COALESCE(v_manager_id, v_worker_id), now(),
        'correct_piece_gift_truck_balance', 'loading_session', v_session_id,
        'تصحيح رصيد الشاحنة: احتساب هدية القطعة كقطعة وليس كصندوق - ' || COALESCE(r.product_name, r.product_id::text)
      );
    END IF;
  END LOOP;
END $$;