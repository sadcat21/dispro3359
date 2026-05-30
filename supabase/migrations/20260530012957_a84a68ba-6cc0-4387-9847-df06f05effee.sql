ALTER TABLE public.manager_handovers
  ADD COLUMN IF NOT EXISTS debt_cash_amount NUMERIC NOT NULL DEFAULT 0;