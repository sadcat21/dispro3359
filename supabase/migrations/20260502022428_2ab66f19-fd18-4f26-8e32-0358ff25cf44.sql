-- Archive tables (mirror originals + archive metadata)
CREATE TABLE IF NOT EXISTS public.cash_movements_archive (LIKE public.cash_movements INCLUDING ALL);
ALTER TABLE public.cash_movements_archive
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE TABLE IF NOT EXISTS public.debt_movements_archive (LIKE public.debt_movements INCLUDING ALL);
ALTER TABLE public.debt_movements_archive
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE TABLE IF NOT EXISTS public.stock_movements_archive (LIKE public.stock_movements INCLUDING ALL);
ALTER TABLE public.stock_movements_archive
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_by uuid;

-- Enable RLS
ALTER TABLE public.cash_movements_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_movements_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements_archive ENABLE ROW LEVEL SECURITY;

-- Policies: admin only
DO $$ BEGIN
  CREATE POLICY "admin read cash archive" ON public.cash_movements_archive FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin insert cash archive" ON public.cash_movements_archive FOR INSERT WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin delete cash archive" ON public.cash_movements_archive FOR DELETE USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin read debt archive" ON public.debt_movements_archive FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin insert debt archive" ON public.debt_movements_archive FOR INSERT WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin delete debt archive" ON public.debt_movements_archive FOR DELETE USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin read stock archive" ON public.stock_movements_archive FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin insert stock archive" ON public.stock_movements_archive FOR INSERT WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "admin delete stock archive" ON public.stock_movements_archive FOR DELETE USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Archive functions: copy all rows to archive then truncate
CREATE OR REPLACE FUNCTION public.archive_cash_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid; v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can archive'; END IF;
  v_actor := auth.uid();
  INSERT INTO public.cash_movements_archive
    SELECT cm.*, now(), v_actor FROM public.cash_movements cm;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.cash_movements;
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
  DELETE FROM public.debt_movements;
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
  DELETE FROM public.stock_movements;
  RETURN jsonb_build_object('ok', true, 'archived', v_count);
END; $$;

-- Purge (delete all without archive)
CREATE OR REPLACE FUNCTION public.purge_cash_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.cash_movements;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_debt_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.debt_movements;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.purge_stock_movements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only system admin can purge'; END IF;
  DELETE FROM public.stock_movements;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END; $$;