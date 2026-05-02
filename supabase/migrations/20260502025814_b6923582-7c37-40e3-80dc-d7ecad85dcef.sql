-- Create missing buckets (idempotent)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('manual-invoices', 'manual-invoices', true),
  ('product-images', 'product-images', true),
  ('shared-invoices', 'shared-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- product-images: public read, authenticated write
DO $$ BEGIN
  CREATE POLICY "Product images publicly viewable"
    ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated upload product images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated update product images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated delete product images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- manual-invoices: public read, authenticated write
DO $$ BEGIN
  CREATE POLICY "Manual invoices publicly viewable"
    ON storage.objects FOR SELECT USING (bucket_id = 'manual-invoices');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated upload manual invoices"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'manual-invoices');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated update manual invoices"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'manual-invoices');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated delete manual invoices"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'manual-invoices');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- shared-invoices: private (signed URLs used in code), authenticated CRUD
DO $$ BEGIN
  CREATE POLICY "Authenticated read shared invoices"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'shared-invoices');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated upload shared invoices"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'shared-invoices');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated update shared invoices"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'shared-invoices');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated delete shared invoices"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'shared-invoices');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;