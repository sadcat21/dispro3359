INSERT INTO public.accounting_sessions (worker_id, branch_id, manager_id, session_date, status, period_start, period_end, completed_at, notes)
SELECT 
  w.id,
  w.branch_id,
  '790cbb80-e8e1-4c8c-b8e7-21681ea15110'::uuid,
  '2026-05-30'::date,
  'completed',
  '2000-01-01 00:00:00+00'::timestamptz,
  '2026-05-30 09:16:48+00'::timestamptz,
  now(),
  'Auto-closed before factory receipt 709d11f1-79b7-4fda-ab17-7608c04cd307 to mark prior sales as accounted.'
FROM workers w
WHERE w.id IN (
  'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab',
  '45f8ce43-628a-4f21-97bd-a373ee13b22f',
  '79240031-b627-4d69-b8e8-d29edfb25cde',
  'd1023b86-ed15-42f9-9a0a-3edf2b29dc78',
  'b5d6d2a1-e69a-4254-bce7-f4cab1856c5c',
  '85d8cf13-9d63-450a-b149-934f217ec928'
);