ALTER TABLE public.accounting_sessions
  ADD COLUMN IF NOT EXISTS unload_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unload_notes TEXT,
  ADD COLUMN IF NOT EXISTS unload_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.manager_review_sessions
  DROP COLUMN IF EXISTS unload_confirmed,
  DROP COLUMN IF EXISTS unload_notes,
  DROP COLUMN IF EXISTS unload_confirmed_at;