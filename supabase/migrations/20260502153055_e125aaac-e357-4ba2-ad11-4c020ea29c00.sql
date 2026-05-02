
-- =========================================================
-- Phase 1: Stock Workflow Foundation
-- Adds workflow definitions + transitions log + helper fns
-- Does NOT modify any existing tables or data
-- =========================================================

-- 1) Workflow definitions table
CREATE TABLE IF NOT EXISTS public.stock_workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,            -- factory_order, stock_receipt, worker_load_request, loading_session, warehouse_review, stock_dispute, stock_movement
  from_status text NOT NULL,
  to_status text NOT NULL,
  allowed_roles text[] NOT NULL DEFAULT '{}',          -- e.g. {'admin','branch_admin','company_manager'}
  allowed_custom_role_codes text[] NOT NULL DEFAULT '{}', -- custom_roles.code values (e.g. assistant_gm, system_manager)
  requires_reason boolean NOT NULL DEFAULT false,
  is_terminal boolean NOT NULL DEFAULT false,         -- true if to_status is final
  is_rejection boolean NOT NULL DEFAULT false,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, from_status, to_status)
);

CREATE INDEX IF NOT EXISTS idx_swf_def_doctype ON public.stock_workflow_definitions(document_type, is_active);

-- 2) Workflow transitions log
CREATE TABLE IF NOT EXISTS public.stock_workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  document_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  from_status text,                              -- null on initial creation
  to_status text NOT NULL,
  performed_by uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  performed_role public.app_role,
  performed_custom_role text,
  reason text,
  notes text,
  reference_type text,
  reference_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swf_tr_doc ON public.stock_workflow_transitions(document_type, document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swf_tr_branch ON public.stock_workflow_transitions(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swf_tr_actor ON public.stock_workflow_transitions(performed_by, created_at DESC);

-- 3) Updated_at trigger
DROP TRIGGER IF EXISTS trg_swf_def_updated_at ON public.stock_workflow_definitions;
CREATE TRIGGER trg_swf_def_updated_at
BEFORE UPDATE ON public.stock_workflow_definitions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Validation function
CREATE OR REPLACE FUNCTION public.validate_workflow_transition(
  p_document_type text,
  p_from_status   text,
  p_to_status     text,
  p_actor_role    public.app_role DEFAULT NULL,
  p_actor_worker_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_def RECORD;
  v_actor uuid;
  v_role public.app_role;
  v_role_text text;
  v_allowed boolean := false;
  v_custom_code text;
BEGIN
  v_actor := COALESCE(p_actor_worker_id, public.get_worker_id());
  v_role  := COALESCE(p_actor_role, public.get_user_role());

  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_def
  FROM public.stock_workflow_definitions
  WHERE document_type = p_document_type
    AND from_status = p_from_status
    AND to_status = p_to_status
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'transition_not_defined',
                              'detail', format('%s: %s -> %s', p_document_type, p_from_status, p_to_status));
  END IF;

  v_role_text := v_role::text;

  -- admin always allowed
  IF public.is_admin() THEN
    v_allowed := true;
  ELSIF v_role_text = ANY (v_def.allowed_roles) THEN
    v_allowed := true;
  ELSE
    -- check custom roles
    FOREACH v_custom_code IN ARRAY v_def.allowed_custom_role_codes
    LOOP
      IF public.worker_has_custom_role(v_actor, v_custom_code) THEN
        v_allowed := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_not_allowed',
                              'required_roles', v_def.allowed_roles,
                              'required_custom_roles', v_def.allowed_custom_role_codes);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'requires_reason', v_def.requires_reason,
    'is_terminal', v_def.is_terminal,
    'is_rejection', v_def.is_rejection
  );
END;
$$;

