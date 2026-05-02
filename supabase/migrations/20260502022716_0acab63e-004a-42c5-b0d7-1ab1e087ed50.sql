CREATE OR REPLACE FUNCTION public.archive_cash_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can archive'; END IF;
  v_actor := auth.uid();
  INSERT INTO public.cash_movements_archive
    SELECT cm.*, now(), v_actor FROM public.cash_movements cm;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.cash_movements WHERE true;
  RETURN jsonb_build_object('ok', true, 'archived', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.archive_debt_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can archive'; END IF;
  v_actor := auth.uid();
  INSERT INTO public.debt_movements_archive
    SELECT dm.*, now(), v_actor FROM public.debt_movements dm;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.debt_movements WHERE true;
  RETURN jsonb_build_object('ok', true, 'archived', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.archive_stock_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can archive'; END IF;
  v_actor := auth.uid();
  INSERT INTO public.stock_movements_archive
    SELECT sm.*, now(), v_actor FROM public.stock_movements sm;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.stock_movements WHERE true;
  RETURN jsonb_build_object('ok', true, 'archived', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_cash_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.cash_movements WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_debt_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.debt_movements WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_stock_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.stock_movements WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;