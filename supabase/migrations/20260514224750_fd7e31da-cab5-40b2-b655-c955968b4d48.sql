-- Fix recalibrate_worker_stock: promo_sale and promo_gift stock_movements
-- store quantity in RAW PIECES (not B.P). Treat them as pieces directly.

CREATE OR REPLACE FUNCTION public.preview_recalibrate_worker_stock(p_worker_id uuid)
 RETURNS TABLE(product_id uuid, product_name text, ppb integer, current_qty numeric, new_qty numeric, last_load_at timestamp with time zone, loaded_pieces numeric, sold_pieces numeric, movements jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_last_load timestamptz;
  v_loaded numeric;
  v_sold numeric;
  v_balance numeric;
  v_new_qty numeric;
  v_movs jsonb;
BEGIN
  FOR r IN
    SELECT ws.product_id AS pid, ws.quantity AS current_qty, p.name AS product_name, GREATEST(COALESCE(p.pieces_per_box, 1), 1) AS ppb
    FROM worker_stock ws
    JOIN products p ON p.id = ws.product_id
    WHERE ws.worker_id = p_worker_id
  LOOP
    SELECT MAX(load_at) INTO v_last_load
    FROM (
      SELECT sm.created_at AS load_at
      FROM stock_movements sm
      WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid AND sm.movement_type = 'load'
      UNION ALL
      SELECT COALESCE(ls.completed_at, ls.created_at) AS load_at
      FROM loading_sessions ls
      JOIN loading_session_items li ON li.session_id = ls.id
      WHERE ls.worker_id = p_worker_id AND li.product_id = r.pid AND ls.status IN ('completed', 'open')
    ) loads;

    IF v_last_load IS NULL THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(
      public.stock_qty_bp_to_pieces(li.quantity, r.ppb) +
      CASE WHEN COALESCE(li.gift_unit, 'piece') = 'piece'
        THEN GREATEST(COALESCE(li.gift_quantity, 0), 0)
        ELSE public.stock_qty_bp_to_pieces(li.gift_quantity, r.ppb)
      END
    ), 0) INTO v_loaded
    FROM loading_sessions ls
    JOIN loading_session_items li ON li.session_id = ls.id
    WHERE ls.worker_id = p_worker_id
      AND li.product_id = r.pid
      AND ls.status IN ('completed', 'open')
      AND COALESCE(ls.completed_at, ls.created_at) BETWEEN v_last_load - interval '5 seconds' AND v_last_load + interval '5 seconds';

    IF v_loaded = 0 THEN
      SELECT COALESCE(SUM(public.stock_qty_bp_to_pieces(sm.quantity, r.ppb)), 0)
      INTO v_loaded
      FROM stock_movements sm
      WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
        AND sm.movement_type = 'load'
        AND sm.created_at BETWEEN v_last_load - interval '5 seconds' AND v_last_load + interval '5 seconds';
    END IF;

    WITH delivered_items AS (
      SELECT
        oi.id AS item_id,
        oi.order_id,
        oi.product_id,
        public.stock_qty_bp_to_pieces(oi.quantity, r.ppb) + GREATEST(COALESCE(oi.gift_pieces, 0), 0) AS item_pieces
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE oi.product_id = r.pid
        AND (o.assigned_worker_id = p_worker_id OR o.created_by = p_worker_id)
        AND o.status = 'delivered'
        AND COALESCE(o.updated_at, o.delivery_date::timestamptz, o.created_at) > v_last_load
    ), per_item AS (
      SELECT
        di.item_id,
        COALESCE(
          NULLIF((
            SELECT SUM(
              GREATEST(COALESCE(st.sold_boxes, 0), 0) * r.ppb +
              GREATEST(COALESCE(st.sold_pieces, 0), 0) +
              GREATEST(COALESCE(st.gift_boxes, 0), 0) * r.ppb +
              GREATEST(COALESCE(st.gift_pieces, 0), 0)
            )
            FROM sales_tracking st
            WHERE st.order_id = di.order_id
              AND st.product_id = di.product_id
              AND st.worker_id = p_worker_id
              AND COALESCE(st.sold_at, st.created_at) > v_last_load
          ), 0),
          NULLIF((
            SELECT SUM(
              CASE
                WHEN sm.movement_type IN ('promo_sale','promo_gift')
                  THEN GREATEST(COALESCE(sm.quantity, 0), 0)
                ELSE public.stock_qty_bp_to_pieces(sm.quantity, r.ppb)
              END
            )
            FROM stock_movements sm
            WHERE sm.order_id = di.order_id
              AND sm.product_id = di.product_id
              AND sm.worker_id = p_worker_id
              AND sm.created_at > v_last_load
              AND sm.movement_type IN ('delivery','direct_sale','modification','promo_sale','promo_gift')
          ), 0),
          di.item_pieces
        ) AS pieces
      FROM delivered_items di
    ), orphan_movements AS (
      SELECT COALESCE(SUM(
        CASE
          WHEN sm.movement_type IN ('promo_sale','promo_gift')
            THEN GREATEST(COALESCE(sm.quantity, 0), 0)
          ELSE public.stock_qty_bp_to_pieces(sm.quantity, r.ppb)
        END
      ), 0) AS pieces
      FROM stock_movements sm
      WHERE sm.worker_id = p_worker_id
        AND sm.product_id = r.pid
        AND sm.created_at > v_last_load
        AND sm.order_id IS NULL
        AND sm.movement_type IN ('delivery','direct_sale','modification','promo_sale','promo_gift')
    )
    SELECT COALESCE((SELECT SUM(pieces) FROM per_item), 0) + COALESCE((SELECT pieces FROM orphan_movements), 0)
    INTO v_sold;

    v_balance := GREATEST(v_loaded - v_sold, 0);
    v_new_qty := FLOOR(v_balance / r.ppb) + MOD(v_balance, r.ppb)::numeric / 100;

    IF ROUND(v_new_qty, 4) = ROUND(r.current_qty, 4) THEN CONTINUE; END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'created_at', sm.created_at,
      'movement_type', sm.movement_type,
      'quantity', sm.quantity,
      'signed_quantity', sm.signed_quantity,
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
$function$;