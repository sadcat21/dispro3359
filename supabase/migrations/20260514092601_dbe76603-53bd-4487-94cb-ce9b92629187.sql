CREATE OR REPLACE FUNCTION public.delete_promo_ledger_entries(p_promo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_current_bp numeric;
  v_current_pieces numeric;
  v_ppb numeric;
  v_new_pieces numeric;
  v_new_bp numeric;
BEGIN
  FOR r IN
    SELECT sm.product_id,
           COALESCE(sm.from_location_id, sm.worker_id) AS worker_id,
           sm.branch_id,
           sm.quantity AS pieces,
           GREATEST(COALESCE(p.pieces_per_box, 1), 1)::numeric AS ppb
    FROM public.stock_movements sm
    JOIN public.products p ON p.id = sm.product_id
    WHERE sm.reference_type = 'promo'
      AND sm.reference_id = p_promo_id
      AND sm.from_location_type = 'worker'
      AND sm.movement_type IN ('promo_sale', 'promo_gift')
      AND sm.quantity IS NOT NULL
      AND sm.quantity > 0
  LOOP
    v_ppb := r.ppb;

    SELECT quantity INTO v_current_bp
    FROM public.worker_stock
    WHERE worker_id = r.worker_id AND product_id = r.product_id
    FOR UPDATE;

    IF v_current_bp IS NULL THEN
      v_current_pieces := 0;
    ELSE
      v_current_bp := ROUND(v_current_bp, 2);
      v_current_pieces := FLOOR(v_current_bp) * v_ppb
                       + ROUND((v_current_bp - FLOOR(v_current_bp)) * 100);
    END IF;

    v_new_pieces := v_current_pieces + r.pieces;
    v_new_bp := FLOOR(v_new_pieces / v_ppb) + (MOD(v_new_pieces::int, v_ppb::int)::numeric / 100.0);

    IF EXISTS (SELECT 1 FROM public.worker_stock WHERE worker_id = r.worker_id AND product_id = r.product_id) THEN
      UPDATE public.worker_stock
      SET quantity = v_new_bp, updated_at = now()
      WHERE worker_id = r.worker_id AND product_id = r.product_id;
    ELSE
      INSERT INTO public.worker_stock (worker_id, product_id, branch_id, quantity, updated_at)
      VALUES (r.worker_id, r.product_id, r.branch_id, v_new_bp, now());
    END IF;
  END LOOP;

  DELETE FROM public.stock_movements
  WHERE reference_type = 'promo' AND reference_id = p_promo_id;
END;
$$;