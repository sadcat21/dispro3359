CREATE OR REPLACE FUNCTION public.enforce_worker_freeze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.worker_id IS NOT NULL AND public.is_worker_frozen(NEW.worker_id) THEN
    RAISE EXCEPTION 'العامل مُجمَّد بعد المراجعة النهائية — يجب إغلاق جلسة المحاسبة قبل أي حركة جديدة (تحميل/تفريغ/بيع)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;