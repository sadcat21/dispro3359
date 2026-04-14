
-- Create stock_confirmations table for worker approval workflow
CREATE TABLE public.stock_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type text NOT NULL CHECK (operation_type IN ('load', 'unload', 'deficit', 'surplus', 'damaged', 'review', 'exchange')),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'amended')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_items jsonb DEFAULT NULL,
  source_session_id uuid DEFAULT NULL,
  rejection_note text DEFAULT NULL,
  amendment_note text DEFAULT NULL,
  parent_confirmation_id uuid REFERENCES public.stock_confirmations(id) DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup by worker
CREATE INDEX idx_stock_confirmations_worker ON public.stock_confirmations(worker_id, status);
CREATE INDEX idx_stock_confirmations_manager ON public.stock_confirmations(manager_id);

-- Enable RLS
ALTER TABLE public.stock_confirmations ENABLE ROW LEVEL SECURITY;

-- Workers can see their own confirmations
CREATE POLICY "Workers can view own confirmations"
ON public.stock_confirmations FOR SELECT
TO authenticated
USING (
  worker_id = public.get_worker_id()
  OR manager_id = public.get_worker_id()
  OR public.is_admin()
  OR public.is_branch_admin()
);

-- Managers/warehouse can create confirmations
CREATE POLICY "Managers can create confirmations"
ON public.stock_confirmations FOR INSERT
TO authenticated
WITH CHECK (
  manager_id = public.get_worker_id()
  OR public.is_admin()
);

-- Managers can update pending/rejected confirmations, workers can approve/reject pending ones
CREATE POLICY "Update confirmations"
ON public.stock_confirmations FOR UPDATE
TO authenticated
USING (
  (manager_id = public.get_worker_id() AND status IN ('pending', 'rejected'))
  OR (worker_id = public.get_worker_id() AND status = 'pending')
  OR public.is_admin()
);

-- Only admins and managers can delete
CREATE POLICY "Delete confirmations"
ON public.stock_confirmations FOR DELETE
TO authenticated
USING (
  manager_id = public.get_worker_id()
  OR public.is_admin()
);

-- Trigger for updated_at
CREATE TRIGGER update_stock_confirmations_updated_at
BEFORE UPDATE ON public.stock_confirmations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
