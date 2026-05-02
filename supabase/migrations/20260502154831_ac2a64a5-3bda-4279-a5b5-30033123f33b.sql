-- =========================================================
-- Phase 2: Factory Orders workflow + i18n status labels
-- =========================================================

-- 1) Status labels table (i18n + colors + icons)
CREATE TABLE IF NOT EXISTS public.stock_workflow_status_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  status_code text NOT NULL,
  locale text NOT NULL DEFAULT 'ar',
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'in_progress',
  color text NOT NULL DEFAULT 'muted',
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, status_code, locale)
);

CREATE INDEX IF NOT EXISTS idx_swsl_lookup
  ON public.stock_workflow_status_labels(document_type, locale, is_active);

DROP TRIGGER IF EXISTS trg_swsl_updated_at ON public.stock_workflow_status_labels;
CREATE TRIGGER trg_swsl_updated_at
BEFORE UPDATE ON public.stock_workflow_status_labels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stock_workflow_status_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "swsl_select_all" ON public.stock_workflow_status_labels;
CREATE POLICY "swsl_select_all"
ON public.stock_workflow_status_labels
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "swsl_admin_manage" ON public.stock_workflow_status_labels;
CREATE POLICY "swsl_admin_manage"
ON public.stock_workflow_status_labels
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2) Seed labels (Arabic)
INSERT INTO public.stock_workflow_status_labels
  (document_type, status_code, locale, label, description, category, color, icon, sort_order)
