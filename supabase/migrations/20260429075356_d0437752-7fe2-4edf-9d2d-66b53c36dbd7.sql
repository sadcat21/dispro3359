-- 1. Create the custom role
INSERT INTO public.custom_roles (code, name_ar, description_ar, is_system)
VALUES (
  'internal_supervisor',
  'مشرف داخلي',
  'متابعة أداء وانضباط العمال داخل الفرع: الديون، إنجازات اليوم، تجميع المبيعات، الموافقة على تعديلات/حذف العملاء',
  true
)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar;

-- 2. Assign permissions to the internal_supervisor role
WITH role_data AS (
  SELECT id AS role_id FROM public.custom_roles WHERE code = 'internal_supervisor'
),
perm_codes(code) AS (
  VALUES
    ('page_orders'),
    ('view_orders'),
    ('page_customers'),
    ('customers_read'),
    ('customers_update'),
    ('page_customer_accounts'),
    ('page_customer_journey'),
    ('page_customer_debts'),
    ('view_customer_debts'),
    ('collect_debts'),
    ('page_worker_debts'),
    ('page_worker_tracking'),
    ('page_attendance'),
    ('page_activity_logs'),
    ('page_geo_operations'),
    ('page_workers'),
    ('page_manager_sales_summary'),
    ('page_stats'),
    ('page_promo_table'),
    ('page_my_promos')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rd.role_id, p.id
FROM role_data rd
CROSS JOIN perm_codes pc
JOIN public.permissions p ON p.code = pc.code
ON CONFLICT DO NOTHING;