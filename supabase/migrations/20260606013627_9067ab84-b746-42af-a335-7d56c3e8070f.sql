
CREATE TABLE IF NOT EXISTS public.accounting_session_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.accounting_sessions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('document','stamp_invoice')),
  decision text NOT NULL CHECK (decision IN ('received','not_received')),
  prior_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acc_sess_decisions_session ON public.accounting_session_decisions(session_id);

GRANT SELECT ON public.accounting_session_decisions TO authenticated;
GRANT ALL ON public.accounting_session_decisions TO service_role;
ALTER TABLE public.accounting_session_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read session decisions" ON public.accounting_session_decisions
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.apply_manager_decision_drafts(p_worker_id uuid, p_session_id uuid DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_manager uuid := auth.uid();
  v_count integer := 0;
  r record;
  v_existing jsonb;
  v_patch jsonb;
  v_doc_type text;
  v_prior jsonb;
  o public.orders%ROWTYPE;
BEGIN
  IF v_manager IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR r IN
    SELECT * FROM public.manager_decision_drafts
    WHERE manager_id = v_manager AND worker_id = p_worker_id
    ORDER BY created_at
  LOOP
    SELECT * INTO o FROM public.orders WHERE id = r.order_id;
    v_prior := jsonb_build_object(
      'document_verification', COALESCE(o.document_verification, '{}'::jsonb),
      'invoice_number', o.invoice_number,
      'invoice_sent_at', o.invoice_sent_at,
      'invoice_received_at', o.invoice_received_at,
      'invoice_stage', o.invoice_stage,
      'invoice_manager_decision', o.invoice_manager_decision,
      'document_status', o.document_status,
      'document_stage', o.document_stage,
      'document_manager_decision', o.document_manager_decision
    );

    IF r.kind = 'document' THEN
      IF r.decision = 'received' THEN
        v_existing := COALESCE(o.document_verification, '{}'::jsonb);
        v_doc_type := o.invoice_payment_method;
        v_patch := v_existing;
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

    IF p_session_id IS NOT NULL THEN
      INSERT INTO public.accounting_session_decisions(session_id, order_id, kind, decision, prior_state)
      VALUES (p_session_id, r.order_id, r.kind, r.decision, v_prior);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.manager_decision_drafts
    WHERE manager_id = v_manager AND worker_id = p_worker_id;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revert_accounting_session_decisions(p_session_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  FOR r IN
    SELECT * FROM public.accounting_session_decisions WHERE session_id = p_session_id
    ORDER BY created_at DESC
  LOOP
    UPDATE public.orders SET
      document_verification = COALESCE((r.prior_state->'document_verification'), '{}'::jsonb),
      invoice_number = NULLIF(r.prior_state->>'invoice_number',''),
      invoice_sent_at = NULLIF(r.prior_state->>'invoice_sent_at','')::timestamptz,
      invoice_received_at = NULLIF(r.prior_state->>'invoice_received_at','')::timestamptz,
      invoice_stage = NULLIF(r.prior_state->>'invoice_stage','')::invoice_stage,
      invoice_manager_decision = NULLIF(r.prior_state->>'invoice_manager_decision',''),
      document_status = NULLIF(r.prior_state->>'document_status',''),
      document_stage = NULLIF(r.prior_state->>'document_stage','')::document_stage,
      document_manager_decision = NULLIF(r.prior_state->>'document_manager_decision',''),
      updated_at = now()
    WHERE id = r.order_id;
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.accounting_session_decisions WHERE session_id = p_session_id;
  RETURN v_count;
END;
$function$;
