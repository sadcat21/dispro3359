DELETE FROM public.stock_movements
WHERE return_reason = 'damaged'
   OR notes ILIKE '%استبدال تالف%';