UPDATE public.worker_stock
SET quantity = 1479, updated_at = now()
WHERE worker_id = 'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab'
  AND product_id = (SELECT id FROM public.products WHERE name ILIKE '%CAFE AROMA 250%' LIMIT 1);