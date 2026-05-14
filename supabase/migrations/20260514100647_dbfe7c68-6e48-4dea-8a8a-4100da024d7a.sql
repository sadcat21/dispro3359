CREATE OR REPLACE FUNCTION public.recalibrate_worker_stock(p_worker_id uuid)
RETURNS TABLE(product_id uuid, product_name text, old_qty numeric, new_qty numeric, ppb integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT DISTINCT sm.product_id, p.name, p.pieces_per_box
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    WHERE sm.worker_id = p_worker_id
  LOOP
    v_ppb := COALESCE(rec.pieces_per_box, 1);

    -- last load timestamp
    SELECT MAX(created_at) INTO v_last_load_at
    FROM stock_movements
    WHERE worker_id = p_worker_id
      AND product_id = rec.product_id
      AND movement_type = 'load';

    IF v_last_load_at IS NULL THEN
      CONTINUE;
    END IF;

    -- loaded pieces from the latest load(s) at that timestamp
    SELECT COALESCE(SUM(
      FLOOR(quantity)::int * v_ppb + ROUND((quantity - FLOOR(quantity)) * 100)::int
    ), 0) INTO v_loaded_pieces
    FROM stock_movements
    WHERE worker_id = p_worker_id
      AND product_id = rec.product_id
      AND movement_type = 'load'
      AND created_at = v_last_load_at;

    -- sold/given pieces after the last load, excluding cancelled orders
    SELECT COALESCE(SUM(
      FLOOR(sm.quantity)::int * v_ppb + ROUND((sm.quantity - FLOOR(sm.quantity)) * 100)::int
    ), 0) INTO v_sold_pieces
    FROM stock_movements sm
    LEFT JOIN orders o ON o.id = sm.order_id
    WHERE sm.worker_id = p_worker_id
      AND sm.product_id = rec.product_id
      AND sm.created_at > v_last_load_at
      AND sm.movement_type IN ('delivery','modification','promo_sale','promo_gift','direct_sale')
      AND (sm.order_id IS NULL OR o.status <> 'cancelled');

    v_balance_pieces := GREATEST(v_loaded_pieces - v_sold_pieces, 0);
    v_boxes := FLOOR(v_balance_pieces / v_ppb)::int;
    v_pieces := (v_balance_pieces - v_boxes * v_ppb)::int;
    v_new_qty := v_boxes + (v_pieces::numeric / 100);

    SELECT quantity INTO v_old_qty FROM worker_stock
    WHERE worker_id = p_worker_id AND product_id = rec.product_id;

    IF v_old_qty IS NULL THEN
      INSERT INTO worker_stock (worker_id, product_id, quantity, updated_at)
      VALUES (p_worker_id, rec.product_id, v_new_qty, now());
      v_old_qty := 0;
    ELSE
      UPDATE worker_stock
      SET quantity = v_new_qty, updated_at = now()
      WHERE worker_id = p_worker_id AND product_id = rec.product_id;
    END IF;

    product_id := rec.product_id;
    product_name := rec.name;
    old_qty := v_old_qty;
    new_qty := v_new_qty;
    ppb := v_ppb;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalibrate_worker_stock(uuid) TO authenticated;