DO $$
DECLARE
  v_worker uuid := 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78';
  v_creator uuid := '06817d3e-0539-485e-9ffe-55b7d8727fdc';
  v_branch uuid := '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6';
  v_created timestamptz := '2026-06-01 21:57:57.447268+00';
  v_dd date := '2026-06-02';
  -- Products
  p_aroma uuid := 'c51e3eda-047f-43f3-a9aa-caf367440fc2';   -- CAFE AROMA 250 Gr (20 pcs, 5kg/box)
  p_seau uuid := 'c7180526-a70b-42c5-8c98-5925eb218939';    -- CAFE AROMA SEAU 5Kg (1 pcs, 5kg/box)
  p_esp uuid := '04ffdfed-0137-444c-9dcd-8007d26b1fab';     -- CAFE AROMA 250 gr ESPRESSO
  p_fam uuid := '37b163aa-0c3d-4695-8280-f0d088ceeb9f';     -- CAFE AROMA FAMILIAL 250 gr
  p_dima uuid := '2c9f0278-afce-41f4-878a-f8b079b86928';    -- DIMA 08KG (32 pcs, 8kg/box)
  oid uuid;
BEGIN
  -- 1. Belhouari Mansour (1 AROMA + 1 SEAU = 9500)
  oid := gen_random_uuid();
  INSERT INTO orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, total_amount, delivery_date, created_at, updated_at)
  VALUES (oid, '1afbb720-3ea8-4a91-bd28-302149843f3f', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'cash', 9500, v_dd, v_created, v_created);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, price_subtype, created_at) VALUES
    (oid, p_aroma, 5, 950, 4750, 'kg', 5, 20, 'retail', v_created),
    (oid, p_seau, 5, 950, 4750, 'kg', 5, 1, 'retail', v_created);

  -- 2. Guezgouz Omar (1 AROMA = 4750)
  oid := gen_random_uuid();
  INSERT INTO orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, total_amount, delivery_date, created_at, updated_at)
  VALUES (oid, 'e96a78c3-b2b1-4b1e-b6db-f71ea97553cc', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'cash', 4750, v_dd, v_created, v_created);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, price_subtype, created_at) VALUES
    (oid, p_aroma, 5, 950, 4750, 'kg', 5, 20, 'retail', v_created);

  -- 4. Benattia (2 AROMA = 9500)
  oid := gen_random_uuid();
  INSERT INTO orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, total_amount, delivery_date, created_at, updated_at)
  VALUES (oid, 'f4ff4ab3-09f4-4447-a2c6-5692697e66c7', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'cash', 9500, v_dd, v_created, v_created);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, price_subtype, created_at) VALUES
    (oid, p_aroma, 10, 950, 9500, 'kg', 5, 20, 'retail', v_created);

  -- 5. Issam (1 AROMA @gros 945 = 4725)
  oid := gen_random_uuid();
  INSERT INTO orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, total_amount, delivery_date, created_at, updated_at)
  VALUES (oid, '61c3db78-02b5-4893-ae8c-3fc8d469aba0', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'cash', 4725, v_dd, v_created, v_created);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, price_subtype, created_at) VALUES
    (oid, p_aroma, 5, 945, 4725, 'kg', 5, 20, 'gros', v_created);

  -- 6. Ayoub (1 AROMA @gros 945 = 4725)
  oid := gen_random_uuid();
  INSERT INTO orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, total_amount, delivery_date, created_at, updated_at)
  VALUES (oid, 'ca1815a0-0095-4d92-b037-4254fb19208d', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'cash', 4725, v_dd, v_created, v_created);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, price_subtype, created_at) VALUES
    (oid, p_aroma, 5, 945, 4725, 'kg', 5, 20, 'gros', v_created);

  -- 7. Ben Turkia (1 AROMA + 1 DIMA = 7590)
  oid := gen_random_uuid();
  INSERT INTO orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, total_amount, delivery_date, created_at, updated_at)
  VALUES (oid, '215cd88e-56ca-4aa8-bedf-76a2842dd7c0', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'cash', 7590, v_dd, v_created, v_created);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, price_subtype, created_at) VALUES
    (oid, p_aroma, 5, 950, 4750, 'kg', 5, 20, 'retail', v_created),
    (oid, p_dima, 8, 355, 2840, 'kg', 8, 32, 'retail', v_created);

  -- 8. Farouk (4 AROMA + 1 ESPRESSO + 1 FAMILIAL = 28500)
  oid := gen_random_uuid();
  INSERT INTO orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, total_amount, delivery_date, created_at, updated_at)
  VALUES (oid, '7a4a774e-f532-4398-b31d-7c96605d18a5', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'cash', 28500, v_dd, v_created, v_created);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, price_subtype, created_at) VALUES
    (oid, p_aroma, 20, 950, 19000, 'kg', 5, 20, 'retail', v_created),
    (oid, p_esp, 5, 950, 4750, 'kg', 5, 20, 'retail', v_created),
    (oid, p_fam, 5, 950, 4750, 'kg', 5, 20, 'retail', v_created);

  -- 10. Kheireddine (1 ESPRESSO + 1 FAMILIAL + 1 DIMA = 12340)
  oid := gen_random_uuid();
  INSERT INTO orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, payment_type, payment_status, total_amount, delivery_date, created_at, updated_at)
  VALUES (oid, '4f6c10c9-8f36-4224-8d43-639731b57c09', v_creator, v_worker, v_branch, 'assigned', 'without_invoice', 'cash', 12340, v_dd, v_created, v_created);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit, weight_per_box, pieces_per_box, price_subtype, created_at) VALUES
    (oid, p_esp, 5, 950, 4750, 'kg', 5, 20, 'retail', v_created),
    (oid, p_fam, 5, 950, 4750, 'kg', 5, 20, 'retail', v_created),
    (oid, p_dima, 8, 355, 2840, 'kg', 8, 32, 'retail', v_created);
END $$;