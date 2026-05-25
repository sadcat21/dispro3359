-- 1) Delete the older duplicate manual promo (12:07)
DELETE FROM public.promos WHERE id = 'e5b2569d-fddc-4ed9-9319-29c1730f188c';

-- 2) Restore 8 boxes (stored in BP format, 0 pieces remainder) to branch warehouse_stock
UPDATE public.warehouse_stock
SET quantity = quantity + 8
WHERE id = '37f200e9-4d9e-471a-9aaf-f83d7e15fb41';

-- 3) Reversal stock movement for audit (160 pieces = 8 boxes * 20)
INSERT INTO public.stock_movements (
  branch_id, product_id, movement_type, quantity, signed_quantity,
  from_location_type, from_location_id, to_location_type,
  worker_id, created_by, reason, notes
) VALUES (
  '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6',
  'c51e3eda-047f-43f3-a9aa-caf367440fc2',
  'promo_gift_reversal',
  160,
  160,
  'customer', NULL, 'branch',
  '790cbb80-e8e1-4c8c-b8e7-21681ea15110',
  '790cbb80-e8e1-4c8c-b8e7-21681ea15110',
  'إلغاء تسجيل برومو يدوي مكرر',
  'حذف سجل البرومو المكرر بتاريخ 2026-05-25 12:07 وإرجاع 8 صناديق للمخزون'
);
