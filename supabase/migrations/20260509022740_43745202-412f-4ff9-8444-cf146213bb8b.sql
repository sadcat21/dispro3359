
-- Move zones from sector مزغران (7188b41c) to sector 5 جويلية 1962 (8703b559)
WITH moved_zones AS (
  UPDATE public.sector_zones
  SET sector_id = '8703b559-3000-4b53-8312-a65ad007d8cf'
  WHERE sector_id = '7188b41c-5405-46e1-a8cf-8caf1b635c71'
    AND name IN ('Chateux','بالفودار','بايموت','حي 5 جويلية','حي شمومة','دبدابة','زغلول','سيدي فلاڤ','سيدي لعجال','شوما ديكراك','ليناس')
  RETURNING id
)
UPDATE public.customers
SET sector_id = '8703b559-3000-4b53-8312-a65ad007d8cf'
WHERE zone_id IN (SELECT id FROM moved_zones);
