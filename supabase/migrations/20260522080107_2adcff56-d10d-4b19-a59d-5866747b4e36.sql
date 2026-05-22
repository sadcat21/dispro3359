UPDATE public.manual_invoice_requests mir
SET products = rebuilt.products
FROM (
  SELECT
    mir_inner.id,
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'product_name', p.name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total', oi.total_price
      )
      ORDER BY oi.created_at, oi.id
    ) AS products
  FROM public.manual_invoice_requests mir_inner
  JOIN public.orders o ON o.id = mir_inner.order_id
  JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE o.payment_type = 'with_invoice'
    AND (
      mir_inner.products IS NULL
      OR mir_inner.products = '[]'::jsonb
      OR jsonb_array_length(mir_inner.products) = 0
    )
  GROUP BY mir_inner.id
) AS rebuilt
WHERE mir.id = rebuilt.id;