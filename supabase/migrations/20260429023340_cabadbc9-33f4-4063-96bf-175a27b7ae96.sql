-- 1. توسيع stock_receipts بمرحلة الموافقة الثانية
ALTER TABLE public.stock_receipts
  ADD COLUMN IF NOT EXISTS assistant_approved_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS assistant_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS branch_approved_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS branch_approved_at timestamptz;

-- 2. توسيع factory_orders بنفس المرحلة
ALTER TABLE public.factory_orders
  ADD COLUMN IF NOT EXISTS branch_approved_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS branch_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS assistant_approved_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS assistant_approved_at timestamptz;

-- 3. توسيع manual_invoice_requests
ALTER TABLE public.manual_invoice_requests
  ADD COLUMN IF NOT EXISTS branch_approved_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS branch_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS assistant_approved_by uuid REFERENCES public.workers(id),
  ADD COLUMN IF NOT EXISTS assistant_approved_at timestamptz;

-- 4. جدول الفواتير المشتركة
CREATE TABLE IF NOT EXISTS public.shared_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  pdf_url text NOT NULL,
  pdf_path text NOT NULL,
  target_branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.workers(id),
  notes text,
  downloaded_at timestamptz,
  downloaded_by uuid REFERENCES public.workers(id),
  printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_invoices_branch ON public.shared_invoices(target_branch_id);
CREATE INDEX IF NOT EXISTS idx_shared_invoices_uploader ON public.shared_invoices(uploaded_by);

ALTER TABLE public.shared_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shared_invoices_select" ON public.shared_invoices;
CREATE POLICY "shared_invoices_select" ON public.shared_invoices
  FOR SELECT
  USING (
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR (
      public.is_branch_admin()
      AND target_branch_id IN (
        SELECT id FROM public.branches WHERE admin_id = public.get_worker_id()
      )
    )
  );

DROP POLICY IF EXISTS "shared_invoices_insert" ON public.shared_invoices;
CREATE POLICY "shared_invoices_insert" ON public.shared_invoices
  FOR INSERT
  WITH CHECK (
    public.is_admin() OR public.has_custom_role('company_manager')
  );

DROP POLICY IF EXISTS "shared_invoices_update" ON public.shared_invoices;
CREATE POLICY "shared_invoices_update" ON public.shared_invoices
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.has_custom_role('company_manager')
    OR (
      public.is_branch_admin()
      AND target_branch_id IN (
        SELECT id FROM public.branches WHERE admin_id = public.get_worker_id()
      )
    )
  );

DROP POLICY IF EXISTS "shared_invoices_delete" ON public.shared_invoices;
CREATE POLICY "shared_invoices_delete" ON public.shared_invoices
  FOR DELETE
  USING (public.is_admin() OR public.has_custom_role('company_manager'));

CREATE TRIGGER set_shared_invoices_updated_at
  BEFORE UPDATE ON public.shared_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Storage bucket للفواتير
INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-invoices', 'shared-invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "shared_invoices_storage_select" ON storage.objects;
CREATE POLICY "shared_invoices_storage_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'shared-invoices'
    AND (
      public.is_admin()
      OR public.has_custom_role('company_manager')
      OR public.is_branch_admin()
    )
  );

DROP POLICY IF EXISTS "shared_invoices_storage_insert" ON storage.objects;
CREATE POLICY "shared_invoices_storage_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'shared-invoices'
    AND (public.is_admin() OR public.has_custom_role('company_manager'))
  );

DROP POLICY IF EXISTS "shared_invoices_storage_delete" ON storage.objects;
CREATE POLICY "shared_invoices_storage_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'shared-invoices'
    AND (public.is_admin() OR public.has_custom_role('company_manager'))
  );