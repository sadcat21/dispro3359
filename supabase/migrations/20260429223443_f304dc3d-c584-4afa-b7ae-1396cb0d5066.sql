
-- إضافة حقول التفاصيل لكل بند مراجعة
ALTER TABLE public.warehouse_review_items
  ADD COLUMN IF NOT EXISTS boxes_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pieces_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hall_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.warehouse_review_items.boxes_quantity IS 'الكمية المخصصة للصناديق الكاملة';
COMMENT ON COLUMN public.warehouse_review_items.pieces_quantity IS 'الكمية بالقطعة';
COMMENT ON COLUMN public.warehouse_review_items.hall_quantity IS 'كمية الصالة';
COMMENT ON COLUMN public.warehouse_review_items.damaged_quantity IS 'كمية التالف';
