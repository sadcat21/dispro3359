CREATE OR REPLACE FUNCTION public.can_finalize_sector_coverage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.get_worker_id() IS NOT NULL
    AND (
      public.is_admin()
      OR public.has_custom_role('company_manager')
      OR public.get_user_role() = 'company_manager'::public.app_role
    );
$$;

DROP POLICY IF EXISTS "Authorized users can update sector coverage" ON public.sector_coverage;

CREATE POLICY "Authorized users can update sector coverage"
ON public.sector_coverage
FOR UPDATE
USING (
  public.can_manage_sector_coverage_branch(branch_id)
  OR public.can_finalize_sector_coverage()
)
WITH CHECK (
  public.can_manage_sector_coverage_branch(branch_id)
  OR public.can_finalize_sector_coverage()
);