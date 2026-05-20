CREATE TABLE IF NOT EXISTS public.order_deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_snapshot JSONB NOT NULL,
  related_snapshots JSONB,
  reason TEXT,
  batch_id UUID,
  deleted_by UUID REFERENCES public.workers(id),
  deleted_by_name TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oda_order_id ON public.order_deletion_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_oda_batch_id ON public.order_deletion_audit(batch_id);
CREATE INDEX IF NOT EXISTS idx_oda_deleted_at ON public.order_deletion_audit(deleted_at DESC);

ALTER TABLE public.order_deletion_audit ENABLE ROW LEVEL SECURITY;

DO $pol$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_deletion_audit' AND policyname='Admins view deletion audit') THEN
    EXECUTE $$CREATE POLICY "Admins view deletion audit"
      ON public.order_deletion_audit FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin'::app_role,'branch_admin'::app_role,'company_manager'::app_role)))$$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_deletion_audit' AND policyname='Admins insert deletion audit') THEN
    EXECUTE $$CREATE POLICY "Admins insert deletion audit"
      ON public.order_deletion_audit FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin'::app_role,'branch_admin'::app_role,'company_manager'::app_role)))$$;
  END IF;
END $pol$;

DO $$
DECLARE
  v_batch_id UUID := gen_random_uuid();
  v_order_ids UUID[] := ARRAY[
    'e43ef801-9e28-4af4-96d4-ca4fe16c1f9e',
    '303b1df9-60d7-4205-9bbb-7c67e26c4db7',
    '90fae35a-d941-4c3c-a664-553e08e8d574',
    'd15feea0-c643-4d1a-a8ae-ec39de6e756b',
    '6a520dff-c157-424c-9158-f081f3b6f213',
    '00dffcaf-75db-4706-836b-374ba18c70a7'
  ]::uuid[];
  v_oid UUID;
  v_order_snap JSONB;
  v_items_snap JSONB;
  v_events_snap JSONB;
  v_sales_snap JSONB;
  v_stock_count INT;
  v_debt_count INT;
BEGIN
  SELECT count(*) INTO v_stock_count FROM public.stock_movements WHERE order_id = ANY(v_order_ids);
  SELECT count(*) INTO v_debt_count  FROM public.customer_debts  WHERE order_id = ANY(v_order_ids);
  IF v_stock_count > 0 OR v_debt_count > 0 THEN
    RAISE EXCEPTION 'Aborting: stock_movements=% customer_debts=% on ghost orders', v_stock_count, v_debt_count;
  END IF;

  FOREACH v_oid IN ARRAY v_order_ids LOOP
    SELECT to_jsonb(o.*) INTO v_order_snap FROM public.orders o WHERE o.id = v_oid;
    IF v_order_snap IS NULL THEN
      RAISE NOTICE 'Order % not found, skipping', v_oid;
      CONTINUE;
    END IF;
    SELECT jsonb_agg(to_jsonb(i.*)) INTO v_items_snap  FROM public.order_items     i WHERE i.order_id = v_oid;
    SELECT jsonb_agg(to_jsonb(e.*)) INTO v_events_snap FROM public.order_events    e WHERE e.order_id = v_oid;
    SELECT jsonb_agg(to_jsonb(s.*)) INTO v_sales_snap  FROM public.sales_tracking  s WHERE s.order_id = v_oid;

    INSERT INTO public.order_deletion_audit (
      order_id, order_snapshot, related_snapshots, reason, batch_id, deleted_by, deleted_by_name
    ) VALUES (
      v_oid,
      v_order_snap,
      jsonb_build_object(
        'order_items',    COALESCE(v_items_snap,  '[]'::jsonb),
        'order_events',   COALESCE(v_events_snap, '[]'::jsonb),
        'sales_tracking', COALESCE(v_sales_snap,  '[]'::jsonb)
      ),
      'Ghost duplicate order (hssm27 2026-05-18) — no stock movement, no customer debt',
      v_batch_id,
      NULL,
      'system/migration (admin-approved)'
    );

    DELETE FROM public.sales_tracking WHERE order_id = v_oid;
    DELETE FROM public.order_items    WHERE order_id = v_oid;
    DELETE FROM public.order_events   WHERE order_id = v_oid;
    DELETE FROM public.orders         WHERE id = v_oid;
  END LOOP;

  RAISE NOTICE 'Deleted ghost orders, batch_id=%', v_batch_id;
END $$;