DELETE FROM public.promos
WHERE id = 'b20da7ec-731a-48d9-94be-b95996af25e2';

UPDATE public.warehouse_stock
SET quantity = quantity + 8160,
    updated_at = now()
WHERE id = '37f200e9-4d9e-471a-9aaf-f83d7e15fb41';

INSERT INTO public.stock_movements (
  branch_id, product_id, movement_type, quantity, signed_quantity,
  worker_id, created_by, reason, notes, created_at
) VALUES (
  '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6',
  'c51e3eda-047f-43f3-a9aa-caf367440fc2',
  'promo_sale_reversal',
  8000, 8000,
  '790cbb80-e8e1-4c8c-b8e7-21681ea15110',
  '790cbb80-e8e1-4c8c-b8e7-21681ea15110',
  'إلغاء بيع عرض يدوي مكرر',
  'حذف عرض يدوي مكرر بتاريخ 2026-05-24 18:18 وإرجاع 400 صندوق (8000 قطعة) للمخزون',
  now()
);

INSERT INTO public.stock_movements (
  branch_id, product_id, movement_type, quantity, signed_quantity,
  worker_id, created_by, reason, notes, created_at
) VALUES (
  '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6',
  'c51e3eda-047f-43f3-a9aa-caf367440fc2',
  'promo_gift_reversal',
  160, 160,
  '790cbb80-e8e1-4c8c-b8e7-21681ea15110',
  '790cbb80-e8e1-4c8c-b8e7-21681ea15110',
  'إلغاء هدية عرض يدوي مكرر',
  'حذف عرض يدوي مكرر بتاريخ 2026-05-24 18:18 وإرجاع 8 صناديق (160 قطعة) للمخزون',
  now()
);