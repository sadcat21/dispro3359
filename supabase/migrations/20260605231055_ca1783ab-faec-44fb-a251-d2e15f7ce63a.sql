ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS owner_first_name_ar text,
  ADD COLUMN IF NOT EXISTS owner_last_name_ar text,
  ADD COLUMN IF NOT EXISTS owner_first_name_fr text,
  ADD COLUMN IF NOT EXISTS owner_last_name_fr text;