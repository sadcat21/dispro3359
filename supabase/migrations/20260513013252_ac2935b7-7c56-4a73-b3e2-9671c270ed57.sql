CREATE OR REPLACE FUNCTION public.confirm_pending_offer(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.sales_tracking (
    source, order_id, order_item_id, product_id, product_name,
    pieces_per_box, sold_boxes, sold_pieces, gift_boxes, gift_pieces,
    unit_price, total_price, branch_id, worker_id, customer_id,
    worker_name, customer_name, branch_name, notes
  ) VALUES (
    CASE WHEN rec.source IN ('direct_sale', 'delivery_sale', 'warehouse_sale') THEN rec.source ELSE 'delivery_sale' END,
    rec.order_id, rec.order_item_id, v_stock_product_id,
    COALESCE(rec.gift_product_name, rec.product_name),
    v_ppb, 0, 0, rec.gift_boxes, rec.gift_pieces, 0, 0,
    rec.branch_id, rec.worker_id, rec.customer_id,
    rec.worker_name, rec.customer_name, rec.branch_name,
    COALESCE(rec.notes, '') || ' [confirmed offer gift]'
  );

  -- Insert into promos table only after confirmation, so it appears on /my-promos
  IF rec.worker_id IS NOT NULL AND rec.customer_id IS NOT NULL THEN
    SELECT po.min_quantity, po.min_quantity_unit, po.gift_quantity_unit
      INTO v_offer
      FROM public.product_offers po
      WHERE po.id = rec.offer_id;

    INSERT INTO public.promos (
      worker_id, customer_id, product_id,
      vente_quantity, sale_quantity_unit,
      gratuite_quantity, gift_quantity_unit,
      offer_id, has_bonus, bonus_amount, notes
    ) VALUES (
      rec.worker_id, rec.customer_id, rec.product_id,
      COALESCE(v_offer.min_quantity, 0),
      COALESCE(v_offer.min_quantity_unit, 'box'),
      v_gift_total_pieces,
      COALESCE(v_offer.gift_quantity_unit, 'piece'),
      rec.offer_id, false, 0,
      'هدية عرض مؤكدة'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_pending_offer(uuid) TO authenticated;