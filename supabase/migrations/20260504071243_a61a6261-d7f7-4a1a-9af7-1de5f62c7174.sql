CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read suppliers"
ON public.suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage suppliers - insert"
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_custom_role('company_manager'));

CREATE POLICY "Admins manage suppliers - update"
ON public.suppliers FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_custom_role('company_manager'));

CREATE POLICY "Admins manage suppliers - delete"
ON public.suppliers FOR DELETE TO authenticated
USING (public.is_admin() OR public.has_custom_role('company_manager'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();