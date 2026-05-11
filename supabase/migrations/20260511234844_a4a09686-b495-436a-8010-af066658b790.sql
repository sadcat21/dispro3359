-- Replace freeze source: use loading_sessions(status='review') instead of final_review_sessions
CREATE OR REPLACE FUNCTION public.is_worker_frozen(_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.loading_sessions ls
    WHERE ls.worker_id = _worker_id
      AND ls.status = 'review'
      AND NOT EXISTS (
        SELECT 1
        FROM public.accounting_sessions acs
        WHERE acs.worker_id = _worker_id
          AND acs.status = 'completed'
          AND acs.created_at >= ls.created_at
      )
  );
$$;

-- Allow inserting the review session itself even while frozen
CREATE OR REPLACE FUNCTION public.enforce_worker_freeze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip check for review sessions (the act of opening a review is what triggers the freeze)
  IF TG_TABLE_NAME = 'loading_sessions' AND NEW.status = 'review' THEN
    RETURN NEW;
  END IF;

  IF NEW.worker_id IS NOT NULL AND public.is_worker_frozen(NEW.worker_id) THEN
    RAISE EXCEPTION 'العامل مُجمَّد بعد جلسة المراجعة — يجب إغلاق جلسة المحاسبة قبل أي حركة جديدة (تحميل/تفريغ/بيع)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;