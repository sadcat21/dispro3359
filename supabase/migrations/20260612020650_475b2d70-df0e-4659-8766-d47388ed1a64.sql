
CREATE TABLE public.accounting_session_truck_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.accounting_sessions(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  loaded numeric NOT NULL DEFAULT 0,
  unloaded numeric NOT NULL DEFAULT 0,
  sold numeric NOT NULL DEFAULT 0,
  system_qty numeric NOT NULL DEFAULT 0,
  actual_qty numeric,
  diff numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_acc_truck_snap_session ON public.accounting_session_truck_snapshots(session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_session_truck_snapshots TO authenticated;
GRANT ALL ON public.accounting_session_truck_snapshots TO service_role;

ALTER TABLE public.accounting_session_truck_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth can read truck snapshots"
  ON public.accounting_session_truck_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth can write truck snapshots"
  ON public.accounting_session_truck_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth can update truck snapshots"
  ON public.accounting_session_truck_snapshots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth can delete truck snapshots"
  ON public.accounting_session_truck_snapshots FOR DELETE TO authenticated USING (true);
