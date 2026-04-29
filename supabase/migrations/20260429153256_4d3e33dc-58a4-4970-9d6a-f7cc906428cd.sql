-- إضافة دعم حالة "مؤجل" وتتبع الفواتير المُجمَّعة لطلبات الفواتير اليدوية

-- حقول جديدة لتتبع التجميع
ALTER TABLE public.manual_invoice_requests
  ADD COLUMN IF NOT EXISTS merged_into_request_id uuid REFERENCES public.manual_invoice_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_request_ids uuid[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_merged_parent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS postponed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS postponed_by uuid DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_mir_status ON public.manual_invoice_requests(status);
CREATE INDEX IF NOT EXISTS idx_mir_merged_into ON public.manual_invoice_requests(merged_into_request_id);
