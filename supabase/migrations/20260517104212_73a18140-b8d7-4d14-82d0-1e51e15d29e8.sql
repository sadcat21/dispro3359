UPDATE public.orders SET status='cancelled', updated_at=now() WHERE id='e38bf8eb-f6bf-4490-a222-7f3c65398c70';
DELETE FROM public.sales_tracking WHERE order_id='e38bf8eb-f6bf-4490-a222-7f3c65398c70';
DELETE FROM public.pending_offer_confirmations WHERE order_id='e38bf8eb-f6bf-4490-a222-7f3c65398c70';