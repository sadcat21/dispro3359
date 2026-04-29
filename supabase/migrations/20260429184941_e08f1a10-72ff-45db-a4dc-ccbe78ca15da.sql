
-- إضافة دعم التأجيل/التجميد والرفض مع ملاحظة لـ stock_receipts و factory_orders
-- وإضافة ربط التسليم بالاستلام

ALTER TABLE public.stock_receipts
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_note text,
  ADD COLUMN IF NOT EXISTS linked_delivery_id uuid;

ALTER TABLE public.factory_orders
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_note text,
  ADD COLUMN IF NOT EXISTS linked_receipt_id uuid;
