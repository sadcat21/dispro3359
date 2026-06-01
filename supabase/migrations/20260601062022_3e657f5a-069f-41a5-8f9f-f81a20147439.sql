
UPDATE public.worker_stock
SET quantity = 1044, updated_at = now()
WHERE worker_id = 'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab'
  AND product_id = 'c51e3eda-047f-43f3-a9aa-caf367440fc2';

UPDATE public.worker_stock
SET quantity = 0, updated_at = now()
WHERE worker_id = 'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab'
  AND product_id = 'c7180526-a70b-42c5-8c98-5925eb218939';
