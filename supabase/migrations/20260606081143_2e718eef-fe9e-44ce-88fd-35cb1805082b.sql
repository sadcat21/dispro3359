
CREATE OR REPLACE FUNCTION public.is_expense_accounted(_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expenses e
    JOIN public.accounting_sessions s ON s.worker_id = e.worker_id
    WHERE e.id = _expense_id
      AND s.status = 'completed'
      AND e.created_at > s.period_start
      AND e.created_at <= GREATEST(s.period_end, COALESCE(s.completed_at, s.period_end))
  );
$$;

DROP POLICY IF EXISTS "Workers can delete own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Workers can update own pending expenses" ON public.expenses;

CREATE POLICY "Workers can delete own unaccounted expenses"
ON public.expenses
FOR DELETE
USING (
  (worker_id = get_worker_id() AND NOT public.is_expense_accounted(id))
);

CREATE POLICY "Workers can update own unaccounted expenses"
ON public.expenses
FOR UPDATE
USING (
  (worker_id = get_worker_id() AND NOT public.is_expense_accounted(id))
  OR is_admin() OR is_branch_admin()
);
