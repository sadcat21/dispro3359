
-- ============================================================
-- Promo Ledger Integration
-- يربط جدول promos بـ stock_movements كـ ledger موحّد
-- ============================================================

-- 1) دالة مساعدة: إدراج حركة في الـ ledger مع حساب running_balance
CREATE OR REPLACE FUNCTION public.insert_promo_ledger_entry(
  p_promo_id uuid,
  p_worker_id uuid,
  p_customer_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_subtype text,  -- 'promo_sale' or 'promo_gift'
  p_created_by uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_balance numeric;
  v_signed numeric;
  v_branch_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RETURN;
  END IF;

  -- الكمية سالبة (خروج من رصيد العامل إلى العميل)
  v_signed := -ABS(p_quantity);

  -- جلب آخر رصيد للعامل/المنتج من الـ ledger
  SELECT running_balance INTO v_last_balance
  FROM public.stock_movements
  WHERE from_location_type = 'worker'
    AND from_location_id = p_worker_id
    AND product_id = p_product_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF v_last_balance IS NULL THEN
    SELECT COALESCE(running_balance, 0) INTO v_last_balance
    FROM public.stock_movements
    WHERE to_location_type = 'worker'
      AND to_location_id = p_worker_id
      AND product_id = p_product_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  END IF;

  v_last_balance := COALESCE(v_last_balance, 0);

  -- جلب فرع العامل (للسجل)
  SELECT branch_id INTO v_branch_id FROM public.workers WHERE id = p_worker_id;

  INSERT INTO public.stock_movements (
    branch_id, product_id, movement_type, quantity, signed_quantity,
    running_balance, worker_id, from_location_type, from_location_id,
    to_location_type, to_location_id, reference_type, reference_id,
    reason, notes, status, created_by
  ) VALUES (
    v_branch_id, p_product_id, p_movement_subtype, ABS(p_quantity), v_signed,
    v_last_balance + v_signed, p_worker_id, 'worker', p_worker_id,
    'customer', p_customer_id, 'promo', p_promo_id,
    CASE WHEN p_movement_subtype = 'promo_gift' THEN 'تسليم مجاني (عرض)' ELSE 'بيع عرض' END,
    'قيد تلقائي من ledger العروض', 'completed', p_created_by
  );
END;
$$;

-- 2) دالة عكس قيد (للحذف/التعديل)
CREATE OR REPLACE FUNCTION public.delete_promo_ledger_entries(p_promo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.stock_movements
  WHERE reference_type = 'promo' AND reference_id = p_promo_id;
END;
$$;

-- 3) Trigger function على promos
CREATE OR REPLACE FUNCTION public.promo_ledger_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.delete_promo_ledger_entries(OLD.id);
    RETURN OLD;
  END IF;

  v_creator := COALESCE(NEW.worker_id, OLD.worker_id);

  IF TG_OP = 'UPDATE' THEN
    -- إعادة بناء القيود لهذا العرض
    PERFORM public.delete_promo_ledger_entries(NEW.id);
  END IF;

  -- بيع
  IF NEW.vente_quantity IS NOT NULL AND NEW.vente_quantity > 0 THEN
    PERFORM public.insert_promo_ledger_entry(
      NEW.id, NEW.worker_id, NEW.customer_id, NEW.product_id,
      NEW.vente_quantity, 'promo_sale', v_creator
    );
  END IF;

  -- مجاني
  IF NEW.gratuite_quantity IS NOT NULL AND NEW.gratuite_quantity > 0 THEN
    PERFORM public.insert_promo_ledger_entry(
      NEW.id, NEW.worker_id, NEW.customer_id, NEW.product_id,
      NEW.gratuite_quantity, 'promo_gift', v_creator
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 4) ربط الـ trigger
DROP TRIGGER IF EXISTS trg_promo_ledger ON public.promos;
CREATE TRIGGER trg_promo_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.promos
FOR EACH ROW EXECUTE FUNCTION public.promo_ledger_trigger();

-- 5) Backfill: إدخال السجلات الموجودة حالياً
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.promos ORDER BY created_at ASC LOOP
    -- تنظيف أي قيود قديمة لهذا العرض (لتفادي التكرار)
    PERFORM public.delete_promo_ledger_entries(r.id);

    IF r.vente_quantity IS NOT NULL AND r.vente_quantity > 0 THEN
      PERFORM public.insert_promo_ledger_entry(
        r.id, r.worker_id, r.customer_id, r.product_id,
        r.vente_quantity, 'promo_sale', r.worker_id
      );
    END IF;

    IF r.gratuite_quantity IS NOT NULL AND r.gratuite_quantity > 0 THEN
      PERFORM public.insert_promo_ledger_entry(
        r.id, r.worker_id, r.customer_id, r.product_id,
        r.gratuite_quantity, 'promo_gift', r.worker_id
      );
    END IF;
  END LOOP;
END $$;
