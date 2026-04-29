
CREATE OR REPLACE FUNCTION public.auto_create_manual_invoice_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_products jsonb;
BEGIN
  -- نعمل فقط على الطلبيات بفاتورة
  IF NEW.payment_type IS DISTINCT FROM 'with_invoice' THEN
    RETURN NEW;
  END IF;

  -- تجنّب التكرار
  IF EXISTS (SELECT 1 FROM public.manual_invoice_requests WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- استنتاج فرع الطلب: من الطلبية، أو من المنشئ، أو من المندوب المسؤول
  v_branch_id := NEW.branch_id;
  IF v_branch_id IS NULL THEN
    SELECT branch_id INTO v_branch_id FROM public.workers
      WHERE id = COALESCE(NEW.created_by, NEW.assigned_worker_id) LIMIT 1;
  END IF;

  -- بناء قائمة المنتجات من order_items
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', oi.product_id,
    'product_name', p.name,
    'quantity', oi.quantity,
    'unit_price', oi.unit_price,
    'total', oi.total_price
  )), '[]'::jsonb)
  INTO v_products
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id;

  INSERT INTO public.manual_invoice_requests (
    order_id, customer_id, worker_id, branch_id,
    products, payment_method, status, total_amount, created_by_role
  ) VALUES (
    NEW.id,
    NEW.customer_id,
    COALESCE(NEW.created_by, NEW.assigned_worker_id),
    v_branch_id,
    v_products,
    NEW.invoice_payment_method,
    'pending_branch',
    COALESCE(NEW.total_amount, 0),
    'worker'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_manual_invoice_request ON public.orders;

CREATE TRIGGER trg_auto_create_manual_invoice_request
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_manual_invoice_request();

-- معالجة الطلبيات الموجودة اليوم (catch-up) للطلبيات بفاتورة بدون سجل
INSERT INTO public.manual_invoice_requests (
  order_id, customer_id, worker_id, branch_id,
  products, payment_method, status, total_amount, created_by_role
)
SELECT
  o.id,
  o.customer_id,
  COALESCE(o.created_by, o.assigned_worker_id),
  COALESCE(o.branch_id, w.branch_id),
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'product_id', oi.product_id,
      'product_name', p.name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'total', oi.total_price
    ))
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = o.id
  ), '[]'::jsonb),
  o.invoice_payment_method,
  'pending_branch',
  COALESCE(o.total_amount, 0),
  'worker'
FROM public.orders o
LEFT JOIN public.workers w ON w.id = COALESCE(o.created_by, o.assigned_worker_id)
WHERE o.payment_type = 'with_invoice'
  AND NOT EXISTS (SELECT 1 FROM public.manual_invoice_requests m WHERE m.order_id = o.id);
