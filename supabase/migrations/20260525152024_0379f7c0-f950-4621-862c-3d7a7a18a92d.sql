-- Fix inflated sales_tracking rows for worker ce5b6f33 caused by purchased_boxes being stored in pieces
UPDATE public.sales_tracking SET sold_boxes = 20  WHERE id = '376a5b3a-6b54-46d6-a2e9-4d33f1d42769';
UPDATE public.sales_tracking SET sold_boxes = 2   WHERE id = '0c0c6ad7-a45b-4411-bb97-f972e4477ce5';
UPDATE public.sales_tracking SET sold_boxes = 4   WHERE id = '64f6febf-29d1-413e-aad0-eb6baefbd37d';
UPDATE public.sales_tracking SET sold_boxes = 4   WHERE id = 'a0744ca9-e809-4a2a-ae11-18db164f7ed8';
UPDATE public.sales_tracking SET sold_boxes = 1   WHERE id = '24f13ec6-3102-41b4-ac2c-853b48172707';
UPDATE public.sales_tracking SET sold_boxes = 1   WHERE id = '79210aed-d101-49d6-ab1f-64e2c4365ca7';