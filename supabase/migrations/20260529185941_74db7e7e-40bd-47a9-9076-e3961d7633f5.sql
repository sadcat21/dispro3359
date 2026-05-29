CREATE TABLE public.supplier_pallet_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL UNIQUE REFERENCES public.suppliers(id) ON DELETE CASCADE,
  pallet_cost numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_pallet_costs TO authenticated;
GRANT ALL ON public.supplier_pallet_costs TO service_role;

ALTER TABLE public.supplier_pallet_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read supplier pallet costs"
  ON public.supplier_pallet_costs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert supplier pallet costs"
  ON public.supplier_pallet_costs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update supplier pallet costs"
  ON public.supplier_pallet_costs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete supplier pallet costs"
  ON public.supplier_pallet_costs FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_supplier_pallet_costs_updated_at
  BEFORE UPDATE ON public.supplier_pallet_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();