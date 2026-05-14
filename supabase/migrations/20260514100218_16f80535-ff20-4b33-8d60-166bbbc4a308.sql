-- Recalibrate worker_stock for worker Hicham (d1023b86) per the rule:
--   balance = last load - non-cancelled sales
-- Café d'Or 250gr (ppb 20):  5.10 (110 pcs) - 20 pcs delivered = 90 pcs = 4.10 b.p
-- CAFE AROMA POT 700 (ppb 6): 6.03 (39 pcs) - 0  (only movement was on a cancelled order) = 6.03 b.p

UPDATE public.worker_stock
SET quantity = 4.10, updated_at = now()
WHERE worker_id = 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78'
  AND product_id = '504fc5c8-ae46-40d1-affe-ac3f24aa6b9b';

UPDATE public.worker_stock
SET quantity = 6.03, updated_at = now()
WHERE worker_id = 'd1023b86-ed15-42f9-9a0a-3edf2b29dc78'
  AND product_id = '81a2b197-81a3-496a-b269-57332001fa69';