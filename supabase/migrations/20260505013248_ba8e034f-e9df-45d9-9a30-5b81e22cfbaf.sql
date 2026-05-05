-- Add sale_quantity_unit to promos to lock unit semantics and prevent ambiguity
ALTER TABLE public.promos
  ADD COLUMN IF NOT EXISTS sale_quantity_unit text NOT NULL DEFAULT 'piece';

-- Backfill: existing gift_quantity_unit defaults to 'piece' too
UPDATE public.promos SET gift_quantity_unit = COALESCE(gift_quantity_unit, 'piece');
ALTER TABLE public.promos ALTER COLUMN gift_quantity_unit SET DEFAULT 'piece';
ALTER TABLE public.promos ALTER COLUMN gift_quantity_unit SET NOT NULL;

-- Constrain values
ALTER TABLE public.promos DROP CONSTRAINT IF EXISTS promos_sale_quantity_unit_check;
ALTER TABLE public.promos ADD CONSTRAINT promos_sale_quantity_unit_check CHECK (sale_quantity_unit IN ('piece','box'));
ALTER TABLE public.promos DROP CONSTRAINT IF EXISTS promos_gift_quantity_unit_check;
ALTER TABLE public.promos ADD CONSTRAINT promos_gift_quantity_unit_check CHECK (gift_quantity_unit IN ('piece','box'));