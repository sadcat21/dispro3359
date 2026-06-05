CREATE OR REPLACE FUNCTION public.enforce_invoice_number_on_handover()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.document_stage = 'handed' AND COALESCE(OLD.document_stage, '') <> 'handed')
     OR (NEW.invoice_stage = 'delivered' AND COALESCE(OLD.invoice_stage, '') <> 'delivered') THEN
    IF NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
      RAISE EXCEPTION 'invoice_number_required'
        USING HINT = 'يجب إدخال رقم الفاتورة قبل تسليم الوثيقة';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_number_on_handover ON public.orders;
CREATE TRIGGER trg_enforce_invoice_number_on_handover
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_number_on_handover();