
ALTER TABLE public.product_offers
ADD COLUMN IF NOT EXISTS is_deferred_confirmation boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.pending_offer_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid NULL,
  order_item_id uuid NULL,
  offer_id uuid NULL REFERENCES public.product_offers(id) ON DELETE SET NULL,
  product_id uuid NOT NULL,
  product_name text NULL,
  pieces_per_box integer NOT NULL DEFAULT 1,
  gift_product_id uuid NULL,
  gift_product_name text NULL,
  gift_boxes integer NOT NULL DEFAULT 0,
  gift_pieces integer NOT NULL DEFAULT 0,
  customer_id uuid NULL,
  customer_name text NULL,
  worker_id uuid NULL,
  worker_name text NULL,
  branch_id uuid NULL,
  branch_name text NULL,
  source text NOT NULL DEFAULT 'order',
  status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamptz NULL,
  confirmed_by uuid NULL,
  notes text NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_offer_status ON public.pending_offer_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_pending_offer_customer ON public.pending_offer_confirmations(customer_id);
CREATE INDEX IF NOT EXISTS idx_pending_offer_worker ON public.pending_offer_confirmations(worker_id);
CREATE INDEX IF NOT EXISTS idx_pending_offer_branch ON public.pending_offer_confirmations(branch_id);
CREATE INDEX IF NOT EXISTS idx_pending_offer_created ON public.pending_offer_confirmations(created_at DESC);

ALTER TABLE public.pending_offer_confirmations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_pending_offer_updated_at ON public.pending_offer_confirmations;
CREATE TRIGGER trg_pending_offer_updated_at
BEFORE UPDATE ON public.pending_offer_confirmations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check if current user has any admin-like role
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','branch_admin','supervisor')
  );
$$;

DROP POLICY IF EXISTS "pending_offer_select_auth" ON public.pending_offer_confirmations;
CREATE POLICY "pending_offer_select_auth"
ON public.pending_offer_confirmations FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "pending_offer_insert_auth" ON public.pending_offer_confirmations;
CREATE POLICY "pending_offer_insert_auth"
ON public.pending_offer_confirmations FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pending_offer_update_auth" ON public.pending_offer_confirmations;
CREATE POLICY "pending_offer_update_auth"
ON public.pending_offer_confirmations FOR UPDATE
TO authenticated
USING (worker_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "pending_offer_delete_admin" ON public.pending_offer_confirmations;
CREATE POLICY "pending_offer_delete_admin"
ON public.pending_offer_confirmations FOR DELETE
TO authenticated
USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.confirm_pending_offer(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.pending_offer_confirmations%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.pending_offer_confirmations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending offer not found'; END IF;
  IF rec.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  UPDATE public.pending_offer_confirmations
  SET status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid()
  WHERE id = p_id;

  INSERT INTO public.sales_tracking (
    source, order_id, order_item_id, product_id, product_name,
    pieces_per_box, sold_boxes, sold_pieces, gift_boxes, gift_pieces,
    unit_price, total_price, branch_id, worker_id, customer_id,
    worker_name, customer_name, branch_name, notes
  ) VALUES (
    COALESCE(rec.source, 'order'), rec.order_id, rec.order_item_id,
    COALESCE(rec.gift_product_id, rec.product_id),
    COALESCE(rec.gift_product_name, rec.product_name),
    GREATEST(1, rec.pieces_per_box), 0, 0,
    rec.gift_boxes, rec.gift_pieces,
    0, 0, rec.branch_id, rec.worker_id, rec.customer_id,
    rec.worker_name, rec.customer_name, rec.branch_name,
    COALESCE(rec.notes, '') || ' [confirmed offer gift]'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_pending_offer(p_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pending_offer_confirmations
  SET status = 'rejected',
      confirmed_at = now(),
      confirmed_by = auth.uid(),
      notes = COALESCE(p_notes, notes)
  WHERE id = p_id AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_pending_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pending_offer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
