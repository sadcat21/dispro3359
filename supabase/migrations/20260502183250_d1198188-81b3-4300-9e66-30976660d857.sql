-- جدول فترات العرض/الشرائح
CREATE TABLE IF NOT EXISTS public.product_offer_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.product_offers(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES public.product_offer_tiers(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'original' CHECK (period_type IN ('original','extension','resume')),
  sold_quantity_pieces NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_periods_offer ON public.product_offer_periods(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_periods_tier ON public.product_offer_periods(tier_id);
CREATE INDEX IF NOT EXISTS idx_offer_periods_dates ON public.product_offer_periods(period_start, period_end);

-- تحديث updated_at
CREATE TRIGGER trg_offer_periods_updated
BEFORE UPDATE ON public.product_offer_periods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.product_offer_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view offer periods"
  ON public.product_offer_periods FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage offer periods"
  ON public.product_offer_periods FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = public.get_worker_id()
        AND w.role IN ('admin','branch_admin','project_manager')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = public.get_worker_id()
        AND w.role IN ('admin','branch_admin','project_manager')
    )
  );

-- نقل البيانات: إنشاء فترة "original" لكل عرض موجود
INSERT INTO public.product_offer_periods (offer_id, tier_id, period_start, period_end, period_type, notes)
SELECT 
  o.id,
  NULL,
  COALESCE(o.start_date, o.created_at),
  COALESCE(o.end_date, o.created_at + interval '30 days'),
  'original',
  'تم إنشاؤها تلقائيًا من العرض الأصلي'
FROM public.product_offers o
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_offer_periods p WHERE p.offer_id = o.id AND p.tier_id IS NULL
);

-- دالة لتمديد العرض أو شريحة
CREATE OR REPLACE FUNCTION public.extend_offer_period(
  p_offer_id UUID,
  p_tier_id UUID,
  p_new_start TIMESTAMPTZ,
  p_new_end TIMESTAMPTZ,
  p_period_type TEXT DEFAULT 'extension',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
  v_max_end TIMESTAMPTZ;
BEGIN
  IF p_new_end <= p_new_start THEN
    RAISE EXCEPTION 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
  END IF;

  IF p_period_type NOT IN ('extension','resume') THEN
    p_period_type := 'extension';
  END IF;

  INSERT INTO public.product_offer_periods (
    offer_id, tier_id, period_start, period_end, period_type, created_by, notes
  ) VALUES (
    p_offer_id, p_tier_id, p_new_start, p_new_end, p_period_type, get_worker_id(), p_notes
  ) RETURNING id INTO v_period_id;

  -- تحديث end_date للعرض ليطابق آخر فترة
  SELECT MAX(period_end) INTO v_max_end
  FROM public.product_offer_periods
  WHERE offer_id = p_offer_id;

  UPDATE public.product_offers
  SET end_date = v_max_end,
      is_active = true,
      updated_at = now()
  WHERE id = p_offer_id;

  RETURN v_period_id;
END;
$$;