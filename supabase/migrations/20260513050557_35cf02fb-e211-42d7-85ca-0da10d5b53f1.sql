
CREATE TABLE IF NOT EXISTS public.product_offer_settings (
  id text PRIMARY KEY DEFAULT 'global',
  is_deferred_confirmation boolean NOT NULL DEFAULT true,
  auto_fill_quantities boolean NOT NULL DEFAULT true,
  is_mandatory boolean NOT NULL DEFAULT false,
  scope_stages text[] NOT NULL DEFAULT ARRAY['worker_loading','order_creation','direct_sale','warehouse_sale']::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  CONSTRAINT product_offer_settings_singleton CHECK (id = 'global')
);

INSERT INTO public.product_offer_settings (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.product_offer_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offer_settings_read" ON public.product_offer_settings;
CREATE POLICY "offer_settings_read"
ON public.product_offer_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "offer_settings_update" ON public.product_offer_settings;
CREATE POLICY "offer_settings_update"
ON public.product_offer_settings FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());
