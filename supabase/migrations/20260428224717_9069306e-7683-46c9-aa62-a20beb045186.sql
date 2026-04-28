CREATE OR REPLACE FUNCTION public.get_worker_permissions_for_role(
  p_worker_id uuid,
  p_custom_role_code text DEFAULT NULL,
  p_base_role public.app_role DEFAULT NULL
)
RETURNS TABLE(permission_code text, permission_name text, category text, resource text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- صلاحيات قائمة على الدور المحدد فقط، مطروحاً منها الصلاحيات الممنوعة فردياً للعامل
  SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
  FROM public.worker_roles wr
  LEFT JOIN public.custom_roles cr_direct ON cr_direct.id = wr.custom_role_id
  LEFT JOIN public.custom_roles cr_by_role ON cr_by_role.code = wr.role::text AND wr.custom_role_id IS NULL
  JOIN public.role_permissions rp ON rp.role_id = COALESCE(cr_direct.id, cr_by_role.id)
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE wr.worker_id = p_worker_id
    AND (
      -- مطابقة بكود الدور المخصص
      (p_custom_role_code IS NOT NULL AND (
         cr_direct.code = p_custom_role_code
         OR (wr.custom_role_id IS NULL AND wr.role::text = p_custom_role_code)
      ))
      -- أو fallback إلى الدور الأساسي إذا لم يكن هناك كود مخصص
      OR (p_custom_role_code IS NULL AND p_base_role IS NOT NULL AND wr.role = p_base_role AND wr.custom_role_id IS NULL)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.worker_permissions wp
      WHERE wp.worker_id = p_worker_id
        AND wp.permission_id = p.id
        AND wp.granted = false
    )

  UNION

  -- صلاحيات فردية ممنوحة صراحة للعامل
  SELECT DISTINCT p.code, p.name_ar, p.category, p.resource
  FROM public.worker_permissions wp
  JOIN public.permissions p ON p.id = wp.permission_id
  WHERE wp.worker_id = p_worker_id
    AND wp.granted = true;
$$;