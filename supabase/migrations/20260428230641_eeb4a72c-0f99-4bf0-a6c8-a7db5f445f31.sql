-- إضافة دعم الفترة الزمنية والتفعيل للأدوار الإضافية
ALTER TABLE public.worker_roles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS notes text;

-- دالة مساعدة: هل الدور فعّال الآن؟
CREATE OR REPLACE FUNCTION public.is_worker_role_active(p_is_active boolean, p_valid_from timestamptz, p_valid_until timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_is_active, true)
    AND (p_valid_from IS NULL OR p_valid_from <= now())
    AND (p_valid_until IS NULL OR p_valid_until >= now());
$$;

-- تحديث get_worker_roles لإرجاع الأدوار الفعّالة فقط
CREATE OR REPLACE FUNCTION public.get_worker_roles(p_worker_id uuid)
RETURNS TABLE(role app_role, branch_id uuid, branch_name text, custom_role_id uuid, custom_role_code text, custom_role_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    wr.role, 
    wr.branch_id, 
    b.name as branch_name,
    cr.id as custom_role_id,
    cr.code as custom_role_code,
    cr.name_ar as custom_role_name
  FROM public.worker_roles wr
  LEFT JOIN public.branches b ON b.id = wr.branch_id
  LEFT JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
  WHERE wr.worker_id = p_worker_id
    AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
$function$;

-- تحديث get_worker_permissions_for_role لاحترام الفترة والتفعيل
CREATE OR REPLACE FUNCTION public.get_worker_permissions_for_role(p_worker_id uuid, p_custom_role_code text DEFAULT NULL::text, p_base_role app_role DEFAULT NULL::app_role)
RETURNS TABLE(permission_code text, permission_name text, category text, resource text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
  FROM public.worker_roles wr
  LEFT JOIN public.custom_roles cr_direct ON cr_direct.id = wr.custom_role_id
  LEFT JOIN public.custom_roles cr_by_role ON cr_by_role.code = wr.role::text AND wr.custom_role_id IS NULL
  JOIN public.role_permissions rp ON rp.role_id = COALESCE(cr_direct.id, cr_by_role.id)
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE wr.worker_id = p_worker_id
    AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
    AND (
      (p_custom_role_code IS NOT NULL AND (
         cr_direct.code = p_custom_role_code
         OR (wr.custom_role_id IS NULL AND wr.role::text = p_custom_role_code)
      ))
      OR (p_custom_role_code IS NULL AND p_base_role IS NOT NULL AND wr.role = p_base_role AND wr.custom_role_id IS NULL)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.worker_permissions wp
      WHERE wp.worker_id = p_worker_id
        AND wp.permission_id = p.id
        AND wp.granted = false
    )

  UNION

  SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
  FROM public.worker_permissions wp
  JOIN public.permissions p ON p.id = wp.permission_id
  WHERE wp.worker_id = p_worker_id
    AND wp.granted = true;
$function$;

-- سياسات RLS لجدول worker_roles: السماح للمسؤول بإدارة الأدوار
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='worker_roles' AND policyname='Admins manage worker_roles') THEN
    CREATE POLICY "Admins manage worker_roles" ON public.worker_roles
      FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END$$;