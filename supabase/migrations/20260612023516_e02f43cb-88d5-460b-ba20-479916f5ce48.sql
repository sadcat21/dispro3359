-- 1) Add lifecycle columns to manager_treasury
ALTER TABLE public.manager_treasury
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolution_type text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS linked_debt_id uuid,
  ADD COLUMN IF NOT EXISTS due_date date;

-- Enforce allowed values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manager_treasury_status_check') THEN
    ALTER TABLE public.manager_treasury
      ADD CONSTRAINT manager_treasury_status_check
      CHECK (status IN ('open','under_review','settled','written_off','transferred_to_debt'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manager_treasury_resolution_type_check') THEN
    ALTER TABLE public.manager_treasury
      ADD CONSTRAINT manager_treasury_resolution_type_check
      CHECK (resolution_type IS NULL OR resolution_type IN ('auto_writeoff','worker_debt','manager_approved_writeoff','investigation','customer_repayment'));
  END IF;
END $$;

-- Backfill: legacy non-surplus/deficit entries are considered settled to avoid noise
UPDATE public.manager_treasury
SET status = 'settled', resolved_at = COALESCE(resolved_at, created_at)
WHERE status = 'open'
  AND source_type NOT IN ('accounting_surplus','accounting_deficit','customer_surplus');

CREATE INDEX IF NOT EXISTS idx_manager_treasury_status_source
  ON public.manager_treasury(status, source_type);

-- 2) Tolerance settings table
CREATE TABLE IF NOT EXISTS public.treasury_tolerance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NULL,
  cash_tolerance_amount numeric NOT NULL DEFAULT 0,
  cash_tolerance_pct numeric NOT NULL DEFAULT 0,
  auto_writeoff_below_amount numeric NOT NULL DEFAULT 0,
  require_approval_above_amount numeric NOT NULL DEFAULT 0,
  default_due_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treasury_tolerance_settings_branch_unique UNIQUE (branch_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_tolerance_settings TO authenticated;
GRANT ALL ON public.treasury_tolerance_settings TO service_role;

ALTER TABLE public.treasury_tolerance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tolerance settings"
  ON public.treasury_tolerance_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can manage tolerance settings"
  ON public.treasury_tolerance_settings FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_treasury_tolerance_settings_updated_at ON public.treasury_tolerance_settings;
CREATE TRIGGER update_treasury_tolerance_settings_updated_at
  BEFORE UPDATE ON public.treasury_tolerance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a default (global) row
INSERT INTO public.treasury_tolerance_settings (branch_id, cash_tolerance_amount, cash_tolerance_pct, auto_writeoff_below_amount, require_approval_above_amount, default_due_days)
SELECT NULL, 0, 0, 50, 5000, 30
WHERE NOT EXISTS (SELECT 1 FROM public.treasury_tolerance_settings WHERE branch_id IS NULL);