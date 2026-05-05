
CREATE TABLE IF NOT EXISTS public.offer_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES public.product_offers(id) ON DELETE SET NULL,
  offer_tier_id uuid REFERENCES public.product_offer_tiers(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN (
    'warehouse_to_worker','worker_to_customer','shortage','return_to_warehouse','adjustment'
  )),
  sale_quantity numeric NOT NULL DEFAULT 0,
  gift_quantity numeric NOT NULL DEFAULT 0,
  sale_quantity_unit text DEFAULT 'box',
  gift_quantity_unit text DEFAULT 'box',
  signed_sale numeric,
  signed_gift numeric,
  running_sale_balance numeric,
  running_gift_balance numeric,
  reference_type text,
  reference_id uuid,
  source_session_id uuid REFERENCES public.loading_sessions(id) ON DELETE SET NULL,
  promo_id uuid REFERENCES public.promos(id) ON DELETE CASCADE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_ledger_offer ON public.offer_ledger(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_ledger_worker ON public.offer_ledger(worker_id);
CREATE INDEX IF NOT EXISTS idx_offer_ledger_product ON public.offer_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_offer_ledger_customer ON public.offer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_offer_ledger_branch ON public.offer_ledger(branch_id);
CREATE INDEX IF NOT EXISTS idx_offer_ledger_promo ON public.offer_ledger(promo_id);
CREATE INDEX IF NOT EXISTS idx_offer_ledger_created ON public.offer_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_ledger_type ON public.offer_ledger(movement_type);

CREATE OR REPLACE FUNCTION public.compute_offer_ledger_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev_sale numeric; v_prev_gift numeric; v_sign int;
BEGIN
  v_sign := CASE NEW.movement_type
    WHEN 'warehouse_to_worker' THEN  1
    WHEN 'worker_to_customer'  THEN -1
    WHEN 'shortage'            THEN -1
    WHEN 'return_to_warehouse' THEN -1
    WHEN 'adjustment'          THEN  1
    ELSE 1 END;
  IF NEW.signed_sale IS NULL THEN NEW.signed_sale := v_sign * COALESCE(NEW.sale_quantity, 0); END IF;
  IF NEW.signed_gift IS NULL THEN NEW.signed_gift := v_sign * COALESCE(NEW.gift_quantity, 0); END IF;
  IF NEW.worker_id IS NOT NULL AND NEW.product_id IS NOT NULL THEN
    SELECT running_sale_balance, running_gift_balance INTO v_prev_sale, v_prev_gift
    FROM public.offer_ledger
    WHERE worker_id = NEW.worker_id AND product_id = NEW.product_id
      AND COALESCE(offer_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(NEW.offer_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (created_at < NEW.created_at OR (created_at = NEW.created_at AND id < NEW.id))
      AND running_sale_balance IS NOT NULL
    ORDER BY created_at DESC, id DESC LIMIT 1;
    NEW.running_sale_balance := COALESCE(v_prev_sale, 0) + NEW.signed_sale;
    NEW.running_gift_balance := COALESCE(v_prev_gift, 0) + NEW.signed_gift;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_compute_offer_ledger_balance ON public.offer_ledger;
CREATE TRIGGER trg_compute_offer_ledger_balance
BEFORE INSERT ON public.offer_ledger
FOR EACH ROW EXECUTE FUNCTION public.compute_offer_ledger_balance();

CREATE OR REPLACE FUNCTION public.sync_promo_to_offer_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch_id uuid;
BEGIN
  SELECT branch_id INTO v_branch_id FROM public.workers WHERE id = NEW.worker_id;
  INSERT INTO public.offer_ledger (
    offer_id, offer_tier_id, product_id, worker_id, customer_id, branch_id,
    movement_type, sale_quantity, gift_quantity,
    sale_quantity_unit, gift_quantity_unit,
    reference_type, reference_id, promo_id, notes, created_by, created_at
  ) VALUES (
    NEW.offer_id, NEW.offer_tier_id, NEW.product_id, NEW.worker_id, NEW.customer_id, v_branch_id,
    'worker_to_customer',
    COALESCE(NEW.vente_quantity, 0), COALESCE(NEW.gratuite_quantity, 0),
    COALESCE(NEW.sale_quantity_unit, 'box'), COALESCE(NEW.gift_quantity_unit, 'box'),
    'promo', NEW.id, NEW.id, NEW.notes, NEW.worker_id,
    COALESCE(NEW.promo_date, NEW.created_at, now())
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_promo_to_offer_ledger ON public.promos;
CREATE TRIGGER trg_sync_promo_to_offer_ledger
AFTER INSERT ON public.promos
FOR EACH ROW EXECUTE FUNCTION public.sync_promo_to_offer_ledger();

INSERT INTO public.offer_ledger (
  offer_id, offer_tier_id, product_id, worker_id, customer_id, branch_id,
  movement_type, sale_quantity, gift_quantity,
  sale_quantity_unit, gift_quantity_unit,
  reference_type, reference_id, promo_id, notes, created_by, created_at
)
SELECT p.offer_id, p.offer_tier_id, p.product_id, p.worker_id, p.customer_id, w.branch_id,
  'worker_to_customer',
  COALESCE(p.vente_quantity, 0), COALESCE(p.gratuite_quantity, 0),
  COALESCE(p.sale_quantity_unit, 'box'), COALESCE(p.gift_quantity_unit, 'box'),
  'promo', p.id, p.id, p.notes, p.worker_id,
  COALESCE(p.promo_date, p.created_at, now())
FROM public.promos p
LEFT JOIN public.workers w ON w.id = p.worker_id
WHERE NOT EXISTS (SELECT 1 FROM public.offer_ledger ol WHERE ol.promo_id = p.id);

CREATE OR REPLACE FUNCTION public.record_offer_load(
  p_offer_id uuid, p_worker_id uuid, p_product_id uuid,
  p_sale_qty numeric, p_gift_qty numeric DEFAULT 0,
  p_session_id uuid DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_branch uuid; v_id uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT branch_id INTO v_branch FROM public.workers WHERE id = p_worker_id;
  INSERT INTO public.offer_ledger (offer_id, product_id, worker_id, branch_id,
    movement_type, sale_quantity, gift_quantity, reference_type, reference_id, source_session_id, notes, created_by)
  VALUES (p_offer_id, p_product_id, p_worker_id, v_branch,
    'warehouse_to_worker', COALESCE(p_sale_qty,0), COALESCE(p_gift_qty,0),
    CASE WHEN p_session_id IS NULL THEN 'manual' ELSE 'loading_session' END,
    p_session_id, p_session_id, p_notes, v_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_offer_shortage(
  p_offer_id uuid, p_worker_id uuid, p_product_id uuid,
  p_sale_qty numeric, p_gift_qty numeric DEFAULT 0, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_branch uuid; v_id uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT branch_id INTO v_branch FROM public.workers WHERE id = p_worker_id;
  INSERT INTO public.offer_ledger (offer_id, product_id, worker_id, branch_id,
    movement_type, sale_quantity, gift_quantity, reference_type, notes, created_by)
  VALUES (p_offer_id, p_product_id, p_worker_id, v_branch,
    'shortage', COALESCE(p_sale_qty,0), COALESCE(p_gift_qty,0), 'manual', p_notes, v_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_offer_adjustment(
  p_offer_id uuid, p_worker_id uuid, p_product_id uuid,
  p_sale_qty numeric, p_gift_qty numeric DEFAULT 0, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_branch uuid; v_id uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT branch_id INTO v_branch FROM public.workers WHERE id = p_worker_id;
  INSERT INTO public.offer_ledger (offer_id, product_id, worker_id, branch_id,
    movement_type, sale_quantity, gift_quantity, reference_type, notes, created_by)
  VALUES (p_offer_id, p_product_id, p_worker_id, v_branch,
    'adjustment', COALESCE(p_sale_qty,0), COALESCE(p_gift_qty,0), 'manual', p_notes, v_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE VIEW public.v_offer_balances AS
SELECT ol.offer_id, ol.worker_id, ol.product_id, ol.branch_id,
  COALESCE(SUM(CASE WHEN movement_type='warehouse_to_worker' THEN sale_quantity END), 0) AS loaded_sale,
  COALESCE(SUM(CASE WHEN movement_type='warehouse_to_worker' THEN gift_quantity END), 0) AS loaded_gift,
  COALESCE(SUM(CASE WHEN movement_type='worker_to_customer' THEN sale_quantity END), 0)  AS delivered_sale,
  COALESCE(SUM(CASE WHEN movement_type='worker_to_customer' THEN gift_quantity END), 0)  AS delivered_gift,
  COALESCE(SUM(CASE WHEN movement_type='shortage' THEN sale_quantity END), 0)            AS shortage_sale,
  COALESCE(SUM(CASE WHEN movement_type='shortage' THEN gift_quantity END), 0)            AS shortage_gift,
  COALESCE(SUM(CASE WHEN movement_type='return_to_warehouse' THEN sale_quantity END), 0) AS returned_sale,
  COALESCE(SUM(CASE WHEN movement_type='return_to_warehouse' THEN gift_quantity END), 0) AS returned_gift,
  COALESCE(SUM(signed_sale), 0) AS remaining_sale,
  COALESCE(SUM(signed_gift), 0) AS remaining_gift,
  MAX(ol.created_at) AS last_movement_at,
  COUNT(*) AS movements_count
FROM public.offer_ledger ol
GROUP BY ol.offer_id, ol.worker_id, ol.product_id, ol.branch_id;

CREATE OR REPLACE VIEW public.v_offer_ledger_full AS
SELECT ol.*,
  po.name        AS offer_name,
  pr.name        AS product_name,
  pr.pieces_per_box,
  w.full_name    AS worker_name,
  c.name         AS customer_name,
  b.name         AS branch_name
FROM public.offer_ledger ol
LEFT JOIN public.product_offers po ON po.id = ol.offer_id
LEFT JOIN public.products pr       ON pr.id = ol.product_id
LEFT JOIN public.workers w         ON w.id = ol.worker_id
LEFT JOIN public.customers c       ON c.id = ol.customer_id
LEFT JOIN public.branches b        ON b.id = ol.branch_id;

ALTER TABLE public.offer_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_select_admin_or_own" ON public.offer_ledger;
CREATE POLICY "ledger_select_admin_or_own" ON public.offer_ledger FOR SELECT USING (
  public.is_admin() OR public.is_branch_admin()
  OR public.has_custom_role('company_manager') OR public.has_custom_role('warehouse_manager')
  OR worker_id = public.get_worker_id()
  OR (branch_id IS NOT NULL AND public.current_worker_manages_branch(branch_id))
);

DROP POLICY IF EXISTS "ledger_insert_authorized" ON public.offer_ledger;
CREATE POLICY "ledger_insert_authorized" ON public.offer_ledger FOR INSERT WITH CHECK (
  public.is_admin() OR public.is_branch_admin()
  OR public.has_custom_role('company_manager') OR public.has_custom_role('warehouse_manager')
  OR worker_id = public.get_worker_id()
  OR (branch_id IS NOT NULL AND public.current_worker_manages_branch(branch_id))
);

DROP POLICY IF EXISTS "ledger_update_admin" ON public.offer_ledger;
CREATE POLICY "ledger_update_admin" ON public.offer_ledger FOR UPDATE
USING (public.is_admin() OR public.is_branch_admin());

DROP POLICY IF EXISTS "ledger_delete_admin" ON public.offer_ledger;
CREATE POLICY "ledger_delete_admin" ON public.offer_ledger FOR DELETE USING (public.is_admin());
