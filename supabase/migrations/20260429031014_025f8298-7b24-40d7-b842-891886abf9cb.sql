CREATE OR REPLACE FUNCTION public.can_manage_sector_coverage_branch(p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_branch_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND public.get_worker_id() IS NOT NULL
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.workers w
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
          AND COALESCE(w.branch_id, wr.branch_id) = p_branch_id
          AND (
            wr.role = 'branch_admin'::public.app_role
            OR cr.code = 'branch_admin'
          )
      )
    );
$$;

DROP POLICY IF EXISTS "Admins can insert sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Branch managers can insert own branch sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Admins can update sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Branch managers can update own branch sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Admins can delete sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Branch managers can delete own branch sector coverage" ON public.sector_coverage;

CREATE POLICY "Authorized users can insert sector coverage"
ON public.sector_coverage
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_sector_coverage_branch(branch_id));

CREATE POLICY "Authorized users can update sector coverage"
ON public.sector_coverage
FOR UPDATE
TO authenticated
USING (public.can_manage_sector_coverage_branch(branch_id))
WITH CHECK (public.can_manage_sector_coverage_branch(branch_id));

CREATE POLICY "Authorized users can delete sector coverage"
ON public.sector_coverage
FOR DELETE
TO authenticated
USING (public.can_manage_sector_coverage_branch(branch_id));