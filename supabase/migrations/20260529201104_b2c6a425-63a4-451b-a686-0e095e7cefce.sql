CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','project_manager','company_manager')
    LIMIT 1
  )
  OR EXISTS (
    -- Recognize project_manager / company_manager granted via worker_roles + custom_roles
    SELECT 1
    FROM public.user_roles ur
    JOIN public.worker_roles wr ON wr.worker_id = ur.worker_id
    JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
    WHERE ur.user_id = auth.uid()
      AND wr.is_active = true
      AND cr.code IN ('project_manager','company_manager')
    LIMIT 1
  )
$$;