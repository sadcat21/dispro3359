ALTER TABLE public.order_items
ALTER COLUMN quantity TYPE numeric USING quantity::numeric;