-- Add new enum value for external supervisor
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'external_supervisor';
