CREATE OR REPLACE FUNCTION public.can_insert_stock_confirmation(
  _worker_id uuid,
  _manager_id uuid,
  _source_session_id uuid,
  _branch_id uuid,
  _operation_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_worker_id uuid;
  v_actor_role public.app_role;
BEGIN
  v_actor_worker_id := public.get_worker_id();
  v_actor_role := public.get_user_role();

  IF auth.uid() IS NULL OR v_actor_worker_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.workers target_worker
    LEFT JOIN public.workers manager_worker ON manager_worker.id = _manager_id
    LEFT JOIN public.loading_sessions ls ON ls.id = _source_session_id
    WHERE target_worker.id = _worker_id
      AND target_worker.is_active = true
      AND COALESCE(manager_worker.is_active, true) = true
      AND (_manager_id IS NULL OR manager_worker.id = _manager_id)
      AND (
        _source_session_id IS NULL
        OR (
          ls.id = _source_session_id
          AND ls.worker_id = _worker_id
          AND (
            ls.manager_id = _manager_id
            OR _manager_id = v_actor_worker_id
          )
        )
      )
      AND (
        _branch_id IS NULL
        OR target_worker.branch_id = _branch_id
        OR manager_worker.branch_id = _branch_id
        OR ls.branch_id = _branch_id
      )
      AND (
        public.is_admin()
        OR public.is_branch_admin()
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
              OR b.id = ls.branch_id
            )
        )
        OR (
          _manager_id = v_actor_worker_id
          AND (
            v_actor_role IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
            OR public.worker_has_custom_role(v_actor_worker_id, 'warehouse_manager')
            OR public.worker_has_custom_role(v_actor_worker_id, 'supervisor')
          )
          AND (
            _branch_id IS NULL
            OR target_worker.branch_id = _branch_id
            OR EXISTS (
              SELECT 1
              FROM public.worker_roles wr
              WHERE wr.worker_id = v_actor_worker_id
                AND (wr.branch_id IS NULL OR wr.branch_id = _branch_id OR wr.branch_id = target_worker.branch_id)
            )
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
    stock_confirmations.branch_id,
    stock_confirmations.operation_type
  )
);