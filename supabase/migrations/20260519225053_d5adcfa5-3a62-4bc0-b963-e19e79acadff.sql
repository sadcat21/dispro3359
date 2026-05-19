SELECT product_name, old_qty, new_qty FROM public.recalibrate_worker_stock('45f8ce43-628a-4f21-97bd-a373ee13b22f'::uuid)
WHERE product_name IN ('CAFE AROMA POT 700 Gr','CAFE AROMA  400 Gr');