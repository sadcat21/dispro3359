CREATE OR REPLACE FUNCTION public.confirm_pending_offer(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec public.pending_offer_confirmations%ROWTYPE;
  v_ppb integer;
  v_gift_total_pieces integer;
  v_gift_qty numeric;
  v_worker_row record;
  v_warehouse_row record;
  v_current_pieces integer;
  v_new_pieces integer;
  v_actor_worker uuid;
  v_stock_product_id uuid;
  v_offer record;
  v_paid_quantity numeric;
  v_paid_total_pieces integer;
  v_existing_promo_id uuid;
  v_resolved_source text;
  v_existing_st_id uuid;
  v_gift_unit text;
  v_sale_unit text;
  v_gratuite_value numeric;
BEGIN
  SELECT * INTO rec FROM public.pending_offer_confirmations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending offer not found'; END IF;
  IF rec.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  v_ppb := GREATEST(1, COALESCE(rec.pieces_per_box, 1));
  v_gift_total_pieces := GREATEST(0, COALESCE(rec.gift_boxes, 0)) * v_ppb + GREATEST(0, COALESCE(rec.gift_pieces, 0));
  IF v_gift_total_pieces <= 0 THEN RAISE EXCEPTION 'Pending offer has no gift quantity'; END IF;

  v_gift_qty := FLOOR(v_gift_total_pieces / v_ppb) + MOD(v_gift_total_pieces, v_ppb) / 100.0;
  v_stock_product_id := COALESCE(rec.gift_product_id, rec.product_id);
  v_actor_worker := COALESCE(public.get_worker_id(), rec.worker_id);

  IF rec.source = 'warehouse_sale' THEN
    IF rec.branch_id IS NULL THEN RAISE EXCEPTION 'Branch is required to confirm this offer'; END IF;
    SELECT ws.id, ws.quantity INTO v_warehouse_row FROM public.warehouse_stock ws
      WHERE ws.branch_id = rec.branch_id AND ws.product_id = v_stock_product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No warehouse stock found for gift product'; END IF;
    v_current_pieces := FLOOR(ROUND(COALESCE(v_warehouse_row.quantity, 0)::numeric, 2))::integer * v_ppb
      + ROUND((ROUND(COALESCE(v_warehouse_row.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(v_warehouse_row.quantity, 0)::numeric, 2))) * 100)::integer;
    IF v_current_pieces < v_gift_total_pieces THEN RAISE EXCEPTION 'Insufficient warehouse stock to confirm offer'; END IF;
    v_new_pieces := v_current_pieces - v_gift_total_pieces;
    UPDATE public.warehouse_stock
      SET quantity = FLOOR(v_new_pieces / v_ppb) + MOD(v_new_pieces, v_ppb) / 100.0, updated_at = now()
      WHERE id = v_warehouse_row.id;
  ELSE
    IF rec.worker_id IS NULL THEN RAISE EXCEPTION 'Worker is required to confirm this offer'; END IF;
    SELECT ws.id, ws.quantity INTO v_worker_row FROM public.worker_stock ws
      WHERE ws.worker_id = rec.worker_id AND ws.product_id = v_stock_product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No worker stock found for gift product'; END IF;
    v_current_pieces := FLOOR(ROUND(COALESCE(v_worker_row.quantity, 0)::numeric, 2))::integer * v_ppb
      + ROUND((ROUND(COALESCE(v_worker_row.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(v_worker_row.quantity, 0)::numeric, 2))) * 100)::integer;
    IF v_current_pieces < v_gift_total_pieces THEN RAISE EXCEPTION 'Insufficient worker stock to confirm offer'; END IF;
    v_new_pieces := v_current_pieces - v_gift_total_pieces;
    UPDATE public.worker_stock
      SET quantity = FLOOR(v_new_pieces / v_ppb) + MOD(v_new_pieces, v_ppb) / 100.0, updated_at = now()
      WHERE id = v_worker_row.id;
  END IF;

  INSERT INTO public.stock_movements (
    product_id, branch_id, quantity, movement_type, status, created_by, worker_id,
    order_id, signed_quantity, from_location_type, from_location_id,
    to_location_type, to_location_id, reason, reference_type, reference_id, notes
  ) VALUES (
    v_stock_product_id, rec.branch_id, v_gift_qty, 'delivery', 'approved', v_actor_worker, rec.worker_id,
    rec.order_id, -v_gift_qty,
    CASE WHEN rec.source = 'warehouse_sale' THEN 'warehouse' ELSE 'worker' END,
    CASE WHEN rec.source = 'warehouse_sale' THEN rec.branch_id ELSE rec.worker_id END,
    'customer', rec.customer_id, 'confirmed_deferred_offer_gift', 'pending_offer_confirmation', rec.id,
    COALESCE(NULLIF(rec.notes, ''), 'تأكيد هدية عرض مؤجل')
  );

  UPDATE public.pending_offer_confirmations
    SET status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid()
    WHERE id = p_id;

  v_resolved_source := CASE WHEN rec.source IN ('direct_sale', 'delivery_sale', 'warehouse_sale') THEN rec.source ELSE 'delivery_sale' END;

  IF rec.order_id IS NOT NULL THEN
    SELECT id INTO v_existing_st_id
    FROM public.sales_tracking
    WHERE order_id = rec.order_id
      AND product_id = v_stock_product_id
      AND source = v_resolved_source
    LIMIT 1;
  END IF;

  IF v_existing_st_id IS NOT NULL THEN
    UPDATE public.sales_tracking
    SET gift_boxes = COALESCE(gift_boxes, 0) + COALESCE(rec.gift_boxes, 0),
        gift_pieces = COALESCE(gift_pieces, 0) + COALESCE(rec.gift_pieces, 0),
        notes = COALESCE(notes, '') || ' [confirmed offer gift]'
    WHERE id = v_existing_st_id;
  ELSE
    INSERT INTO public.sales_tracking (
      source, order_id, order_item_id, product_id, product_name,
      pieces_per_box, sold_boxes, sold_pieces, gift_boxes, gift_pieces,
      unit_price, total_price, branch_id, worker_id, customer_id,
      worker_name, customer_name, branch_name, notes
    ) VALUES (
      v_resolved_source,
      rec.order_id, rec.order_item_id, v_stock_product_id,
      COALESCE(rec.gift_product_name, rec.product_name),
      v_ppb, 0, 0, rec.gift_boxes, rec.gift_pieces, 0, 0,
      rec.branch_id, rec.worker_id, rec.customer_id,
      rec.worker_name, rec.customer_name, rec.branch_name,
      COALESCE(rec.notes, '') || ' [confirmed offer gift]'
    );
  END IF;

  IF rec.worker_id IS NOT NULL AND rec.customer_id IS NOT NULL THEN
    SELECT po.min_quantity, po.min_quantity_unit, po.gift_quantity_unit
      INTO v_offer
      FROM public.product_offers po
      WHERE po.id = rec.offer_id;

    v_sale_unit := COALESCE(v_offer.min_quantity_unit, 'box');
    v_paid_total_pieces := NULL;

    IF COALESCE(rec.purchased_boxes, 0) > 0 OR COALESCE(rec.purchased_pieces, 0) > 0 THEN
      v_paid_total_pieces := GREATEST(0, COALESCE(rec.purchased_boxes, 0)) * v_ppb
        + GREATEST(0, COALESCE(rec.purchased_pieces, 0));
    END IF;

    IF v_paid_total_pieces IS NULL AND rec.order_item_id IS NOT NULL THEN
      SELECT GREATEST(
        0,
        FLOOR(COALESCE(oi.quantity, 0))::integer * v_ppb
          + ROUND((COALESCE(oi.quantity, 0) - FLOOR(COALESCE(oi.quantity, 0))) * 100)::integer
          - (
            GREATEST(0, COALESCE(oi.gift_quantity, 0)) * v_ppb
            + GREATEST(0, COALESCE(oi.gift_pieces, 0))
          )
      )
      INTO v_paid_total_pieces
      FROM public.order_items oi
      WHERE oi.id = rec.order_item_id;
    END IF;

    IF v_paid_total_pieces IS NULL AND rec.order_id IS NOT NULL THEN
      SELECT GREATEST(
        0,
        FLOOR(COALESCE(oi.quantity, 0))::integer * v_ppb
          + ROUND((COALESCE(oi.quantity, 0) - FLOOR(COALESCE(oi.quantity, 0))) * 100)::integer
          - (
            GREATEST(0, COALESCE(oi.gift_quantity, 0)) * v_ppb
            + GREATEST(0, COALESCE(oi.gift_pieces, 0))
          )
      )
      INTO v_paid_total_pieces
      FROM public.order_items oi
      WHERE oi.order_id = rec.order_id
        AND oi.product_id = rec.product_id
      ORDER BY oi.created_at DESC
      LIMIT 1;
    END IF;

    IF v_paid_total_pieces IS NULL THEN
      v_paid_quantity := COALESCE(v_offer.min_quantity, 0);
    ELSIF v_sale_unit = 'box' AND v_ppb > 0 THEN
      v_paid_quantity := FLOOR(v_paid_total_pieces / v_ppb) + MOD(v_paid_total_pieces, v_ppb) / 100.0;
    ELSE
      v_paid_quantity := v_paid_total_pieces;
    END IF;

    v_gift_unit := COALESCE(v_offer.gift_quantity_unit, 'piece');
    IF v_gift_unit = 'box' AND v_ppb > 0 THEN
      v_gratuite_value := v_gift_total_pieces::numeric / v_ppb;
    ELSE
      v_gratuite_value := v_gift_total_pieces;
    END IF;

    SELECT p.id INTO v_existing_promo_id
    FROM public.promos p
    WHERE p.order_id = rec.order_id
      AND p.worker_id = rec.worker_id
      AND p.customer_id = rec.customer_id
      AND p.product_id = rec.product_id
      AND (p.offer_id IS NOT DISTINCT FROM rec.offer_id)
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF v_existing_promo_id IS NULL THEN
      INSERT INTO public.promos (
        worker_id, customer_id, product_id, order_id,
        vente_quantity, sale_quantity_unit,
        gratuite_quantity, gift_quantity_unit,
        offer_id, has_bonus, bonus_amount, notes
      ) VALUES (
        rec.worker_id, rec.customer_id, rec.product_id, rec.order_id,
        v_paid_quantity,
        v_sale_unit,
        v_gratuite_value,
        v_gift_unit,
        rec.offer_id, false, 0,
        'هدية عرض مؤكدة'
      );
    ELSE
      UPDATE public.promos
      SET vente_quantity = v_paid_quantity,
          sale_quantity_unit = COALESCE(v_sale_unit, sale_quantity_unit, 'box'),
          gratuite_quantity = v_gratuite_value,
          gift_quantity_unit = v_gift_unit,
          notes = 'هدية عرض مؤكدة'
      WHERE id = v_existing_promo_id;
    END IF;
  END IF;
END;
$function$;

WITH resolved AS (
  SELECT
    p.id,
    GREATEST(1, COALESCE(pr.pieces_per_box, 1)) AS ppb,
    COALESCE(p.sale_quantity_unit, po.min_quantity_unit, 'box') AS sale_unit,
    COALESCE(
      CASE
        WHEN poc.id IS NOT NULL THEN
          GREATEST(0, COALESCE(poc.purchased_boxes, 0)) * GREATEST(1, COALESCE(pr.pieces_per_box, 1))
          + GREATEST(0, COALESCE(poc.purchased_pieces, 0))
        ELSE NULL
      END,
      (
        SELECT GREATEST(
          0,
          FLOOR(COALESCE(oi.quantity, 0))::integer * GREATEST(1, COALESCE(pr.pieces_per_box, 1))
            + ROUND((COALESCE(oi.quantity, 0) - FLOOR(COALESCE(oi.quantity, 0))) * 100)::integer
            - (
              GREATEST(0, COALESCE(oi.gift_quantity, 0)) * GREATEST(1, COALESCE(pr.pieces_per_box, 1))
              + GREATEST(0, COALESCE(oi.gift_pieces, 0))
            )
        )
        FROM public.order_items oi
        WHERE (
          poc.order_item_id IS NOT NULL AND oi.id = poc.order_item_id
        ) OR (
          poc.order_item_id IS NULL AND oi.order_id = p.order_id AND oi.product_id = p.product_id
        )
        ORDER BY CASE WHEN poc.order_item_id IS NOT NULL AND oi.id = poc.order_item_id THEN 0 ELSE 1 END,
                 oi.created_at DESC
        LIMIT 1
      )
    ) AS paid_pieces
  FROM public.promos p
  LEFT JOIN public.products pr ON pr.id = p.product_id
  LEFT JOIN public.product_offers po ON po.id = p.offer_id
  LEFT JOIN LATERAL (
    SELECT poc.*
    FROM public.pending_offer_confirmations poc
    WHERE poc.status = 'confirmed'
      AND poc.order_id = p.order_id
      AND poc.worker_id = p.worker_id
      AND poc.customer_id = p.customer_id
      AND poc.product_id = p.product_id
      AND (p.offer_id IS NOT DISTINCT FROM poc.offer_id)
    ORDER BY poc.confirmed_at DESC NULLS LAST, poc.created_at DESC
    LIMIT 1
  ) poc ON true
  WHERE p.notes = 'هدية عرض مؤكدة'
), normalized AS (
  SELECT
    id,
    CASE
      WHEN paid_pieces IS NULL THEN NULL
      WHEN sale_unit = 'box' THEN FLOOR(paid_pieces::numeric / ppb) + MOD(paid_pieces, ppb) / 100.0
      ELSE paid_pieces::numeric
    END AS correct_vente
  FROM resolved
)
UPDATE public.promos p
SET vente_quantity = n.correct_vente
FROM normalized n
WHERE p.id = n.id
  AND n.correct_vente IS NOT NULL
  AND p.vente_quantity IS DISTINCT FROM n.correct_vente;