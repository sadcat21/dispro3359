
CREATE OR REPLACE FUNCTION public.get_branch_manager_treasury_balances(p_branch_id uuid DEFAULT NULL)
RETURNS TABLE(manager_id uuid, full_name text, total_in numeric, handed_over numeric, remaining numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mgrs AS (
    SELECT w.id, w.full_name
    FROM public.workers w
    WHERE w.is_active = true
      AND w.role = 'branch_admin'::public.app_role
      AND (p_branch_id IS NULL OR w.branch_id = p_branch_id)
  ),
  totals AS (
    SELECT mt.manager_id, SUM(mt.amount)::numeric AS total
    FROM public.manager_treasury mt
    WHERE (p_branch_id IS NULL OR mt.branch_id = p_branch_id)
    GROUP BY mt.manager_id
  ),
  handed AS (
    SELECT mh.manager_id, SUM(mh.amount)::numeric AS handed
    FROM public.manager_handovers mh
    WHERE (p_branch_id IS NULL OR mh.branch_id = p_branch_id)
    GROUP BY mh.manager_id
  )
  SELECT m.id AS manager_id,
         m.full_name,
         COALESCE(t.total, 0) AS total_in,
         COALESCE(h.handed, 0) AS handed_over,
         COALESCE(t.total, 0) - COALESCE(h.handed, 0) AS remaining
  FROM mgrs m
  LEFT JOIN totals t ON t.manager_id = m.id
  LEFT JOIN handed h ON h.manager_id = m.id
  ORDER BY remaining DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_branch_manager_treasury_balances(uuid) TO authenticated;
