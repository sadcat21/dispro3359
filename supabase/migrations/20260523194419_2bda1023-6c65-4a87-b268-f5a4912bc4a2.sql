UPDATE public.worker_debts
SET remaining_amount = GREATEST(0, COALESCE(amount, 0) - COALESCE(paid_amount, 0))
WHERE remaining_amount IS NULL
   OR remaining_amount <> GREATEST(0, COALESCE(amount, 0) - COALESCE(paid_amount, 0));

CREATE OR REPLACE FUNCTION public.worker_debts_sync_remaining()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.remaining_amount := GREATEST(0, COALESCE(NEW.amount, 0) - COALESCE(NEW.paid_amount, 0));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_debts_sync_remaining ON public.worker_debts;
CREATE TRIGGER trg_worker_debts_sync_remaining
BEFORE INSERT OR UPDATE OF amount, paid_amount ON public.worker_debts
FOR EACH ROW
EXECUTE FUNCTION public.worker_debts_sync_remaining();