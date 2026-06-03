-- تعليم حركات "التفريغ من العامل" المكررة كـ rejected
-- المعيار: نفس (worker_id, product_id, branch_id), movement_type='return',
-- status != 'rejected', reference_type IS NULL (تفريغ يدوي وليس جلسة شحن),
-- notes تبدأ بـ 'تفريغ '. نُبقي الأقدم فقط.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY worker_id, product_id, branch_id
      ORDER BY created_at ASC
    ) AS rn
  FROM public.stock_movements
  WHERE movement_type = 'return'
    AND status <> 'rejected'
    AND worker_id IS NOT NULL
    AND product_id IS NOT NULL
    AND branch_id IS NOT NULL
    AND reference_type IS NULL
    AND notes LIKE 'تفريغ %'
)
UPDATE public.stock_movements sm
SET status = 'rejected',
    notes = COALESCE(sm.notes, '') || ' [مكرر — تم الإلغاء تلقائياً]'
FROM ranked r
WHERE sm.id = r.id
  AND r.rn > 1;