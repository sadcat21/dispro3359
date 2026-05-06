
CREATE TABLE public.sales_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('direct_sale', 'delivery_sale', 'warehouse_sale')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  pieces_per_box INTEGER NOT NULL DEFAULT 20,
  sold_boxes INTEGER NOT NULL DEFAULT 0,
  sold_pieces INTEGER NOT NULL DEFAULT 0,
  gift_boxes INTEGER NOT NULL DEFAULT 0,
  gift_pieces INTEGER NOT NULL DEFAULT 0,
  total_boxes INTEGER NOT NULL DEFAULT 0,
  total_pieces INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  worker_name TEXT,
  customer_name TEXT,
  branch_name TEXT,
  notes TEXT,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_tracking_source ON public.sales_tracking(source);
CREATE INDEX idx_sales_tracking_branch ON public.sales_tracking(branch_id);
CREATE INDEX idx_sales_tracking_worker ON public.sales_tracking(worker_id);
CREATE INDEX idx_sales_tracking_customer ON public.sales_tracking(customer_id);
CREATE INDEX idx_sales_tracking_product ON public.sales_tracking(product_id);
CREATE INDEX idx_sales_tracking_sold_at ON public.sales_tracking(sold_at DESC);
CREATE INDEX idx_sales_tracking_order ON public.sales_tracking(order_id);

ALTER TABLE public.sales_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales tracking"
ON public.sales_tracking FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert sales tracking"
ON public.sales_tracking FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update sales tracking"
ON public.sales_tracking FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete sales tracking"
ON public.sales_tracking FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.sales_tracking_normalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ppb INTEGER;
  total_p INTEGER;
BEGIN
  ppb := GREATEST(1, COALESCE(NEW.pieces_per_box, 20));
  total_p := (COALESCE(NEW.sold_boxes,0) * ppb + COALESCE(NEW.sold_pieces,0))
           + (COALESCE(NEW.gift_boxes,0) * ppb + COALESCE(NEW.gift_pieces,0));
  NEW.total_boxes := total_p / ppb;
  NEW.total_pieces := total_p % ppb;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_tracking_normalize_trg
BEFORE INSERT OR UPDATE ON public.sales_tracking
FOR EACH ROW EXECUTE FUNCTION public.sales_tracking_normalize();
