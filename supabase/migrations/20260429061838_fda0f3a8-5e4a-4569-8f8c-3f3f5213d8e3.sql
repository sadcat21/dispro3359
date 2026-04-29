-- توسيع رؤية مدير الفرع لتشمل كل طلبات الفواتير لعمال فرعه

DROP POLICY IF EXISTS "manual_invoice_requests_select_workflow" ON public.manual_invoice_requests;
DROP POLICY IF EXISTS "manual_invoice_requests_update_workflow" ON public.manual_invoice_requests;

-- دالة مساعدة: هل العامل الحالي مديرٌ لفرع معيّن؟
CREATE OR REPLACE FUNCTION public.current_worker_manages_branch(p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_branch_id IS NOT NULL
    AND public.get_worker_id() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = p_branch_id AND b.admin_id = public.get_worker_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.workers w
        WHERE w.id = public.get_worker_id()
          AND w.is_active = true
          AND w.branch_id = p_branch_id
          AND w.role = 'branch_admin'::public.app_role
      )
      OR EXISTS (
        SELECT 1
        FROM public.worker_roles wr
        LEFT JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
        LEFT JOIN public.workers w ON w.id = wr.worker_id
        WHERE wr.worker_id = public.get_worker_id()
          AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
          AND COALESCE(wr.branch_id, w.branch_id) = p_branch_id
          AND (wr.role = 'branch_admin'::public.app_role OR cr.code = 'branch_admin')
      )
    );
$$;

CREATE POLICY "manual_invoice_requests_select_workflow"
ON public.manual_invoice_requests
FOR SELECT
USING (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR worker_id = public.get_worker_id()
  OR public.current_worker_manages_branch(branch_id)
  OR EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = manual_invoice_requests.worker_id
      AND public.current_worker_manages_branch(w.branch_id)
  )
);

CREATE POLICY "manual_invoice_requests_update_workflow"
ON public.manual_invoice_requests
FOR UPDATE
USING (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR public.current_worker_manages_branch(branch_id)
  OR EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = manual_invoice_requests.worker_id
      AND public.current_worker_manages_branch(w.branch_id)
  )
)
WITH CHECK (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR public.current_worker_manages_branch(branch_id)
  OR EXISTS (
    SELECT 1 FROM public.workers w
    WHERE w.id = manual_invoice_requests.worker_id
      AND public.current_worker_manages_branch(w.branch_id)
  )
);

-- تحديث دالة التحويل للإدارة العليا لاستخدام نفس المنطق
CREATE OR REPLACE FUNCTION public.forward_manual_invoice_request_to_management(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.manual_invoice_requests%ROWTYPE;
  v_worker_id uuid;
  v_request_worker_branch uuid;
  v_allowed boolean;
BEGIN
  v_worker_id := public.get_worker_id();

  SELECT * INTO v_request
  FROM public.manual_invoice_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice_request_not_found';
  END IF;

  IF v_request.status <> 'pending_branch' THEN
    RAISE EXCEPTION 'invoice_request_not_pending_branch';
  END IF;

  SELECT branch_id INTO v_request_worker_branch
  FROM public.workers WHERE id = v_request.worker_id;

  v_allowed :=
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR public.current_worker_manages_branch(v_request.branch_id)
    OR public.current_worker_manages_branch(v_request_worker_branch);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'not_allowed_to_forward_invoice_request';
  END IF;

  UPDATE public.manual_invoice_requests
  SET
    status = 'pending_assistant',
    branch_approved_by = v_worker_id,
    branch_approved_at = now()
  WHERE id = p_request_id;

  IF v_request.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'pending_assistant'
    WHERE id = v_request.order_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'next_status', 'pending_assistant');
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_worker_manages_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forward_manual_invoice_request_to_management(uuid) TO authenticated;