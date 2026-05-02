-- ============================================================
-- 1. توسيع جدول stock_movements ليصبح Ledger حقيقي
-- ============================================================
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS from_location_type text,
  ADD COLUMN IF NOT EXISTS from_location_id uuid,
  ADD COLUMN IF NOT EXISTS to_location_type text,
  ADD COLUMN IF NOT EXISTS to_location_id uuid,
  ADD COLUMN IF NOT EXISTS running_balance numeric,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS signed_quantity numeric;

COMMENT ON COLUMN public.stock_movements.from_location_type IS 'warehouse | worker | customer | supplier | external';
COMMENT ON COLUMN public.stock_movements.to_location_type IS 'warehouse | worker | customer | supplier | external | damaged';
COMMENT ON COLUMN public.stock_movements.running_balance IS 'الرصيد التراكمي للمنتج في المخزن المرجعي بعد هذه الحركة';
COMMENT ON COLUMN public.stock_movements.signed_quantity IS '+ للدخول، - للخروج (بصيغة box.piece)';

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_branch_created
  ON public.stock_movements (product_id, branch_id, created_at);

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
  ON public.stock_movements (reference_type, reference_id);

-- ============================================================
-- 2. حماية على مستوى DB ضد المخزون السالب
-- ============================================================
ALTER TABLE public.warehouse_stock
  DROP CONSTRAINT IF EXISTS warehouse_stock_quantity_non_negative,
  DROP CONSTRAINT IF EXISTS warehouse_stock_damaged_non_negative;

ALTER TABLE public.warehouse_stock
  ADD CONSTRAINT warehouse_stock_quantity_non_negative CHECK (quantity >= 0),
  ADD CONSTRAINT warehouse_stock_damaged_non_negative CHECK (damaged_quantity >= 0);

ALTER TABLE public.worker_stock
  DROP CONSTRAINT IF EXISTS worker_stock_quantity_non_negative;

ALTER TABLE public.worker_stock
  ADD CONSTRAINT worker_stock_quantity_non_negative CHECK (quantity >= 0);

-- ============================================================
-- 3. Trigger لحساب running_balance تلقائيًا
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_movement_running_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signed numeric;
  v_prev_balance numeric;
BEGIN
  IF NEW.signed_quantity IS NULL THEN
    v_signed := CASE NEW.movement_type
      WHEN 'load'            THEN -NEW.quantity
      WHEN 'delivery'        THEN -NEW.quantity
      WHEN 'receipt'         THEN  NEW.quantity
      WHEN 'return'          THEN  NEW.quantity
      WHEN 'transfer_out'    THEN -NEW.quantity
      WHEN 'transfer_in'     THEN  NEW.quantity
      WHEN 'customer_return' THEN  NEW.quantity
      WHEN 'damage'          THEN -NEW.quantity
      WHEN 'exchange'        THEN -NEW.quantity
      WHEN 'adjustment'      THEN  NEW.quantity
      ELSE NEW.quantity
    END;
    NEW.signed_quantity := v_signed;
  ELSE
    v_signed := NEW.signed_quantity;
  END IF;

  IF NEW.branch_id IS NOT NULL AND NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(running_balance, 0) INTO v_prev_balance
    FROM public.stock_movements
    WHERE product_id = NEW.product_id
      AND branch_id = NEW.branch_id
      AND (created_at < NEW.created_at OR (created_at = NEW.created_at AND id < NEW.id))
      AND running_balance IS NOT NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    NEW.running_balance := COALESCE(v_prev_balance, 0) + v_signed;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_running_balance ON public.stock_movements;
CREATE TRIGGER trg_compute_running_balance
BEFORE INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.compute_movement_running_balance();

-- ============================================================
-- 4. Backfill
-- ============================================================
UPDATE public.stock_movements
SET signed_quantity = CASE movement_type
  WHEN 'load'     THEN -quantity
  WHEN 'delivery' THEN -quantity
  WHEN 'receipt'  THEN  quantity
  WHEN 'return'   THEN  quantity
  ELSE quantity
END
WHERE signed_quantity IS NULL;

