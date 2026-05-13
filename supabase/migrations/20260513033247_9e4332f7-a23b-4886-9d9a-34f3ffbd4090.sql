ALTER TABLE public.promos ADD COLUMN IF NOT EXISTS order_id uuid;
CREATE INDEX IF NOT EXISTS idx_promos_order_id ON public.promos(order_id);