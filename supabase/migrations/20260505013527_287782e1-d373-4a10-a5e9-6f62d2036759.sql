ALTER TABLE public.promos ALTER COLUMN sale_quantity_unit DROP NOT NULL;
ALTER TABLE public.promos ALTER COLUMN sale_quantity_unit DROP DEFAULT;
UPDATE public.promos SET sale_quantity_unit = NULL WHERE sale_quantity_unit = 'piece' AND created_at < now();