WITH ordered AS (
  SELECT id,
         SUM(signed_quantity) OVER (
           PARTITION BY product_id, branch_id
           ORDER BY created_at, id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS rb
  FROM public.stock_movements
  WHERE branch_id IS NOT NULL
)
UPDATE public.stock_movements sm
SET running_balance = ordered.rb
FROM ordered
WHERE sm.id = ordered.id;

-- ============================================================
-- 5. RPC: تحويل بين الفروع
-- ============================================================
CREATE OR REPLACE FUNCTION public.transfer_between_branches_atomic(
  p_from_branch uuid,
  p_to_branch uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty numeric;
  v_existing numeric;
  v_count int := 0;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_from_branch = p_to_branch THEN
    RAISE EXCEPTION 'Source and destination branches must differ';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR public.current_worker_manages_branch(p_from_branch)
    OR public.current_worker_manages_branch(p_to_branch)
  ) THEN
    RAISE EXCEPTION 'Not allowed to perform branch transfer';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for product %', v_product_id;
    END IF;

    SELECT quantity INTO v_existing
    FROM public.warehouse_stock
    WHERE branch_id = p_from_branch AND product_id = v_product_id
    FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_existing, 0) < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % in source branch', v_product_id;
    END IF;

    UPDATE public.warehouse_stock
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE branch_id = p_from_branch AND product_id = v_product_id;

    INSERT INTO public.warehouse_stock (branch_id, product_id, quantity, updated_at)
    VALUES (p_to_branch, v_product_id, v_qty, now())
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET quantity = public.warehouse_stock.quantity + v_qty, updated_at = now();

    INSERT INTO public.stock_movements
      (product_id, branch_id, quantity, movement_type, status, created_by,
       from_location_type, from_location_id, to_location_type, to_location_id,
       reason, notes)
    VALUES
      (v_product_id, p_from_branch, v_qty, 'transfer_out', 'approved', v_actor,
       'warehouse', p_from_branch, 'warehouse', p_to_branch,
       'branch_transfer', COALESCE(p_notes, 'تحويل بين الفروع'));

    INSERT INTO public.stock_movements
      (product_id, branch_id, quantity, movement_type, status, created_by,
       from_location_type, from_location_id, to_location_type, to_location_id,
       reason, notes)
    VALUES
      (v_product_id, p_to_branch, v_qty, 'transfer_in', 'approved', v_actor,
       'warehouse', p_from_branch, 'warehouse', p_to_branch,
       'branch_transfer', COALESCE(p_notes, 'تحويل بين الفروع'));

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'items_transferred', v_count);
END;
$$;

