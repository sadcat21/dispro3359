
-- Create stock disputes table
CREATE TABLE public.stock_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id),
  raised_by UUID REFERENCES public.workers(id) NOT NULL,
  warehouse_worker_id UUID REFERENCES public.workers(id) NOT NULL,
  delivery_worker_id UUID REFERENCES public.workers(id) NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'loading',
  session_id UUID,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT,
  warehouse_qty NUMERIC NOT NULL DEFAULT 0,
  delivery_qty NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES public.workers(id),
  resolved_at TIMESTAMPTZ,
  guilty_worker_id UUID REFERENCES public.workers(id),
  guilty_accepted BOOLEAN DEFAULT false,
  guilty_accepted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_disputes ENABLE ROW LEVEL SECURITY;

-- Workers can view disputes they're involved in
CREATE POLICY "Workers can view their disputes"
ON public.stock_disputes
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_branch_admin()
  OR public.get_worker_id() = warehouse_worker_id
  OR public.get_worker_id() = delivery_worker_id
  OR public.get_worker_id() = raised_by
);

-- Any authenticated worker can create a dispute
CREATE POLICY "Workers can create disputes"
ON public.stock_disputes
FOR INSERT
TO authenticated
WITH CHECK (public.is_worker());

-- Admins and branch admins can update (resolve), guilty worker can accept
CREATE POLICY "Admins and guilty can update disputes"
ON public.stock_disputes
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR public.is_branch_admin()
  OR public.get_worker_id() = guilty_worker_id
);

-- Trigger for updated_at
CREATE TRIGGER update_stock_disputes_updated_at
BEFORE UPDATE ON public.stock_disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
