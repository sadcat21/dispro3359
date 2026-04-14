
-- Create manager_review_sessions table
CREATE TABLE public.manager_review_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES public.workers(id),
  branch_id UUID REFERENCES public.branches(id),
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Add review linkage to accounting_sessions
ALTER TABLE public.accounting_sessions 
  ADD COLUMN review_session_id UUID REFERENCES public.manager_review_sessions(id),
  ADD COLUMN is_treasury_posted BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing completed sessions as already posted (backward compat)
UPDATE public.accounting_sessions 
SET is_treasury_posted = true 
WHERE status = 'completed';

-- Enable RLS
ALTER TABLE public.manager_review_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for manager_review_sessions
CREATE POLICY "Workers can view review sessions"
ON public.manager_review_sessions FOR SELECT
TO authenticated
USING (public.is_worker());

CREATE POLICY "Admins can insert review sessions"
ON public.manager_review_sessions FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR public.is_branch_admin());

CREATE POLICY "Admins can update review sessions"
ON public.manager_review_sessions FOR UPDATE
TO authenticated
USING (public.is_admin() OR public.is_branch_admin());

CREATE POLICY "Admins can delete review sessions"
ON public.manager_review_sessions FOR DELETE
TO authenticated
USING (public.is_admin() OR public.is_branch_admin());

-- Index for performance
CREATE INDEX idx_manager_review_sessions_manager ON public.manager_review_sessions(manager_id);
CREATE INDEX idx_manager_review_sessions_branch ON public.manager_review_sessions(branch_id);
CREATE INDEX idx_accounting_sessions_review ON public.accounting_sessions(review_session_id);
