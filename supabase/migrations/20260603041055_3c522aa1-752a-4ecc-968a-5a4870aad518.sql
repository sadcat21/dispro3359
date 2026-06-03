CREATE OR REPLACE FUNCTION public.recalibrate_worker_stock_after_accounting_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.worker_id IS NOT NULL THEN
    PERFORM public.recalibrate_worker_stock(OLD.worker_id);
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalibrate_worker_stock_after_accounting_delete ON public.accounting_sessions;

CREATE TRIGGER trg_recalibrate_worker_stock_after_accounting_delete
AFTER DELETE ON public.accounting_sessions
FOR EACH ROW
EXECUTE FUNCTION public.recalibrate_worker_stock_after_accounting_delete();

CREATE OR REPLACE FUNCTION public.confirm_loading_session_atomic(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_worker_row_exists      boolean := false;
  v_new_warehouse_pieces   integer;
  v_new_worker_pieces      integer;
  v_load_qty               numeric;
  v_live_prev_qty          numeric;
  v_acct_anchor            timestamptz;
  v_other_confirms         integer;
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

  SELECT MAX(COALESCE(completed_at, created_at)) INTO v_acct_anchor
  FROM public.accounting_sessions
  WHERE worker_id = v_session.worker_id AND status IN ('completed','closed');
  v_acct_anchor := COALESCE(v_acct_anchor, '1970-01-01'::timestamptz);

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

    v_worker_row_exists := FOUND;
    v_live_prev_qty := COALESCE(v_worker_row.quantity, 0);

    SELECT COUNT(*) INTO v_other_confirms
    FROM public.loading_sessions ls
    JOIN public.loading_session_items li ON li.session_id = ls.id
    WHERE ls.worker_id = v_session.worker_id
      AND li.product_id = v_item.product_id
      AND ls.status = 'completed'
      AND ls.id <> p_session_id
      AND COALESCE(ls.completed_at, ls.created_at) > v_acct_anchor;

    IF v_worker_row_exists THEN
      IF v_live_prev_qty <= 0 AND v_other_confirms = 0 THEN
        v_new_worker_pieces := v_total_load_pieces;
      ELSE
        v_new_worker_pieces := COALESCE(v_worker_row.total_pieces, 0) + v_total_load_pieces;
      END IF;

      UPDATE public.worker_stock
      SET quantity = FLOOR(v_new_worker_pieces / v_pieces_per_box) + MOD(v_new_worker_pieces, v_pieces_per_box) / 100.0,
          updated_at = now()
      WHERE id = v_worker_row.id;
    ELSE
      INSERT INTO public.worker_stock (worker_id, product_id, branch_id, quantity, updated_at)
      VALUES (
        v_session.worker_id,
        v_item.product_id,
        v_session.branch_id,
        FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0,
        now()
      );
    END IF;

    UPDATE public.loading_session_items
    SET previous_quantity = v_live_prev_qty
    WHERE id = v_item.id
      AND COALESCE(previous_quantity, 0) <> v_live_prev_qty;

    v_load_qty := FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0;

    INSERT INTO public.stock_movements
      (product_id, branch_id, quantity, movement_type, status, created_by, worker_id, notes,
       from_location_type, from_location_id, to_location_type, to_location_id,
       reason, reference_type, reference_id)
    SELECT v_item.product_id, v_session.branch_id, v_load_qty, 'load', 'approved',
           v_actor_worker_id, v_session.worker_id,
           'تأكيد شحن - ' || COALESCE(v_item.product_name, ''),
           'warehouse', v_session.branch_id, 'worker', v_session.worker_id,
           'loading_session_confirm', 'loading_session', v_session.id
    WHERE v_load_qty > 0;
  END LOOP;

  UPDATE public.loading_sessions
  SET status = 'completed', updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true, 'session_id', v_session.id, 'status', 'completed');
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT worker_id
    FROM public.worker_stock
    WHERE worker_id IS NOT NULL
  LOOP
    PERFORM public.recalibrate_worker_stock(r.worker_id);
  END LOOP;
END;
$$;