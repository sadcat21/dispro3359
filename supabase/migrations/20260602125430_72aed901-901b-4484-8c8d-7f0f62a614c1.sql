CREATE OR REPLACE FUNCTION public.ensure_order_visit_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker uuid;
  v_operation_type text;
BEGIN
  v_worker := COALESCE(NEW.assigned_worker_id, NEW.created_by);
  IF v_worker IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.visit_tracking
    WHERE operation_id = NEW.id
      AND operation_type IN ('order','direct_sale','delivery')
  ) THEN
    RETURN NEW;
  END IF;

  v_operation_type := CASE
    WHEN NEW.assigned_worker_id IS NOT NULL AND NEW.created_by IS NOT NULL AND NEW.assigned_worker_id <> NEW.created_by THEN 'delivery'
    WHEN NEW.status = 'delivered' THEN 'direct_sale'
    ELSE 'order'
  END;

  INSERT INTO public.visit_tracking (
    worker_id, customer_id, branch_id,
    operation_type, operation_id, notes, created_at
  ) VALUES (
    v_worker, NEW.customer_id, NEW.branch_id,
    v_operation_type, NEW.id, 'auto: server fallback', NEW.created_at
  );

  RETURN NEW;
END;
$$;

DELETE FROM public.visit_tracking vt
USING public.orders o
WHERE vt.operation_id = o.id
  AND vt.operation_type = 'direct_sale'
  AND vt.notes IN ('auto: server fallback','auto: backfill')
  AND o.assigned_worker_id IS NOT NULL
  AND o.created_by IS NOT NULL
  AND o.assigned_worker_id <> o.created_by;

INSERT INTO public.visit_tracking (worker_id, customer_id, branch_id, operation_type, operation_id, notes, created_at)
SELECT
  COALESCE(o.assigned_worker_id, o.created_by),
  o.customer_id,
  o.branch_id,
  CASE
    WHEN o.assigned_worker_id IS NOT NULL AND o.created_by IS NOT NULL AND o.assigned_worker_id <> o.created_by THEN 'delivery'
    WHEN o.status = 'delivered' THEN 'direct_sale'
    ELSE 'order'
  END,
  o.id,
  'auto: backfill',
  o.created_at
FROM public.orders o
LEFT JOIN public.visit_tracking v
  ON v.operation_id = o.id
 AND v.operation_type IN ('order','direct_sale','delivery')
WHERE v.id IS NULL
  AND COALESCE(o.assigned_worker_id, o.created_by) IS NOT NULL;