VALUES
('factory_order','draft','ar','مسودة','طلب لم يُرسل بعد','draft','muted','FileEdit',10),
('factory_order','pending_branch_manager','ar','بانتظار موافقة مدير الفرع',null,'pending_approval','warning','Clock',20),
('factory_order','pending_assistant_gm','ar','بانتظار موافقة مساعد المدير العام',null,'pending_approval','warning','UserCheck',30),
('factory_order','pending_system_manager','ar','بانتظار اعتماد مدير النظام',null,'pending_approval','warning','ShieldCheck',40),
('factory_order','approved','ar','معتمد','تم اعتماد الطلب','approved','success','CheckCircle2',50),
('factory_order','rejected','ar','مرفوض',null,'rejected','destructive','XCircle',60),
('factory_order','in_production','ar','قيد التصنيع',null,'in_progress','info','Factory',70),
('factory_order','ready_for_delivery','ar','جاهز للتسليم',null,'in_progress','info','PackageCheck',80),
('factory_order','delivered','ar','تم التسليم',null,'in_progress','info','Truck',90),
('factory_order','closed','ar','مُقفل',null,'terminal','muted','Lock',100),
('factory_order','cancelled','ar','مُلغى',null,'cancelled','muted','Ban',110),
('stock_receipt','draft','ar','مسودة',null,'draft','muted','FileEdit',10),
('stock_receipt','received_pending_count','ar','مُستلم بانتظار العد',null,'in_progress','info','PackageOpen',20),
('stock_receipt','counted','ar','تم العد',null,'in_progress','info','Calculator',30),
('stock_receipt','pending_branch_manager','ar','بانتظار موافقة مدير الفرع',null,'pending_approval','warning','Clock',40),
('stock_receipt','has_discrepancy','ar','يوجد فروقات',null,'in_progress','warning','AlertTriangle',50),
('stock_receipt','pending_assistant','ar','بانتظار موافقة مساعد المدير العام',null,'pending_approval','warning','UserCheck',60),
('stock_receipt','rejected','ar','مرفوض',null,'rejected','destructive','XCircle',70),
('stock_receipt','approved','ar','معتمد',null,'approved','success','CheckCircle2',80),
('stock_receipt','posted_to_stock','ar','تم الترحيل للمخزون',null,'terminal','success','Database',90),
('stock_receipt','returned_to_factory','ar','مُرجع للمصنع',null,'terminal','muted','Undo2',100),
('worker_load_request','draft','ar','مسودة',null,'draft','muted','FileEdit',10),
('worker_load_request','submitted','ar','تم الإرسال',null,'in_progress','info','Send',20),
('worker_load_request','pending_branch_manager','ar','بانتظار موافقة مدير الفرع',null,'pending_approval','warning','Clock',30),
('worker_load_request','cancelled','ar','مُلغى',null,'cancelled','muted','Ban',40),
('worker_load_request','approved','ar','معتمد',null,'approved','success','CheckCircle2',50),
('worker_load_request','rejected','ar','مرفوض',null,'rejected','destructive','XCircle',60),
('worker_load_request','loading_in_progress','ar','جاري التحميل',null,'in_progress','info','Loader',70),
('worker_load_request','loaded','ar','تم التحميل',null,'in_progress','info','PackageCheck',80),
('worker_load_request','out_for_delivery','ar','خرج للتوزيع',null,'in_progress','info','Truck',90),
('worker_load_request','completed','ar','مُكتمل',null,'terminal','success','CheckCheck',100),
('worker_load_request','partially_returned','ar','مرتجع جزئي',null,'terminal','warning','RotateCcw',110),
('loading_session','open','ar','مفتوحة',null,'draft','info','DoorOpen',10),
('loading_session','loading','ar','جاري التحميل',null,'in_progress','info','Loader',20),
('loading_session','closed','ar','مُقفلة',null,'in_progress','muted','Lock',30),
('loading_session','pending_verification','ar','بانتظار التحقق',null,'pending_approval','warning','Clock',40),
('loading_session','verified_by_branch_manager','ar','تحقق منها مدير الفرع',null,'in_progress','info','UserCheck',50),
('loading_session','confirmed','ar','مؤكدة',null,'terminal','success','CheckCircle2',60),
('loading_session','disputed','ar','عليها نزاع',null,'rejected','destructive','AlertTriangle',70),
('warehouse_review','draft','ar','مسودة',null,'draft','muted','FileEdit',10),
('warehouse_review','in_progress','ar','جاري الجرد',null,'in_progress','info','Loader',20),
('warehouse_review','counted','ar','اكتمل العد',null,'in_progress','info','Calculator',30),
('warehouse_review','pending_branch_manager','ar','بانتظار موافقة مدير الفرع',null,'pending_approval','warning','Clock',40),
('warehouse_review','pending_assistant_gm','ar','بانتظار موافقة مساعد المدير العام',null,'pending_approval','warning','UserCheck',50),
('warehouse_review','recount_required','ar','مطلوب إعادة عد',null,'in_progress','warning','RefreshCw',60),
('warehouse_review','approved','ar','معتمد',null,'approved','success','CheckCircle2',70),
('warehouse_review','rejected','ar','مرفوض',null,'rejected','destructive','XCircle',80),
('warehouse_review','adjustments_posted','ar','تم ترحيل التسويات',null,'in_progress','info','Database',90),
('warehouse_review','closed','ar','مُقفل',null,'terminal','muted','Lock',100),
('stock_dispute','pending','ar','جديد',null,'pending_approval','warning','AlertCircle',10),
('stock_dispute','under_review_branch_manager','ar','قيد مراجعة مدير الفرع',null,'pending_approval','warning','Eye',20),
('stock_dispute','accepted','ar','مقبول',null,'approved','success','ThumbsUp',30),
('stock_dispute','rejected','ar','مرفوض',null,'rejected','destructive','ThumbsDown',40),
('stock_dispute','escalated_to_assistant_gm','ar','صُعّد لمساعد المدير العام',null,'pending_approval','warning','ArrowUpCircle',50),
('stock_dispute','escalated_to_system_manager','ar','صُعّد لمدير النظام',null,'pending_approval','warning','ArrowUpCircle',60),
('stock_dispute','resolved','ar','تم الحل',null,'in_progress','success','CheckCircle2',70),
('stock_dispute','closed','ar','مُقفل',null,'terminal','muted','Lock',80),
('stock_movement','pending','ar','بانتظار الاعتماد',null,'pending_approval','warning','Clock',10),
('stock_movement','approved','ar','معتمد',null,'approved','success','CheckCircle2',20),
('stock_movement','rejected','ar','مرفوض',null,'rejected','destructive','XCircle',30),
('stock_movement','posted','ar','مُرحّل',null,'terminal','success','Database',40),
('stock_movement','reversed','ar','تم العكس',null,'terminal','muted','Undo2',50)
ON CONFLICT (document_type, status_code, locale) DO NOTHING;

-- English subset
INSERT INTO public.stock_workflow_status_labels
  (document_type, status_code, locale, label, category, color, icon, sort_order)
