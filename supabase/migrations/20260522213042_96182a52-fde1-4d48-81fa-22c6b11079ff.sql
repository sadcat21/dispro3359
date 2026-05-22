
-- Add a generated column on orders to distinguish Versement Cash vs Versement Doc (and same for check/transfer)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method_resolved text
GENERATED ALWAYS AS (
  CASE
    WHEN invoice_payment_method IS NULL THEN NULL
    WHEN invoice_payment_method = 'cash' THEN 'cash'
    WHEN (document_verification->>'paid_by_cash')::boolean IS TRUE THEN invoice_payment_method || '_cash'
    ELSE invoice_payment_method || '_doc'
  END
) STORED;

CREATE INDEX IF NOT EXISTS idx_orders_payment_method_resolved ON public.orders(payment_method_resolved);
