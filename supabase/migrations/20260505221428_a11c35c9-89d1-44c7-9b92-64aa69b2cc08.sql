CREATE OR REPLACE FUNCTION public.deactivate_expired_product_offers()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.product_offers
  SET is_active = false
  WHERE is_active = true
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_expired_product_offers() TO anon, authenticated;

-- Run once now to fix existing data
SELECT public.deactivate_expired_product_offers();