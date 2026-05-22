
-- Drop old trigger on orders
DROP TRIGGER IF EXISTS trg_auto_create_manual_invoice_request ON public.orders;

-- Recreate function: fires on order_items, aggregates real items, auto-approved
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
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Only invoice path 1
  IF v_order.payment_type IS DISTINCT FROM 'with_invoice' THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicates
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
    products, payment_method, status, total_amount, created_by_role,
    branch_approved_by, branch_approved_at,
    assistant_approved_by, assistant_approved_at
  ) VALUES (
    v_order.id,
    v_order.customer_id,
    v_worker_id,
    v_branch_id,
    v_products,
    v_order.invoice_payment_method,
    'approved',
    COALESCE(v_order.total_amount, 0),
    'worker',
    v_worker_id, v_now,
    v_worker_id, v_now
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Statement-level trigger after items are inserted
DROP TRIGGER IF EXISTS trg_auto_create_manual_invoice_request_items ON public.order_items;
CREATE TRIGGER trg_auto_create_manual_invoice_request_items
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.auto_create_manual_invoice_request();
