
DO $$
DECLARE
  v_worker uuid := '79240031-b627-4d69-b8e8-d29edfb25cde';
  v_admin  uuid := '790cbb80-e8e1-4c8c-b8e7-21681ea15110';
  v_branch uuid := '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6';
  v_today  date := '2026-05-05';
  v_order1 uuid;
  v_order2 uuid;
BEGIN
  -- Order 1: خالد ڨورين
  INSERT INTO public.orders (customer_id, created_by, assigned_worker_id, branch_id, status, delivery_date, payment_type, total_amount, payment_status)
  VALUES ('370d21dd-d639-4d3a-9831-1a2cb3870e8a', v_admin, v_worker, v_branch, 'pending', v_today, 'with_invoice', 57000, 'pending')
  RETURNING id INTO v_order1;

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (v_order1, 'c51e3eda-047f-43f3-a9aa-caf367440fc2', 10, 950, 47500, 'kg', 5, 20),
    (v_order1, 'c7180526-a70b-42c5-8c98-5925eb218939', 2,  950,  9500, 'kg', 5, 1);

  -- Order 2: بن عمار يوسف
  INSERT INTO public.orders (customer_id, created_by, assigned_worker_id, branch_id, status, delivery_date, payment_type, total_amount, payment_status)
  VALUES ('49a9991c-60c3-4836-8836-9ea2c2261e7f', v_admin, v_worker, v_branch, 'pending', v_today, 'with_invoice', 7710, 'pending')
  RETURNING id INTO v_order2;

  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, pieces_per_box) VALUES
    (v_order2, 'bf1a98c1-2bf2-4026-90e5-ce5572070c7f', 10, 375, 3750, 'unit', 12),
    (v_order2, '81a2b197-81a3-496a-b269-57332001fa69', 6,  660, 3960, 'unit', 6);
END $$;
