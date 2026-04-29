-- 1) Insert missing permissions only if they don't already exist
INSERT INTO public.permissions (code, name_ar, category, resource)
SELECT v.code, v.name_ar, v.category, v.resource
FROM (VALUES
  ('page_warehouse', 'صفحة المخزن', 'page_access', 'warehouse'),
  ('page_warehouse_review', 'صفحة مراجعة المخزن', 'page_access', 'warehouse'),
  ('page_stock_receipts', 'صفحة وصولات المخزن', 'page_access', 'stock_receipts'),
  ('page_worker_liability', 'صفحة عهدة العمال', 'page_access', 'worker_liability'),
  ('page_worker_roles_management', 'صفحة إدارة أدوار العمال', 'page_access', 'permissions'),
  ('page_manager_accounting_review', 'صفحة مراجعة محاسبة المدير', 'page_access', 'accounting'),
  ('page_assistant_approvals', 'صفحة موافقات المساعد', 'page_access', 'shared_invoices'),
  ('page_order_tracking', 'صفحة تتبع الطلبيات', 'page_access', 'orders')
) AS v(code, name_ar, category, resource)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

-- 2) Link them to company_manager (avoid duplicates)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id
FROM public.custom_roles cr
CROSS JOIN public.permissions p
WHERE cr.code = 'company_manager'
  AND p.code IN (
    'page_warehouse',
    'page_warehouse_review',
    'page_stock_receipts',
    'page_worker_liability',
    'page_worker_roles_management',
    'page_manager_accounting_review',
    'page_assistant_approvals',
    'page_order_tracking'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = cr.id AND rp.permission_id = p.id
  );