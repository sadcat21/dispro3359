UPDATE public.warehouse_stock
SET quantity = quantity - 1000
WHERE id = '140e5a47-e3d1-4890-ab42-d8baa3a329c8'
  AND quantity >= 1000;