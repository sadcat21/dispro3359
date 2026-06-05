
CREATE TABLE IF NOT EXISTS public.manager_decision_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  order_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('document','stamp_invoice')),
  decision text NOT NULL CHECK (decision IN ('received','not_received')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, worker_id, order_id, kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_decision_drafts TO authenticated;
GRANT ALL ON public.manager_decision_drafts TO service_role;

ALTER TABLE public.manager_decision_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager can read own drafts"
  ON public.manager_decision_drafts FOR SELECT
  TO authenticated
  USING (manager_id = auth.uid());

CREATE POLICY "Manager can insert own drafts"
  ON public.manager_decision_drafts FOR INSERT
  TO authenticated
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Manager can update own drafts"
  ON public.manager_decision_drafts FOR UPDATE
  TO authenticated
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Manager can delete own drafts"
  ON public.manager_decision_drafts FOR DELETE
  TO authenticated
  USING (manager_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_manager_decision_drafts_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_mdd_updated_at ON public.manager_decision_drafts;
CREATE TRIGGER trg_mdd_updated_at BEFORE UPDATE ON public.manager_decision_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_manager_decision_drafts_updated_at();

CREATE OR REPLACE FUNCTION public.apply_manager_decision_drafts(p_worker_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager uuid := auth.uid();
  v_count integer := 0;
  r record;
  v_existing jsonb;
  v_patch jsonb;
  v_doc_type text;
BEGIN
  IF v_manager IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR r IN
    SELECT * FROM public.manager_decision_drafts
    WHERE manager_id = v_manager AND worker_id = p_worker_id
    ORDER BY created_at
  LOOP
    IF r.kind = 'document' THEN
      IF r.decision = 'received' THEN
        SELECT COALESCE(document_verification, '{}'::jsonb), invoice_payment_method
          INTO v_existing, v_doc_type
          FROM public.orders WHERE id = r.order_id;
        v_patch := COALESCE(v_existing, '{}'::jsonb);
        IF v_doc_type = 'check' THEN
          v_patch := v_patch || jsonb_build_object('check_number', r.payload->>'doc_number', 'check_date', r.payload->>'doc_date');
        ELSIF v_doc_type IN ('transfer','virement') THEN
          v_patch := v_patch || jsonb_build_object('transfer_reference', r.payload->>'doc_number', 'transfer_date', r.payload->>'doc_date');
        ELSE
          v_patch := v_patch || jsonb_build_object('receipt_number', r.payload->>'doc_number', 'receipt_date', r.payload->>'doc_date');
        END IF;

        UPDATE public.orders
          SET document_verification = v_patch,
              invoice_number = COALESCE(NULLIF(r.payload->>'invoice_number',''), invoice_number),
              invoice_sent_at = COALESCE((NULLIF(r.payload->>'invoice_date',''))::timestamptz, invoice_sent_at)
          WHERE id = r.order_id;

        IF NULLIF(r.payload->>'invoice_number','') IS NOT NULL THEN
          PERFORM public.set_manager_invoice_decision(r.order_id, 'received');
        END IF;
      END IF;
      PERFORM public.set_manager_document_decision(r.order_id, r.decision);

    ELSIF r.kind = 'stamp_invoice' THEN
      IF r.decision = 'received' THEN
        PERFORM public.confirm_order_invoice_receipt(
          r.order_id,
          NULLIF(r.payload->>'invoice_number',''),
          (NULLIF(r.payload->>'issue_date',''))::date
        );
      ELSE
        PERFORM public.set_manager_invoice_decision(r.order_id, 'not_received');
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.manager_decision_drafts
    WHERE manager_id = v_manager AND worker_id = p_worker_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_manager_decision_drafts(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_manager_decision_drafts(uuid) TO authenticated;
