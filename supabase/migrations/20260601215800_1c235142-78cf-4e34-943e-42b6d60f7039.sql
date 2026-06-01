DO $$
DECLARE
  v_creator uuid := '06817d3e-0539-485e-9ffe-55b7d8727fdc';        -- Berkani zinou
  v_worker  uuid := 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78';        -- BIG hichem
  v_branch  uuid := '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6';
  v_date    date := DATE '2026-06-02';
  v_aroma   uuid := 'c51e3eda-047f-43f3-a9aa-caf367440fc2';        -- AROMA 250 Gr (5kg)
  v_espr    uuid := '04ffdfed-0137-444c-9dcd-8007d26b1fab';        -- ESPRESSO 250gr (5kg)
  v_famil   uuid := '37b163aa-0c3d-4695-8280-f0d088ceeb9f';        -- FAMILIAL 250gr (5kg)
  v_bdn     uuid := 'c7180526-a70b-42c5-8c98-5925eb218939';        -- AROMA BDN 5Kg
  v_dima    uuid := '2c9f0278-afce-41f4-878a-f8b079b86928';        -- DIMA 250gr (8kg)
  v_oid uuid;

  -- helper: orders to insert  (customer_id, total, items as text)
  -- We'll do them inline
BEGIN
  -- 1) بلهواري منصور: AROMA 1 + BDN 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('1afbb720-3ea8-4a91-bd28-302149843f3f', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 9500) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (v_oid, v_aroma, 5, 950, 4750, 'kg', 5, 20),
    (v_oid, v_bdn,   5, 950, 4750, 'kg', 5, 1);

  -- 2) عمر قزقوز: AROMA 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('e96a78c3-b2b1-4b1e-b6db-f71ea97553cc', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 4750) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box)
  VALUES (v_oid, v_aroma, 5, 950, 4750, 'kg', 5, 20);

  -- 3) وهيبة: AROMA 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('5bebc988-54c1-4077-ae53-f3ef12f1bdf6', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 4750) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box)
  VALUES (v_oid, v_aroma, 5, 950, 4750, 'kg', 5, 20);

  -- 4) سوبيرات الفتح: AROMA 2
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('f4ff4ab3-09f4-4447-a2c6-5692697e66c7', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 9500) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box)
  VALUES (v_oid, v_aroma, 10, 950, 9500, 'kg', 5, 20);

  -- 5) سوبيرات عصام: AROMA 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('61c3db78-02b5-4893-ae8c-3fc8d469aba0', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 4750) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box)
  VALUES (v_oid, v_aroma, 5, 950, 4750, 'kg', 5, 20);

  -- 6) Mini shop: AROMA 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('ca1815a0-0095-4d92-b037-4254fb19208d', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 4750) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box)
  VALUES (v_oid, v_aroma, 5, 950, 4750, 'kg', 5, 20);

  -- 7) ماركت البركة 27: AROMA 1 + DIMA 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('215cd88e-56ca-4aa8-bedf-76a2842dd7c0', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 7590) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (v_oid, v_aroma, 5, 950, 4750, 'kg', 5, 20),
    (v_oid, v_dima,  8, 355, 2840, 'kg', 8, 32);

  -- 8) Sup al Farouk: AROMA 4 + ESPRESSO 1 + FAMILIAL 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('7a4a774e-f532-4398-b31d-7c96605d18a5', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 28500) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (v_oid, v_aroma, 20, 950, 19000, 'kg', 5, 20),
    (v_oid, v_espr,   5, 950,  4750, 'kg', 5, 20),
    (v_oid, v_famil,  5, 950,  4750, 'kg', 5, 20);

  -- 9) حاج: AROMA 4
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('8a60d38e-8f5a-4f2b-912f-15d0f3f56517', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 19000) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box)
  VALUES (v_oid, v_aroma, 20, 950, 19000, 'kg', 5, 20);

  -- 10) خيردين: ESPRESSO 1 + FAMILIAL 1 + DIMA 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('4f6c10c9-8f36-4224-8d43-639731b57c09', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 12340) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (v_oid, v_espr,  5, 950, 4750, 'kg', 5, 20),
    (v_oid, v_famil, 5, 950, 4750, 'kg', 5, 20),
    (v_oid, v_dima,  8, 355, 2840, 'kg', 8, 32);

  -- 11) مسمودي: AROMA 1 + BDN 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('ded76de5-be4a-4a6b-8356-87506e0318d0', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 9500) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box) VALUES
    (v_oid, v_aroma, 5, 950, 4750, 'kg', 5, 20),
    (v_oid, v_bdn,   5, 950, 4750, 'kg', 5, 1);

  -- 12) حلول قدوس مداح: AROMA 1
  INSERT INTO public.orders(customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, delivery_date, total_amount)
  VALUES ('1594fb6b-cdde-49f9-b203-6f41b8ff2472', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'pending', v_date, 4750) RETURNING id INTO v_oid;
  INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box)
  VALUES (v_oid, v_aroma, 5, 950, 4750, 'kg', 5, 20);
END $$;