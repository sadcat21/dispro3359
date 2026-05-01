CREATE OR REPLACE FUNCTION public.is_branch_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND public.get_worker_id() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.admin_id = public.get_worker_id()
          AND b.is_active = true
      )
      OR EXISTS (
        SELECT 1 FROM public.workers w
        WHERE w.id = public.get_worker_id()
          AND w.is_active = true
          AND w.role = 'branch_admin'::public.app_role
      )
      OR EXISTS (
        SELECT 1
        FROM public.worker_roles wr
        LEFT JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
        WHERE wr.worker_id = public.get_worker_id()
          AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
          AND (wr.role = 'branch_admin'::public.app_role OR cr.code = 'branch_admin')
      )
    );
$function$;