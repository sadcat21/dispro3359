CREATE OR REPLACE FUNCTION public.recalibrate_worker_stock(p_worker_id uuid)
RETURNS TABLE(product_id uuid, product_name text, old_qty numeric, new_qty numeric, ppb integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_last_load_at timestamptz;
  v_loaded_pieces numeric;
  v_sold_pieces numeric;
  v_balance_pieces numeric;
  v_boxes integer;
  v_pieces integer;
  v_new_qty numeric;
  v_old_qty numeric;
  v_ppb integer;
BEGIN
  FOR rec IN
    SELECT DISTINCT sm.product_id AS pid, p.name, p.pieces_per_box
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    WHERE sm.worker_id = p_worker_id
  LOOP
    v_ppb := COALESCE(rec.pieces_per_box, 1);

    SELECT MAX(sm.created_at) INTO v_last_load_at
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = rec.pid
      AND sm.movement_type = 'load';

    IF v_last_load_at IS NULL THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(
      FLOOR(sm.quantity)::int * v_ppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int
    ), 0) INTO v_loaded_pieces
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = rec.pid
      AND sm.movement_type = 'load' AND sm.created_at = v_last_load_at;

    -- Only delivery and direct_sale represent actual stock leaving the worker.
    -- promo_sale / promo_gift / modification are ledger entries that duplicate
    -- what is already included in the delivery (gifts are auto-included).
    SELECT COALESCE(SUM(
      FLOOR(sm.quantity)::int * v_ppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int
    ), 0) INTO v_sold_pieces
    FROM stock_movements sm
    LEFT JOIN orders o ON o.id = sm.order_id
    WHERE sm.worker_id = p_worker_id AND sm.product_id = rec.pid
      AND sm.created_at > v_last_load_at
      AND sm.movement_type IN ('delivery','direct_sale')
      AND (sm.order_id IS NULL OR o.status <> 'cancelled');

    v_balance_pieces := GREATEST(v_loaded_pieces - v_sold_pieces, 0);
    v_boxes := FLOOR(v_balance_pieces / v_ppb)::int;
    v_pieces := (v_balance_pieces - v_boxes * v_ppb)::int;
    v_new_qty := v_boxes + (v_pieces::numeric / 100);

    SELECT ws.quantity INTO v_old_qty FROM worker_stock ws
    WHERE ws.worker_id = p_worker_id AND ws.product_id = rec.pid;

    IF v_old_qty IS NULL THEN
      INSERT INTO worker_stock (worker_id, product_id, quantity, updated_at)
      VALUES (p_worker_id, rec.pid, v_new_qty, now());
      v_old_qty := 0;
    ELSE
      UPDATE worker_stock ws SET quantity = v_new_qty, updated_at = now()
      WHERE ws.worker_id = p_worker_id AND ws.product_id = rec.pid;
    END IF;

    product_id := rec.pid;
    product_name := rec.name;
    old_qty := v_old_qty;
    new_qty := v_new_qty;
    ppb := v_ppb;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_recalibrate_worker_stock(p_worker_id uuid)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  ppb integer,
  current_qty numeric,
  new_qty numeric,
  last_load_at timestamptz,
  loaded_pieces numeric,
  sold_pieces numeric,
  movements jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_last_load_at timestamptz;
  v_loaded_pieces numeric;
  v_sold_pieces numeric;
  v_balance_pieces numeric;
  v_boxes integer;
  v_pieces integer;
  v_new_qty numeric;
  v_old_qty numeric;
  v_ppb integer;
  v_movements jsonb;
BEGIN
  FOR rec IN
    SELECT DISTINCT sm.product_id AS pid, p.name, p.pieces_per_box
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    WHERE sm.worker_id = p_worker_id
  LOOP
    v_ppb := COALESCE(rec.pieces_per_box, 1);

    SELECT MAX(sm.created_at) INTO v_last_load_at
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = rec.pid
      AND sm.movement_type = 'load';

    IF v_last_load_at IS NULL THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(
      FLOOR(sm.quantity)::int * v_ppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int
    ), 0) INTO v_loaded_pieces
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = rec.pid
      AND sm.movement_type = 'load' AND sm.created_at = v_last_load_at;

    SELECT COALESCE(SUM(
      FLOOR(sm.quantity)::int * v_ppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int
    ), 0) INTO v_sold_pieces
    FROM stock_movements sm
    LEFT JOIN orders o ON o.id = sm.order_id
    WHERE sm.worker_id = p_worker_id AND sm.product_id = rec.pid
      AND sm.created_at > v_last_load_at
      AND sm.movement_type IN ('delivery','direct_sale')
      AND (sm.order_id IS NULL OR o.status <> 'cancelled');

    v_balance_pieces := GREATEST(v_loaded_pieces - v_sold_pieces, 0);
    v_boxes := FLOOR(v_balance_pieces / v_ppb)::int;
    v_pieces := (v_balance_pieces - v_boxes * v_ppb)::int;
    v_new_qty := v_boxes + (v_pieces::numeric / 100);

    SELECT COALESCE(ws.quantity, 0) INTO v_old_qty FROM worker_stock ws
    WHERE ws.worker_id = p_worker_id AND ws.product_id = rec.pid;
    v_old_qty := COALESCE(v_old_qty, 0);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'created_at', sm.created_at,
      'movement_type', sm.movement_type,
      'quantity', sm.quantity,
      'signed_quantity', sm.signed_quantity,
      'notes', sm.notes,
      'reason', sm.reason
    ) ORDER BY sm.created_at), '[]'::jsonb) INTO v_movements
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = rec.pid
      AND sm.created_at >= v_last_load_at;

    IF v_old_qty <> v_new_qty THEN
      product_id := rec.pid;
      product_name := rec.name;
      ppb := v_ppb;
      current_qty := v_old_qty;
      new_qty := v_new_qty;
      last_load_at := v_last_load_at;
      loaded_pieces := v_loaded_pieces;
      sold_pieces := v_sold_pieces;
      movements := v_movements;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;