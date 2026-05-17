-- Safety-net trigger: forbid stock_movements from deducting more than
-- (order quantity − pending deferred-gift boxes) for any product in an order.
-- This catches future code paths that forget to honor is_deferred_confirmation.

CREATE OR REPLACE FUNCTION public.assert_no_deferred_gift_overdeduction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_product_id uuid;
  v_total_sold numeric;
  v_pending_deferred_gift numeric;
  v_actual_deducted numeric;
  v_max_allowed numeric;
BEGIN
  v_order_id := NEW.order_id;
  v_product_id := NEW.product_id;

  IF v_order_id IS NULL OR v_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only guard the deduction paths
  IF NEW.movement_type NOT IN ('delivery', 'modification', 'sale') THEN
    RETURN NEW;
  END IF;

  -- Total ordered boxes (paid + gift) for this product on this order
  SELECT COALESCE(SUM(oi.quantity), 0)
    INTO v_total_sold
  FROM order_items oi
  WHERE oi.order_id = v_order_id AND oi.product_id = v_product_id;

  IF v_total_sold = 0 THEN
    RETURN NEW;
  END IF;

  -- Sum of gift boxes from deferred offers that have NOT been confirmed yet.
  -- These boxes must stay in stock until the worker confirms the offer card.
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

  v_max_allowed := v_total_sold - v_pending_deferred_gift;

  -- Sum of deductions already recorded for this order+product (after this row).
  -- signed_quantity is negative for deductions; we compare absolute value.
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

  -- Add the incoming row
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

DROP TRIGGER IF EXISTS trg_assert_no_deferred_gift_overdeduction ON public.stock_movements;
CREATE TRIGGER trg_assert_no_deferred_gift_overdeduction
AFTER INSERT OR UPDATE ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.assert_no_deferred_gift_overdeduction();