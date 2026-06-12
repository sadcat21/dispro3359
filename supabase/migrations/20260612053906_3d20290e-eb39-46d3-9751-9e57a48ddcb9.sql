
ALTER TABLE public.manager_treasury
  DROP CONSTRAINT IF EXISTS manager_treasury_resolution_type_check;

ALTER TABLE public.manager_treasury
  ADD CONSTRAINT manager_treasury_resolution_type_check
  CHECK (
    resolution_type IS NULL OR resolution_type = ANY (ARRAY[
      'auto_writeoff','worker_debt','manager_approved_writeoff','investigation',
      'customer_repayment','tolerance_writeoff','split_writeoff_debt',
      'deduct_from_reward','offset_against_return','worker_acknowledged',
      'credit_to_customer','carry_forward','transfer_to_other_employee',
      'peer_cash_handover'
    ])
  );

CREATE TABLE IF NOT EXISTS public.peer_cash_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id uuid NOT NULL REFERENCES public.manager_treasury(id) ON DELETE CASCADE,
  split_id text NOT NULL,
  sender_worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  receiver_worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  response_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_peer_cash_handovers_receiver
  ON public.peer_cash_handovers(receiver_worker_id, status);
CREATE INDEX IF NOT EXISTS idx_peer_cash_handovers_sender
  ON public.peer_cash_handovers(sender_worker_id);
CREATE INDEX IF NOT EXISTS idx_peer_cash_handovers_treasury
  ON public.peer_cash_handovers(treasury_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.peer_cash_handovers TO authenticated;
GRANT ALL ON public.peer_cash_handovers TO service_role;

ALTER TABLE public.peer_cash_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Peer handover read"
ON public.peer_cash_handovers FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR sender_worker_id = public.get_worker_id()
  OR receiver_worker_id = public.get_worker_id()
);

CREATE POLICY "Peer handover insert by admin"
ON public.peer_cash_handovers FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Peer handover update by receiver or admin"
ON public.peer_cash_handovers FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR receiver_worker_id = public.get_worker_id()
)
WITH CHECK (
  public.is_admin()
  OR receiver_worker_id = public.get_worker_id()
);

CREATE POLICY "Peer handover delete by admin"
ON public.peer_cash_handovers FOR DELETE TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.respond_peer_cash_handover(
  p_handover_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
) RETURNS public.peer_cash_handovers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.peer_cash_handovers;
  v_wid uuid := public.get_worker_id();
BEGIN
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  SELECT * INTO v_row FROM public.peer_cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'handover not found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'handover already responded'; END IF;

  IF NOT public.is_admin() AND v_row.receiver_worker_id <> v_wid THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.peer_cash_handovers
     SET status = p_decision,
         response_note = p_note,
         responded_at = now()
   WHERE id = p_handover_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_peer_cash_handover(uuid, text, text) TO authenticated;
