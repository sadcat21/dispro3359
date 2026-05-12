CREATE OR REPLACE FUNCTION public.enforce_worker_freeze()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_worker_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    v_worker_id := COALESCE(NEW.assigned_worker_id, NEW.created_by);
  ELSE
    v_worker_id := NEW.worker_id;
  END IF;

  IF v_worker_id IS NOT NULL AND public.is_worker_frozen(v_worker_id) THEN
    RAISE EXCEPTION 'العامل مُجمَّد بعد المراجعة النهائية — يجب إغلاق جلسة المحاسبة قبل أي حركة جديدة (تحميل/تفريغ/بيع)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;