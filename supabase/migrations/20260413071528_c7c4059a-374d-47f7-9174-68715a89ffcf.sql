CREATE OR REPLACE VIEW public.workers_safe AS
SELECT 
  id,
  username,
  full_name,
  full_name_fr,
  role,
  branch_id,
  is_active,
  is_test,
  department,
  personal_phone,
  work_phone,
  print_name,
  bonus_cap_percentage,
  salary,
  device_locked,
  last_device_id,
  last_device_info,
  created_at,
  updated_at
FROM public.workers;