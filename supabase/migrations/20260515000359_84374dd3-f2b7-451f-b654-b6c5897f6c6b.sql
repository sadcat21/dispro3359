CREATE OR REPLACE FUNCTION public.cleanup_pending_offers_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
    DELETE FROM public.pending_offer_confirmations
      WHERE order_id = NEW.id AND status = 'pending';
    UPDATE public.pending_offer_confirmations
      SET status = 'cancelled_confirmed'
      WHERE order_id = NEW.id AND status = 'confirmed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_pending_offers_on_order_cancel ON public.orders;
CREATE TRIGGER trg_cleanup_pending_offers_on_order_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_pending_offers_on_order_cancel();

-- Backfill: clean up any currently-stale rows whose order is already cancelled
DELETE FROM public.pending_offer_confirmations poc
USING public.orders o
WHERE poc.order_id = o.id
  AND o.status = 'cancelled'
  AND poc.status = 'pending';