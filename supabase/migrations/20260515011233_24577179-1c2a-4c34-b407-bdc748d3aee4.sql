do $$
declare
  v_worker_id uuid := 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78';
  v_product_id uuid := 'bf1a98c1-2bf2-4026-90e5-ce5572070c7f';
  v_branch_id uuid;
begin
  select branch_id into v_branch_id
  from public.worker_stock
  where worker_id = v_worker_id and product_id = v_product_id
  limit 1;

  update public.worker_stock
  set quantity = 5.05
  where worker_id = v_worker_id
    and product_id = v_product_id
    and quantity = 5.04;

  if found then
    insert into public.stock_movements (
      product_id, branch_id, quantity, signed_quantity,
      movement_type, status, worker_id, created_by, notes
    ) values (
      v_product_id, v_branch_id, 0.01, 0.01,
      'modification', 'approved', v_worker_id, v_worker_id,
      'تصحيح الباقي بعد تعديل الهدية: 5.04 → 5.05'
    );
  end if;
end $$;