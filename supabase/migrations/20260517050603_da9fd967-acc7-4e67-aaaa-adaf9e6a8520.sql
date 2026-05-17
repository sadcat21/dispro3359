CREATE OR REPLACE FUNCTION public.assert_no_deferred_gift_overdeduction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_product_id uuid;
  v_ppb integer;
  v_total_ordered_pieces numeric;
  v_pending_deferred_gift_pieces numeric;
  v_actual_deducted_pieces numeric;
  v_max_allowed_pieces numeric;
  v_current_pending_confirmation_id uuid;
  v_current_poc_order_item_id uuid;
BEGIN
  v_order_id := NEW.order_id;
  v_product_id := NEW.product_id;

  IF v_order_id IS NULL OR v_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.movement_type NOT IN ('delivery', 'modification', 'sale') THEN
    RETURN NEW;
  END IF;

  -- If this movement confirms a pending offer card that is NOT linked to any
  -- order_item (e.g. direct-sale gifts), it is orthogonal to the order_items
  -- totals used below — skip the check.
  IF NEW.reference_type = 'pending_offer_confirmation' AND NEW.reference_id IS NOT NULL THEN
    SELECT poc.order_item_id INTO v_current_poc_order_item_id
    FROM public.pending_offer_confirmations poc
    WHERE poc.id = NEW.reference_id;
    IF v_current_poc_order_item_id IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT GREATEST(COALESCE(p.pieces_per_box, 1), 1)
    INTO v_ppb
  FROM public.products p
  WHERE p.id = v_product_id;

  v_ppb := GREATEST(COALESCE(v_ppb, 1), 1);

  v_current_pending_confirmation_id := CASE
    WHEN NEW.reference_type = 'pending_offer_confirmation' THEN NEW.reference_id
    ELSE NULL
  END;

  SELECT COALESCE(SUM(
    public.stock_qty_bp_to_pieces(COALESCE(oi.quantity, 0), v_ppb)
    + (GREATEST(COALESCE(oi.gift_quantity, 0), 0) * v_ppb)
    + GREATEST(COALESCE(oi.gift_pieces, 0), 0)
  ), 0)
    INTO v_total_ordered_pieces
  FROM public.order_items oi
  WHERE oi.order_id = v_order_id
    AND oi.product_id = v_product_id;

  IF v_total_ordered_pieces = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(
    (GREATEST(COALESCE(oi.gift_quantity, 0), 0) * v_ppb)
    + GREATEST(COALESCE(oi.gift_pieces, 0), 0)
  ), 0)
    INTO v_pending_deferred_gift_pieces
  FROM public.order_items oi
  JOIN public.product_offers po ON po.id = oi.gift_offer_id
  WHERE oi.order_id = v_order_id
    AND oi.product_id = v_product_id
    AND po.is_deferred_confirmation = true
    AND (COALESCE(oi.gift_quantity, 0) > 0 OR COALESCE(oi.gift_pieces, 0) > 0)
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_offer_confirmations poc
      WHERE poc.order_item_id = oi.id
        AND poc.status = 'confirmed'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_offer_confirmations poc
      WHERE poc.order_item_id = oi.id
        AND poc.id = v_current_pending_confirmation_id
    );

  v_max_allowed_pieces := v_total_ordered_pieces - v_pending_deferred_gift_pieces;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE(sm.signed_quantity,
        CASE WHEN sm.movement_type IN ('delivery','modification','sale') THEN -sm.quantity ELSE sm.quantity END
      ) < 0
      THEN public.stock_qty_bp_to_pieces(ABS(COALESCE(sm.signed_quantity,
        CASE WHEN sm.movement_type IN ('delivery','modification','sale') THEN -sm.quantity ELSE sm.quantity END
      )), v_ppb)
      ELSE -public.stock_qty_bp_to_pieces(ABS(COALESCE(sm.signed_quantity,
        CASE WHEN sm.movement_type IN ('delivery','modification','sale') THEN -sm.quantity ELSE sm.quantity END
      )), v_ppb)
    END
  ), 0)
    INTO v_actual_deducted_pieces
  FROM public.stock_movements sm
  WHERE sm.order_id = v_order_id
    AND sm.product_id = v_product_id
    AND sm.id <> NEW.id;

  v_actual_deducted_pieces := v_actual_deducted_pieces + CASE
    WHEN COALESCE(NEW.signed_quantity,
      CASE WHEN NEW.movement_type IN ('delivery','modification','sale') THEN -NEW.quantity ELSE NEW.quantity END
    ) < 0
    THEN public.stock_qty_bp_to_pieces(ABS(COALESCE(NEW.signed_quantity,
      CASE WHEN NEW.movement_type IN ('delivery','modification','sale') THEN -NEW.quantity ELSE NEW.quantity END
    )), v_ppb)
    ELSE -public.stock_qty_bp_to_pieces(ABS(COALESCE(NEW.signed_quantity,
      CASE WHEN NEW.movement_type IN ('delivery','modification','sale') THEN -NEW.quantity ELSE NEW.quantity END
    )), v_ppb)
  END;

  IF v_actual_deducted_pieces > v_max_allowed_pieces + 0.001 THEN
    RAISE EXCEPTION 'DEFERRED_GIFT_PROTECTION: cannot deduct % pieces for product % on order % — max allowed is % pieces (pending deferred gift: % pieces)',
      v_actual_deducted_pieces, v_product_id, v_order_id, v_max_allowed_pieces, v_pending_deferred_gift_pieces;
  END IF;

  RETURN NEW;
END;
$$;