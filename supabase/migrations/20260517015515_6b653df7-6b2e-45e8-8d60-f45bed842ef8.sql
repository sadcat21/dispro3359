-- 1) Helper: ensure pending offer confirmation cards exist for every deferred gift on a worker's orders
CREATE OR REPLACE FUNCTION public.ensure_pending_offer_cards_for_worker(p_worker_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.pending_offer_confirmations (
      order_id, order_item_id, offer_id, product_id, product_name, pieces_per_box,
      gift_product_id, gift_product_name, gift_boxes, gift_pieces,
      purchased_boxes, purchased_pieces,
      customer_id, customer_name, worker_id, worker_name,
      branch_id, branch_name, source, status,
      notes
    )
    SELECT
      o.id, oi.id, po.id, oi.product_id, lp.name,
      GREATEST(COALESCE(oi.pieces_per_box, lp.pieces_per_box, 1), 1),
      po.gift_product_id, COALESCE(gp.name, lp.name),
      GREATEST(COALESCE(oi.gift_quantity, 0), 0),
      GREATEST(COALESCE(oi.gift_pieces, 0), 0),
      GREATEST(COALESCE(oi.quantity, 0), 0), 0,
      o.customer_id, c.name, o.assigned_worker_id, w.full_name,
      o.branch_id, b.name, 'order', 'pending',
      'إعادة إنشاء تلقائية بعد تصحيح رصيد الشاحنة'
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.product_offers po ON po.id = oi.gift_offer_id
      AND po.is_deferred_confirmation = true
    LEFT JOIN public.products lp ON lp.id = oi.product_id
    LEFT JOIN public.products gp ON gp.id = po.gift_product_id
    LEFT JOIN public.customers c ON c.id = o.customer_id
    LEFT JOIN public.workers w ON w.id = o.assigned_worker_id
    LEFT JOIN public.branches b ON b.id = o.branch_id
    WHERE o.assigned_worker_id = p_worker_id
      AND COALESCE(o.status, '') NOT IN ('cancelled')
      AND (COALESCE(oi.gift_quantity, 0) > 0 OR COALESCE(oi.gift_pieces, 0) > 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.pending_offer_confirmations poc
        WHERE poc.order_item_id = oi.id
          AND poc.offer_id = po.id
          AND poc.status IN ('pending', 'confirmed')
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;
  RETURN v_inserted;
END;
$$;

-- 2) Patch preview_recalibrate_worker_stock: exclude deferred-offer gift pieces from the deduction
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
  v_deferred_gift_pieces numeric;
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

    -- NEW: compensate for the bug where gift pieces of deferred-confirmation offers
    -- were deducted from worker_stock. For every unique order_id linked to a
    -- delivery/direct_sale/modification of this product, add back the gift pieces
    -- of any line in that order whose deferred offer ultimately gifts this product.
    SELECT COALESCE(SUM(
      COALESCE(oi.gift_quantity, 0) * r.ppb + COALESCE(oi.gift_pieces, 0)
    ), 0) INTO v_deferred_gift_pieces
    FROM (
      SELECT DISTINCT sm.order_id
      FROM stock_movements sm
      LEFT JOIN orders o ON o.id = sm.order_id
      WHERE sm.worker_id = p_worker_id
        AND sm.product_id = r.pid
        AND sm.created_at > v_last_load
        AND sm.movement_type IN ('delivery','direct_sale','modification')
        AND sm.order_id IS NOT NULL
        AND COALESCE(o.status, '') NOT IN ('cancelled')
    ) ord
    JOIN order_items oi ON oi.order_id = ord.order_id
    JOIN product_offers po ON po.id = oi.gift_offer_id
      AND po.is_deferred_confirmation = true
    WHERE COALESCE(po.gift_product_id, oi.product_id) = r.pid
      AND (COALESCE(oi.gift_quantity, 0) > 0 OR COALESCE(oi.gift_pieces, 0) > 0);

    v_balance := LEAST(
      v_loaded,
      GREATEST(v_loaded - COALESCE(v_net_out, 0) + COALESCE(v_deferred_gift_pieces, 0), 0)
    );
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
    sold_pieces := COALESCE(v_net_out, 0) - COALESCE(v_deferred_gift_pieces, 0);
    movements := v_movs;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 3) Patch recalibrate_worker_stock to also ensure pending offer cards exist
CREATE OR REPLACE FUNCTION public.recalibrate_worker_stock(p_worker_id uuid)
RETURNS TABLE(product_id uuid, product_name text, old_qty numeric, new_qty numeric, ppb integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  -- Re-create any missing deferred-offer confirmation cards first, so the
  -- preview/balance logic sees them and the worker can confirm them later.
  PERFORM public.ensure_pending_offer_cards_for_worker(p_worker_id);

  FOR rec IN SELECT * FROM public.preview_recalibrate_worker_stock(p_worker_id)
  LOOP
    UPDATE worker_stock ws
    SET quantity = rec.new_qty, updated_at = now()
    WHERE ws.worker_id = p_worker_id AND ws.product_id = rec.product_id;

    product_id := rec.product_id;
    product_name := rec.product_name;
    old_qty := rec.current_qty;
    new_qty := rec.new_qty;
    ppb := rec.ppb;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- 4) Immediately recreate the cards for the two workers whose stock was just restored
SELECT public.ensure_pending_offer_cards_for_worker('ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab');
SELECT public.ensure_pending_offer_cards_for_worker('d1023b86-ed15-42f9-9a0a-3edf2b29dc78');