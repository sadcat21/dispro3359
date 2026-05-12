
ALTER TABLE public.product_offers
  ADD COLUMN IF NOT EXISTS scope_stages text[] NOT NULL DEFAULT ARRAY['worker_loading','order_creation','direct_sale','warehouse_sale']::text[],
  ADD COLUMN IF NOT EXISTS auto_fill_quantities boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_mandatory boolean NOT NULL DEFAULT false;
