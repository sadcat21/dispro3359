
-- Safety net: ensure every order produces a visit_tracking row, even if the
-- client-side trackVisit call fails (GPS denied, network drop, app closed).
CREATE OR REPLACE FUNCTION public.ensure_order_visit_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker uuid;
BEGIN
  v_worker := COALESCE(NEW.assigned_worker_id, NEW.created_by);
  IF v_worker IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if a visit row already exists for this order
  IF EXISTS (
    SELECT 1 FROM public.visit_tracking
    WHERE operation_id = NEW.id
      AND operation_type IN ('order','direct_sale','delivery')
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.visit_tracking (
    worker_id, customer_id, branch_id,
    operation_type, operation_id, notes, created_at
  ) VALUES (
    v_worker, NEW.customer_id, NEW.branch_id,
    'direct_sale', NEW.id, 'auto: server fallback', NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_order_visit_tracking ON public.orders;
CREATE TRIGGER trg_ensure_order_visit_tracking
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_order_visit_tracking();

-- Backfill any historical orders missing a tracking row
INSERT INTO public.visit_tracking (worker_id, customer_id, branch_id, operation_type, operation_id, notes, created_at)
SELECT
  COALESCE(o.assigned_worker_id, o.created_by),
  o.customer_id, o.branch_id,
  'direct_sale', o.id, 'auto: backfill', o.created_at
FROM public.orders o
LEFT JOIN public.visit_tracking v
  ON v.operation_id = o.id
 AND v.operation_type IN ('order','direct_sale','delivery')
WHERE v.id IS NULL
  AND COALESCE(o.assigned_worker_id, o.created_by) IS NOT NULL;
