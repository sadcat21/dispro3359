CREATE OR REPLACE FUNCTION public.auto_clear_tracking_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.invoice_stage := 'cancelled';
    NEW.document_stage := 'cancelled';
    NEW.invoice_number := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_clear_tracking_on_cancel ON public.orders;
CREATE TRIGGER trg_auto_clear_tracking_on_cancel
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_clear_tracking_on_cancel();

-- Backfill existing cancelled orders
UPDATE public.orders
SET invoice_stage = 'cancelled',
    document_stage = 'cancelled',
    invoice_number = NULL
WHERE status = 'cancelled'
  AND (invoice_stage <> 'cancelled' OR document_stage <> 'cancelled' OR invoice_number IS NOT NULL);