-- 5) Recording function (writes transition row)
CREATE OR REPLACE FUNCTION public.record_workflow_transition(
  p_document_type text,
  p_document_id   uuid,
  p_from_status   text,
  p_to_status     text,
  p_branch_id     uuid DEFAULT NULL,
  p_reason        text DEFAULT NULL,
  p_notes         text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id   uuid DEFAULT NULL,
  p_metadata      jsonb DEFAULT '{}'::jsonb,
  p_skip_validation boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_role  public.app_role;
  v_custom text;
  v_check  jsonb;
  v_id uuid;
BEGIN
  v_actor := public.get_worker_id();
  v_role  := public.get_user_role();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthorized: no worker session';
  END IF;

  IF NOT p_skip_validation AND p_from_status IS NOT NULL THEN
    v_check := public.validate_workflow_transition(p_document_type, p_from_status, p_to_status, v_role, v_actor);
    IF NOT (v_check->>'ok')::boolean THEN
      RAISE EXCEPTION 'workflow_transition_denied: %', v_check::text;
    END IF;
    IF (v_check->>'requires_reason')::boolean AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
      RAISE EXCEPTION 'reason_required for transition % -> %', p_from_status, p_to_status;
    END IF;
  END IF;

  -- Pick first custom role for record (informational)
  SELECT cr.code INTO v_custom
  FROM public.worker_roles wr
  JOIN public.custom_roles cr ON cr.id = wr.custom_role_id
  WHERE wr.worker_id = v_actor
    AND public.is_worker_role_active(wr.is_active, wr.valid_from, wr.valid_until)
  LIMIT 1;

  INSERT INTO public.stock_workflow_transitions (
    document_type, document_id, branch_id,
    from_status, to_status,
    performed_by, performed_role, performed_custom_role,
    reason, notes, reference_type, reference_id, metadata
  ) VALUES (
    p_document_type, p_document_id, p_branch_id,
    p_from_status, p_to_status,
    v_actor, v_role, v_custom,
    p_reason, p_notes, p_reference_type, p_reference_id, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 6) Helper to fetch allowed next statuses for current user
CREATE OR REPLACE FUNCTION public.get_allowed_next_statuses(
  p_document_type text,
  p_from_status text
)
RETURNS TABLE(to_status text, requires_reason boolean, is_terminal boolean, is_rejection boolean, description text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_role  public.app_role;
BEGIN
  v_actor := public.get_worker_id();
  v_role  := public.get_user_role();

  IF v_actor IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.to_status, d.requires_reason, d.is_terminal, d.is_rejection, d.description
  FROM public.stock_workflow_definitions d
  WHERE d.document_type = p_document_type
    AND d.from_status = p_from_status
    AND d.is_active = true
    AND (
      public.is_admin()
      OR v_role::text = ANY (d.allowed_roles)
      OR EXISTS (
        SELECT 1 FROM unnest(d.allowed_custom_role_codes) c
        WHERE public.worker_has_custom_role(v_actor, c)
      )
    )
  ORDER BY d.sort_order, d.to_status;
END;
$$;

-- 7) RLS
ALTER TABLE public.stock_workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_workflow_transitions ENABLE ROW LEVEL SECURITY;

-- Definitions: readable by any authenticated worker, manageable by admin only
DROP POLICY IF EXISTS "swf_def_select" ON public.stock_workflow_definitions;
CREATE POLICY "swf_def_select"
ON public.stock_workflow_definitions
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "swf_def_admin_all" ON public.stock_workflow_definitions;
CREATE POLICY "swf_def_admin_all"
ON public.stock_workflow_definitions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Transitions log: branch-scoped read, no direct writes (use function)
DROP POLICY IF EXISTS "swf_tr_select" ON public.stock_workflow_transitions;
CREATE POLICY "swf_tr_select"
ON public.stock_workflow_transitions
FOR SELECT
USING (
  public.is_admin()
  OR public.has_custom_role('company_manager')
  OR public.has_custom_role('assistant_gm')
  OR (branch_id IS NOT NULL AND public.current_worker_manages_branch(branch_id))
  OR performed_by = public.get_worker_id()
);

DROP POLICY IF EXISTS "swf_tr_admin_manage" ON public.stock_workflow_transitions;
CREATE POLICY "swf_tr_admin_manage"
ON public.stock_workflow_transitions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 8) Seed initial workflow definitions
-- Roles convention used here:
--   built-in app_role: admin, branch_admin, company_manager, supervisor, warehouse_manager, accountant, worker
--   custom role codes: assistant_gm, system_manager, warehouse_manager, branch_admin

