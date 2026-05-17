
-- حذف 3 طلبيات مكررة لبهليل عفيف (نُبقي الأقدم: e38bf8eb)
DELETE FROM public.order_items
WHERE order_id IN (
  '6c0b2a26-a395-4c25-b890-c0caaa7d88fa',
  'e71abf7f-cee7-4b78-8125-27402339b429',
  'ff19515a-9b59-40c2-9412-66cd39ccd168'
);

DELETE FROM public.stock_movements
WHERE order_id IN (
  '6c0b2a26-a395-4c25-b890-c0caaa7d88fa',
  'e71abf7f-cee7-4b78-8125-27402339b429',
  'ff19515a-9b59-40c2-9412-66cd39ccd168'
);

DELETE FROM public.sales_tracking
WHERE order_id IN (
  '6c0b2a26-a395-4c25-b890-c0caaa7d88fa',
  'e71abf7f-cee7-4b78-8125-27402339b429',
  'ff19515a-9b59-40c2-9412-66cd39ccd168'
);

DELETE FROM public.orders
WHERE id IN (
  '6c0b2a26-a395-4c25-b890-c0caaa7d88fa',
  'e71abf7f-cee7-4b78-8125-27402339b429',
  'ff19515a-9b59-40c2-9412-66cd39ccd168'
);
