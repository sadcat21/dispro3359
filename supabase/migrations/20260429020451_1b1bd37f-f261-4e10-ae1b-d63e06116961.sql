DROP FUNCTION IF EXISTS public.get_worker_roles(uuid);

CREATE OR REPLACE FUNCTION public.get_worker_roles(p_worker_id uuid)
RETURNS TABLE(
  role public.app_role,
  branch_id uuid,
  branch_name text,
  custom_role_id uuid,
  custom_role_code text,
  custom_role_name text,
  is_primary boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    wr.role,
    wr.branch_id,
    b.name AS branch_name,
    cr.id AS custom_role_id,
    cr.code AS custom_role_code,
    cr.name_ar AS custom_role_name,
    COALESCE(wr.is_primary, false) AS is_primary
  FROM public.worker_roles wr
  LEFT JOIN public.branches b ON b.id = wr.branch_id
  LEFT JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
  WHERE wr.worker_id = p_worker_id
    AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
  ORDER BY COALESCE(wr.is_primary, false) DESC, wr.created_at ASC NULLS LAST;
$function$;