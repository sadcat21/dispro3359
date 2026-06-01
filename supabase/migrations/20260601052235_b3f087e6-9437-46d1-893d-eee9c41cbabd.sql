-- 1) Heal: any order stuck in pending_branch should be delivered
UPDATE public.orders
SET status = 'delivered'
WHERE status = 'pending_branch';

-- 2) Guard trigger: never let a sale order sit as pending_branch — auto-promote to delivered.
--    The invoice-request workflow (manual_invoice_requests) is independent and untouched.
CREATE OR REPLACE FUNCTION public.auto_deliver_pending_branch_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pending_branch' THEN
    NEW.status := 'delivered';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_deliver_pending_branch_order ON public.orders;
CREATE TRIGGER trg_auto_deliver_pending_branch_order
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'pending_branch')
EXECUTE FUNCTION public.auto_deliver_pending_branch_order();