-- Helper insert
INSERT INTO public.stock_workflow_definitions
  (document_type, from_status, to_status, allowed_roles, allowed_custom_role_codes, requires_reason, is_terminal, is_rejection, description, sort_order)
VALUES
-- ===== factory_orders =====
('factory_order','draft','pending_branch_manager', ARRAY['branch_admin','warehouse_manager','worker'], ARRAY['branch_admin'], false, false, false, 'إرسال طلب المصنع لمدير الفرع', 10),
('factory_order','pending_branch_manager','pending_assistant_gm', ARRAY['branch_admin'], ARRAY['branch_admin'], false, false, false, 'موافقة مدير الفرع وتمرير لمساعد المدير العام', 20),
('factory_order','pending_branch_manager','rejected', ARRAY['branch_admin'], ARRAY['branch_admin'], true, true, true, 'رفض مدير الفرع', 21),
('factory_order','pending_assistant_gm','pending_system_manager', ARRAY['company_manager'], ARRAY['assistant_gm'], false, false, false, 'موافقة مساعد المدير العام', 30),
('factory_order','pending_assistant_gm','rejected', ARRAY['company_manager'], ARRAY['assistant_gm'], true, true, true, 'رفض مساعد المدير العام', 31),
('factory_order','pending_system_manager','approved', ARRAY['admin'], ARRAY['system_manager'], false, false, false, 'الاعتماد النهائي من مدير النظام', 40),
('factory_order','pending_system_manager','rejected', ARRAY['admin'], ARRAY['system_manager'], true, true, true, 'رفض مدير النظام', 41),
('factory_order','approved','in_production', ARRAY['admin','company_manager'], ARRAY['assistant_gm','system_manager'], false, false, false, 'بدء التصنيع', 50),
('factory_order','in_production','ready_for_delivery', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], false, false, false, 'جاهز للتسليم', 60),
('factory_order','ready_for_delivery','delivered', ARRAY['admin','branch_admin','company_manager'], ARRAY['branch_admin','assistant_gm'], false, false, false, 'تم التسليم للفرع', 70),
('factory_order','delivered','closed', ARRAY['admin','branch_admin'], ARRAY['branch_admin'], false, true, false, 'إقفال الطلب', 80),
('factory_order','approved','cancelled', ARRAY['admin','company_manager'], ARRAY['assistant_gm','system_manager'], true, true, false, 'إلغاء بعد الاعتماد', 90),

-- ===== stock_receipt =====
('stock_receipt','draft','received_pending_count', ARRAY['branch_admin','warehouse_manager','worker'], ARRAY['branch_admin','warehouse_manager'], false, false, false, 'استلام البضاعة بانتظار العد', 10),
('stock_receipt','received_pending_count','counted', ARRAY['branch_admin','warehouse_manager'], ARRAY['warehouse_manager'], false, false, false, 'انتهاء العد', 20),
('stock_receipt','counted','pending_branch_manager', ARRAY['branch_admin','warehouse_manager'], ARRAY['warehouse_manager'], false, false, false, 'إرسال للموافقة', 30),
('stock_receipt','pending_branch_manager','pending_assistant', ARRAY['branch_admin'], ARRAY['branch_admin'], false, false, false, 'موافقة مدير الفرع', 40),
('stock_receipt','pending_branch_manager','rejected', ARRAY['branch_admin'], ARRAY['branch_admin'], true, true, true, 'رفض مدير الفرع', 41),
('stock_receipt','pending_assistant','approved', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], false, false, false, 'اعتماد نهائي وترحيل للمخزون', 50),
('stock_receipt','pending_assistant','rejected', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], true, true, true, 'رفض المساعد', 51),
('stock_receipt','approved','posted_to_stock', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], false, true, false, 'تم ترحيلها لرصيد المخزون', 60),
('stock_receipt','counted','has_discrepancy', ARRAY['branch_admin','warehouse_manager'], ARRAY['warehouse_manager','branch_admin'], true, false, false, 'وجود فروقات تستدعي مراجعة', 70),
('stock_receipt','rejected','returned_to_factory', ARRAY['branch_admin','admin'], ARRAY['branch_admin','assistant_gm'], false, true, false, 'إرجاع للمصنع', 80),

