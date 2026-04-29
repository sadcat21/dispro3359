DROP POLICY IF EXISTS "Admins can manage sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Admins can insert sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Branch managers can insert own branch sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Admins can update sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Branch managers can update own branch sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Admins can delete sector coverage" ON public.sector_coverage;
DROP POLICY IF EXISTS "Branch managers can delete own branch sector coverage" ON public.sector_coverage;

CREATE POLICY "Admins can insert sector coverage"
ON public.sector_coverage
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Branch managers can insert own branch sector coverage"
ON public.sector_coverage
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'branch_admin'::public.app_role
  AND branch_id IS NOT NULL
  AND branch_id = public.get_worker_branch_id()
);

CREATE POLICY "Admins can update sector coverage"
ON public.sector_coverage
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Branch managers can update own branch sector coverage"
ON public.sector_coverage
FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'branch_admin'::public.app_role
  AND branch_id IS NOT NULL
  AND branch_id = public.get_worker_branch_id()
)
WITH CHECK (
  public.get_user_role() = 'branch_admin'::public.app_role
  AND branch_id IS NOT NULL
  AND branch_id = public.get_worker_branch_id()
);

CREATE POLICY "Admins can delete sector coverage"
ON public.sector_coverage
FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Branch managers can delete own branch sector coverage"
ON public.sector_coverage
FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'branch_admin'::public.app_role
  AND branch_id IS NOT NULL
  AND branch_id = public.get_worker_branch_id()
);