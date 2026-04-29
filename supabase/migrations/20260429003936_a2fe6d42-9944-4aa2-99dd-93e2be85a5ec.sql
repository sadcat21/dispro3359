-- ضمان وجود قيد فريد على code
ALTER TABLE public.custom_roles
  ADD CONSTRAINT custom_roles_code_key UNIQUE (code);

INSERT INTO public.custom_roles (code, name_ar, description_ar, is_system)
SELECT 'company_manager','مسير الشركة',
  'الدور التنفيذي الأعلى: موافقات نهائية، إدارة شاملة للموارد والمخزون والتقارير', true
WHERE NOT EXISTS (SELECT 1 FROM public.custom_roles WHERE code='company_manager');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id
FROM public.custom_roles cr
CROSS JOIN public.permissions p
WHERE cr.code = 'company_manager'
  AND p.code IN (
    'scope_all',
    'page_home','page_products','page_customers','page_orders','page_workers',
    'page_branches','page_permissions','page_settings','page_stats',
    'page_customer_debts','page_promo_table','page_my_promos','page_my_deliveries',
    'products_create','products_read','products_update','products_delete',
    'branches_create','branches_read','branches_update','branches_delete',
    'workers_create','workers_read','workers_update','workers_delete',
    'customers_create','customers_read','customers_update','customers_delete',
    'create_orders','view_orders','orders_all','update_order_status',
    'assign_orders','delete_orders',
    'promos_create','promos_read','promos_update','promos_delete','view_all_promos',
    'collect_debts','view_customer_debts',
    'view_reports','view_activity_logs','view_all_activity_logs','view_worker_activity',
    'customize_prices','bypass_gps_guard','bypass_location_check'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = cr.id AND rp.permission_id = p.id
  );

CREATE OR REPLACE FUNCTION public.is_worker()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','worker','branch_admin','supervisor','project_manager','accountant','admin_assistant','company_manager')
    LIMIT 1
  )
$$;

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
$$;