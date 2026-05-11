UPDATE public.stock_movements
SET movement_type = 'exchange',
    signed_quantity = -ABS(quantity),
    from_location_type = COALESCE(from_location_type, 'warehouse'),
    to_location_type = 'damaged',
    reason = COALESCE(reason, 'damaged_replacement')
WHERE return_reason = 'damaged'
  AND movement_type = 'return';

UPDATE public.warehouse_stock
SET quantity = 448,
    damaged_quantity = 10.05,
    updated_at = now()
WHERE id = '1a7d06e2-0bd7-41f8-9f4b-9d59bcb4b38a';