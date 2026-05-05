
-- View: مراقبة سلامة بيانات العروض
CREATE OR REPLACE VIEW public.v_offer_integrity_issues AS
WITH missing_ledger AS (
  -- promos لم تُسجَّل في الـ ledger
  SELECT 
    'missing_ledger_entry'::text AS issue_type,
    'حركة promo بدون قيد في الدفتر'::text AS issue_label,
    'high'::text AS severity,
    p.id AS promo_id,
    p.offer_id,
    p.product_id,
    p.worker_id,
    p.customer_id,
    p.vente_quantity AS sale_quantity,
    p.gratuite_quantity AS gift_quantity,
    p.created_at,
    NULL::numeric AS expected,
    NULL::numeric AS actual
  FROM public.promos p
  WHERE NOT EXISTS (SELECT 1 FROM public.offer_ledger ol WHERE ol.promo_id = p.id)
),
qty_mismatch AS (
  -- اختلاف بين كمية promo وكمية الـ ledger
  SELECT 
    'quantity_mismatch'::text,
    'اختلاف بين كمية promo والقيد المسجَّل'::text,
    'high'::text,
    p.id, p.offer_id, p.product_id, p.worker_id, p.customer_id,
    p.vente_quantity, p.gratuite_quantity, p.created_at,
    p.vente_quantity AS expected,
    ol.sale_quantity AS actual
  FROM public.promos p
  JOIN public.offer_ledger ol ON ol.promo_id = p.id
  WHERE COALESCE(p.vente_quantity,0) <> COALESCE(ol.sale_quantity,0)
     OR COALESCE(p.gratuite_quantity,0) <> COALESCE(ol.gift_quantity,0)
),
negative_balance AS (
  -- رصيد سالب: تسليم أكثر من المحمّل
  SELECT 
    'negative_balance'::text,
    'رصيد سالب (تسليم أكثر من المحمَّل)'::text,
    'critical'::text,
    NULL::uuid,
    b.offer_id, b.product_id, b.worker_id, NULL::uuid,
    NULL::numeric, NULL::numeric, b.last_movement_at,
    b.loaded_sale, b.delivered_sale + b.shortage_sale
  FROM public.v_offer_balances b
  WHERE b.remaining_sale < 0 OR b.remaining_gift < 0
),
orphan_offer AS (
  -- promo يشير لعرض غير موجود
  SELECT 
    'orphan_offer_reference'::text,
    'حركة تشير إلى عرض محذوف'::text,
    'medium'::text,
    p.id, p.offer_id, p.product_id, p.worker_id, p.customer_id,
    p.vente_quantity, p.gratuite_quantity, p.created_at,
    NULL::numeric, NULL::numeric
  FROM public.promos p
  WHERE p.offer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.product_offers po WHERE po.id = p.offer_id)
)
SELECT * FROM missing_ledger
UNION ALL SELECT * FROM qty_mismatch
UNION ALL SELECT * FROM negative_balance
UNION ALL SELECT * FROM orphan_offer;

-- دالة لإصلاح الحركات الناقصة تلقائياً
CREATE OR REPLACE FUNCTION public.repair_offer_ledger()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT (public.is_admin() OR public.is_branch_admin()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  
  WITH inserted AS (
    INSERT INTO public.offer_ledger (
      offer_id, offer_tier_id, product_id, worker_id, customer_id, branch_id,
      movement_type, sale_quantity, gift_quantity,
      sale_quantity_unit, gift_quantity_unit,
      reference_type, reference_id, promo_id, notes, created_by, created_at
    )
    SELECT p.offer_id, p.offer_tier_id, p.product_id, p.worker_id, p.customer_id, w.branch_id,
      'worker_to_customer',
      COALESCE(p.vente_quantity, 0), COALESCE(p.gratuite_quantity, 0),
      COALESCE(p.sale_quantity_unit, 'box'), COALESCE(p.gift_quantity_unit, 'box'),
      'promo', p.id, p.id, 
      COALESCE(p.notes, '') || ' [إصلاح تلقائي]',
      p.worker_id,
      COALESCE(p.promo_date, p.created_at, now())
    FROM public.promos p
    LEFT JOIN public.workers w ON w.id = p.worker_id
    WHERE NOT EXISTS (SELECT 1 FROM public.offer_ledger ol WHERE ol.promo_id = p.id)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM inserted;
  
  RETURN jsonb_build_object('ok', true, 'repaired', v_count);
END; $$;
