ALTER TABLE public.stock_receipts 
  ADD COLUMN IF NOT EXISTS receipt_expenses numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expenses_description text;