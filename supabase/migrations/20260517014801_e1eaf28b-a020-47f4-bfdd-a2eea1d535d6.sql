
SET session_replication_role = replica;

-- (1) CAFE AROMA SEAU 5Kg — حذف حركة تعديل خاطئة + استعادة 1 للعامل ce5b6f33
DELETE FROM public.stock_movements WHERE id = 'e14e3898-3cd8-481f-85f0-d4159c56e36a';
UPDATE public.worker_stock SET quantity = quantity + 1 WHERE id = '688dddae-f046-41f3-bae7-2c5ddb42aae2';

-- (2) CAFE AROMA 250 Gr — العامل d1023b86 (طلب 0c476d75)
UPDATE public.worker_stock SET quantity = quantity + 1 WHERE id = '5391a215-2113-4906-9508-eebea1e23295';
INSERT INTO public.stock_movements
  (product_id, branch_id, quantity, signed_quantity, movement_type, status, created_by, worker_id, order_id, notes)
VALUES
  ('c51e3eda-047f-43f3-a9aa-caf367440fc2', NULL, 1, 1, 'modification', 'approved',
   'd1023b86-ed15-42f9-9a0a-3edf2b29dc78', 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78',
   '0c476d75-163e-4bad-af7b-b0bedec58bbf',
   'تصحيح تلقائي: استعادة هدية مؤجلة بانتظار تأكيد بطاقة العرض');

-- (3) CAFE AROMA 250 Gr — العامل ce5b6f33 (طلب 5edec8d2)
UPDATE public.worker_stock SET quantity = quantity + 1 WHERE id = 'bbe40436-d313-4baa-92bb-036c900cc11f';
INSERT INTO public.stock_movements
  (product_id, branch_id, quantity, signed_quantity, movement_type, status, created_by, worker_id, order_id, notes)
VALUES
  ('c51e3eda-047f-43f3-a9aa-caf367440fc2', '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6', 1, 1, 'modification', 'approved',
   'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab', 'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab',
   '5edec8d2-4583-4917-a30d-97605e2803a2',
   'تصحيح تلقائي: استعادة هدية مؤجلة بانتظار تأكيد بطاقة العرض');

SET session_replication_role = origin;
