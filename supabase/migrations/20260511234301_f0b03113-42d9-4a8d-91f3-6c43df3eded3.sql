-- Function: returns true if the worker has a locked final review with no completed accounting session afterwards
CREATE OR REPLACE FUNCTION public.is_worker_frozen(_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.final_review_sessions frs
    WHERE frs.worker_id = _worker_id
      AND frs.status = 'locked'
      AND NOT EXISTS (
        SELECT 1
        FROM public.accounting_sessions acs
        WHERE acs.worker_id = _worker_id
          AND acs.status = 'completed'
          AND acs.created_at >= frs.locked_at
      )
  );
$$;

-- Generic guard trigger function
CREATE OR REPLACE FUNCTION public.enforce_worker_freeze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wid uuid;
BEGIN
  _wid := NEW.worker_id;
  IF _wid IS NOT NULL AND public.is_worker_frozen(_wid) THEN
    RAISE EXCEPTION 'العامل مُجمَّد بعد المراجعة النهائية — يجب إغلاق جلسة المحاسبة قبل أي حركة جديدة (تحميل/تفريغ/بيع)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers on the three target tables
DROP TRIGGER IF EXISTS trg_freeze_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_freeze_stock_movements
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_freeze();

DROP TRIGGER IF EXISTS trg_freeze_loading_sessions ON public.loading_sessions;
CREATE TRIGGER trg_freeze_loading_sessions
  BEFORE INSERT ON public.loading_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_freeze();

DROP TRIGGER IF EXISTS trg_freeze_orders ON public.orders;
CREATE TRIGGER trg_freeze_orders
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_freeze();