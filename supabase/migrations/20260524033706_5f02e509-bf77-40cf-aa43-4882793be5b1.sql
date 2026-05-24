
UPDATE public.sales_tracking
SET created_at = created_at - INTERVAL '1 day',
    updated_at = updated_at - INTERVAL '1 day'
WHERE created_at::date = CURRENT_DATE;

UPDATE public.order_items
SET created_at = created_at - INTERVAL '1 day'
WHERE created_at::date = CURRENT_DATE;

UPDATE public.orders
SET created_at = created_at - INTERVAL '1 day',
    updated_at = updated_at - INTERVAL '1 day'
WHERE created_at::date = CURRENT_DATE;

UPDATE public.pending_offer_confirmations
SET created_at = created_at - INTERVAL '1 day',
    updated_at = updated_at - INTERVAL '1 day',
    confirmed_at = CASE WHEN confirmed_at IS NOT NULL THEN confirmed_at - INTERVAL '1 day' ELSE NULL END
WHERE created_at::date = CURRENT_DATE;

UPDATE public.stock_movements
SET created_at = created_at - INTERVAL '1 day'
WHERE created_at::date = CURRENT_DATE
  AND movement_type IN ('sale','direct_sale','warehouse_sale','delivery_sale');
