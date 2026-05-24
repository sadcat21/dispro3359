UPDATE public.stock_receipt_items
SET quantity = 22.05,
    notes = COALESCE(notes,'') || ' | تصحيح: من 32.05 إلى 22.05 لمطابقة المخزون 7.05'
WHERE id = '257e39fa-2b0a-48f9-b8e4-a8941bc86488'
  AND quantity = 32.05;

INSERT INTO public.stock_movements (
  product_id, branch_id, quantity, movement_type, status,
  from_location_type, to_location_type, reason, notes,
  created_by, approved_by, approved_at
)
SELECT
  '8ec0025d-b239-47c8-a0b8-96ae8c57e68e',
  '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6',
  -10, 'adjustment', 'approved',
  'warehouse', 'external', 'correction',
  'تصحيح وصل GOLD 250g: تقليل الكمية المستلمة بـ 10 ك.ق (من 32.05 إلى 22.05) لمطابقة رصيد المخزن 7.05 + رصيد العمال 15.00',
  sr.created_by, sr.created_by, now()
FROM public.stock_receipts sr
WHERE sr.id = '3c4d111d-f3a4-4c41-a9ff-7d9a85f3a2b5';