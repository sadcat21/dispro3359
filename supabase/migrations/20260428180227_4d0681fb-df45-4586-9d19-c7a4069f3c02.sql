ALTER TABLE public.stock_confirmations
ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS frozen_by UUID REFERENCES public.workers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.auto_freeze_stock_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('pending', 'amended') THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.frozen_at := COALESCE(NEW.frozen_at, now());
      NEW.frozen_by := COALESCE(NEW.frozen_by, public.get_worker_id());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_freeze_stock_confirmation ON public.stock_confirmations;

CREATE TRIGGER trg_auto_freeze_stock_confirmation
BEFORE INSERT OR UPDATE OF status ON public.stock_confirmations
FOR EACH ROW
EXECUTE FUNCTION public.auto_freeze_stock_confirmation();

NOTIFY pgrst, 'reload schema';