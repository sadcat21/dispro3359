-- دعم كميات b.p العشرية في العروض وعدم حصرها في أعداد صحيحة
ALTER TABLE public.promos
  ALTER COLUMN vente_quantity TYPE numeric USING vente_quantity::numeric,
  ALTER COLUMN gratuite_quantity TYPE numeric USING gratuite_quantity::numeric;

ALTER TABLE public.product_offers
  ALTER COLUMN min_quantity TYPE numeric USING min_quantity::numeric,
  ALTER COLUMN max_quantity TYPE numeric USING max_quantity::numeric,
  ALTER COLUMN gift_quantity TYPE numeric USING gift_quantity::numeric;

ALTER TABLE public.product_offer_tiers
  ALTER COLUMN min_quantity TYPE numeric USING min_quantity::numeric,
  ALTER COLUMN max_quantity TYPE numeric USING max_quantity::numeric,
  ALTER COLUMN gift_quantity TYPE numeric USING gift_quantity::numeric;

-- تحويل أي كمية حسب الوحدة إلى إجمالي القطع اعتماداً على pieces_per_box للمنتج
CREATE OR REPLACE FUNCTION public.quantity_to_total_pieces(
  p_product_id uuid,
  p_quantity numeric,
  p_unit text DEFAULT 'box'
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pieces_per_box numeric;
  v_qty numeric;
  v_boxes numeric;
  v_pieces numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RETURN 0;
  END IF;

  SELECT GREATEST(COALESCE(pieces_per_box, 1), 1)::numeric
  INTO v_pieces_per_box
  FROM public.products
  WHERE id = p_product_id;

  v_pieces_per_box := COALESCE(v_pieces_per_box, 1);
  v_qty := ROUND(ABS(p_quantity)::numeric, 2);

  IF COALESCE(p_unit, 'box') = 'piece' THEN
    RETURN ROUND(v_qty);
  END IF;

  -- صيغة b.p: الجزء الصحيح = صناديق، والجزء العشري = عدد القطع وليس كسراً عشرياً
  v_boxes := FLOOR(v_qty);
  v_pieces := ROUND((v_qty - v_boxes) * 100);

  RETURN (v_boxes * v_pieces_per_box) + v_pieces;
END;
$$;

-- تحويل إجمالي القطع إلى صيغة b.p حسب إعدادات المنتج
CREATE OR REPLACE FUNCTION public.total_pieces_to_bp(
  p_product_id uuid,
  p_total_pieces numeric
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pieces_per_box numeric;
  v_total_pieces numeric;
  v_boxes numeric;
  v_pieces numeric;
BEGIN
  IF p_total_pieces IS NULL OR p_total_pieces = 0 THEN
    RETURN 0;
  END IF;

  SELECT GREATEST(COALESCE(pieces_per_box, 1), 1)::numeric
  INTO v_pieces_per_box
  FROM public.products
  WHERE id = p_product_id;

  v_pieces_per_box := COALESCE(v_pieces_per_box, 1);
  v_total_pieces := ROUND(ABS(p_total_pieces));
  v_boxes := FLOOR(v_total_pieces / v_pieces_per_box);
  v_pieces := MOD(v_total_pieces, v_pieces_per_box);

  RETURN v_boxes + (v_pieces / 100.0);
END;
$$;

-- إزالة النسخة القديمة غير الداعمة للوحدة حتى لا تستعمل بالخطأ
DROP FUNCTION IF EXISTS public.insert_promo_ledger_entry(uuid, uuid, uuid, uuid, numeric, text, uuid);

-- توحيد إدخال العروض إلى Ledger: يخزن دائماً إجمالي القطع، ويدعم تحويل القطع ↔ b.p
CREATE OR REPLACE FUNCTION public.insert_promo_ledger_entry(
  p_promo_id uuid,
  p_worker_id uuid,
  p_customer_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_subtype text,
  p_created_by uuid,
  p_unit text DEFAULT 'box'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_pieces numeric;
  v_signed numeric;
  v_branch_id uuid;
  v_bp_equivalent numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RETURN;
  END IF;

  v_total_pieces := public.quantity_to_total_pieces(p_product_id, p_quantity, p_unit);

  IF v_total_pieces = 0 THEN
    RETURN;
  END IF;

  v_signed := -ABS(v_total_pieces);
  v_bp_equivalent := public.total_pieces_to_bp(p_product_id, v_total_pieces);

  SELECT branch_id INTO v_branch_id
  FROM public.workers
  WHERE id = p_worker_id;

  INSERT INTO public.stock_movements (
    branch_id, product_id, movement_type, quantity, signed_quantity,
    worker_id, from_location_type, from_location_id,
    to_location_type, to_location_id, reference_type, reference_id,
    reason, notes, status, created_by
  ) VALUES (
    v_branch_id, p_product_id, p_movement_subtype, ABS(v_total_pieces), v_signed,
    p_worker_id, 'worker', p_worker_id,
    'customer', p_customer_id, 'promo', p_promo_id,
    CASE WHEN p_movement_subtype = 'promo_gift' THEN 'تسليم مجاني (عرض)' ELSE 'بيع عرض' END,
    'قيد ledger - الأصل: ' || p_quantity || ' ' || COALESCE(p_unit, 'box') ||
      '، إجمالي القطع: ' || ABS(v_total_pieces) ||
      '، مكافئ b.p: ' || v_bp_equivalent,
    'completed', p_created_by
  );
END;
$$;

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

  -- البيع يسجل بصيغة b.p افتراضياً
  IF NEW.vente_quantity IS NOT NULL AND NEW.vente_quantity > 0 THEN
    PERFORM public.insert_promo_ledger_entry(
      NEW.id, NEW.worker_id, NEW.customer_id, NEW.product_id,
      NEW.vente_quantity, 'promo_sale', v_creator, 'box'
    );
  END IF;

  -- الهدية: إذا كانت بالقطع يتم تحويلها تلقائياً إلى مكافئ b.p وإجمالي قطع حسب المنتج
  IF NEW.gratuite_quantity IS NOT NULL AND NEW.gratuite_quantity > 0 THEN
    v_gift_unit := COALESCE(NEW.gift_quantity_unit, 'piece');
    PERFORM public.insert_promo_ledger_entry(
      NEW.id, NEW.worker_id, NEW.customer_id, NEW.product_id,
      NEW.gratuite_quantity, 'promo_gift', v_creator, v_gift_unit
    );
  END IF;

  RETURN NEW;
END;
$$;