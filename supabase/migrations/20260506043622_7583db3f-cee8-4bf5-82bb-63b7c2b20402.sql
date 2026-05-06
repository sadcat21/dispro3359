DO $$
DECLARE
  v_worker uuid := '79240031-b627-4d69-b8e8-d29edfb25cde';
  v_branch uuid := '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6';
  v_date date := '2026-05-06';
  o_id uuid;
  p400 uuid := 'bf1a98c1-2bf2-4026-90e5-ce5572070c7f';
  p250 uuid := 'c51e3eda-047f-43f3-a9aa-caf367440fc2';
  p700 uuid := '81a2b197-81a3-496a-b269-57332001fa69';
  pbdn uuid := 'c7180526-a70b-42c5-8c98-5925eb218939';
BEGIN
  -- 1. Supérette El Adjal
  INSERT INTO orders(customer_id, created_by, branch_id, status, assigned_worker_id, delivery_date, payment_type, invoice_payment_method, total_amount)
  VALUES ('6ad5b0e7-3b83-42e6-9547-863952b38b3c', v_worker, v_branch, 'assigned', v_worker, v_date, 'with_invoice', 'cash', 12670)
  RETURNING id INTO o_id;
  INSERT INTO order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, payment_type, invoice_payment_method, price_subtype) VALUES
   (o_id, p250, 1, 950, 4750, 'kg', 5, 20, 'with_invoice','cash','gros'),
   (o_id, p700, 12, 660, 7920, 'unit', NULL, 6, 'with_invoice','cash','gros');

  -- 2. Amine Kaibich
  INSERT INTO orders(customer_id, created_by, branch_id, status, assigned_worker_id, delivery_date, payment_type, invoice_payment_method, total_amount)
  VALUES ('fe2db772-bf8f-45e0-b6e7-3d2723bb4052', v_worker, v_branch, 'assigned', v_worker, v_date, 'with_invoice','cash', 4750)
  RETURNING id INTO o_id;
  INSERT INTO order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, payment_type, invoice_payment_method, price_subtype) VALUES
   (o_id, p250, 1, 950, 4750, 'kg', 5, 20, 'with_invoice','cash','gros');

  -- 3. Ammar Meliani
  INSERT INTO orders(customer_id, created_by, branch_id, status, assigned_worker_id, delivery_date, payment_type, invoice_payment_method, total_amount)
  VALUES ('dbf21e53-33f9-44e2-8f84-7f5408840d45', v_worker, v_branch, 'assigned', v_worker, v_date, 'with_invoice','cash', 4750)
  RETURNING id INTO o_id;
  INSERT INTO order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, payment_type, invoice_payment_method, price_subtype) VALUES
   (o_id, p250, 1, 950, 4750, 'kg', 5, 20, 'with_invoice','cash','gros');

  -- 4. Supérette Ben Omrane
  INSERT INTO orders(customer_id, created_by, branch_id, status, assigned_worker_id, delivery_date, payment_type, invoice_payment_method, total_amount)
  VALUES ('93d0ca60-e0c8-4eb5-9786-a2c954b862ad', v_worker, v_branch, 'assigned', v_worker, v_date, 'with_invoice','cash', 12670)
  RETURNING id INTO o_id;
  INSERT INTO order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, payment_type, invoice_payment_method, price_subtype) VALUES
   (o_id, p250, 1, 950, 4750, 'kg', 5, 20, 'with_invoice','cash','gros'),
   (o_id, p700, 12, 660, 7920, 'unit', NULL, 6, 'with_invoice','cash','gros');

  -- 5. Cheikh Khattab
  INSERT INTO orders(customer_id, created_by, branch_id, status, assigned_worker_id, delivery_date, payment_type, invoice_payment_method, total_amount)
  VALUES ('a93b6577-f9cf-452a-8d69-ec936b9f6dcd', v_worker, v_branch, 'assigned', v_worker, v_date, 'with_invoice','cash', 18250)
  RETURNING id INTO o_id;
  INSERT INTO order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, payment_type, invoice_payment_method, price_subtype) VALUES
   (o_id, p400, 36, 375, 13500, 'unit', NULL, 12, 'with_invoice','cash','gros'),
   (o_id, pbdn, 1, 950, 4750, 'kg', 5, 1, 'with_invoice','cash','gros');

  -- 6. Medani Bennour
  INSERT INTO orders(customer_id, created_by, branch_id, status, assigned_worker_id, delivery_date, payment_type, invoice_payment_method, total_amount)
  VALUES ('0f2cc4dc-2391-44a7-a0d7-bf6665c82672', v_worker, v_branch, 'assigned', v_worker, v_date, 'with_invoice','cash', 4750)
  RETURNING id INTO o_id;
  INSERT INTO order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, payment_type, invoice_payment_method, price_subtype) VALUES
   (o_id, p250, 1, 950, 4750, 'kg', 5, 20, 'with_invoice','cash','gros');

  -- 7. Sahnon Hani
  INSERT INTO orders(customer_id, created_by, branch_id, status, assigned_worker_id, delivery_date, payment_type, invoice_payment_method, total_amount)
  VALUES ('9b7ac417-0523-484a-88a8-0f323e51e651', v_worker, v_branch, 'assigned', v_worker, v_date, 'with_invoice','cash', 17170)
  RETURNING id INTO o_id;
  INSERT INTO order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, payment_type, invoice_payment_method, price_subtype) VALUES
   (o_id, p400, 12, 375, 4500, 'unit', NULL, 12, 'with_invoice','cash','gros'),
   (o_id, p250, 1, 950, 4750, 'kg', 5, 20, 'with_invoice','cash','gros'),
   (o_id, p700, 12, 660, 7920, 'unit', NULL, 6, 'with_invoice','cash','gros');
END $$;