CREATE OR REPLACE FUNCTION public.current_worker_branch_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT branch_id) FILTER (WHERE branch_id IS NOT NULL), ARRAY[]::uuid[])
  FROM (
    SELECT w.branch_id
    FROM public.workers w
    WHERE w.id = public.get_worker_id()
      AND w.is_active = true

    UNION

    SELECT wr.branch_id
    FROM public.worker_roles wr
    WHERE wr.worker_id = public.get_worker_id()
      AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)

    UNION

    SELECT b.id AS branch_id
    FROM public.branches b
    WHERE b.admin_id = public.get_worker_id()
      AND b.is_active = true
  ) allowed_branches;
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch_data(p_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      p_branch_id IS NOT NULL
      AND p_branch_id = ANY(public.current_worker_branch_ids())
    );
$$;

DROP POLICY IF EXISTS "Allow read access to customers" ON public.customers;
DROP POLICY IF EXISTS "View customers based on role" ON public.customers;
DROP POLICY IF EXISTS "Allow read access to sectors" ON public.sectors;
DROP POLICY IF EXISTS "Allow read access to sector_zones" ON public.sector_zones;

CREATE POLICY "Read customers by assigned branch"
ON public.customers
FOR SELECT
TO authenticated
USING (public.can_access_branch_data(branch_id));

CREATE POLICY "Read sectors by assigned branch"
ON public.sectors
FOR SELECT
TO authenticated
USING (public.can_access_branch_data(branch_id));

CREATE POLICY "Read sector zones by sector branch"
ON public.sector_zones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sectors s
    WHERE s.id = sector_zones.sector_id
      AND public.can_access_branch_data(s.branch_id)
  )
);