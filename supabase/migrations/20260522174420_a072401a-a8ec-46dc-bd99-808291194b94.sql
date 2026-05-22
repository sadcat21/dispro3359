UPDATE public.stock_movements
SET quantity = 5, signed_quantity = -5
WHERE id = '7319797b-5036-42b1-8ec6-2298793c0ba7';

UPDATE public.worker_stock
SET quantity = 49, updated_at = now()
WHERE worker_id = 'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab'
  AND product_id = 'c51e3eda-047f-43f3-a9aa-caf367440fc2';