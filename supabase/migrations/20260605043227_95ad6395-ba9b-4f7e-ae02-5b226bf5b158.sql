CREATE TYPE public.document_stage AS ENUM ('pending', 'received', 'ready', 'handed');
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS document_stage public.document_stage NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_orders_document_stage ON public.orders(branch_id, document_stage) WHERE payment_type = 'with_invoice';