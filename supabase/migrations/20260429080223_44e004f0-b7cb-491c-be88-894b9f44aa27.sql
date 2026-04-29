DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.custom_roles WHERE code = 'internal_supervisor')
  AND permission_id IN (SELECT id FROM public.permissions WHERE code = 'page_worker_debts');