ALTER TABLE public.factory_order_items
  ADD COLUMN IF NOT EXISTS lot_number TEXT,
  ADD COLUMN IF NOT EXISTS manufacturing_date DATE,
  ADD COLUMN IF NOT EXISTS manufacturing_time TEXT,
  ADD COLUMN IF NOT EXISTS delivery_date DATE;