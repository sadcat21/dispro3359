ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS invoice_payment_subtype text;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';