
-- Split resolutions for a single manager_treasury entry.
-- Each row = one partial settlement line (type + amount + optional party).
CREATE TABLE public.manager_treasury_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id uuid NOT NULL REFERENCES public.manager_treasury(id) ON DELETE CASCADE,
  resolution_type text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  party_type text,                   -- 'customer' | 'worker' | null
  party_id uuid,                     -- customers.id or workers.id
  party_label text,                  -- snapshot name
  linked_debt_id uuid,               -- worker_debts.id when applicable
  customer_credit_id uuid,           -- customer_credits.id when applicable
  status text NOT NULL DEFAULT 'settled', -- settled | under_review | open
  notes text,
  resolved_by uuid,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_treasury_resolutions TO authenticated;
GRANT ALL ON public.manager_treasury_resolutions TO service_role;

ALTER TABLE public.manager_treasury_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read treasury resolutions"
  ON public.manager_treasury_resolutions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth write treasury resolutions"
  ON public.manager_treasury_resolutions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_mtres_treasury ON public.manager_treasury_resolutions(treasury_id);

-- Trigger: keep parent manager_treasury status in sync with sum(splits)
CREATE OR REPLACE FUNCTION public.sync_manager_treasury_from_splits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_treasury_id uuid := COALESCE(NEW.treasury_id, OLD.treasury_id);
  v_target numeric;
  v_sum numeric;
  v_count int;
  v_first_type text;
  v_new_status text;
BEGIN
  SELECT ABS(amount) INTO v_target FROM public.manager_treasury WHERE id = v_treasury_id;
  IF v_target IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(amount),0), COUNT(*)
    INTO v_sum, v_count
    FROM public.manager_treasury_resolutions
    WHERE treasury_id = v_treasury_id;

  IF v_count = 0 THEN
    UPDATE public.manager_treasury
       SET status='open', resolution_type=NULL, resolved_at=NULL
     WHERE id = v_treasury_id;
    RETURN NEW;
  END IF;

  -- pick representative resolution_type (most recent line) for display
  SELECT resolution_type INTO v_first_type
    FROM public.manager_treasury_resolutions
   WHERE treasury_id = v_treasury_id
   ORDER BY created_at DESC LIMIT 1;

  IF v_sum + 0.005 < v_target THEN
    v_new_status := 'open';  -- partial
  ELSE
    -- fully covered → derive aggregate status
    IF EXISTS (SELECT 1 FROM public.manager_treasury_resolutions
                WHERE treasury_id = v_treasury_id AND status='under_review') THEN
      v_new_status := 'under_review';
    ELSIF EXISTS (SELECT 1 FROM public.manager_treasury_resolutions
                   WHERE treasury_id = v_treasury_id
                     AND resolution_type IN ('worker_debt','worker_acknowledged',
                                             'transfer_to_other_employee','split_writeoff_debt')) THEN
      v_new_status := 'transferred_to_debt';
    ELSIF EXISTS (SELECT 1 FROM public.manager_treasury_resolutions
                   WHERE treasury_id = v_treasury_id
                     AND resolution_type IN ('manager_approved_writeoff','tolerance_writeoff','auto_writeoff')) THEN
      v_new_status := 'written_off';
    ELSE
      v_new_status := 'settled';
    END IF;
  END IF;

  UPDATE public.manager_treasury
     SET status = v_new_status,
         resolution_type = v_first_type,
         resolved_at = CASE WHEN v_new_status IN ('open') THEN NULL ELSE now() END
   WHERE id = v_treasury_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_treasury_after_split
AFTER INSERT OR UPDATE OR DELETE ON public.manager_treasury_resolutions
FOR EACH ROW EXECUTE FUNCTION public.sync_manager_treasury_from_splits();
