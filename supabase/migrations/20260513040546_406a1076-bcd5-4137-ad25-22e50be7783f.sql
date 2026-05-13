CREATE OR REPLACE FUNCTION public.sync_order_confirmed_offer_quantities(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.pending_offer_confirmations%ROWTYPE;
  v_item record;
  v_offer record;
  v_ppb integer;
  v_desired_total_pieces integer;
  v_paid_quantity numeric;
  v_promo_gift_quantity numeric;
  v_existing_promo_id uuid;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT *
    FROM public.pending_offer_confirmations
    WHERE order_id = p_order_id
      AND status = 'confirmed'
    FOR UPDATE
  LOOP
    v_ppb := GREATEST(1, COALESCE(rec.pieces_per_box, 1));
    v_item := NULL;

    SELECT
      oi.id,
      oi.quantity,
      oi.gift_quantity,
      oi.gift_pieces,
      oi.pieces_per_box,
      oi.gift_offer_id,
      oi.product_id
    INTO v_item
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND (
        (rec.order_item_id IS NOT NULL AND oi.id = rec.order_item_id)
        OR (
          rec.order_item_id IS NULL
          AND oi.product_id = rec.product_id
          AND (oi.gift_offer_id IS NOT DISTINCT FROM rec.offer_id)
        )
      )
    ORDER BY CASE WHEN rec.order_item_id IS NOT NULL AND oi.id = rec.order_item_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF FOUND THEN
      v_ppb := GREATEST(1, COALESCE(v_item.pieces_per_box, rec.pieces_per_box, 1));
      v_desired_total_pieces :=
        GREATEST(0, COALESCE(v_item.gift_quantity, 0)) * v_ppb
        + GREATEST(0, COALESCE(v_item.gift_pieces, 0));
      v_paid_quantity := GREATEST(0, COALESCE(v_item.quantity, 0) - COALESCE(v_item.gift_quantity, 0));

      UPDATE public.pending_offer_confirmations
      SET order_item_id = COALESCE(order_item_id, v_item.id),
          pieces_per_box = v_ppb,
          gift_boxes = FLOOR(v_desired_total_pieces / v_ppb),
          gift_pieces = MOD(v_desired_total_pieces, v_ppb)
      WHERE id = rec.id;
    ELSE
      v_desired_total_pieces := 0;
      v_paid_quantity := 0;

      UPDATE public.pending_offer_confirmations
      SET gift_boxes = 0,
          gift_pieces = 0
      WHERE id = rec.id;
    END IF;

    SELECT po.min_quantity, po.min_quantity_unit, po.gift_quantity_unit
    INTO v_offer
    FROM public.product_offers po
    WHERE po.id = rec.offer_id;

    DELETE FROM public.pending_offer_confirmations p
    WHERE p.order_id = p_order_id
      AND p.status = 'pending'
      AND p.product_id = rec.product_id
      AND (p.offer_id IS NOT DISTINCT FROM rec.offer_id);

    SELECT p.id
    INTO v_existing_promo_id
    FROM public.promos p
    WHERE p.order_id = p_order_id
      AND p.worker_id = rec.worker_id
      AND p.customer_id = rec.customer_id
      AND p.product_id = rec.product_id
      AND (p.offer_id IS NOT DISTINCT FROM rec.offer_id)
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF v_desired_total_pieces <= 0 THEN
      DELETE FROM public.promos p
      WHERE p.order_id = p_order_id
        AND p.worker_id = rec.worker_id
        AND p.customer_id = rec.customer_id
        AND p.product_id = rec.product_id
        AND (p.offer_id IS NOT DISTINCT FROM rec.offer_id);
    ELSE
      v_promo_gift_quantity := CASE
        WHEN COALESCE(v_offer.gift_quantity_unit, 'piece') = 'box'
          THEN FLOOR(v_desired_total_pieces / v_ppb) + MOD(v_desired_total_pieces, v_ppb) / 100.0
        ELSE v_desired_total_pieces
      END;

      IF v_existing_promo_id IS NULL THEN
        INSERT INTO public.promos (
          worker_id, customer_id, product_id, order_id,
          vente_quantity, sale_quantity_unit,
          gratuite_quantity, gift_quantity_unit,
          offer_id, has_bonus, bonus_amount, notes
        ) VALUES (
          rec.worker_id, rec.customer_id, rec.product_id, p_order_id,
          COALESCE(NULLIF(v_paid_quantity, 0), COALESCE(v_offer.min_quantity, 0)),
          COALESCE(v_offer.min_quantity_unit, 'box'),
          v_promo_gift_quantity,
          COALESCE(v_offer.gift_quantity_unit, 'piece'),
          rec.offer_id, false, 0,
          'هدية عرض مؤكدة'
        );
      ELSE
        UPDATE public.promos
        SET vente_quantity = COALESCE(NULLIF(v_paid_quantity, 0), vente_quantity),
            sale_quantity_unit = COALESCE(v_offer.min_quantity_unit, sale_quantity_unit, 'box'),
            gratuite_quantity = v_promo_gift_quantity,
            gift_quantity_unit = COALESCE(v_offer.gift_quantity_unit, gift_quantity_unit, 'piece'),
            notes = 'هدية عرض مؤكدة'
        WHERE id = v_existing_promo_id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_order_confirmed_offer_quantities(uuid) TO authenticated;

WITH affected_orders AS (
  SELECT DISTINCT order_id
  FROM public.pending_offer_confirmations
  WHERE order_id IS NOT NULL
    AND status = 'confirmed'
)
SELECT public.sync_order_confirmed_offer_quantities(order_id)
FROM affected_orders;