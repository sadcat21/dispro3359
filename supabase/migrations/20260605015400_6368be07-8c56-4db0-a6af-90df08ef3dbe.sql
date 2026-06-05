CREATE OR REPLACE FUNCTION public.prevent_duplicate_order_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dup_id uuid;
BEGIN
  IF NEW.assigned_worker_id IS NULL OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO dup_id
  FROM public.orders
  WHERE assigned_worker_id = NEW.assigned_worker_id
    AND customer_id = NEW.customer_id
    AND total_amount = NEW.total_amount
    AND created_at >= (now() - interval '60 seconds')
  LIMIT 1;

  IF dup_id IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate_order_within_window: identical order % already created in the last 60 seconds', dup_id
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_order_insert ON public.orders;
CREATE TRIGGER trg_prevent_duplicate_order_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_order_insert();