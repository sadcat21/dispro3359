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
  v_net_out numeric;
  v_balance numeric;
  v_new_qty numeric;
  v_movs jsonb;
BEGIN
  FOR r IN
    SELECT ws.product_id AS pid, ws.quantity AS current_qty, p.name AS product_name,
           GREATEST(COALESCE(p.pieces_per_box, 1), 1) AS ppb
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

    WITH scoped AS (
      SELECT sm.*,
             COALESCE(o.status, promo_order.status, pending_order.status) AS linked_order_status
      FROM stock_movements sm
      LEFT JOIN orders o ON o.id = sm.order_id
      LEFT JOIN promos promo ON sm.reference_type = 'promo' AND promo.id = sm.reference_id
      LEFT JOIN orders promo_order ON promo_order.id = promo.order_id
      LEFT JOIN pending_offer_confirmations poc ON sm.reference_type = 'pending_offer_confirmation' AND poc.id = sm.reference_id
      LEFT JOIN orders pending_order ON pending_order.id = poc.order_id
      WHERE sm.worker_id = p_worker_id
        AND sm.product_id = r.pid
        AND sm.created_at > v_last_load
        AND sm.movement_type <> 'load'
    )
    SELECT COALESCE(SUM(
      CASE
        WHEN linked_order_status = 'cancelled' THEN 0
        -- promo_sale / promo_gift are ledger-only duplicates of delivery rows; ignore for stock
        WHEN movement_type IN ('promo_sale','promo_gift') THEN 0
        WHEN signed_quantity IS NOT NULL THEN
          public.stock_qty_bp_to_pieces(ABS(signed_quantity), r.ppb)
          * CASE WHEN signed_quantity < 0 THEN 1 WHEN signed_quantity > 0 THEN -1 ELSE 0 END
        WHEN movement_type IN ('delivery','direct_sale','modification') THEN public.stock_qty_bp_to_pieces(quantity, r.ppb)
        WHEN movement_type IN ('return','receipt','exchange') THEN -public.stock_qty_bp_to_pieces(quantity, r.ppb)
        ELSE 0
      END
    ), 0) INTO v_net_out
    FROM scoped;

    v_balance := LEAST(v_loaded, GREATEST(v_loaded - COALESCE(v_net_out, 0), 0));
    v_new_qty := FLOOR(v_balance / r.ppb) + MOD(v_balance, r.ppb)::numeric / 100;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'created_at', sm.created_at,
      'movement_type', sm.movement_type,
      'quantity', sm.quantity,
      'signed_quantity', sm.signed_quantity,
      'notes', sm.notes,
      'reason', sm.reason,
      'customer_name', c.name,
      'order_status', COALESCE(o.status, promo_order.status, pending_order.status)
    ) ORDER BY sm.created_at), '[]'::jsonb) INTO v_movs
    FROM stock_movements sm
    LEFT JOIN orders o ON o.id = sm.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN promos promo ON sm.reference_type = 'promo' AND promo.id = sm.reference_id
    LEFT JOIN orders promo_order ON promo_order.id = promo.order_id
    LEFT JOIN pending_offer_confirmations poc ON sm.reference_type = 'pending_offer_confirmation' AND poc.id = sm.reference_id
    LEFT JOIN orders pending_order ON pending_order.id = poc.order_id
    WHERE sm.worker_id = p_worker_id AND sm.product_id = r.pid
      AND sm.created_at >= v_last_load;

    product_id := r.pid; product_name := r.product_name; ppb := r.ppb;
    current_qty := r.current_qty; new_qty := v_new_qty;
    last_load_at := v_last_load; loaded_pieces := v_loaded;
    sold_pieces := COALESCE(v_net_out, 0);
    movements := v_movs;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- Re-run global recalibration with the fixed logic
DO $$
DECLARE
  v_worker_id uuid;
  rec record;
BEGIN
  FOR v_worker_id IN SELECT DISTINCT worker_id FROM public.worker_stock WHERE worker_id IS NOT NULL
  LOOP
    FOR rec IN SELECT * FROM public.preview_recalibrate_worker_stock(v_worker_id)
    LOOP
      UPDATE public.worker_stock ws
      SET quantity = rec.new_qty, updated_at = now()
      WHERE ws.worker_id = v_worker_id AND ws.product_id = rec.product_id;
    END LOOP;
  END LOOP;
END $$;