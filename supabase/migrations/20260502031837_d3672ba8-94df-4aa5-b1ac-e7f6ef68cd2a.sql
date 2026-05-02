ALTER TABLE public.stock_receipts
ADD COLUMN IF NOT EXISTS expenses_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb;