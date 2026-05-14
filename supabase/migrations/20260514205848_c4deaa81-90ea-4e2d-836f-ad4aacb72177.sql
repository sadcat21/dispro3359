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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_last_load timestamptz;
  v_loaded numeric;
  v_sold numeric;
  v_new_qty numeric;
  v_movs jsonb;
BEGIN
  FOR r IN
    SELECT ws.product_id AS pid, ws.quantity AS current_qty, p.name AS product_name, COALESCE(p.pieces_per_box,1) AS ppb
    FROM worker_stock ws
    JOIN products p ON p.id = ws.product_id
    WHERE ws.worker_id = p_worker_id
  LOOP
    SELECT MAX(sm.created_at) INTO v_last_load
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid AND sm.movement_type = 'load';

    IF v_last_load IS NULL THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(sm.quantity * r.ppb),0) INTO v_loaded
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
      AND sm.movement_type = 'load' AND sm.created_at = v_last_load;

    SELECT COALESCE(SUM(
      CASE WHEN sm.movement_type IN ('delivery','direct_sale','promo_sale','promo_gift') THEN sm.quantity ELSE 0 END
    ),0) INTO v_sold
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
      AND sm.created_at > v_last_load;

    v_new_qty := GREATEST(0, (v_loaded - v_sold) / r.ppb::numeric);

    IF ROUND(v_new_qty::numeric, 4) = ROUND(r.current_qty::numeric, 4) THEN CONTINUE; END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'created_at', sm.created_at,
      'movement_type', sm.movement_type,
      'quantity', sm.quantity,
      'signed_quantity', sm.quantity,
      'notes', sm.notes,
      'reason', sm.reason,
      'customer_name', c.name
    ) ORDER BY sm.created_at), '[]'::jsonb) INTO v_movs
    FROM stock_movements sm
    LEFT JOIN orders o ON o.id = sm.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
      AND sm.created_at >= v_last_load;

    product_id := r.pid;
    product_name := r.product_name;
    ppb := r.ppb;
    current_qty := r.current_qty;
    new_qty := v_new_qty;
    last_load_at := v_last_load;
    loaded_pieces := v_loaded;
    sold_pieces := v_sold;
    movements := v_movs;
    RETURN NEXT;
  END LOOP;
END;
$$;