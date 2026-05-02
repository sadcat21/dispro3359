
-- =========================================================
-- 1) CASH LEDGER
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type text NOT NULL CHECK (account_type IN ('worker_treasury','manager_treasury','branch_safe','customer_account','external','expense_pool')),
  account_id uuid,
  branch_id uuid,
  amount numeric NOT NULL CHECK (amount >= 0),
  signed_amount numeric,
  running_balance numeric,
  movement_type text NOT NULL CHECK (movement_type IN ('collection','payment','deposit','withdrawal','transfer_in','transfer_out','expense','adjustment','debt_payment_in','debt_payment_out','sale_cash')),
  from_account_type text,
  from_account_id uuid,
  to_account_type text,
  to_account_id uuid,
  currency text NOT NULL DEFAULT 'DZD',
  reason text,
  reference_type text,
  reference_id uuid,
  worker_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_account ON public.cash_movements(account_type, account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cash_movements_branch ON public.cash_movements(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cash_movements_ref ON public.cash_movements(reference_type, reference_id);

CREATE OR REPLACE FUNCTION public.compute_cash_running_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_signed numeric; v_prev numeric;
BEGIN
  IF NEW.signed_amount IS NULL THEN
    v_signed := CASE NEW.movement_type
      WHEN 'collection' THEN NEW.amount
      WHEN 'deposit' THEN NEW.amount
      WHEN 'transfer_in' THEN NEW.amount
      WHEN 'debt_payment_in' THEN NEW.amount
      WHEN 'sale_cash' THEN NEW.amount
      WHEN 'payment' THEN -NEW.amount
      WHEN 'withdrawal' THEN -NEW.amount
      WHEN 'transfer_out' THEN -NEW.amount
      WHEN 'expense' THEN -NEW.amount
      WHEN 'debt_payment_out' THEN -NEW.amount
      WHEN 'adjustment' THEN NEW.amount
      ELSE NEW.amount END;
    NEW.signed_amount := v_signed;
  ELSE v_signed := NEW.signed_amount; END IF;

  IF NEW.account_type IS NOT NULL AND NEW.account_id IS NOT NULL THEN
    SELECT COALESCE(running_balance, 0) INTO v_prev
    FROM public.cash_movements
    WHERE account_type = NEW.account_type AND account_id = NEW.account_id
      AND (created_at < NEW.created_at OR (created_at = NEW.created_at AND id < NEW.id))
      AND running_balance IS NOT NULL
    ORDER BY created_at DESC, id DESC LIMIT 1;
    NEW.running_balance := COALESCE(v_prev, 0) + v_signed;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cash_movements_running_balance ON public.cash_movements;
CREATE TRIGGER trg_cash_movements_running_balance
BEFORE INSERT ON public.cash_movements
FOR EACH ROW EXECUTE FUNCTION public.compute_cash_running_balance();

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view all cash movements" ON public.cash_movements;
CREATE POLICY "Admins and managers can view all cash movements"
ON public.cash_movements FOR SELECT TO authenticated
USING (
  public.is_admin() OR public.has_custom_role('company_manager')
  OR public.has_custom_role('warehouse_manager') OR public.has_custom_role('accountant')
  OR public.is_branch_admin()
);

DROP POLICY IF EXISTS "Workers can view their own cash movements" ON public.cash_movements;
CREATE POLICY "Workers can view their own cash movements"
ON public.cash_movements FOR SELECT TO authenticated
USING (worker_id = public.get_worker_id() OR account_id = public.get_worker_id());

-- =========================================================
-- 2) DEBT LEDGER
-- =========================================================
CREATE TABLE IF NOT EXISTS public.debt_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_type text NOT NULL CHECK (debtor_type IN ('customer','worker')),
  debtor_id uuid NOT NULL,
  debt_id uuid,
  branch_id uuid,
  worker_id uuid,
  amount numeric NOT NULL CHECK (amount >= 0),
  signed_amount numeric,
  running_debt_balance numeric,
  movement_type text NOT NULL CHECK (movement_type IN ('debt_created','partial_payment','full_payment','debt_writeoff','debt_adjustment','interest','discount','debt_increase')),
  payment_method text,
  reason text,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_movements_debtor ON public.debt_movements(debtor_type, debtor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_debt_movements_debt ON public.debt_movements(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_movements_ref ON public.debt_movements(reference_type, reference_id);

CREATE OR REPLACE FUNCTION public.compute_debt_running_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_signed numeric; v_prev numeric;
BEGIN
  IF NEW.signed_amount IS NULL THEN
    v_signed := CASE NEW.movement_type
      WHEN 'debt_created' THEN NEW.amount
      WHEN 'debt_increase' THEN NEW.amount
      WHEN 'interest' THEN NEW.amount
      WHEN 'partial_payment' THEN -NEW.amount
      WHEN 'full_payment' THEN -NEW.amount
      WHEN 'debt_writeoff' THEN -NEW.amount
      WHEN 'discount' THEN -NEW.amount
      WHEN 'debt_adjustment' THEN NEW.amount
      ELSE NEW.amount END;
    NEW.signed_amount := v_signed;
  ELSE v_signed := NEW.signed_amount; END IF;

  SELECT COALESCE(running_debt_balance, 0) INTO v_prev
  FROM public.debt_movements
  WHERE debtor_type = NEW.debtor_type AND debtor_id = NEW.debtor_id
    AND (created_at < NEW.created_at OR (created_at = NEW.created_at AND id < NEW.id))
    AND running_debt_balance IS NOT NULL
  ORDER BY created_at DESC, id DESC LIMIT 1;

  NEW.running_debt_balance := GREATEST(COALESCE(v_prev, 0) + v_signed, 0);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_debt_movements_running_balance ON public.debt_movements;
CREATE TRIGGER trg_debt_movements_running_balance
BEFORE INSERT ON public.debt_movements
FOR EACH ROW EXECUTE FUNCTION public.compute_debt_running_balance();

ALTER TABLE public.debt_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view all debt movements" ON public.debt_movements;
CREATE POLICY "Admins and managers can view all debt movements"
ON public.debt_movements FOR SELECT TO authenticated
USING (
  public.is_admin() OR public.has_custom_role('company_manager')
  OR public.has_custom_role('accountant') OR public.is_branch_admin()
);

DROP POLICY IF EXISTS "Workers can view debt movements they created" ON public.debt_movements;
CREATE POLICY "Workers can view debt movements they created"
ON public.debt_movements FOR SELECT TO authenticated
USING (worker_id = public.get_worker_id());

-- =========================================================
-- 3) ATOMIC FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.record_cash_collection_atomic(
  p_account_type text, p_account_id uuid, p_amount numeric,
  p_branch_id uuid DEFAULT NULL, p_from_account_type text DEFAULT 'customer_account',
  p_from_account_id uuid DEFAULT NULL, p_reason text DEFAULT 'collection',
  p_reference_type text DEFAULT NULL, p_reference_id uuid DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO public.cash_movements
    (account_type, account_id, branch_id, amount, movement_type,
     from_account_type, from_account_id, to_account_type, to_account_id,
     reason, reference_type, reference_id, worker_id, notes, created_by)
  VALUES
    (p_account_type, p_account_id, p_branch_id, p_amount, 'collection',
     p_from_account_type, p_from_account_id, p_account_type, p_account_id,
     p_reason, p_reference_type, p_reference_id, v_actor, p_notes, v_actor);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.transfer_cash_atomic(
  p_from_account_type text, p_from_account_id uuid,
  p_to_account_type text, p_to_account_id uuid,
  p_amount numeric, p_branch_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'cash_transfer', p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO public.cash_movements
    (account_type, account_id, branch_id, amount, movement_type,
     from_account_type, from_account_id, to_account_type, to_account_id,
     reason, worker_id, notes, created_by)
  VALUES
    (p_from_account_type, p_from_account_id, p_branch_id, p_amount, 'transfer_out',
     p_from_account_type, p_from_account_id, p_to_account_type, p_to_account_id,
     p_reason, v_actor, p_notes, v_actor);
  INSERT INTO public.cash_movements
    (account_type, account_id, branch_id, amount, movement_type,
     from_account_type, from_account_id, to_account_type, to_account_id,
     reason, worker_id, notes, created_by)
  VALUES
    (p_to_account_type, p_to_account_id, p_branch_id, p_amount, 'transfer_in',
     p_from_account_type, p_from_account_id, p_to_account_type, p_to_account_id,
     p_reason, v_actor, p_notes, v_actor);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.record_expense_atomic(
  p_account_type text, p_account_id uuid, p_amount numeric,
  p_branch_id uuid DEFAULT NULL, p_reason text DEFAULT 'expense',
  p_reference_id uuid DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO public.cash_movements
    (account_type, account_id, branch_id, amount, movement_type,
     from_account_type, from_account_id, to_account_type, to_account_id,
     reason, reference_type, reference_id, worker_id, notes, created_by)
  VALUES
    (p_account_type, p_account_id, p_branch_id, p_amount, 'expense',
     p_account_type, p_account_id, 'expense_pool', NULL,
     p_reason, 'expense', p_reference_id, v_actor, p_notes, v_actor);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.record_debt_creation_atomic(
  p_debtor_type text, p_debtor_id uuid, p_debt_id uuid,
  p_amount numeric, p_branch_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'order_debt', p_reference_type text DEFAULT 'order',
  p_reference_id uuid DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO public.debt_movements
    (debtor_type, debtor_id, debt_id, branch_id, worker_id, amount,
     movement_type, reason, reference_type, reference_id, notes, created_by)
  VALUES
    (p_debtor_type, p_debtor_id, p_debt_id, p_branch_id, v_actor, p_amount,
     'debt_created', p_reason, p_reference_type, p_reference_id, p_notes, v_actor);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.record_debt_payment_atomic(
  p_debtor_type text, p_debtor_id uuid, p_debt_id uuid,
  p_amount numeric, p_payment_method text DEFAULT 'cash',
  p_branch_id uuid DEFAULT NULL, p_is_full boolean DEFAULT false,
  p_reference_id uuid DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO public.debt_movements
    (debtor_type, debtor_id, debt_id, branch_id, worker_id, amount,
     movement_type, payment_method, reason, reference_type, reference_id, notes, created_by)
  VALUES
    (p_debtor_type, p_debtor_id, p_debt_id, p_branch_id, v_actor, p_amount,
     CASE WHEN p_is_full THEN 'full_payment' ELSE 'partial_payment' END,
     p_payment_method, 'debt_payment', 'debt_collection', p_reference_id, p_notes, v_actor);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.record_debt_writeoff_atomic(
  p_debtor_type text, p_debtor_id uuid, p_debt_id uuid,
  p_amount numeric, p_reason text DEFAULT 'writeoff', p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL OR NOT (public.is_admin() OR public.has_custom_role('company_manager')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO public.debt_movements
    (debtor_type, debtor_id, debt_id, worker_id, amount,
     movement_type, reason, notes, created_by)
  VALUES
    (p_debtor_type, p_debtor_id, p_debt_id, v_actor, p_amount,
     'debt_writeoff', p_reason, p_notes, v_actor);
  RETURN jsonb_build_object('ok', true);
END; $$;

-- =========================================================
-- 4) BACKFILL — DEBT
-- =========================================================
INSERT INTO public.debt_movements
  (debtor_type, debtor_id, debt_id, branch_id, worker_id, amount,
   movement_type, reason, reference_type, reference_id, notes, created_by, created_at)
SELECT 'customer', cd.customer_id, cd.id, cd.branch_id, cd.worker_id, COALESCE(cd.total_amount, 0),
  'debt_created', 'historical_backfill', 'order', cd.order_id,
  'Backfill from customer_debts', cd.worker_id, cd.created_at
FROM public.customer_debts cd
WHERE COALESCE(cd.total_amount, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.debt_movements dm WHERE dm.debt_id = cd.id AND dm.movement_type = 'debt_created');

INSERT INTO public.debt_movements
  (debtor_type, debtor_id, debt_id, branch_id, worker_id, amount,
   movement_type, payment_method, reason, reference_type, reference_id, notes, created_by, created_at)
SELECT 'customer', cd.customer_id, dc.debt_id, cd.branch_id, dc.worker_id, COALESCE(dc.amount_collected, 0),
  'partial_payment', dc.payment_method, 'historical_backfill', 'debt_collection', dc.id,
  'Backfill from debt_collections', dc.worker_id, dc.created_at
FROM public.debt_collections dc
JOIN public.customer_debts cd ON cd.id = dc.debt_id
WHERE COALESCE(dc.amount_collected, 0) > 0
  AND COALESCE(dc.status, 'approved') NOT IN ('rejected','cancelled')
  AND NOT EXISTS (SELECT 1 FROM public.debt_movements dm WHERE dm.reference_type='debt_collection' AND dm.reference_id=dc.id);

INSERT INTO public.debt_movements
  (debtor_type, debtor_id, debt_id, worker_id, amount,
   movement_type, reason, reference_type, reference_id, notes, created_by, created_at)
SELECT 'worker', wd.worker_id, wd.id, wd.worker_id, COALESCE(wd.amount, 0),
  'debt_created', 'historical_backfill', 'worker_debt', wd.id,
  'Backfill from worker_debts', wd.worker_id, wd.created_at
FROM public.worker_debts wd
WHERE COALESCE(wd.amount, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.debt_movements dm WHERE dm.reference_type='worker_debt' AND dm.reference_id=wd.id AND dm.movement_type='debt_created');

INSERT INTO public.debt_movements
  (debtor_type, debtor_id, debt_id, worker_id, amount,
   movement_type, payment_method, reason, reference_type, reference_id, notes, created_by, created_at)
SELECT 'worker', wd.worker_id, wdp.worker_debt_id, wdp.collected_by, COALESCE(wdp.amount, 0),
  'partial_payment', wdp.payment_method, 'historical_backfill', 'worker_debt_payment', wdp.id,
  'Backfill from worker_debt_payments', wdp.collected_by, wdp.created_at
FROM public.worker_debt_payments wdp
JOIN public.worker_debts wd ON wd.id = wdp.worker_debt_id
WHERE COALESCE(wdp.amount, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.debt_movements dm WHERE dm.reference_type='worker_debt_payment' AND dm.reference_id=wdp.id);

-- =========================================================
-- 5) BACKFILL — CASH
-- =========================================================
INSERT INTO public.cash_movements
  (account_type, account_id, branch_id, amount, movement_type,
   from_account_type, from_account_id, to_account_type, to_account_id,
   reason, reference_type, reference_id, worker_id, notes, created_by, created_at)
SELECT 'worker_treasury', dc.worker_id, cd.branch_id, COALESCE(dc.amount_collected,0), 'debt_payment_in',
  'customer_account', cd.customer_id, 'worker_treasury', dc.worker_id,
  'historical_backfill', 'debt_collection', dc.id, dc.worker_id,
  'Backfill from debt_collections', dc.worker_id, dc.created_at
FROM public.debt_collections dc
JOIN public.customer_debts cd ON cd.id = dc.debt_id
WHERE COALESCE(dc.amount_collected, 0) > 0
  AND COALESCE(dc.status, 'approved') NOT IN ('rejected','cancelled')
  AND dc.worker_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.cash_movements cm WHERE cm.reference_type='debt_collection' AND cm.reference_id=dc.id);

INSERT INTO public.cash_movements
  (account_type, account_id, branch_id, amount, movement_type,
   from_account_type, from_account_id, to_account_type, to_account_id,
   reason, reference_type, reference_id, worker_id, notes, created_by, created_at)
SELECT 'worker_treasury', e.worker_id, e.branch_id, COALESCE(e.amount,0), 'expense',
  'worker_treasury', e.worker_id, 'expense_pool', NULL,
  COALESCE(LEFT(e.description, 200), 'expense'), 'expense', e.id, e.worker_id,
  'Backfill from expenses', e.worker_id, e.created_at
FROM public.expenses e
WHERE COALESCE(e.amount, 0) > 0
  AND COALESCE(e.status, 'approved') NOT IN ('rejected','cancelled')
  AND e.worker_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.cash_movements cm WHERE cm.reference_type='expense' AND cm.reference_id=e.id);

-- =========================================================
-- 6) RECONCILIATION VIEWS
-- =========================================================
CREATE OR REPLACE VIEW public.v_debt_reconciliation
WITH (security_invoker = true) AS
WITH ledger AS (
  SELECT debtor_type, debtor_id, debt_id, SUM(signed_amount) AS ledger_balance
  FROM public.debt_movements GROUP BY debtor_type, debtor_id, debt_id
)
SELECT 'customer'::text AS debtor_type, cd.customer_id AS debtor_id, cd.id AS debt_id,
  COALESCE(cd.remaining_amount, 0) AS actual_remaining,
  COALESCE(l.ledger_balance, 0) AS ledger_balance,
  COALESCE(l.ledger_balance, 0) - COALESCE(cd.remaining_amount, 0) AS variance
FROM public.customer_debts cd
LEFT JOIN ledger l ON l.debtor_type='customer' AND l.debtor_id=cd.customer_id AND l.debt_id=cd.id
UNION ALL
SELECT 'worker'::text, wd.worker_id, wd.id,
  COALESCE(wd.amount, 0) - COALESCE((SELECT SUM(amount) FROM public.worker_debt_payments WHERE worker_debt_id = wd.id), 0),
  COALESCE(l.ledger_balance, 0),
  COALESCE(l.ledger_balance, 0) - (COALESCE(wd.amount, 0) - COALESCE((SELECT SUM(amount) FROM public.worker_debt_payments WHERE worker_debt_id = wd.id), 0))
FROM public.worker_debts wd
LEFT JOIN ledger l ON l.debtor_type='worker' AND l.debtor_id=wd.worker_id AND l.debt_id=wd.id;

CREATE OR REPLACE VIEW public.v_cash_reconciliation
WITH (security_invoker = true) AS
SELECT account_type, account_id,
  SUM(signed_amount) AS ledger_balance,
  COUNT(*) AS movements_count,
  MAX(created_at) AS last_movement_at
FROM public.cash_movements
GROUP BY account_type, account_id;

GRANT EXECUTE ON FUNCTION public.record_cash_collection_atomic(text, uuid, numeric, uuid, text, uuid, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_cash_atomic(text, uuid, text, uuid, numeric, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_expense_atomic(text, uuid, numeric, uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_creation_atomic(text, uuid, uuid, numeric, uuid, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_payment_atomic(text, uuid, uuid, numeric, text, uuid, boolean, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_debt_writeoff_atomic(text, uuid, uuid, numeric, text, text) TO authenticated;
GRANT SELECT ON public.v_cash_reconciliation TO authenticated;
GRANT SELECT ON public.v_debt_reconciliation TO authenticated;
