
-- ============================================================
-- Investigation Cases (إحالة للتحقيق) — professional workflow
-- ============================================================

-- 1. Severity / status / decision enums
DO $$ BEGIN
  CREATE TYPE public.investigation_severity AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.investigation_status AS ENUM ('open','in_progress','concluded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.investigation_decision AS ENUM (
    'manager_approved_writeoff',
    'worker_debt',
    'customer_repayment',
    'fraud_confirmed',
    'inconclusive_writeoff'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.investigation_party_type AS ENUM ('worker','driver','cashier','customer','external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.investigation_evidence_kind AS ENUM ('note','file','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Main cases table
CREATE TABLE IF NOT EXISTS public.investigation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number bigint GENERATED ALWAYS AS IDENTITY,
  treasury_id uuid REFERENCES public.manager_treasury(id) ON DELETE SET NULL,
  branch_id uuid,
  title text NOT NULL,
  summary text,
  severity public.investigation_severity NOT NULL DEFAULT 'medium',
  status public.investigation_status NOT NULL DEFAULT 'open',
  investigator_id uuid REFERENCES public.workers(id),
  deadline date,
  opened_by uuid REFERENCES public.workers(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  closed_by uuid REFERENCES public.workers(id),
  closed_at timestamptz,
  decision public.investigation_decision,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_cases_status ON public.investigation_cases(status);
CREATE INDEX IF NOT EXISTS idx_inv_cases_investigator ON public.investigation_cases(investigator_id);
CREATE INDEX IF NOT EXISTS idx_inv_cases_treasury ON public.investigation_cases(treasury_id);

GRANT SELECT, INSERT, UPDATE ON public.investigation_cases TO authenticated;
GRANT ALL ON public.investigation_cases TO service_role;

ALTER TABLE public.investigation_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_cases_select"
  ON public.investigation_cases FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR investigator_id = auth.uid()
    OR opened_by = auth.uid()
  );

CREATE POLICY "inv_cases_insert_admin"
  ON public.investigation_cases FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "inv_cases_update_admin_or_investigator"
  ON public.investigation_cases FOR UPDATE TO authenticated
  USING (public.is_admin() OR investigator_id = auth.uid())
  WITH CHECK (public.is_admin() OR investigator_id = auth.uid());

-- 3. Parties
CREATE TABLE IF NOT EXISTS public.investigation_case_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  party_type public.investigation_party_type NOT NULL,
  party_user_id uuid,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_parties_case ON public.investigation_case_parties(case_id);

GRANT SELECT, INSERT, DELETE ON public.investigation_case_parties TO authenticated;
GRANT ALL ON public.investigation_case_parties TO service_role;

ALTER TABLE public.investigation_case_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_parties_select"
  ON public.investigation_case_parties FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.investigation_cases c
    WHERE c.id = case_id
      AND (public.is_admin() OR c.investigator_id = auth.uid() OR c.opened_by = auth.uid())
  ));

CREATE POLICY "inv_parties_modify_admin"
  ON public.investigation_case_parties FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Evidence timeline
CREATE TABLE IF NOT EXISTS public.investigation_case_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.workers(id),
  kind public.investigation_evidence_kind NOT NULL DEFAULT 'note',
  body text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_evidence_case ON public.investigation_case_evidence(case_id, created_at DESC);

GRANT SELECT, INSERT ON public.investigation_case_evidence TO authenticated;
GRANT ALL ON public.investigation_case_evidence TO service_role;

ALTER TABLE public.investigation_case_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_evidence_select"
  ON public.investigation_case_evidence FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.investigation_cases c
    WHERE c.id = case_id
      AND (public.is_admin() OR c.investigator_id = auth.uid() OR c.opened_by = auth.uid())
  ));

CREATE POLICY "inv_evidence_insert"
  ON public.investigation_case_evidence FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.investigation_cases c
    WHERE c.id = case_id
      AND (public.is_admin() OR c.investigator_id = auth.uid())
  ));

-- 5. Audit log
CREATE TABLE IF NOT EXISTS public.investigation_case_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.workers(id),
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_audit_case ON public.investigation_case_audit(case_id, created_at DESC);

GRANT SELECT, INSERT ON public.investigation_case_audit TO authenticated;
GRANT ALL ON public.investigation_case_audit TO service_role;

ALTER TABLE public.investigation_case_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_audit_select_admin_or_party"
  ON public.investigation_case_audit FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.investigation_cases c
    WHERE c.id = case_id
      AND (public.is_admin() OR c.investigator_id = auth.uid() OR c.opened_by = auth.uid())
  ));

CREATE POLICY "inv_audit_insert_admin"
  ON public.investigation_case_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- 6. Link column on manager_treasury
ALTER TABLE public.manager_treasury
  ADD COLUMN IF NOT EXISTS investigation_case_id uuid REFERENCES public.investigation_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treasury_inv_case ON public.manager_treasury(investigation_case_id);

-- 7. updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_investigation_cases()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_inv_cases ON public.investigation_cases;
CREATE TRIGGER trg_touch_inv_cases
  BEFORE UPDATE ON public.investigation_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_investigation_cases();

