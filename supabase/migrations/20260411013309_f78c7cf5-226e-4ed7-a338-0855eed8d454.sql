
-- Table to store UI element visibility overrides per role
CREATE TABLE public.role_ui_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  element_type text NOT NULL,
  element_key text NOT NULL,
  is_hidden boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  UNIQUE (role_id, element_type, element_key)
);

-- Enable RLS
ALTER TABLE public.role_ui_overrides ENABLE ROW LEVEL SECURITY;

-- Workers can read overrides for their assigned roles
CREATE POLICY "Workers can view role ui overrides"
ON public.role_ui_overrides
FOR SELECT
TO authenticated
USING (public.is_worker());

-- Admins can manage all role overrides
CREATE POLICY "Admins can manage role ui overrides"
ON public.role_ui_overrides
FOR ALL
TO authenticated
USING (public.is_admin() OR public.is_branch_admin())
WITH CHECK (public.is_admin() OR public.is_branch_admin());

-- Index for fast lookups
CREATE INDEX idx_role_ui_overrides_role ON public.role_ui_overrides(role_id);
