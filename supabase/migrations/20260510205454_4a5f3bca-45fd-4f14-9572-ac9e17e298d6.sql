UPDATE public.loading_session_items
SET quantity = 20.10
WHERE id = 'c2343169-c5f2-4f44-b6bf-4db05c6e48e7';

UPDATE public.worker_stock
SET quantity = 20.10, updated_at = now()
WHERE worker_id = (SELECT id FROM public.workers WHERE username='hssm27')
  AND product_id = '37b163aa-0c3d-4695-8280-f0d088ceeb9f';

INSERT INTO public.stock_movements (
  product_id, worker_id, movement_type, quantity, signed_quantity,
  reason, reference_type, notes, status, created_by
) VALUES (
  '37b163aa-0c3d-4695-8280-f0d088ceeb9f',
  (SELECT id FROM public.workers WHERE username='hssm27'),
  'adjustment', 0.40, -0.40,
  'shipment_correction_bp_format', 'loading_session',
  'تصحيح تنسيق B.P: 20.5 → 20.10 (20 صندوق + 10 قطع)',
  'approved',
  (SELECT id FROM public.workers WHERE username='hssm27')
);