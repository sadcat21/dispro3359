ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_unit_sale boolean NOT NULL DEFAULT false;
NOTIFY pgrst, 'reload schema';