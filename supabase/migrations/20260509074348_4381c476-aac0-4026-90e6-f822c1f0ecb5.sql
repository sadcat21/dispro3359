-- Insert 15 orders for worker BIG hichem (branch Mazaghran)
INSERT INTO public.orders (id, customer_id, created_by, assigned_worker_id, branch_id, status, delivery_date, payment_type, total_amount) VALUES
('b6582f4f-ee92-45f7-a7ca-c00fea49a627','5d29dce9-2bfc-4451-a3ea-eb2170bfad46','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',19000),
('dfe09dcf-3113-49b6-9466-a9cdfa8c315a','67a0fe69-87f6-46ac-91a3-0034ec3b1ae9','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',141750),
('cbbe2841-5b18-4167-8f44-26d2f8931c21','d757f653-25cc-423a-8c31-1a0604d1b897','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',11875),
('77074156-2a1d-412a-b3cc-3eb35eff313e','aa24ee87-522b-474a-899d-04cd28e662c2','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',19000),
('8e4c01fd-b9c3-4d4a-9a1d-1a90c2b59af8','ed404f4c-d8fd-494e-b581-01eaf327fff2','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',4750),
('04ee580e-11c9-44eb-b8a2-84122e3dccac','10e4420a-2621-44a3-88fb-3688d480509e','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',9500),
('7b6ddcdd-3561-481b-a518-930cd63f6816','33fb8e53-084b-4762-80c9-7c9c488af787','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',19000),
('e1695a42-cc72-4347-944e-65ced8c320da','02a2ddba-395f-4daa-99e9-df9a9b79dd69','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',9500),
('c464eb1e-52ea-44f4-b516-01609f542353','63523826-ab7b-408e-8afe-bc18cb02f874','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',9500),
('2ace12d9-69b5-4916-84db-6351b0ca309c','7b019324-57b9-4711-9475-9595bc56bcb6','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',16920),
('fbffd411-28b3-49f2-b21b-631ad9737fcd','c04ad891-e1d7-414b-b452-a54dbb42a697','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',9500),
('6230944d-db60-4d16-96c8-4d97788155aa','9fe6b88e-9995-4d9b-9cc9-3c37b9e6d8bd','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',19000),
('78574e8f-a614-4210-887c-a52a0358d99b','d35a20a5-4454-4c71-a044-a6a1ed80511b','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',4750),
('40b3d649-690c-4dbf-9afa-79a1f16ab684','aa35d3fc-6769-42b5-9e5c-cecf67efe20b','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',31170),
('98ad6476-9be9-42e1-b958-78a94752a898','8fa06510-800a-47c5-96cd-51d48b19deb7','6a458ecd-7e3d-45a4-a280-9d5671d70a31','d1023b86-ed15-42f9-9a0a-3edf2b29dc78','9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6','confirmed', CURRENT_DATE,'with_invoice',8650);

