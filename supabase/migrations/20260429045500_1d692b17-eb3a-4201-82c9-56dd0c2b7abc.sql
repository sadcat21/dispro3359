-- Allow top management to view and process manual invoice requests, and keep branch managers scoped to their branch
DROP POLICY IF EXISTS "Admins can manage manual_invoice_requests" ON public.manual_invoice_requests;
DROP POLICY IF EXISTS "manual_invoice_requests_select_workflow" ON public.manual_invoice_requests;
DROP POLICY IF EXISTS "manual_invoice_requests_update_workflow" ON public.manual_invoice_requests;

CREATE POLICY "manual_invoice_requests_select_workflow"
ON public.manual_invoice_requests
FOR SELECT
USING (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR worker_id = public.get_worker_id()
  OR (
    public.is_branch_admin()
    AND branch_id IN (
      SELECT id FROM public.branches WHERE admin_id = public.get_worker_id()
    )
  )
);

CREATE POLICY "manual_invoice_requests_update_workflow"
ON public.manual_invoice_requests
FOR UPDATE
USING (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR (
    public.is_branch_admin()
    AND branch_id IN (
      SELECT id FROM public.branches WHERE admin_id = public.get_worker_id()
    )
  )
)
WITH CHECK (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR (
    public.is_branch_admin()
    AND branch_id IN (
      SELECT id FROM public.branches WHERE admin_id = public.get_worker_id()
    )
  )
);

CREATE OR REPLACE FUNCTION public.forward_manual_invoice_request_to_management(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.manual_invoice_requests%ROWTYPE;
  v_worker_id uuid;
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

  IF NOT (
    public.is_admin()
    OR (
      public.is_branch_admin()
      AND EXISTS (
        SELECT 1
        FROM public.branches b
        WHERE b.id = v_request.branch_id
          AND b.admin_id = v_worker_id
      )
    )
  ) THEN
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

GRANT EXECUTE ON FUNCTION public.forward_manual_invoice_request_to_management(uuid) TO authenticated;