ALTER TABLE public.document_collections 
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS collection_type text;