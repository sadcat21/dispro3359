
-- Remove duplicate visit_tracking rows for the same operation, keep earliest
DELETE FROM public.visit_tracking vt
USING public.visit_tracking vt2
WHERE vt.operation_id IS NOT NULL
  AND vt.operation_id = vt2.operation_id
  AND vt.operation_type = vt2.operation_type
  AND (vt2.created_at < vt.created_at
       OR (vt2.created_at = vt.created_at AND vt2.id < vt.id));

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS visit_tracking_unique_operation
ON public.visit_tracking(operation_type, operation_id)
WHERE operation_id IS NOT NULL;
