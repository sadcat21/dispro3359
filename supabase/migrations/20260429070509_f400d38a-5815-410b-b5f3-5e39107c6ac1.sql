
ALTER TABLE public.manual_invoice_requests
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS invoice_scope text DEFAULT 'public' CHECK (invoice_scope IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_by_assistant_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS received_by_assistant_id uuid;

CREATE INDEX IF NOT EXISTS idx_manual_invoice_requests_scope ON public.manual_invoice_requests(invoice_scope);
CREATE INDEX IF NOT EXISTS idx_manual_invoice_requests_status ON public.manual_invoice_requests(status);
