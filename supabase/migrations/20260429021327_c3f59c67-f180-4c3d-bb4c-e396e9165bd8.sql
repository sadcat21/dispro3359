INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id
FROM public.custom_roles cr
JOIN public.permissions p ON p.code IN (
  'page_worker_actions',
  'page_worker_tracking',
  'page_attendance',
  'page_product_offers',
  'page_promo_splits',
  'page_customer_accounts',
  'page_customer_journey',
  'page_worker_debts',
  'page_manager_sales_summary',
  'page_expenses_management',
  'page_shared_invoices',
  'page_manager_treasury',
  'page_surplus_deficit',
  'page_rewards',
  'page_accounting',
  'page_daily_receipts',
  'page_activity_logs',
  'page_customer_debts',
  'view_customer_debts',
  'collect_debts',
  'view_all_activity_logs',
  'view_worker_activity',
  'scope_all'
)
WHERE cr.code = 'company_manager'
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = cr.id
      AND rp.permission_id = p.id
  );