-- ===== worker_load_request =====
('worker_load_request','draft','submitted', ARRAY['worker','warehouse_manager'], ARRAY[]::text[], false, false, false, 'إرسال الطلب', 10),
('worker_load_request','submitted','pending_branch_manager', ARRAY['warehouse_manager','branch_admin'], ARRAY['warehouse_manager','branch_admin'], false, false, false, 'تمرير لمدير الفرع', 20),
('worker_load_request','pending_branch_manager','approved', ARRAY['branch_admin'], ARRAY['branch_admin'], false, false, false, 'موافقة على التحميل', 30),
('worker_load_request','pending_branch_manager','rejected', ARRAY['branch_admin'], ARRAY['branch_admin'], true, true, true, 'رفض التحميل', 31),
('worker_load_request','approved','loading_in_progress', ARRAY['warehouse_manager','worker'], ARRAY['warehouse_manager'], false, false, false, 'بدء التحميل', 40),
('worker_load_request','loading_in_progress','loaded', ARRAY['warehouse_manager'], ARRAY['warehouse_manager'], false, false, false, 'انتهاء التحميل', 50),
('worker_load_request','loaded','out_for_delivery', ARRAY['worker'], ARRAY[]::text[], false, false, false, 'خروج للتوزيع', 60),
('worker_load_request','out_for_delivery','completed', ARRAY['worker','warehouse_manager','branch_admin'], ARRAY['warehouse_manager'], false, true, false, 'إكمال', 70),
('worker_load_request','out_for_delivery','partially_returned', ARRAY['worker','warehouse_manager'], ARRAY['warehouse_manager'], true, false, false, 'مرتجع جزئي', 71),
('worker_load_request','submitted','cancelled', ARRAY['worker','branch_admin'], ARRAY['branch_admin'], true, true, false, 'إلغاء قبل الموافقة', 80),

-- ===== loading_session =====
('loading_session','open','loading', ARRAY['warehouse_manager','worker'], ARRAY['warehouse_manager'], false, false, false, 'بدء التحميل', 10),
('loading_session','loading','closed', ARRAY['warehouse_manager','branch_admin'], ARRAY['warehouse_manager'], false, false, false, 'إقفال الجلسة', 20),
('loading_session','closed','pending_verification', ARRAY['warehouse_manager','branch_admin'], ARRAY['warehouse_manager','branch_admin'], false, false, false, 'بانتظار تحقق مدير الفرع', 30),
('loading_session','pending_verification','verified_by_branch_manager', ARRAY['branch_admin'], ARRAY['branch_admin'], false, false, false, 'تحقق مدير الفرع', 40),
('loading_session','verified_by_branch_manager','confirmed', ARRAY['admin','branch_admin','company_manager'], ARRAY['branch_admin','assistant_gm'], false, true, false, 'تأكيد نهائي', 50),
('loading_session','pending_verification','disputed', ARRAY['branch_admin'], ARRAY['branch_admin'], true, false, false, 'فتح نزاع', 60),

