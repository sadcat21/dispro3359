UPDATE public.stock_movements
SET quantity = 3,
    signed_quantity = 3,
    notes = 'تفريغ 3 من Café Aroma 125gr (كان 3، متبقي 0) — تصحيح بعد إصلاح احتساب التعديلات'
WHERE id = 'b5d64a23-2045-4f7d-a104-a35bf1b52f85';

SELECT public.recalibrate_worker_stock('79240031-b627-4d69-b8e8-d29edfb25cde');