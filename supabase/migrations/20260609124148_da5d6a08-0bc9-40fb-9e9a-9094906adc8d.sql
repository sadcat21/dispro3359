
CREATE OR REPLACE FUNCTION public.recalibrate_worker_stock_on_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_worker_id uuid;
BEGIN
  v_worker_id := COALESCE(NEW.worker_id, OLD.worker_id);
  IF v_worker_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- Recalibrate when modifications / returns / cancellations land,
  -- because these change the truck balance without going through orders triggers.
  IF COALESCE(NEW.movement_type, OLD.movement_type) IN ('modification','return','customer_return','adjustment','damage','exchange') THEN
    PERFORM public.recalibrate_worker_stock(v_worker_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalibrate_worker_stock_on_sm ON public.stock_movements;
CREATE TRIGGER trg_recalibrate_worker_stock_on_sm
AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.recalibrate_worker_stock_on_movement();

-- Backfill: recalibrate all workers that have current stock so any stale
-- doubly-deducted values get corrected immediately.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT worker_id FROM public.worker_stock WHERE worker_id IS NOT NULL LOOP
    PERFORM public.recalibrate_worker_stock(r.worker_id);
  END LOOP;
END $$;
