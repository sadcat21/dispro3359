WITH desired_permissions(code, name_ar, description_ar, category, resource) AS (
  VALUES
    ('page_worker_actions', 'صفحة إجراءات العمال', 'الوصول إلى إجراءات العمال كما يراها مدير النظام', 'page_access', 'worker_actions'),
    ('page_worker_tracking', 'صفحة تتبع العمال', 'الوصول إلى تتبع العمال والمواقع', 'page_access', 'worker_tracking'),
    ('page_attendance', 'صفحة المداومة', 'الوصول إلى سجل المداومة والحضور', 'page_access', 'attendance'),
    ('page_product_offers', 'صفحة جدول العروض', 'الوصول إلى جدول عروض المنتجات', 'page_access', 'product_offers'),
    ('page_promo_splits', 'صفحة تتبع العروض', 'الوصول إلى تتبع وتقسيم العروض', 'page_access', 'promo_splits'),
    ('page_customer_accounts', 'صفحة حسابات العملاء', 'الوصول إلى حسابات العملاء والتجار', 'page_access', 'customer_accounts'),
    ('page_customer_journey', 'صفحة مسار العميل', 'الوصول إلى مسار العميل وتفاصيله', 'page_access', 'customer_journey'),
    ('page_worker_debts', 'صفحة ديون العمال', 'الوصول إلى ديون العمال', 'page_access', 'worker_debts'),
    ('page_manager_sales_summary', 'صفحة تجميع مبيعات العمال', 'الوصول إلى تجميع مبيعات العمال', 'page_access', 'manager_sales_summary'),
    ('page_expenses_management', 'صفحة إدارة المصاريف', 'الوصول إلى إدارة المصاريف', 'page_access', 'expenses_management'),
    ('page_shared_invoices', 'صفحة الفواتير المشتركة', 'الوصول إلى الفواتير المشتركة', 'page_access', 'shared_invoices'),
    ('page_manager_treasury', 'صفحة خزينة المدير', 'الوصول إلى خزينة المدير', 'page_access', 'manager_treasury'),
    ('page_surplus_deficit', 'صفحة خزينة الفائض والعجز', 'الوصول إلى الفائض والعجز', 'page_access', 'surplus_deficit'),
    ('page_rewards', 'صفحة مصاريف الفرح', 'الوصول إلى مصاريف الفرح والمكافآت', 'page_access', 'rewards'),
    ('page_accounting', 'صفحة سجل جلسات المحاسبة', 'الوصول إلى سجل جلسات المحاسبة', 'page_access', 'accounting'),
    ('page_daily_receipts', 'صفحة الفواتير اليومية', 'الوصول إلى الفواتير اليومية', 'page_access', 'daily_receipts'),
    ('page_activity_logs', 'صفحة سجل النشاط', 'الوصول إلى سجل النشاط', 'page_access', 'activity_logs')
), inserted_permissions AS (
  INSERT INTO public.permissions (code, name_ar, description_ar, category, resource)
  SELECT dp.code, dp.name_ar, dp.description_ar, dp.category, dp.resource
  FROM desired_permissions dp
  WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = dp.code
  )
  RETURNING id, code
), all_target_permissions AS (
  SELECT p.id, p.code
  FROM public.permissions p
  WHERE p.code IN (
    SELECT code FROM desired_permissions
    UNION ALL
    SELECT unnest(ARRAY[
      'page_promo_table',
      'page_customer_debts',
      'view_customer_debts',
      'collect_debts',
      'view_all_activity_logs',
      'view_worker_activity',
      'scope_all'
    ])
  )
), company_manager_role AS (
  SELECT id FROM public.custom_roles WHERE code = 'company_manager' LIMIT 1
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cm.id, p.id
FROM company_manager_role cm
CROSS JOIN all_target_permissions p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.role_permissions rp
  WHERE rp.role_id = cm.id
    AND rp.permission_id = p.id
);