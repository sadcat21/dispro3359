
-- تحويل b.p → قطع، مع دعم gift_quantity_unit
CREATE OR REPLACE FUNCTION public.insert_promo_ledger_entry(
  p_promo_id uuid,
  p_worker_id uuid,
  p_customer_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_subtype text,
  p_created_by uuid,
  p_unit text DEFAULT 'box'  -- 'box' (b.p format) or 'piece' (raw pieces)
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pieces_per_box numeric;
  v_total_pieces numeric;
  v_signed numeric;
  v_branch_id uuid;
  v_qty_rounded numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(pieces_per_box, 20) INTO v_pieces_per_box
  FROM public.products WHERE id = p_product_id;

  -- تحويل b.p → إجمالي القطع
  IF p_unit = 'piece' THEN
    v_total_pieces := ABS(p_quantity);
  ELSE
    v_qty_rounded := ROUND(ABS(p_quantity)::numeric, 2);
    v_total_pieces :=
      FLOOR(v_qty_rounded) * v_pieces_per_box
      + ROUND((v_qty_rounded - FLOOR(v_qty_rounded)) * 100);
  END IF;

  IF v_total_pieces = 0 THEN RETURN; END IF;

  v_signed := -v_total_pieces;

  SELECT branch_id INTO v_branch_id FROM public.workers WHERE id = p_worker_id;

  INSERT INTO public.stock_movements (
    branch_id, product_id, movement_type, quantity, signed_quantity,
    worker_id, from_location_type, from_location_id,
    to_location_type, to_location_id, reference_type, reference_id,
    reason, notes, status, created_by
  ) VALUES (
    v_branch_id, p_product_id, p_movement_subtype, v_total_pieces, v_signed,
    p_worker_id, 'worker', p_worker_id,
    'customer', p_customer_id, 'promo', p_promo_id,
    CASE WHEN p_movement_subtype = 'promo_gift' THEN 'تسليم مجاني (عرض)' ELSE 'بيع عرض' END,
    'قيد ledger - الكمية بالقطع (وحدة أصلية: ' || p_unit || ', ' || p_quantity || ')',
    'completed', p_created_by
  );
END;
$$;

-- تحديث trigger ليمرر وحدة الهدية الصحيحة
CREATE OR REPLACE FUNCTION public.promo_ledger_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
  v_gift_unit text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.delete_promo_ledger_entries(OLD.id);
    RETURN OLD;
  END IF;

  v_creator := COALESCE(NEW.worker_id, OLD.worker_id);

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.delete_promo_ledger_entries(NEW.id);
  END IF;

  -- البيع دائماً بصيغة b.p (box)
  IF NEW.vente_quantity IS NOT NULL AND NEW.vente_quantity > 0 THEN
    PERFORM public.insert_promo_ledger_entry(
      NEW.id, NEW.worker_id, NEW.customer_id, NEW.product_id,
      NEW.vente_quantity, 'promo_sale', v_creator, 'box'
    );
  END IF;

  -- الهدية: تتبع gift_quantity_unit
  IF NEW.gratuite_quantity IS NOT NULL AND NEW.gratuite_quantity > 0 THEN
    v_gift_unit := COALESCE(NEW.gift_quantity_unit, 'box');
    PERFORM public.insert_promo_ledger_entry(
      NEW.id, NEW.worker_id, NEW.customer_id, NEW.product_id,
      NEW.gratuite_quantity, 'promo_gift', v_creator, v_gift_unit
    );
  END IF;

  RETURN NEW;
END;
$$;

-- إعادة بناء كل القيود الموجودة بالصيغة الصحيحة
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.promos ORDER BY created_at ASC LOOP
    PERFORM public.delete_promo_ledger_entries(r.id);

    IF r.vente_quantity IS NOT NULL AND r.vente_quantity > 0 THEN
      PERFORM public.insert_promo_ledger_entry(
        r.id, r.worker_id, r.customer_id, r.product_id,
        r.vente_quantity, 'promo_sale', r.worker_id, 'box'
      );
    END IF;

    IF r.gratuite_quantity IS NOT NULL AND r.gratuite_quantity > 0 THEN
      PERFORM public.insert_promo_ledger_entry(
        r.id, r.worker_id, r.customer_id, r.product_id,
        r.gratuite_quantity, 'promo_gift', r.worker_id,
        COALESCE(r.gift_quantity_unit, 'box')
      );
    END IF;
  END LOOP;
END $$;
