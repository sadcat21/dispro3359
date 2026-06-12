CREATE OR REPLACE FUNCTION public.approve_treasury_entry(
  p_entry_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS public.manager_treasury
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.manager_treasury;
  v_caller_worker uuid;
  v_new_status text;
BEGIN
  -- Only admin-level roles can approve
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'صلاحية الاعتماد محصورة بالمدير'
      USING ERRCODE = '42501';
  END IF;

  -- Validate decision
  IF p_decision NOT IN ('manager_approved_writeoff','worker_debt','investigation','customer_repayment') THEN
    RAISE EXCEPTION 'قرار غير صالح: %', p_decision;
  END IF;

  SELECT * INTO v_entry FROM public.manager_treasury WHERE id = p_entry_id FOR UPDATE;
  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'القيد غير موجود';
  END IF;

  -- Resolve caller's worker_id (creator is stored as worker_id, not auth uid)
  SELECT ur.worker_id INTO v_caller_worker
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  LIMIT 1;

  -- Four-eyes rule: cannot approve own entry
  IF v_caller_worker IS NOT NULL AND v_entry.manager_id = v_caller_worker THEN
    RAISE EXCEPTION 'لا يمكنك اعتماد قيد أنشأته بنفسك'
      USING ERRCODE = '42501';
  END IF;

  IF v_entry.status NOT IN ('open','under_review') THEN
    RAISE EXCEPTION 'القيد ليس قابلًا للاعتماد (الحالة الحالية: %)', v_entry.status;
  END IF;

  v_new_status := CASE p_decision
    WHEN 'worker_debt'        THEN 'transferred_to_debt'
    WHEN 'investigation'      THEN 'under_review'
    WHEN 'customer_repayment' THEN 'settled'
    ELSE 'written_off'
  END;

  UPDATE public.manager_treasury
  SET status = v_new_status,
      resolution_type = p_decision,
      resolution_notes = COALESCE(p_notes, resolution_notes),
      resolved_by = v_caller_worker,
      resolved_at = now()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_treasury_entry(uuid, text, text) TO authenticated;