-- ===== warehouse_review (سيشن الجرد) =====
('warehouse_review','draft','in_progress', ARRAY['warehouse_manager','branch_admin'], ARRAY['warehouse_manager','branch_admin'], false, false, false, 'بدء الجرد', 10),
('warehouse_review','in_progress','counted', ARRAY['warehouse_manager','branch_admin'], ARRAY['warehouse_manager'], false, false, false, 'انتهاء العد', 20),
('warehouse_review','counted','pending_branch_manager', ARRAY['warehouse_manager','branch_admin'], ARRAY['warehouse_manager'], false, false, false, 'إرسال للموافقة', 30),
('warehouse_review','pending_branch_manager','pending_assistant_gm', ARRAY['branch_admin'], ARRAY['branch_admin'], false, false, false, 'تمرير لمساعد المدير العام', 40),
('warehouse_review','pending_branch_manager','recount_required', ARRAY['branch_admin'], ARRAY['branch_admin'], true, false, false, 'طلب إعادة عد', 41),
('warehouse_review','pending_assistant_gm','approved', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], false, false, false, 'اعتماد التسويات', 50),
('warehouse_review','pending_assistant_gm','rejected', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], true, true, true, 'رفض', 51),
('warehouse_review','approved','adjustments_posted', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], false, false, false, 'ترحيل التسويات', 60),
('warehouse_review','adjustments_posted','closed', ARRAY['admin','branch_admin','company_manager'], ARRAY['branch_admin','assistant_gm'], false, true, false, 'إقفال', 70),
('warehouse_review','recount_required','in_progress', ARRAY['warehouse_manager','branch_admin'], ARRAY['warehouse_manager','branch_admin'], false, false, false, 'إعادة بدء الجرد', 80),

-- ===== stock_dispute =====
('stock_dispute','pending','under_review_branch_manager', ARRAY['branch_admin'], ARRAY['branch_admin'], false, false, false, 'بدء مراجعة مدير الفرع', 10),
('stock_dispute','under_review_branch_manager','accepted', ARRAY['branch_admin'], ARRAY['branch_admin'], false, false, false, 'قبول مدير الفرع', 20),
('stock_dispute','under_review_branch_manager','rejected', ARRAY['branch_admin'], ARRAY['branch_admin'], true, true, true, 'رفض مدير الفرع', 21),
('stock_dispute','under_review_branch_manager','escalated_to_assistant_gm', ARRAY['branch_admin'], ARRAY['branch_admin'], true, false, false, 'تصعيد لمساعد المدير العام', 22),
('stock_dispute','escalated_to_assistant_gm','accepted', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], false, false, false, 'قبول المساعد', 30),
('stock_dispute','escalated_to_assistant_gm','rejected', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], true, true, true, 'رفض المساعد', 31),
('stock_dispute','escalated_to_assistant_gm','escalated_to_system_manager', ARRAY['admin','company_manager'], ARRAY['assistant_gm'], true, false, false, 'تصعيد لمدير النظام', 32),
('stock_dispute','escalated_to_system_manager','accepted', ARRAY['admin'], ARRAY['system_manager'], false, false, false, 'قبول مدير النظام', 40),
('stock_dispute','escalated_to_system_manager','rejected', ARRAY['admin'], ARRAY['system_manager'], true, true, true, 'رفض نهائي', 41),
('stock_dispute','accepted','resolved', ARRAY['admin','branch_admin','company_manager'], ARRAY['branch_admin','assistant_gm','system_manager'], false, false, false, 'تنفيذ الحل', 50),
('stock_dispute','resolved','closed', ARRAY['admin','branch_admin','company_manager'], ARRAY['branch_admin','assistant_gm','system_manager'], false, true, false, 'إقفال', 60),

-- ===== stock_movement =====
('stock_movement','pending','approved', ARRAY['admin','company_manager','branch_admin'], ARRAY['assistant_gm','system_manager','branch_admin'], false, false, false, 'اعتماد حركة مخزون يدوية', 10),
('stock_movement','pending','rejected', ARRAY['admin','company_manager','branch_admin'], ARRAY['assistant_gm','system_manager','branch_admin'], true, true, true, 'رفض الحركة', 11),
('stock_movement','approved','posted', ARRAY['admin','company_manager'], ARRAY['assistant_gm','system_manager'], false, true, false, 'ترحيل نهائي للسجل', 20),
('stock_movement','posted','reversed', ARRAY['admin'], ARRAY['system_manager'], true, true, false, 'عكس بقيد مضاد (مدير النظام فقط)', 30)

ON CONFLICT (document_type, from_status, to_status) DO NOTHING;