VALUES
('factory_order','draft','en','Draft','draft','muted','FileEdit',10),
('factory_order','pending_branch_manager','en','Pending Branch Manager','pending_approval','warning','Clock',20),
('factory_order','pending_assistant_gm','en','Pending Assistant GM','pending_approval','warning','UserCheck',30),
('factory_order','pending_system_manager','en','Pending System Manager','pending_approval','warning','ShieldCheck',40),
('factory_order','approved','en','Approved','approved','success','CheckCircle2',50),
('factory_order','rejected','en','Rejected','rejected','destructive','XCircle',60),
('factory_order','in_production','en','In Production','in_progress','info','Factory',70),
('factory_order','ready_for_delivery','en','Ready for Delivery','in_progress','info','PackageCheck',80),
('factory_order','delivered','en','Delivered','in_progress','info','Truck',90),
('factory_order','closed','en','Closed','terminal','muted','Lock',100),
('factory_order','cancelled','en','Cancelled','cancelled','muted','Ban',110)
ON CONFLICT (document_type, status_code, locale) DO NOTHING;

-- 3) factory_orders schema additions
ALTER TABLE public.factory_orders
  ADD COLUMN IF NOT EXISTS system_manager_approved_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS system_manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_stage text,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS in_production_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_for_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS reference_no bigserial;

-- 4) Migrate legacy status values
UPDATE public.factory_orders
SET status = CASE status
  WHEN 'pending'           THEN 'pending_branch_manager'
  WHEN 'pending_approval'  THEN 'pending_branch_manager'
  WHEN 'pending_assistant' THEN 'pending_assistant_gm'
  WHEN 'confirmed'         THEN 'approved'
  ELSE status
END
WHERE status IN ('pending','pending_approval','pending_assistant','confirmed');

