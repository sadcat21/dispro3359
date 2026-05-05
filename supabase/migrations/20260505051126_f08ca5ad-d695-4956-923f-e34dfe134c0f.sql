
-- Undo previous orders
DELETE FROM public.order_items WHERE order_id IN (
  SELECT id FROM public.orders
  WHERE assigned_worker_id='79240031-b627-4d69-b8e8-d29edfb25cde'
    AND delivery_date='2026-05-05'
    AND customer_id IN ('370d21dd-d639-4d3a-9831-1a2cb3870e8a','49a9991c-60c3-4836-8836-9ea2c2261e7f')
);
DELETE FROM public.orders
  WHERE assigned_worker_id='79240031-b627-4d69-b8e8-d29edfb25cde'
    AND delivery_date='2026-05-05'
    AND customer_id IN ('370d21dd-d639-4d3a-9831-1a2cb3870e8a','49a9991c-60c3-4836-8836-9ea2c2261e7f');

DO $$
DECLARE
  v_worker uuid := '79240031-b627-4d69-b8e8-d29edfb25cde';
  v_admin  uuid := '790cbb80-e8e1-4c8c-b8e7-21681ea15110';
  v_branch uuid := '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6';
  v_today  date := '2026-05-05';
  o uuid;
BEGIN
  -- 1. Amine Berkan: 50 box AROMA 250 × 4725
  INSERT INTO public.orders (customer_id, created_by, assigned_worker_id, branch_id, status, delivery_date, payment_type, total_amount, payment_status)
  VALUES ('5e1cf165-0988-4768-960c-298c4f341b64', v_admin, v_worker, v_branch, 'pending', v_today, 'with_invoice', 236250, 'pending') RETURNING id INTO o;
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (o, 'c51e3eda-047f-43f3-a9aa-caf367440fc2', 50, 4725, 236250, 'kg', 5, 20);

  -- 2. Belaoued: 3 box AROMA 250 × 4750
  INSERT INTO public.orders (customer_id, created_by, assigned_worker_id, branch_id, status, delivery_date, payment_type, total_amount, payment_status)
  VALUES ('24f7e43e-f5ce-4055-9eee-cff7d48a381a', v_admin, v_worker, v_branch, 'pending', v_today, 'with_invoice', 14250, 'pending') RETURNING id INTO o;
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (o, 'c51e3eda-047f-43f3-a9aa-caf367440fc2', 3, 4750, 14250, 'kg', 5, 20);

  -- 3. Djerourou Kaddour: 2 ESPRESSO + 2 FAMILIAL + 1 GOLD
  INSERT INTO public.orders (customer_id, created_by, assigned_worker_id, branch_id, status, delivery_date, payment_type, total_amount, payment_status)
  VALUES ('d9981d4f-01da-42fd-9a5c-339bcf508486', v_admin, v_worker, v_branch, 'pending', v_today, 'with_invoice', 25000, 'pending') RETURNING id INTO o;
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (o, '04ffdfed-0137-444c-9dcd-8007d26b1fab', 2, 4750, 9500, 'kg', 5, 20),
    (o, '37b163aa-0c3d-4695-8280-f0d088ceeb9f', 2, 4750, 9500, 'kg', 5, 20),
    (o, '8ec0025d-b239-47c8-a0b8-96ae8c57e68e', 1, 6000, 6000, 'kg', 5, 20);

  -- 4. Kassar Slimane: 8 AROMA 250 + 2 OSCAR 5KG
  INSERT INTO public.orders (customer_id, created_by, assigned_worker_id, branch_id, status, delivery_date, payment_type, total_amount, payment_status)
  VALUES ('ad20c60f-9934-416c-a42d-d2d78cc4021a', v_admin, v_worker, v_branch, 'pending', v_today, 'with_invoice', 47500, 'pending') RETURNING id INTO o;
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (o, 'c51e3eda-047f-43f3-a9aa-caf367440fc2', 8, 4750, 38000, 'kg', 5, 20),
    (o, '61b37dea-32ac-44a0-a512-7f5cdaac8c55', 2, 4750, 9500, 'kg', 5, 1);

  -- 5. Guaddar Mansour: 1 AROMA 400 (375) + 4 AROMA 250 (4750)
  INSERT INTO public.orders (customer_id, created_by, assigned_worker_id, branch_id, status, delivery_date, payment_type, total_amount, payment_status)
  VALUES ('9d8cc0ff-e7a2-4026-887c-5b49a3803c5c', v_admin, v_worker, v_branch, 'pending', v_today, 'with_invoice', 19375, 'pending') RETURNING id INTO o;
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, pieces_per_box) VALUES
    (o, 'bf1a98c1-2bf2-4026-90e5-ce5572070c7f', 1, 375, 375, 'unit', 12);
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (o, 'c51e3eda-047f-43f3-a9aa-caf367440fc2', 4, 4750, 19000, 'kg', 5, 20);
END $$;