-- ============================================================
-- 6. RPC: تسوية جرد
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_stock_adjustment_atomic(
  p_branch_id uuid,
  p_product_id uuid,
  p_delta numeric,
  p_reason text DEFAULT 'inventory_count',
  p_notes text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_existing numeric;
  v_new_qty numeric;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF NOT (
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR public.has_custom_role('warehouse_manager')
    OR public.current_worker_manages_branch(p_branch_id)
  ) THEN
    RAISE EXCEPTION 'Not allowed to adjust stock';
  END IF;

  IF p_delta = 0 THEN RAISE EXCEPTION 'Adjustment delta cannot be zero'; END IF;

  SELECT quantity INTO v_existing
  FROM public.warehouse_stock
  WHERE branch_id = p_branch_id AND product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_delta < 0 THEN RAISE EXCEPTION 'Cannot decrease stock that does not exist'; END IF;
    INSERT INTO public.warehouse_stock (branch_id, product_id, quantity, updated_at)
    VALUES (p_branch_id, p_product_id, p_delta, now());
    v_new_qty := p_delta;
  ELSE
    v_new_qty := COALESCE(v_existing, 0) + p_delta;
    IF v_new_qty < 0 THEN
      RAISE EXCEPTION 'Adjustment would make stock negative (current=%, delta=%)', v_existing, p_delta;
    END IF;
    UPDATE public.warehouse_stock
    SET quantity = v_new_qty, updated_at = now()
    WHERE branch_id = p_branch_id AND product_id = p_product_id;
  END IF;

  INSERT INTO public.stock_movements
    (product_id, branch_id, quantity, signed_quantity, movement_type, status, created_by,
     from_location_type, from_location_id, to_location_type, to_location_id,
     reason, reference_type, reference_id, notes)
  VALUES
    (p_product_id, p_branch_id, ABS(p_delta), p_delta, 'adjustment', 'approved', v_actor,
     CASE WHEN p_delta < 0 THEN 'warehouse' ELSE 'external' END,
     CASE WHEN p_delta < 0 THEN p_branch_id ELSE NULL END,
     CASE WHEN p_delta > 0 THEN 'warehouse' ELSE 'external' END,
     CASE WHEN p_delta > 0 THEN p_branch_id ELSE NULL END,
     p_reason, 'adjustment', p_reference_id,
     COALESCE(p_notes, 'تسوية جرد'));

  RETURN jsonb_build_object('ok', true, 'new_quantity', v_new_qty, 'delta', p_delta);
END;
$$;

-- ============================================================
-- 7. RPC: مرتجع زبون
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_customer_return_atomic(
  p_customer_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_destination text,
  p_destination_id uuid,
  p_branch_id uuid,
  p_reason text DEFAULT 'customer_return',
  p_notes text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  IF p_destination NOT IN ('worker', 'warehouse') THEN
    RAISE EXCEPTION 'destination must be worker or warehouse';
  END IF;

  IF p_destination = 'worker' THEN
    INSERT INTO public.worker_stock (worker_id, product_id, branch_id, quantity, updated_at)
    VALUES (p_destination_id, p_product_id, p_branch_id, p_quantity, now())
    ON CONFLICT (worker_id, product_id)
    DO UPDATE SET quantity = public.worker_stock.quantity + p_quantity, updated_at = now();
  ELSE
    INSERT INTO public.warehouse_stock (branch_id, product_id, quantity, updated_at)
    VALUES (p_destination_id, p_product_id, p_quantity, now())
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET quantity = public.warehouse_stock.quantity + p_quantity, updated_at = now();
  END IF;

  INSERT INTO public.stock_movements
    (product_id, branch_id, quantity, movement_type, status, created_by, worker_id,
     from_location_type, from_location_id, to_location_type, to_location_id,
     reason, reference_type, reference_id, notes)
  VALUES
    (p_product_id, p_branch_id, p_quantity, 'customer_return', 'approved', v_actor,
     CASE WHEN p_destination = 'worker' THEN p_destination_id ELSE NULL END,
     'customer', p_customer_id,
     p_destination, p_destination_id,
     p_reason, 'order', p_reference_id,
     COALESCE(p_notes, 'مرتجع زبون'));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 8. View للمصالحة
-- ============================================================
CREATE OR REPLACE VIEW public.v_stock_reconciliation AS
SELECT
  ws.branch_id,
  b.name AS branch_name,
  ws.product_id,
  p.name AS product_name,
  ws.quantity AS current_stock,
  COALESCE(SUM(sm.signed_quantity), 0) AS computed_from_movements,
  ws.quantity - COALESCE(SUM(sm.signed_quantity), 0) AS variance,
  CASE
    WHEN ABS(ws.quantity - COALESCE(SUM(sm.signed_quantity), 0)) < 0.01 THEN 'OK'
    ELSE 'MISMATCH'
  END AS status,
  COUNT(sm.id) AS movements_count,
  MAX(sm.created_at) AS last_movement_at
FROM public.warehouse_stock ws
LEFT JOIN public.branches b ON b.id = ws.branch_id
LEFT JOIN public.products p ON p.id = ws.product_id
LEFT JOIN public.stock_movements sm
  ON sm.branch_id = ws.branch_id
 AND sm.product_id = ws.product_id
GROUP BY ws.branch_id, b.name, ws.product_id, p.name, ws.quantity;

COMMENT ON VIEW public.v_stock_reconciliation IS 'مصالحة بين المخزون الحالي ومجموع الحركات';

-- ============================================================
-- 9. RPC: إعادة حساب running_balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_running_balance(
  p_product_id uuid,
  p_branch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_count int;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL OR NOT (public.is_admin() OR public.has_custom_role('company_manager')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  WITH ordered AS (
    SELECT id,
           SUM(signed_quantity) OVER (
             ORDER BY created_at, id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS rb
    FROM public.stock_movements
    WHERE product_id = p_product_id AND branch_id = p_branch_id
  )
  UPDATE public.stock_movements sm
  SET running_balance = ordered.rb
  FROM ordered
  WHERE sm.id = ordered.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'rows_updated', v_count);
END;
$$;

-- ============================================================
-- 10. تحديث confirm_loading_session_atomic
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_loading_session_atomic(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_worker_id uuid;
  v_session public.loading_sessions%ROWTYPE;
  v_item RECORD;
  v_warehouse_row RECORD;
  v_worker_row RECORD;
  v_pieces_per_box numeric;
  v_item_qty_rounded numeric;
  v_item_boxes numeric;
  v_item_piece_part numeric;
  v_gift_pieces numeric;
  v_total_load_pieces numeric;
  v_new_warehouse_pieces numeric;
  v_new_worker_pieces numeric;
  v_is_warehouse_manager boolean;
  v_load_qty numeric;
BEGIN
  v_actor_worker_id := public.get_worker_id();
  IF v_actor_worker_id IS NULL THEN RAISE EXCEPTION 'No active worker session'; END IF;

  v_is_warehouse_manager := EXISTS (
    SELECT 1 FROM public.worker_roles wr
    JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
    WHERE wr.worker_id = v_actor_worker_id AND cr.code = 'warehouse_manager'
  );

  IF NOT (
    public.is_admin()
    OR public.is_branch_admin()
    OR public.get_user_role() IN ('warehouse_manager'::public.app_role, 'supervisor'::public.app_role)
    OR v_is_warehouse_manager
    OR v_actor_worker_id = (SELECT worker_id FROM public.loading_sessions WHERE id = p_session_id)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to confirm loading sessions';
  END IF;

  SELECT * INTO v_session FROM public.loading_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loading session not found'; END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true, 'session_id', v_session.id, 'status', v_session.status);
  END IF;

  IF v_session.status NOT IN ('open', 'pending_confirmation') THEN
    RAISE EXCEPTION 'Loading session is not in a confirmable state (current: %)', v_session.status;
  END IF;

  IF v_session.branch_id IS NULL THEN RAISE EXCEPTION 'Loading session branch is missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.loading_session_items WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'Loading session has no items';
  END IF;

  FOR v_item IN
    SELECT lsi.*, p.name AS product_name, COALESCE(p.pieces_per_box, 20) AS pieces_per_box
    FROM public.loading_session_items lsi
    JOIN public.products p ON p.id = lsi.product_id
    WHERE lsi.session_id = p_session_id
    ORDER BY lsi.created_at, lsi.id
  LOOP
    v_pieces_per_box := COALESCE(v_item.pieces_per_box, 20);
    v_item_qty_rounded := ROUND(COALESCE(v_item.quantity, 0)::numeric, 2);
    v_item_boxes := FLOOR(v_item_qty_rounded);
    v_item_piece_part := ROUND((v_item_qty_rounded - v_item_boxes) * 100);

    v_gift_pieces := CASE
      WHEN COALESCE(v_item.gift_unit, 'piece') = 'box'
        THEN COALESCE(v_item.gift_quantity, 0)::numeric * v_pieces_per_box
      ELSE COALESCE(v_item.gift_quantity, 0)::numeric
    END;

    v_total_load_pieces := (v_item_boxes * v_pieces_per_box) + v_item_piece_part + v_gift_pieces;

    SELECT ws.id, ws.quantity,
      (FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box
       + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_warehouse_row
    FROM public.warehouse_stock ws
    WHERE ws.branch_id = v_session.branch_id AND ws.product_id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_warehouse_row.total_pieces < v_total_load_pieces THEN
      RAISE EXCEPTION 'Insufficient warehouse stock for %', COALESCE(v_item.product_name, v_item.product_id::text);
    END IF;

    v_new_warehouse_pieces := v_warehouse_row.total_pieces - v_total_load_pieces;

    UPDATE public.warehouse_stock
    SET quantity = FLOOR(v_new_warehouse_pieces / v_pieces_per_box) + MOD(v_new_warehouse_pieces, v_pieces_per_box) / 100.0,
        updated_at = now()
    WHERE id = v_warehouse_row.id;

    SELECT ws.id, ws.quantity,
      (FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2)) * v_pieces_per_box
       + ROUND((ROUND(COALESCE(ws.quantity, 0)::numeric, 2) - FLOOR(ROUND(COALESCE(ws.quantity, 0)::numeric, 2))) * 100)
      ) AS total_pieces
    INTO v_worker_row
    FROM public.worker_stock ws
    WHERE ws.worker_id = v_session.worker_id AND ws.product_id = v_item.product_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_worker_pieces := v_worker_row.total_pieces + v_total_load_pieces;
      UPDATE public.worker_stock
      SET quantity = FLOOR(v_new_worker_pieces / v_pieces_per_box) + MOD(v_new_worker_pieces, v_pieces_per_box) / 100.0,
          updated_at = now()
      WHERE id = v_worker_row.id;
    ELSE
      INSERT INTO public.worker_stock (worker_id, product_id, branch_id, quantity, updated_at)
      VALUES (v_session.worker_id, v_item.product_id, v_session.branch_id,
        FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0, now());
    END IF;

    v_load_qty := FLOOR(v_total_load_pieces / v_pieces_per_box) + MOD(v_total_load_pieces, v_pieces_per_box) / 100.0;

    INSERT INTO public.stock_movements
      (product_id, branch_id, quantity, movement_type, status, created_by, worker_id, notes,
       from_location_type, from_location_id, to_location_type, to_location_id,
       reason, reference_type, reference_id)
    VALUES
      (v_item.product_id, v_session.branch_id, v_load_qty, 'load', 'approved',
       v_actor_worker_id, v_session.worker_id, 'شحن من جلسة - ' || COALESCE(v_item.product_name, ''),
       'warehouse', v_session.branch_id, 'worker', v_session.worker_id,
       'loading_session', 'loading_session', p_session_id);
  END LOOP;

  UPDATE public.loading_sessions
  SET status = 'completed', completed_at = now()
  WHERE id = p_session_id AND status IN ('open', 'pending_confirmation');

  RETURN jsonb_build_object('ok', true, 'already_processed', false, 'session_id', v_session.id, 'status', 'completed');
END;
$function$;

-- ============================================================
-- 11. صلاحيات تنفيذ
-- ============================================================
GRANT EXECUTE ON FUNCTION public.transfer_between_branches_atomic(uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_adjustment_atomic(uuid, uuid, numeric, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_return_atomic(uuid, uuid, numeric, text, uuid, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_running_balance(uuid, uuid) TO authenticated;
GRANT SELECT ON public.v_stock_reconciliation TO authenticated;