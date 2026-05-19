UPDATE public.product_offer_settings SET is_mandatory = true WHERE id = 'global';
UPDATE public.product_offers SET is_mandatory = true WHERE is_mandatory = false;
ALTER TABLE public.product_offer_settings ALTER COLUMN is_mandatory SET DEFAULT true;
ALTER TABLE public.product_offers ALTER COLUMN is_mandatory SET DEFAULT true;