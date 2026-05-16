-- Insert external_supervisor custom role
INSERT INTO public.custom_roles (code, name_ar, description_ar, is_system)
VALUES ('external_supervisor', 'مشرف خارجي', 'مشرف ميداني خارجي بصلاحيات عامل مع اشتراط الموافقة على التعديلات', true)
ON CONFLICT (code) DO NOTHING;

-- Copy permissions from worker role to external_supervisor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM public.custom_roles WHERE code = 'external_supervisor'),
  rp.permission_id
FROM public.role_permissions rp
WHERE rp.role_id = (SELECT id FROM public.custom_roles WHERE code = 'worker')
ON CONFLICT DO NOTHING;
