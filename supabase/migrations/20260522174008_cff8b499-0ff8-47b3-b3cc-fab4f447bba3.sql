-- Back-fill 5 missing delivery stock_movements for worker hssm27 / CAFE AROMA 250 Gr
INSERT INTO public.stock_movements
  (branch_id, product_id, movement_type, quantity, signed_quantity, worker_id, order_id, status, notes, created_by, created_at)
SELECT
  '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6'::uuid,
  'c51e3eda-047f-43f3-a9aa-caf367440fc2'::uuid,
  'delivery',
  v.qty,
  -v.qty,
  'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab'::uuid,
  v.order_id::uuid,
  'approved',
  'بيع مباشر من الشاحنة (back-fill)',
  'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab'::uuid,
  v.ts::timestamptz
FROM (VALUES
  ('3702c97a-beeb-4d02-bf1d-237c7121a07f', 5, '2026-05-22 05:33:47+00'),
  ('d776e615-92fb-4cdf-878b-58431f7f2872', 5, '2026-05-22 05:38:39+00'),
  ('662529dc-680a-4e5d-8a56-fce9a8cd9691', 5, '2026-05-22 05:39:27+00'),
  ('abd7876e-ef2e-44ef-b251-1c9e89c94830', 5, '2026-05-22 05:40:02+00'),
  ('afa84501-a659-4e4f-a046-7dfdfe0480ca', 6, '2026-05-22 05:40:43+00')
) AS v(order_id, qty, ts)
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_movements sm
  WHERE sm.order_id = v.order_id::uuid
    AND sm.product_id = 'c51e3eda-047f-43f3-a9aa-caf367440fc2'::uuid
    AND sm.movement_type = 'delivery'
);

-- Correct worker_stock to actual remaining (49)
UPDATE public.worker_stock
SET quantity = 49, updated_at = now()
WHERE worker_id = 'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab'
  AND product_id = 'c51e3eda-047f-43f3-a9aa-caf367440fc2';