-- Add 'internal_supervisor' enum value to app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'internal_supervisor';