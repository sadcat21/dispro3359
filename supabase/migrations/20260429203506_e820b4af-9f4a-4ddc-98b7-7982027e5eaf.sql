ALTER TABLE public.stock_receipt_items
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS manufacturing_date date,
  ADD COLUMN IF NOT EXISTS manufacturing_time text,
  ADD COLUMN IF NOT EXISTS delivery_date date;