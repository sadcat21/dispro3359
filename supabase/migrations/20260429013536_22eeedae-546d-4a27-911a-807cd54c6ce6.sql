-- توسيع سياسة الكتابة على worker_roles لتشمل مدير الفرع ومسير الشركة (عبر دوره الرئيسي في worker_roles)
DROP POLICY IF EXISTS "Admins can manage worker_roles" ON public.worker_roles;
DROP POLICY IF EXISTS "Admins manage worker_roles" ON public.worker_roles;

CREATE POLICY "Admins and managers can manage worker_roles"
ON public.worker_roles
FOR ALL
USING (
  public.is_admin()
  OR public.is_branch_admin()
  OR public.has_custom_role('company_manager')
  OR public.has_custom_role('project_manager')
)
WITH CHECK (
  public.is_admin()
  OR public.is_branch_admin()
  OR public.has_custom_role('company_manager')
  OR public.has_custom_role('project_manager')
);