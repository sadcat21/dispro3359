CREATE TYPE public.invoice_stage AS ENUM ('unsealed', 'sealed', 'ready', 'delivered');
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_stage public.invoice_stage NOT NULL DEFAULT 'unsealed';
CREATE INDEX IF NOT EXISTS idx_orders_invoice_stage ON public.orders(branch_id, invoice_stage) WHERE payment_type = 'with_invoice';