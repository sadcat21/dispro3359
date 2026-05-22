CREATE OR REPLACE FUNCTION public.set_invoice_document_attached(p_order_id uuid, p_attached boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_worker_id uuid;
  v_branch uuid;
  v_verif jsonb;
  v_allowed boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT branch_id, COALESCE(document_verification, '{}'::jsonb)
    INTO v_branch, v_verif
  FROM public.orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user
      AND ur.role::text IN ('admin','company_manager','assistant_manager','project_manager','system_manager','internal_supervisor','warehouse_manager','supervisor')
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    v_worker_id := public.get_worker_id();
    IF v_worker_id IS NOT NULL THEN
      IF public.current_worker_manages_branch(v_branch) OR public.is_branch_admin() THEN
        v_allowed := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  v_verif := v_verif || jsonb_build_object('attached_to_invoice', p_attached);

  UPDATE public.orders
     SET document_verification = v_verif
   WHERE id = p_order_id;

  RETURN jsonb_build_object('order_id', p_order_id, 'attached_to_invoice', p_attached);
END;
$$;