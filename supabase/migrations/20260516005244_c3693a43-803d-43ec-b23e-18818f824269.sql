ALTER TABLE public.manager_review_sessions
  ADD COLUMN IF NOT EXISTS unload_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unload_notes TEXT,
  ADD COLUMN IF NOT EXISTS unload_confirmed_at TIMESTAMPTZ;