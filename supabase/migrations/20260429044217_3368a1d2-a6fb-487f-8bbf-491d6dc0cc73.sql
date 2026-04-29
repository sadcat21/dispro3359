INSERT INTO public.manual_invoice_requests (
  order_id, customer_id, worker_id, branch_id, status, payment_method, products
)
SELECT
  o.id,
  o.customer_id,
  COALESCE(o.assigned_worker_id, o.created_by),
  o.branch_id,
  'pending_branch',
  o.invoice_payment_method,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'productId', oi.product_id,
      'quantity', oi.quantity,
      'unitPrice', oi.unit_price,
      'totalPrice', oi.total_price
    )) FROM public.order_items oi WHERE oi.order_id = o.id),
    '[]'::jsonb
  )
FROM public.orders o
WHERE o.payment_type = 'with_invoice'
  AND o.status NOT IN ('cancelled', 'delivered', 'completed')
  AND COALESCE(o.assigned_worker_id, o.created_by) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.manual_invoice_requests mir WHERE mir.order_id = o.id
  );