-- 8. RPC: open_investigation_case
CREATE OR REPLACE FUNCTION public.open_investigation_case(
  p_treasury_id uuid,
  p_title text,
  p_summary text,
  p_severity public.investigation_severity,
  p_investigator_id uuid,
  p_deadline date,
  p_parties jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id uuid;
  v_branch uuid;
  v_party jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized: admin role required';
  END IF;

  SELECT branch_id INTO v_branch FROM public.manager_treasury WHERE id = p_treasury_id;

  INSERT INTO public.investigation_cases (
    treasury_id, branch_id, title, summary, severity,
    investigator_id, deadline, opened_by, status
  ) VALUES (
    p_treasury_id, v_branch, p_title, p_summary, COALESCE(p_severity,'medium'),
    p_investigator_id, p_deadline, auth.uid(), 'open'
  ) RETURNING id INTO v_case_id;

  IF p_parties IS NOT NULL AND jsonb_array_length(p_parties) > 0 THEN
    FOR v_party IN SELECT * FROM jsonb_array_elements(p_parties) LOOP
      INSERT INTO public.investigation_case_parties (case_id, party_type, party_user_id, label)
      VALUES (
        v_case_id,
        (v_party->>'type')::public.investigation_party_type,
        NULLIF(v_party->>'user_id','')::uuid,
        v_party->>'label'
      );
    END LOOP;
  END IF;

  -- Link treasury entry → case, mark under_review
  IF p_treasury_id IS NOT NULL THEN
    UPDATE public.manager_treasury
      SET investigation_case_id = v_case_id,
          status = 'under_review',
          resolution_type = 'investigation'
      WHERE id = p_treasury_id;
  END IF;

  INSERT INTO public.investigation_case_audit (case_id, actor_id, action, payload)
  VALUES (v_case_id, auth.uid(), 'opened', jsonb_build_object(
    'severity', p_severity, 'investigator_id', p_investigator_id, 'deadline', p_deadline
  ));

  RETURN v_case_id;
END $$;

GRANT EXECUTE ON FUNCTION public.open_investigation_case(uuid,text,text,public.investigation_severity,uuid,date,jsonb) TO authenticated;

-- 9. RPC: add_case_evidence (also allowed to investigator)
CREATE OR REPLACE FUNCTION public.add_case_evidence(
  p_case_id uuid,
  p_kind public.investigation_evidence_kind,
  p_body text,
  p_storage_path text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence_id uuid;
  v_can boolean;
BEGIN
  SELECT (public.is_admin() OR c.investigator_id = auth.uid())
    INTO v_can FROM public.investigation_cases c WHERE c.id = p_case_id;

  IF NOT COALESCE(v_can,false) THEN
    RAISE EXCEPTION 'unauthorized: only admin or assigned investigator can add evidence';
  END IF;

  -- Transition open → in_progress on first evidence by investigator
  UPDATE public.investigation_cases
    SET status = 'in_progress',
        started_at = COALESCE(started_at, now())
    WHERE id = p_case_id AND status = 'open';

  INSERT INTO public.investigation_case_evidence (case_id, author_id, kind, body, storage_path)
  VALUES (p_case_id, auth.uid(), COALESCE(p_kind,'note'), p_body, p_storage_path)
  RETURNING id INTO v_evidence_id;

  INSERT INTO public.investigation_case_audit (case_id, actor_id, action, payload)
  VALUES (p_case_id, auth.uid(), 'evidence_added', jsonb_build_object(
    'kind', p_kind, 'evidence_id', v_evidence_id
  ));

  RETURN v_evidence_id;
END $$;

GRANT EXECUTE ON FUNCTION public.add_case_evidence(uuid,public.investigation_evidence_kind,text,text) TO authenticated;

-- 10. RPC: close_investigation_case — applies final decision to treasury
CREATE OR REPLACE FUNCTION public.close_investigation_case(
  p_case_id uuid,
  p_decision public.investigation_decision,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.investigation_cases%ROWTYPE;
  v_treasury_status text;
  v_resolution_type text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'unauthorized: only admin can close a case';
  END IF;

  SELECT * INTO v_case FROM public.investigation_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'case not found';
  END IF;
  IF v_case.status = 'concluded' THEN
    RAISE EXCEPTION 'case already concluded';
  END IF;

  -- Four-eyes: the closer should not be the opener
  IF v_case.opened_by IS NOT NULL AND v_case.opened_by = auth.uid() THEN
    RAISE EXCEPTION 'four-eyes: case opener cannot close it; another admin must close';
  END IF;

  UPDATE public.investigation_cases
    SET status = 'concluded',
        decision = p_decision,
        decision_notes = p_notes,
        closed_by = auth.uid(),
        closed_at = now()
    WHERE id = p_case_id;

  -- Map decision → treasury status & resolution_type
  v_resolution_type := CASE p_decision
    WHEN 'manager_approved_writeoff' THEN 'manager_approved_writeoff'
    WHEN 'worker_debt'              THEN 'worker_debt'
    WHEN 'customer_repayment'       THEN 'customer_repayment'
    WHEN 'fraud_confirmed'          THEN 'manager_approved_writeoff'
    WHEN 'inconclusive_writeoff'    THEN 'manager_approved_writeoff'
  END;
  v_treasury_status := CASE p_decision
    WHEN 'worker_debt'         THEN 'transferred_to_debt'
    WHEN 'customer_repayment'  THEN 'settled'
    ELSE 'written_off'
  END;

  IF v_case.treasury_id IS NOT NULL THEN
    UPDATE public.manager_treasury
      SET status = v_treasury_status,
          resolution_type = v_resolution_type,
          resolution_notes = COALESCE(p_notes, resolution_notes),
          resolved_by = auth.uid(),
          resolved_at = now()
      WHERE id = v_case.treasury_id;
  END IF;

  INSERT INTO public.investigation_case_audit (case_id, actor_id, action, payload)
  VALUES (p_case_id, auth.uid(), 'concluded', jsonb_build_object(
    'decision', p_decision, 'notes', p_notes
  ));
END $$;

GRANT EXECUTE ON FUNCTION public.close_investigation_case(uuid,public.investigation_decision,text) TO authenticated;
