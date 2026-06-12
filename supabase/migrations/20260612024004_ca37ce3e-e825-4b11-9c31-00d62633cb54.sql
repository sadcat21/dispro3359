CREATE OR REPLACE FUNCTION public.settle_treasury_on_debt_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a worker_debt becomes fully paid, settle any linked treasury entry
  IF COALESCE(NEW.remaining_amount, 0) <= 0
     AND COALESCE(OLD.remaining_amount, 0) > 0 THEN
    UPDATE public.manager_treasury
    SET status = 'settled',
        resolved_at = COALESCE(resolved_at, now()),
        resolution_notes = COALESCE(resolution_notes, '') ||
          CASE WHEN COALESCE(resolution_notes,'')='' THEN '' ELSE E'\n' END ||
          'تم الإغلاق تلقائيًا بسداد دين العامل'
    WHERE linked_debt_id = NEW.id
      AND status <> 'settled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settle_treasury_on_debt_paid ON public.worker_debts;
CREATE TRIGGER trg_settle_treasury_on_debt_paid
AFTER UPDATE OF remaining_amount, paid_amount, status ON public.worker_debts
FOR EACH ROW
EXECUTE FUNCTION public.settle_treasury_on_debt_paid();