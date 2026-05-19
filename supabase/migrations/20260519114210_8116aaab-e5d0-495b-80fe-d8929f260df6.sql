-- Overloads accepting optional worker filter for ledger archive/purge
CREATE OR REPLACE FUNCTION public.archive_cash_movements(p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_actor uuid; v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can archive'; END IF;
  v_actor := auth.uid();
  IF p_worker_id IS NULL THEN
    INSERT INTO public.cash_movements_archive SELECT cm.*, now(), v_actor FROM public.cash_movements cm;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.cash_movements WHERE true;
  ELSE
    INSERT INTO public.cash_movements_archive SELECT cm.*, now(), v_actor FROM public.cash_movements cm WHERE cm.worker_id = p_worker_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.cash_movements WHERE worker_id = p_worker_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'archived', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.archive_debt_movements(p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_actor uuid; v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can archive'; END IF;
  v_actor := auth.uid();
  IF p_worker_id IS NULL THEN
    INSERT INTO public.debt_movements_archive SELECT dm.*, now(), v_actor FROM public.debt_movements dm;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.debt_movements WHERE true;
  ELSE
    INSERT INTO public.debt_movements_archive SELECT dm.*, now(), v_actor FROM public.debt_movements dm WHERE dm.worker_id = p_worker_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.debt_movements WHERE worker_id = p_worker_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'archived', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.archive_stock_movements(p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_actor uuid; v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can archive'; END IF;
  v_actor := auth.uid();
  IF p_worker_id IS NULL THEN
    INSERT INTO public.stock_movements_archive SELECT sm.*, now(), v_actor FROM public.stock_movements sm;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.stock_movements WHERE true;
  ELSE
    INSERT INTO public.stock_movements_archive SELECT sm.*, now(), v_actor FROM public.stock_movements sm WHERE sm.worker_id = p_worker_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    DELETE FROM public.stock_movements WHERE worker_id = p_worker_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'archived', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_cash_movements(p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  IF p_worker_id IS NULL THEN
    DELETE FROM public.cash_movements WHERE true;
  ELSE
    DELETE FROM public.cash_movements WHERE worker_id = p_worker_id;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_debt_movements(p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  IF p_worker_id IS NULL THEN
    DELETE FROM public.debt_movements WHERE true;
  ELSE
    DELETE FROM public.debt_movements WHERE worker_id = p_worker_id;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_stock_movements(p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  IF p_worker_id IS NULL THEN
    DELETE FROM public.stock_movements WHERE true;
  ELSE
    DELETE FROM public.stock_movements WHERE worker_id = p_worker_id;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;