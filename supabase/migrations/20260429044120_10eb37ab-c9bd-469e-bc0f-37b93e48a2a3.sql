ALTER TABLE public.manual_invoice_requests
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_manual_invoice_requests_order_id
  ON public.manual_invoice_requests(order_id);

CREATE INDEX IF NOT EXISTS idx_manual_invoice_requests_branch_status
  ON public.manual_invoice_requests(branch_id, status);