DROP FUNCTION IF EXISTS public.recalibrate_worker_stock(uuid);

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
  v_diff int;
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

    SELECT COALESCE(SUM(FLOOR(sm.quantity)::int * r.ppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int), 0)
      INTO v_loaded
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
      AND sm.movement_type = 'load' AND sm.created_at = v_last_load;

    SELECT COALESCE(SUM(FLOOR(sm.quantity)::int * r.ppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int), 0)
      INTO v_sold
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
      AND sm.created_at > v_last_load
      AND sm.movement_type IN ('delivery','direct_sale','promo_sale','promo_gift');

    v_diff := GREATEST(0, (v_loaded - v_sold))::int;
    v_new_qty := (v_diff / r.ppb) + (v_diff % r.ppb)::numeric / 100;

    IF ROUND(v_new_qty, 4) = ROUND(r.current_qty, 4) THEN CONTINUE; END IF;

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

    product_id := r.pid; product_name := r.product_name; ppb := r.ppb;
    current_qty := r.current_qty; new_qty := v_new_qty;
    last_load_at := v_last_load; loaded_pieces := v_loaded; sold_pieces := v_sold;
    movements := v_movs;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE FUNCTION public.recalibrate_worker_stock(p_worker_id uuid)
RETURNS TABLE(product_id uuid, product_name text, old_qty numeric, new_qty numeric, ppb integer)
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
  v_diff int;
BEGIN
  FOR r IN
    SELECT ws.id AS ws_id, ws.product_id AS pid, ws.quantity AS current_qty,
           p.name AS pname, COALESCE(p.pieces_per_box,1) AS pppb
    FROM worker_stock ws
    JOIN products p ON p.id = ws.product_id
    WHERE ws.worker_id = p_worker_id
  LOOP
    SELECT MAX(sm.created_at) INTO v_last_load
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid AND sm.movement_type = 'load';

    IF v_last_load IS NULL THEN
      product_id := r.pid; product_name := r.pname; old_qty := r.current_qty;
      new_qty := r.current_qty; ppb := r.pppb;
      RETURN NEXT; CONTINUE;
    END IF;

    SELECT COALESCE(SUM(FLOOR(sm.quantity)::int * r.pppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int), 0)
      INTO v_loaded
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
      AND sm.movement_type = 'load' AND sm.created_at = v_last_load;

    SELECT COALESCE(SUM(FLOOR(sm.quantity)::int * r.pppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int), 0)
      INTO v_sold
    FROM stock_movements sm
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
      AND sm.created_at > v_last_load
      AND sm.movement_type IN ('delivery','direct_sale','promo_sale','promo_gift');

    v_diff := GREATEST(0, (v_loaded - v_sold))::int;
    v_new_qty := (v_diff / r.pppb) + (v_diff % r.pppb)::numeric / 100;

    UPDATE worker_stock SET quantity = v_new_qty WHERE id = r.ws_id;

    product_id := r.pid; product_name := r.pname; old_qty := r.current_qty;
    new_qty := v_new_qty; ppb := r.pppb;
    RETURN NEXT;
  END LOOP;
END;
$$;