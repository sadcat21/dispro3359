CREATE OR REPLACE FUNCTION public.worker_has_custom_role(p_worker_id uuid, p_role_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.worker_roles wr
    JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
    WHERE wr.worker_id = p_worker_id
      AND cr.code = p_role_code
  );
$$;

CREATE OR REPLACE FUNCTION public.can_insert_stock_confirmation(
  _worker_id uuid,
  _manager_id uuid,
  _source_session_id uuid,
  _branch_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_worker_id uuid;
BEGIN
  v_actor_worker_id := public.get_worker_id();

  IF auth.uid() IS NULL OR v_actor_worker_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.workers manager_worker
    JOIN public.workers target_worker ON target_worker.id = _worker_id
    WHERE manager_worker.id = _manager_id
      AND manager_worker.is_active = true
      AND target_worker.is_active = true
      AND (
        _branch_id IS NULL
        OR target_worker.branch_id = _branch_id
        OR manager_worker.branch_id = _branch_id
      )
      AND (
        _source_session_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.loading_sessions ls
          WHERE ls.id = _source_session_id
            AND ls.worker_id = _worker_id
            AND ls.manager_id = _manager_id
            AND (
              _branch_id IS NULL
              OR ls.branch_id IS NULL
              OR ls.branch_id = _branch_id
            )
        )
      )
      AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.branches b
          WHERE b.admin_id = v_actor_worker_id
            AND b.is_active = true
            AND (
              _branch_id IS NULL
              OR b.id = _branch_id
              OR b.id = target_worker.branch_id
              OR b.id = manager_worker.branch_id
            )
        )
        OR (
          _manager_id = v_actor_worker_id
          AND (
            public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
            OR public.worker_has_custom_role(v_actor_worker_id, 'warehouse_manager')
            OR public.worker_has_custom_role(v_actor_worker_id, 'supervisor')
          )
        )
      )
  );
END;
$$;

DROP POLICY IF EXISTS "Managers can create confirmations" ON public.stock_confirmations;

CREATE POLICY "Managers can create confirmations"
ON public.stock_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_insert_stock_confirmation(
    stock_confirmations.worker_id,
    stock_confirmations.manager_id,
    stock_confirmations.source_session_id,
    stock_confirmations.branch_id
  )
);