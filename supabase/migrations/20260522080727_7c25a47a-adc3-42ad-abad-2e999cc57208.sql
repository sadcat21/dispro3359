-- حذف التكرارات مع الإبقاء على أقدم سجل لكل order_id
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.manual_invoice_requests
  WHERE order_id IS NOT NULL
)
DELETE FROM public.manual_invoice_requests m
USING ranked r
WHERE m.id = r.id AND r.rn > 1;

-- قيد فريد لمنع التكرار مستقبلاً (NULL مسموح متعدد)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_manual_invoice_requests_order_id
  ON public.manual_invoice_requests(order_id)
  WHERE order_id IS NOT NULL;