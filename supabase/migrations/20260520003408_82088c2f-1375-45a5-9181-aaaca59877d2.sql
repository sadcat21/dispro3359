
-- 1. Idempotency key
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_request_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_request_id
  ON public.orders (client_request_id)
  WHERE client_request_id IS NOT NULL;

-- 2. Combined anti-duplicate + anti-spam trigger
CREATE OR REPLACE FUNCTION public.prevent_order_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dup_count int;
  spam_count int;
BEGIN
  -- Near-duplicate check: same customer + same worker within 60 seconds
  IF NEW.assigned_worker_id IS NOT NULL THEN
    SELECT COUNT(*) INTO dup_count
    FROM public.orders
    WHERE customer_id = NEW.customer_id
      AND assigned_worker_id = NEW.assigned_worker_id
      AND status NOT IN ('cancelled', 'delivered')
      AND created_at > now() - interval '60 seconds';

    IF dup_count > 0 THEN
      RAISE EXCEPTION 'تم رفض الطلبية: توجد طلبية مماثلة لنفس العميل والعامل خلال آخر 60 ثانية (تكرار محتمل).'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Spam check: too many orders for the same customer in 5 minutes
  SELECT COUNT(*) INTO spam_count
  FROM public.orders
  WHERE customer_id = NEW.customer_id
    AND created_at > now() - interval '5 minutes';

  IF spam_count >= 5 THEN
    RAISE EXCEPTION 'تم رفض الطلبية: عدد كبير من الطلبيات لنفس العميل خلال 5 دقائق (%).', spam_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_order_duplicates ON public.orders;
CREATE TRIGGER trg_prevent_order_duplicates
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_order_duplicates();
