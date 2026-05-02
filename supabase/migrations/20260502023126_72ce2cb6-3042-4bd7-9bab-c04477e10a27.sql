-- Archive purge
CREATE OR REPLACE FUNCTION public.purge_cash_movements_archive()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.cash_movements_archive WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_debt_movements_archive()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.debt_movements_archive WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_stock_movements_archive()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.stock_movements_archive WHERE true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

-- Purge all (current + archive)
CREATE OR REPLACE FUNCTION public.purge_cash_movements_all()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a int; v_b int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.cash_movements WHERE true; GET DIAGNOSTICS v_a = ROW_COUNT;
  DELETE FROM public.cash_movements_archive WHERE true; GET DIAGNOSTICS v_b = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_a + v_b, 'current', v_a, 'archive', v_b);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_debt_movements_all()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a int; v_b int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.debt_movements WHERE true; GET DIAGNOSTICS v_a = ROW_COUNT;
  DELETE FROM public.debt_movements_archive WHERE true; GET DIAGNOSTICS v_b = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_a + v_b, 'current', v_a, 'archive', v_b);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_stock_movements_all()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a int; v_b int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.stock_movements WHERE true; GET DIAGNOSTICS v_a = ROW_COUNT;
  DELETE FROM public.stock_movements_archive WHERE true; GET DIAGNOSTICS v_b = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_a + v_b, 'current', v_a, 'archive', v_b);
END; $$;