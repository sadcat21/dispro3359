CREATE OR REPLACE FUNCTION public.approve_stock_receipt_two_stage(p_receipt_id uuid, p_stage text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
  v_receipt public.stock_receipts%ROWTYPE;
  v_item RECORD;
  v_existing_qty numeric;
  v_bp_id uuid;
  v_bp_qty integer;
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

    -- إضافة البليطات المستلمة لرصيد الفرع
    IF COALESCE(v_receipt.pallet_count, 0) > 0 THEN
      SELECT id, quantity INTO v_bp_id, v_bp_qty
      FROM public.branch_pallets
      WHERE branch_id = v_receipt.branch_id
      FOR UPDATE;
      IF FOUND THEN
        UPDATE public.branch_pallets
        SET quantity = COALESCE(v_bp_qty,0) + v_receipt.pallet_count,
            updated_at = now()
        WHERE id = v_bp_id;
      ELSE
        INSERT INTO public.branch_pallets(branch_id, quantity, updated_at)
        VALUES (v_receipt.branch_id, v_receipt.pallet_count, now());
      END IF;
      INSERT INTO public.pallet_movements(branch_id, quantity, movement_type, reference_id, notes, created_by)
      VALUES (v_receipt.branch_id, v_receipt.pallet_count, 'receipt', p_receipt_id, 'استلام باليطات (موافقة نهائية)', v_actor);
    END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.approve_factory_order(p_order_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid; v_order public.factory_orders%ROWTYPE;
  v_next text; v_check jsonb;
  v_bp_id uuid; v_bp_qty integer;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_order FROM public.factory_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'factory_order_not_found'; END IF;
  v_next := CASE v_order.status
    WHEN 'pending_branch_manager' THEN 'pending_assistant_gm'
    WHEN 'pending_assistant_gm'   THEN 'pending_system_manager'
    WHEN 'pending_system_manager' THEN 'approved'
    ELSE NULL END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'cannot_approve_in_current_status: %', v_order.status;
  END IF;
  v_check := public.validate_workflow_transition('factory_order', v_order.status, v_next);
  IF NOT (v_check->>'ok')::boolean THEN
    RAISE EXCEPTION 'approval_denied: %', v_check::text;
  END IF;
  UPDATE public.factory_orders SET
    status = v_next,
    branch_approved_by    = CASE WHEN v_order.status = 'pending_branch_manager' THEN v_actor ELSE branch_approved_by END,
    branch_approved_at    = CASE WHEN v_order.status = 'pending_branch_manager' THEN now()    ELSE branch_approved_at END,
    assistant_approved_by = CASE WHEN v_order.status = 'pending_assistant_gm'   THEN v_actor ELSE assistant_approved_by END,
    assistant_approved_at = CASE WHEN v_order.status = 'pending_assistant_gm'   THEN now()    ELSE assistant_approved_at END,
    system_manager_approved_by = CASE WHEN v_order.status = 'pending_system_manager' THEN v_actor ELSE system_manager_approved_by END,
    system_manager_approved_at = CASE WHEN v_order.status = 'pending_system_manager' THEN now()    ELSE system_manager_approved_at END,
    confirmed_at = CASE WHEN v_next = 'approved' THEN now() ELSE confirmed_at END,
    updated_at = now()
  WHERE id = p_order_id;

  -- خصم البليطات من رصيد الفرع عند الموافقة النهائية على طلب تسليم
  IF v_next = 'approved' AND v_order.order_type = 'delivery' AND COALESCE(v_order.pallet_count, 0) > 0 AND v_order.branch_id IS NOT NULL THEN
    SELECT id, quantity INTO v_bp_id, v_bp_qty
    FROM public.branch_pallets
    WHERE branch_id = v_order.branch_id
    FOR UPDATE;
    IF FOUND THEN
      UPDATE public.branch_pallets
      SET quantity = GREATEST(0, COALESCE(v_bp_qty,0) - v_order.pallet_count),
          updated_at = now()
      WHERE id = v_bp_id;
    END IF;
    INSERT INTO public.pallet_movements(branch_id, quantity, movement_type, reference_id, notes, created_by)
    VALUES (v_order.branch_id, -v_order.pallet_count, 'delivery', p_order_id, 'تسليم باليطات للمصنع (موافقة نهائية)', v_actor);
  END IF;

  PERFORM public.record_workflow_transition(
    'factory_order', p_order_id, v_order.status, v_next,
    v_order.branch_id, NULL, p_notes, NULL, NULL, '{}'::jsonb, true
  );
  RETURN jsonb_build_object('ok', true, 'previous_status', v_order.status, 'next_status', v_next);
END $function$;