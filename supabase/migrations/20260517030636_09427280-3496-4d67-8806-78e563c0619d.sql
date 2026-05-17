CREATE OR REPLACE FUNCTION public.assert_no_deferred_gift_overdeduction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_product_id uuid;
  v_total_ordered numeric;
  v_pending_deferred_gift numeric;
  v_actual_deducted numeric;
  v_max_allowed numeric;
BEGIN
  v_order_id := NEW.order_id;
  v_product_id := NEW.product_id;

  IF v_order_id IS NULL OR v_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.movement_type NOT IN ('delivery', 'modification', 'sale') THEN
    RETURN NEW;
  END IF;

  -- Total boxes ordered (paid + gift) for this product on this order
  SELECT COALESCE(SUM(COALESCE(oi.quantity, 0) + COALESCE(oi.gift_quantity, 0)), 0)
    INTO v_total_ordered
  FROM order_items oi
  WHERE oi.order_id = v_order_id AND oi.product_id = v_product_id;

  IF v_total_ordered = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(oi.gift_quantity), 0)
    INTO v_pending_deferred_gift
  FROM order_items oi
  JOIN product_offers po ON po.id = oi.gift_offer_id
  WHERE oi.order_id = v_order_id
    AND oi.product_id = v_product_id
    AND po.is_deferred_confirmation = true
    AND COALESCE(oi.gift_quantity, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM pending_offer_confirmations poc
      WHERE poc.order_item_id = oi.id
        AND poc.status = 'confirmed'
    );

  v_max_allowed := v_total_ordered - v_pending_deferred_gift;

  SELECT COALESCE(-SUM(
    COALESCE(signed_quantity,
      CASE WHEN movement_type IN ('delivery','modification','sale') THEN -quantity ELSE quantity END
    )
  ), 0)
    INTO v_actual_deducted
  FROM stock_movements
  WHERE order_id = v_order_id
    AND product_id = v_product_id
    AND id <> NEW.id;

  v_actual_deducted := v_actual_deducted + COALESCE(
    -COALESCE(NEW.signed_quantity,
      CASE WHEN NEW.movement_type IN ('delivery','modification','sale') THEN -NEW.quantity ELSE NEW.quantity END
    ), 0);

  IF v_actual_deducted > v_max_allowed + 0.001 THEN
    RAISE EXCEPTION 'DEFERRED_GIFT_PROTECTION: cannot deduct % boxes for product % on order % — max allowed is % (pending deferred gift: %)',
      v_actual_deducted, v_product_id, v_order_id, v_max_allowed, v_pending_deferred_gift;
  END IF;

  RETURN NEW;
END;
$$;