
-- 1) Add jsonb column on manager_treasury
ALTER TABLE public.manager_treasury
  ADD COLUMN IF NOT EXISTS resolution_splits jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Migrate any existing rows from the side table into the jsonb column
UPDATE public.manager_treasury mt
   SET resolution_splits = sub.arr
  FROM (
    SELECT treasury_id,
           jsonb_agg(
             jsonb_build_object(
               'id', id,
               'resolution_type', resolution_type,
               'amount', amount,
               'party_type', party_type,
               'party_id', party_id,
               'party_label', party_label,
               'linked_debt_id', linked_debt_id,
               'customer_credit_id', customer_credit_id,
               'status', status,
               'notes', notes,
               'resolved_by', resolved_by,
               'resolved_at', resolved_at,
               'created_at', created_at
             ) ORDER BY created_at
           ) AS arr
      FROM public.manager_treasury_resolutions
     GROUP BY treasury_id
  ) sub
 WHERE mt.id = sub.treasury_id;

-- 3) Drop old side table + its trigger/function
DROP TRIGGER IF EXISTS trg_sync_treasury_after_split ON public.manager_treasury_resolutions;
DROP TABLE IF EXISTS public.manager_treasury_resolutions CASCADE;
DROP FUNCTION IF EXISTS public.sync_manager_treasury_from_splits();

-- 4) Function + trigger to derive status from resolution_splits jsonb
CREATE OR REPLACE FUNCTION public.sync_treasury_from_resolution_splits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target numeric;
  v_sum numeric;
  v_count int;
  v_first_type text;
  v_has_review boolean;
  v_has_debt boolean;
  v_has_writeoff boolean;
  v_new_status text;
BEGIN
  v_target := ABS(COALESCE(NEW.amount, 0));

  SELECT COALESCE(SUM((s->>'amount')::numeric), 0),
         COUNT(*)
    INTO v_sum, v_count
    FROM jsonb_array_elements(COALESCE(NEW.resolution_splits, '[]'::jsonb)) s;

  IF v_count = 0 THEN
    -- no splits → keep original status if already terminal, else mark open
    IF NEW.status IS NULL OR NEW.status NOT IN ('settled','written_off','transferred_to_debt','under_review') THEN
      NEW.status := 'open';
    END IF;
    NEW.resolution_type := NULL;
    NEW.resolved_at := NULL;
    RETURN NEW;
  END IF;

  -- representative type = last appended
  SELECT s->>'resolution_type'
    INTO v_first_type
    FROM jsonb_array_elements(NEW.resolution_splits) WITH ORDINALITY t(s, ord)
    ORDER BY ord DESC LIMIT 1;

  SELECT
    bool_or((s->>'status') = 'under_review'),
    bool_or((s->>'resolution_type') IN ('worker_debt','worker_acknowledged',
                                         'transfer_to_other_employee','split_writeoff_debt')),
    bool_or((s->>'resolution_type') IN ('manager_approved_writeoff','tolerance_writeoff','auto_writeoff'))
    INTO v_has_review, v_has_debt, v_has_writeoff
    FROM jsonb_array_elements(NEW.resolution_splits) s;

  IF v_sum + 0.005 < v_target THEN
    v_new_status := 'open';
  ELSIF v_has_review THEN
    v_new_status := 'under_review';
  ELSIF v_has_debt THEN
    v_new_status := 'transferred_to_debt';
  ELSIF v_has_writeoff THEN
    v_new_status := 'written_off';
  ELSE
    v_new_status := 'settled';
  END IF;

  NEW.status := v_new_status;
  NEW.resolution_type := v_first_type;
  NEW.resolved_at := CASE WHEN v_new_status = 'open' THEN NULL ELSE now() END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_treasury_resolution_splits ON public.manager_treasury;
CREATE TRIGGER trg_sync_treasury_resolution_splits
BEFORE INSERT OR UPDATE OF resolution_splits ON public.manager_treasury
FOR EACH ROW EXECUTE FUNCTION public.sync_treasury_from_resolution_splits();
