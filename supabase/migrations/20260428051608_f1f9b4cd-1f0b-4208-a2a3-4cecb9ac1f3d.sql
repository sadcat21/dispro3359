ALTER TABLE public.sector_coverage
ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS manager_approved_by UUID NULL,
ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS system_approved_by UUID NULL,
ADD COLUMN IF NOT EXISTS system_approved_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS approval_notes TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_sector_coverage_approval_status
ON public.sector_coverage (approval_status);

CREATE INDEX IF NOT EXISTS idx_sector_coverage_pending_approval
ON public.sector_coverage (approval_status, branch_id)
WHERE is_active = true;