-- 5) Approval functions
CREATE OR REPLACE FUNCTION public.submit_factory_order_for_approval(
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid; v_order public.factory_orders%ROWTYPE;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_order FROM public.factory_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'factory_order_not_found'; END IF;
  IF v_order.status NOT IN ('draft') THEN
    RAISE EXCEPTION 'invalid_status_for_submit: %', v_order.status;
  END IF;
  UPDATE public.factory_orders
  SET status = 'pending_branch_manager', updated_at = now()
  WHERE id = p_order_id;
  PERFORM public.record_workflow_transition(
    'factory_order', p_order_id, 'draft', 'pending_branch_manager',
    v_order.branch_id, NULL, NULL, NULL, NULL, '{}'::jsonb, false
  );
  RETURN jsonb_build_object('ok', true, 'next_status', 'pending_branch_manager');
END $$;

CREATE OR REPLACE FUNCTION public.approve_factory_order(
  p_order_id uuid,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid; v_order public.factory_orders%ROWTYPE;
  v_next text; v_check jsonb;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_order FROM public.factory_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'factory_order_not_found'; END IF;
  v_next := CASE v_order.status
    WHEN 'pending_branch_manager' THEN 'pending_assistant_gm'
    WHEN 'pending_assistant_gm'   THEN 'pending_system_manager'
    WHEN 'pending_system_manager' THEN 'approved'
    ELSE NULL END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'cannot_approve_in_current_status: %', v_order.status;
  END IF;
  v_check := public.validate_workflow_transition('factory_order', v_order.status, v_next);
  IF NOT (v_check->>'ok')::boolean THEN
    RAISE EXCEPTION 'approval_denied: %', v_check::text;
  END IF;
  UPDATE public.factory_orders SET
    status = v_next,
    branch_approved_by    = CASE WHEN v_order.status = 'pending_branch_manager' THEN v_actor ELSE branch_approved_by END,
    branch_approved_at    = CASE WHEN v_order.status = 'pending_branch_manager' THEN now()    ELSE branch_approved_at END,
    assistant_approved_by = CASE WHEN v_order.status = 'pending_assistant_gm'   THEN v_actor ELSE assistant_approved_by END,
    assistant_approved_at = CASE WHEN v_order.status = 'pending_assistant_gm'   THEN now()    ELSE assistant_approved_at END,
    system_manager_approved_by = CASE WHEN v_order.status = 'pending_system_manager' THEN v_actor ELSE system_manager_approved_by END,
    system_manager_approved_at = CASE WHEN v_order.status = 'pending_system_manager' THEN now()    ELSE system_manager_approved_at END,
    confirmed_at = CASE WHEN v_next = 'approved' THEN now() ELSE confirmed_at END,
    updated_at = now()
  WHERE id = p_order_id;
  PERFORM public.record_workflow_transition(
    'factory_order', p_order_id, v_order.status, v_next,
    v_order.branch_id, NULL, p_notes, NULL, NULL, '{}'::jsonb, true
  );
  RETURN jsonb_build_object('ok', true, 'previous_status', v_order.status, 'next_status', v_next);
END $$;

CREATE OR REPLACE FUNCTION public.reject_factory_order(
  p_order_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid; v_order public.factory_orders%ROWTYPE; v_check jsonb;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  SELECT * INTO v_order FROM public.factory_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'factory_order_not_found'; END IF;
  IF v_order.status NOT IN ('pending_branch_manager','pending_assistant_gm','pending_system_manager') THEN
    RAISE EXCEPTION 'cannot_reject_in_current_status: %', v_order.status;
  END IF;
  v_check := public.validate_workflow_transition('factory_order', v_order.status, 'rejected');
  IF NOT (v_check->>'ok')::boolean THEN
    RAISE EXCEPTION 'rejection_denied: %', v_check::text;
  END IF;
  UPDATE public.factory_orders SET
    status = 'rejected',
    rejection_stage = v_order.status,
    rejection_note  = p_reason,
    rejected_by     = v_actor,
    rejected_at     = now(),
    updated_at      = now()
  WHERE id = p_order_id;
  PERFORM public.record_workflow_transition(
    'factory_order', p_order_id, v_order.status, 'rejected',
    v_order.branch_id, p_reason, NULL, NULL, NULL, '{}'::jsonb, true
  );
  RETURN jsonb_build_object('ok', true, 'rejected_from', v_order.status);
END $$;

CREATE OR REPLACE FUNCTION public.transition_factory_order_status(
  p_order_id uuid,
  p_to_status text,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid; v_order public.factory_orders%ROWTYPE; v_check jsonb;
BEGIN
  v_actor := public.get_worker_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_order FROM public.factory_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'factory_order_not_found'; END IF;
  v_check := public.validate_workflow_transition('factory_order', v_order.status, p_to_status);
  IF NOT (v_check->>'ok')::boolean THEN
    RAISE EXCEPTION 'transition_denied: %', v_check::text;
  END IF;
  IF (v_check->>'requires_reason')::boolean AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  UPDATE public.factory_orders SET
    status = p_to_status,
    in_production_at      = CASE WHEN p_to_status = 'in_production'      THEN now() ELSE in_production_at END,
    ready_for_delivery_at = CASE WHEN p_to_status = 'ready_for_delivery' THEN now() ELSE ready_for_delivery_at END,
    delivered_at          = CASE WHEN p_to_status = 'delivered'          THEN now() ELSE delivered_at END,
    closed_at             = CASE WHEN p_to_status = 'closed'             THEN now() ELSE closed_at END,
    cancelled_at          = CASE WHEN p_to_status = 'cancelled'          THEN now() ELSE cancelled_at END,
    cancelled_by          = CASE WHEN p_to_status = 'cancelled'          THEN v_actor ELSE cancelled_by END,
    cancellation_reason   = CASE WHEN p_to_status = 'cancelled'          THEN p_reason ELSE cancellation_reason END,
    updated_at = now()
  WHERE id = p_order_id;
  PERFORM public.record_workflow_transition(
    'factory_order', p_order_id, v_order.status, p_to_status,
    v_order.branch_id, p_reason, p_notes, NULL, NULL, '{}'::jsonb, true
  );
  RETURN jsonb_build_object('ok', true, 'previous_status', v_order.status, 'next_status', p_to_status);
END $$;

-- 6) Backfill historical transitions
INSERT INTO public.stock_workflow_transitions
  (document_type, document_id, branch_id, from_status, to_status, performed_by, created_at, metadata)
SELECT
  'factory_order', fo.id, fo.branch_id,
  NULL, 'draft',
  fo.created_by, fo.created_at, jsonb_build_object('backfilled', true)
FROM public.factory_orders fo
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_workflow_transitions t
  WHERE t.document_type = 'factory_order' AND t.document_id = fo.id
);

-- 7) Localized view
CREATE OR REPLACE VIEW public.v_factory_orders_localized AS
SELECT
  fo.*,
  lbl_ar.label       AS status_label_ar,
  lbl_ar.color       AS status_color,
  lbl_ar.icon        AS status_icon,
  lbl_ar.category    AS status_category,
  lbl_en.label       AS status_label_en
FROM public.factory_orders fo
LEFT JOIN public.stock_workflow_status_labels lbl_ar
  ON lbl_ar.document_type = 'factory_order' AND lbl_ar.status_code = fo.status AND lbl_ar.locale = 'ar'
LEFT JOIN public.stock_workflow_status_labels lbl_en
  ON lbl_en.document_type = 'factory_order' AND lbl_en.status_code = fo.status AND lbl_en.locale = 'en';

GRANT SELECT ON public.v_factory_orders_localized TO authenticated;