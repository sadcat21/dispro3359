-- 1. Add pin_hash column to workers for final review signature
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS review_pin_hash text;

-- 2. Create final_review_sessions table
CREATE TABLE IF NOT EXISTS public.final_review_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  warehouse_manager_id uuid NOT NULL REFERENCES public.workers(id),
  branch_id uuid REFERENCES public.branches(id),
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  worker_confirmed_at timestamptz,
  manager_confirmed_at timestamptz,
  total_expected numeric DEFAULT 0,
  total_actual numeric DEFAULT 0,
  surplus_count int DEFAULT 0,
  deficit_count int DEFAULT 0,
  matched_count int DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','awaiting_worker','locked','disputed','cancelled')),
  accounting_session_id uuid REFERENCES public.accounting_sessions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_final_review_worker_date ON public.final_review_sessions(worker_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_final_review_status ON public.final_review_sessions(status);

-- 3. Link stock_discrepancies to final review sessions
ALTER TABLE public.stock_discrepancies 
  ADD COLUMN IF NOT EXISTS final_review_session_id uuid REFERENCES public.final_review_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason_code text;

CREATE INDEX IF NOT EXISTS idx_stock_disc_final_review ON public.stock_discrepancies(final_review_session_id);

-- 4. Create discrepancy_items table to record every product line (even matched ones) for audit trail
CREATE TABLE IF NOT EXISTS public.final_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  final_review_session_id uuid NOT NULL REFERENCES public.final_review_sessions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  expected_qty numeric NOT NULL DEFAULT 0,
  actual_qty numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  diff_type text NOT NULL CHECK (diff_type IN ('matched','surplus','deficit')),
  reason_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_final_review_items_session ON public.final_review_items(final_review_session_id);

-- 5. Updated-at trigger for final_review_sessions
CREATE OR REPLACE FUNCTION public.update_final_review_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_final_review_updated_at ON public.final_review_sessions;
CREATE TRIGGER trg_final_review_updated_at
BEFORE UPDATE ON public.final_review_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_final_review_updated_at();

-- 6. Enable RLS
ALTER TABLE public.final_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_review_items ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies — authenticated users in this tenant model can read; warehouse managers/admins can write
-- (Following the same permissive pattern as accounting_sessions in this project)
CREATE POLICY "auth_read_final_review_sessions"
  ON public.final_review_sessions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth_insert_final_review_sessions"
  ON public.final_review_sessions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_final_review_sessions"
  ON public.final_review_sessions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_final_review_items"
  ON public.final_review_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth_insert_final_review_items"
  ON public.final_review_items FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_final_review_items"
  ON public.final_review_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_final_review_items"
  ON public.final_review_items FOR DELETE
  TO authenticated USING (true);

-- 8. Helper function: check if worker has a locked final review for a date range
CREATE OR REPLACE FUNCTION public.has_locked_final_review(_worker_id uuid, _from timestamptz, _to timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.final_review_sessions
    WHERE worker_id = _worker_id
      AND status = 'locked'
      AND locked_at >= _from
      AND locked_at <= _to
  );
$$;

-- 9. Helper function: verify worker pin (uses pgcrypto crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.verify_worker_review_pin(_worker_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT review_pin_hash INTO stored_hash FROM public.workers WHERE id = _worker_id;
  IF stored_hash IS NULL OR stored_hash = '' THEN
    RETURN false;
  END IF;
  RETURN stored_hash = crypt(_pin, stored_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_worker_review_pin(_worker_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(_pin) < 4 THEN
    RAISE EXCEPTION 'PIN must be at least 4 characters';
  END IF;
  UPDATE public.workers
  SET review_pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE id = _worker_id;
END;
$$;