
-- Add manager decision columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_manager_decision text,
  ADD COLUMN IF NOT EXISTS document_manager_decision text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_invoice_manager_decision_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_invoice_manager_decision_check
  CHECK (invoice_manager_decision IS NULL OR invoice_manager_decision IN ('received','not_received'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_document_manager_decision_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_document_manager_decision_check
  CHECK (document_manager_decision IS NULL OR document_manager_decision IN ('received','not_received'));

CREATE INDEX IF NOT EXISTS orders_invoice_manager_decision_idx
  ON public.orders(invoice_manager_decision)
  WHERE invoice_manager_decision IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_document_manager_decision_idx
  ON public.orders(document_manager_decision)
  WHERE document_manager_decision IS NOT NULL;

-- Update confirm_order_invoice_receipt to also flip invoice_stage and decision
CREATE OR REPLACE FUNCTION public.confirm_order_invoice_receipt(
  p_order_id uuid,
  p_invoice_number text,
  p_issue_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_actor_worker_id uuid := public.get_worker_id();
  v_invoice_number text := btrim(coalesce(p_invoice_number, ''));
  v_is_global_manager boolean := false;
  v_can_manage_order boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF v_invoice_number = '' THEN
    RAISE EXCEPTION 'invoice_number_required';
  END IF;

  IF p_issue_date IS NULL THEN
    RAISE EXCEPTION 'issue_date_required';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  IF coalesce(v_order.payment_type, '') <> 'with_invoice' THEN
    RAISE EXCEPTION 'order_not_invoice_based';
  END IF;

  v_is_global_manager := (
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR public.has_custom_role('assistant_manager')
    OR public.has_custom_role('assistant_gm')
    OR public.has_custom_role('project_manager')
    OR public.has_custom_role('system_manager')
    OR public.has_custom_role('internal_supervisor')
    OR public.has_custom_role('warehouse_manager')
    OR public.get_user_role() = 'supervisor'::public.app_role
  );

  v_can_manage_order := (
    v_is_global_manager
    OR (
      public.is_branch_admin()
      AND v_actor_worker_id IS NOT NULL
      AND v_order.branch_id IN (
        SELECT b.id FROM public.branches b WHERE b.admin_id = v_actor_worker_id
      )
    )
    OR (
      v_order.branch_id IS NOT NULL
      AND public.current_worker_manages_branch(v_order.branch_id)
    )
  );

  IF NOT v_can_manage_order THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE public.orders
  SET
    invoice_number = v_invoice_number,
    invoice_sent_at = (p_issue_date::timestamp AT TIME ZONE 'UTC'),
    invoice_received_at = now(),
    invoice_stage = CASE WHEN invoice_stage = 'unsealed'::invoice_stage THEN 'sealed'::invoice_stage ELSE invoice_stage END,
    invoice_manager_decision = 'received',
    document_status = CASE
      WHEN coalesce(document_status, 'pending') = 'pending' THEN 'received'
      ELSE document_status
    END,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order.id);
END;
$$;

-- New RPC: set_manager_invoice_decision
CREATE OR REPLACE FUNCTION public.set_manager_invoice_decision(
  p_order_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_actor_worker_id uuid := public.get_worker_id();
  v_can boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_decision NOT IN ('received','not_received') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  v_can := (
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR public.has_custom_role('assistant_manager')
    OR public.has_custom_role('assistant_gm')
    OR public.has_custom_role('project_manager')
    OR public.has_custom_role('system_manager')
    OR public.has_custom_role('internal_supervisor')
    OR public.has_custom_role('warehouse_manager')
    OR public.get_user_role() = 'supervisor'::public.app_role
    OR (
      public.is_branch_admin()
      AND v_actor_worker_id IS NOT NULL
      AND v_order.branch_id IN (SELECT b.id FROM public.branches b WHERE b.admin_id = v_actor_worker_id)
    )
    OR (v_order.branch_id IS NOT NULL AND public.current_worker_manages_branch(v_order.branch_id))
  );
  IF NOT v_can THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF p_decision = 'not_received' THEN
    UPDATE public.orders
      SET invoice_manager_decision = 'not_received',
          invoice_stage = 'unsealed'::invoice_stage,
          invoice_received_at = NULL,
          updated_at = now()
      WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- New RPC: set_manager_document_decision
CREATE OR REPLACE FUNCTION public.set_manager_document_decision(
  p_order_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_actor_worker_id uuid := public.get_worker_id();
  v_can boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_decision NOT IN ('received','not_received') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  v_can := (
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR public.has_custom_role('assistant_manager')
    OR public.has_custom_role('assistant_gm')
    OR public.has_custom_role('project_manager')
    OR public.has_custom_role('system_manager')
    OR public.has_custom_role('internal_supervisor')
    OR public.has_custom_role('warehouse_manager')
    OR public.get_user_role() = 'supervisor'::public.app_role
    OR (
      public.is_branch_admin()
      AND v_actor_worker_id IS NOT NULL
      AND v_order.branch_id IN (SELECT b.id FROM public.branches b WHERE b.admin_id = v_actor_worker_id)
    )
    OR (v_order.branch_id IS NOT NULL AND public.current_worker_manages_branch(v_order.branch_id))
  );
  IF NOT v_can THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF p_decision = 'received' THEN
    UPDATE public.orders
      SET document_manager_decision = 'received',
          document_stage = 'received'::document_stage,
          document_status = CASE WHEN coalesce(document_status,'pending') = 'pending' THEN 'received' ELSE document_status END,
          updated_at = now()
      WHERE id = p_order_id;
  ELSE
    UPDATE public.orders
      SET document_manager_decision = 'not_received',
          document_stage = 'pending'::document_stage,
          updated_at = now()
      WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_manager_invoice_decision(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_manager_document_decision(uuid,text) TO authenticated;