-- Insert order items
-- product ids: AROMA400=bf1a98c1, A125=e43ccedc, A250=c51e3eda, FAM=37b163aa, A700=81a2b197, BDN=c7180526, DIMA=67093e98
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price, pricing_unit) VALUES
-- 1. Rahal: 250x3 + Familial x1
('b6582f4f-ee92-45f7-a7ca-c00fea49a627','c51e3eda-047f-43f3-a9aa-caf367440fc2',3,4750,14250,'box'),
('b6582f4f-ee92-45f7-a7ca-c00fea49a627','37b163aa-0c3d-4695-8280-f0d088ceeb9f',1,4750,4750,'box'),
-- 2. Tayeb: 250x30 @ 4725
('dfe09dcf-3113-49b6-9466-a9cdfa8c315a','c51e3eda-047f-43f3-a9aa-caf367440fc2',30,4725,141750,'box'),
-- 3. Ahmed: 125x1 + 250x1 + Fam x1
('cbbe2841-5b18-4167-8f44-26d2f8931c21','e43ccedc-6c58-4dd2-b25e-2ab0a3d4e252',1,2375,2375,'box'),
('cbbe2841-5b18-4167-8f44-26d2f8931c21','c51e3eda-047f-43f3-a9aa-caf367440fc2',1,4750,4750,'box'),
('cbbe2841-5b18-4167-8f44-26d2f8931c21','37b163aa-0c3d-4695-8280-f0d088ceeb9f',1,4750,4750,'box'),
-- 4. Mansour: 125x2 + 250x3
('77074156-2a1d-412a-b3cc-3eb35eff313e','e43ccedc-6c58-4dd2-b25e-2ab0a3d4e252',2,2375,4750,'box'),
('77074156-2a1d-412a-b3cc-3eb35eff313e','c51e3eda-047f-43f3-a9aa-caf367440fc2',3,4750,14250,'box'),
-- 5. Ben Daoud: 250x1
('8e4c01fd-b9c3-4d4a-9a1d-1a90c2b59af8','c51e3eda-047f-43f3-a9aa-caf367440fc2',1,4750,4750,'box'),
-- 6. Zine: 250x2
('04ee580e-11c9-44eb-b8a2-84122e3dccac','c51e3eda-047f-43f3-a9aa-caf367440fc2',2,4750,9500,'box'),
-- 7. Mini shop: 250x2 + Fam x2
('7b6ddcdd-3561-481b-a518-930cd63f6816','c51e3eda-047f-43f3-a9aa-caf367440fc2',2,4750,9500,'box'),
('7b6ddcdd-3561-481b-a518-930cd63f6816','37b163aa-0c3d-4695-8280-f0d088ceeb9f',2,4750,9500,'box'),
-- 8. Family shop: 250x1 + BDN x1
('e1695a42-cc72-4347-944e-65ced8c320da','c51e3eda-047f-43f3-a9aa-caf367440fc2',1,4750,4750,'box'),
('e1695a42-cc72-4347-944e-65ced8c320da','c7180526-a70b-42c5-8c98-5925eb218939',1,4750,4750,'box'),
-- 9. Épicerie: BDN x2
('c464eb1e-52ea-44f4-b516-01609f542353','c7180526-a70b-42c5-8c98-5925eb218939',2,4750,9500,'box'),
-- 10. Baghdadi: 400x2 + 700x2
('2ace12d9-69b5-4916-84db-6351b0ca309c','bf1a98c1-2bf2-4026-90e5-ce5572070c7f',2,4500,9000,'box'),
('2ace12d9-69b5-4916-84db-6351b0ca309c','81a2b197-81a3-496a-b269-57332001fa69',2,3960,7920,'box'),
-- 11. Adel: 250x2
('fbffd411-28b3-49f2-b21b-631ad9737fcd','c51e3eda-047f-43f3-a9aa-caf367440fc2',2,4750,9500,'box'),
-- 12. Sadoune: 250x2 + Fam x2
('6230944d-db60-4d16-96c8-4d97788155aa','c51e3eda-047f-43f3-a9aa-caf367440fc2',2,4750,9500,'box'),
('6230944d-db60-4d16-96c8-4d97788155aa','37b163aa-0c3d-4695-8280-f0d088ceeb9f',2,4750,9500,'box'),
-- 13. Djillali: 250x1
('78574e8f-a614-4210-887c-a52a0358d99b','c51e3eda-047f-43f3-a9aa-caf367440fc2',1,4750,4750,'box'),
-- 14. Zouhir: 400x2 + 250x3 + 700x2
('40b3d649-690c-4dbf-9afa-79a1f16ab684','bf1a98c1-2bf2-4026-90e5-ce5572070c7f',2,4500,9000,'box'),
('40b3d649-690c-4dbf-9afa-79a1f16ab684','c51e3eda-047f-43f3-a9aa-caf367440fc2',3,4750,14250,'box'),
('40b3d649-690c-4dbf-9afa-79a1f16ab684','81a2b197-81a3-496a-b269-57332001fa69',2,3960,7920,'box'),
-- 15. Sweet home: 250x1 + DIMA x1
('98ad6476-9be9-42e1-b958-78a94752a898','c51e3eda-047f-43f3-a9aa-caf367440fc2',1,4750,4750,'box'),
('98ad6476-9be9-42e1-b958-78a94752a898','67093e98-2cc5-4499-bb2f-59712e9ce07d',1,3900,3900,'box');