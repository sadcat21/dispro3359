UPDATE public.worker_stock
SET quantity = 10, updated_at = now()
WHERE id = '300767a5-1d53-4a79-9c9e-b442c737a7f3'
  AND worker_id = 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78'
  AND product_id = '8ec0025d-b239-47c8-a0b8-96ae8c57e68e';