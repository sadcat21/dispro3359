
DELETE FROM public.loading_session_items
WHERE session_id IN (
  'bde8a852-cf26-450e-afe3-80bf858d5b0b',
  '8995e5bd-356e-4f1f-a0f4-40cad6030ebe'
);

DELETE FROM public.loading_sessions
WHERE id IN (
  'bde8a852-cf26-450e-afe3-80bf858d5b0b',
  '8995e5bd-356e-4f1f-a0f4-40cad6030ebe'
);

SELECT public.recalibrate_worker_stock('ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab'::uuid);
