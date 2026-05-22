CREATE OR REPLACE FUNCTION public.auto_create_manual_invoice_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_branch_id uuid;
  v_products jsonb;
  v_worker_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_order.payment_type IS DISTINCT FROM 'with_invoice' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.manual_invoice_requests WHERE order_id = v_order.id) THEN
    RETURN NEW;
  END IF;

  v_branch_id := v_order.branch_id;
  v_worker_id := COALESCE(v_order.created_by, v_order.assigned_worker_id);
  IF v_branch_id IS NULL AND v_worker_id IS NOT NULL THEN
    SELECT branch_id INTO v_branch_id FROM public.workers WHERE id = v_worker_id LIMIT 1;
  END IF;

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
  WHERE oi.order_id = v_order.id;

  INSERT INTO public.manual_invoice_requests (
    order_id, customer_id, worker_id, branch_id,
    products, payment_method, status, total_amount, created_by_role
  ) VALUES (
    v_order.id,
    v_order.customer_id,
    v_worker_id,
    v_branch_id,
    v_products,
    v_order.invoice_payment_method,
    'pending',
    COALESCE(v_order.total_amount, 0),
    'worker'
  )
  ON CONFLICT (order_id) WHERE (order_id IS NOT NULL) DO NOTHING;

  RETURN NEW;
END;
$function$;