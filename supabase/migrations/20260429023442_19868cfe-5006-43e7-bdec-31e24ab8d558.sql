CREATE OR REPLACE FUNCTION public.approve_stock_receipt_two_stage(
  p_receipt_id uuid,
  p_stage text  -- 'branch' or 'assistant'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_receipt public.stock_receipts%ROWTYPE;
  v_item RECORD;
  v_existing_qty numeric;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_receipt FROM public.stock_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;

  IF p_stage = 'branch' THEN
    IF NOT (public.is_admin() OR public.is_branch_admin()) THEN
      RAISE EXCEPTION 'Only branch admin can approve stage 1';
    END IF;
    IF v_receipt.status NOT IN ('pending', 'pending_branch') THEN
      RAISE EXCEPTION 'Receipt not in branch-pending state';
    END IF;
    UPDATE public.stock_receipts
    SET status = 'pending_assistant',
        branch_approved_by = v_actor,
        branch_approved_at = now(),
        updated_at = now()
    WHERE id = p_receipt_id;
    RETURN jsonb_build_object('ok', true, 'next_status', 'pending_assistant');

  ELSIF p_stage = 'assistant' THEN
    IF NOT (public.is_admin() OR public.has_custom_role('company_manager')) THEN
      RAISE EXCEPTION 'Only assistant general manager can approve stage 2';
    END IF;
    IF v_receipt.status <> 'pending_assistant' THEN
      RAISE EXCEPTION 'Receipt not awaiting assistant approval';
    END IF;

    -- تحديث مخزون الفرع
    FOR v_item IN
      SELECT product_id, COALESCE(quantity,0) AS quantity
      FROM public.stock_receipt_items
      WHERE receipt_id = p_receipt_id
    LOOP
      SELECT quantity INTO v_existing_qty
      FROM public.warehouse_stock
      WHERE branch_id = v_receipt.branch_id AND product_id = v_item.product_id
      FOR UPDATE;

      IF FOUND THEN
        UPDATE public.warehouse_stock
        SET quantity = COALESCE(v_existing_qty,0) + v_item.quantity,
            updated_at = now()
        WHERE branch_id = v_receipt.branch_id AND product_id = v_item.product_id;
      ELSE
        INSERT INTO public.warehouse_stock(branch_id, product_id, quantity, updated_at)
        VALUES (v_receipt.branch_id, v_item.product_id, v_item.quantity, now());
      END IF;
    END LOOP;

    UPDATE public.stock_receipts
    SET status = 'approved',
        assistant_approved_by = v_actor,
        assistant_approved_at = now(),
        approved_by = v_actor,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('ok', true, 'next_status', 'approved');
  ELSE
    RAISE EXCEPTION 'Invalid stage: %', p_stage;
  END IF;
END;
$$;