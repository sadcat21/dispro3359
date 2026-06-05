CREATE OR REPLACE FUNCTION public.enforce_invoice_number_on_handover()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.document_stage = 'handed' AND OLD.document_stage IS DISTINCT FROM 'handed')
     OR (NEW.invoice_stage = 'delivered' AND OLD.invoice_stage IS DISTINCT FROM 'delivered') THEN
    IF NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
      RAISE EXCEPTION 'invoice_number_required'
        USING HINT = 'يجب إدخال رقم الفاتورة قبل تسليم الوثيقة';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;