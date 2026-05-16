CREATE OR REPLACE FUNCTION public.enforce_worker_freeze()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_worker_id uuid;
  v_row jsonb := to_jsonb(NEW);
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    v_worker_id := COALESCE((v_row->>'assigned_worker_id')::uuid, (v_row->>'created_by')::uuid);
  ELSE
    v_worker_id := (v_row->>'worker_id')::uuid;
  END IF;

  IF TG_TABLE_NAME = 'loading_sessions' AND (v_row->>'status') = 'unloaded' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'stock_movements' AND (v_row->>'movement_type') = 'return' THEN
    RETURN NEW;
  END IF;

  IF v_worker_id IS NOT NULL AND public.is_worker_frozen(v_worker_id) THEN
    RAISE EXCEPTION 'العامل مُجمَّد بعد المراجعة النهائية — يجب إغلاق جلسة المحاسبة قبل أي حركة جديدة (تحميل/تفريغ/بيع)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;