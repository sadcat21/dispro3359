-- حذف ميزة "طلب من المصنع" من قاعدة البيانات

-- 1) حذف أي طلبات من النوع factory_request وعناصرها
DELETE FROM public.factory_order_items
WHERE factory_order_id IN (
  SELECT id FROM public.factory_orders WHERE order_type = 'factory_request'
);
DELETE FROM public.factory_orders WHERE order_type = 'factory_request';

-- 2) حذف انتقال سير العمل المضاف خصيصاً لـ factory_request
DELETE FROM public.stock_workflow_definitions
WHERE document_type = 'factory_order'
  AND from_status = 'pending_assistant_gm'
  AND to_status = 'approved';

-- 3) حذف عمود رقم هاتف مندوب المصنع من جدول الفروع
ALTER TABLE public.branches DROP COLUMN IF EXISTS factory_sales_phone;

-- 4) إعادة approve_factory_order إلى نسختها الأصلية (بدون فرع factory_request)
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