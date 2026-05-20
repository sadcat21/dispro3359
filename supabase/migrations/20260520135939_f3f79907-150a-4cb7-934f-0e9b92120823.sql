UPDATE public.stock_workflow_definitions
SET allowed_custom_role_codes = ARRAY['assistant_gm','system_manager','company_manager','project_manager']::text[]
WHERE document_type='factory_order'
  AND from_status='pending_assistant_gm'
  AND to_status IN ('approved','pending_system_manager','rejected');