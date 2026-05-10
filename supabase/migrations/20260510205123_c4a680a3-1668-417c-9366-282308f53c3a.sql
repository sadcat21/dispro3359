UPDATE public.loading_session_items
SET quantity = 20.5,
    gift_quantity = 0,
    notes = COALESCE(notes,'') || ' | تصحيح: 20 صندوق + 10 قطع'
WHERE id = 'c2343169-c5f2-4f44-b6bf-4db05c6e48e7';

UPDATE public.worker_stock
SET quantity = quantity - 9.5,
    updated_at = now()
WHERE worker_id = (SELECT id FROM public.workers WHERE username = 'hssm27')
  AND product_id = '37b163aa-0c3d-4695-8280-f0d088ceeb9f';

INSERT INTO public.stock_movements (
  product_id, worker_id, movement_type, quantity, signed_quantity,
  reason, reference_type, reference_id, notes, status, created_by
) VALUES (
  '37b163aa-0c3d-4695-8280-f0d088ceeb9f',
  (SELECT id FROM public.workers WHERE username='hssm27'),
  'adjustment', 9.5, -9.5,
  'shipment_correction', 'loading_session',
  '59cda90d-0594-4797-a277-cb941f267cc9',
  'تصحيح خطأ شحن FAMILIAL 250gr: من 30 إلى 20.5 صندوق (20 صندوق + 10 قطع)',
  'approved',
  (SELECT id FROM public.workers WHERE username='hssm27')
);