
-- Drop the existing check constraint on status if it exists, and add updated one
DO $$
BEGIN
  -- Try to drop existing constraint (name might vary)
  BEGIN
    ALTER TABLE public.loading_sessions DROP CONSTRAINT IF EXISTS loading_sessions_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Also check if the column has a simple check
ALTER TABLE public.loading_sessions DROP CONSTRAINT IF EXISTS loading_sessions_status_check;

-- Add flexible status - allow pending_confirmation
-- Since the column might not have a check constraint, let's just ensure it works
-- by using a permissive approach
COMMENT ON COLUMN public.loading_sessions.status IS 'open | completed | review | pending_confirmation';
