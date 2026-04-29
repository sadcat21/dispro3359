
-- إضافة أعمدة لرفع ملف الفاتورة
ALTER TABLE public.manual_invoice_requests
  ADD COLUMN IF NOT EXISTS invoice_file_url text,
  ADD COLUMN IF NOT EXISTS invoice_file_name text,
  ADD COLUMN IF NOT EXISTS invoice_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_uploaded_by uuid;

-- إنشاء bucket عام لملفات فواتير الطلبات اليدوية
INSERT INTO storage.buckets (id, name, public)
VALUES ('manual-invoices', 'manual-invoices', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات التخزين: قراءة عامة، رفع للمستخدمين المصادق عليهم
DROP POLICY IF EXISTS "manual_invoices_public_read" ON storage.objects;
CREATE POLICY "manual_invoices_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'manual-invoices');

DROP POLICY IF EXISTS "manual_invoices_authenticated_upload" ON storage.objects;
CREATE POLICY "manual_invoices_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'manual-invoices');

DROP POLICY IF EXISTS "manual_invoices_authenticated_update" ON storage.objects;
CREATE POLICY "manual_invoices_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'manual-invoices');

DROP POLICY IF EXISTS "manual_invoices_authenticated_delete" ON storage.objects;
CREATE POLICY "manual_invoices_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'manual-invoices');
