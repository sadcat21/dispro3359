-- Force-deliver order fa475019: mark as fully paid in cash and bump updated_at so it falls in the current accounting session window
UPDATE public.orders
SET payment_status = 'cash',
    partial_amount = total_amount,
    status = 'delivered',
    updated_at = now()
WHERE id = 'fa475019-09cc-45f2-9f40-25540a47956f';

-- Close any remaining debt on this order
UPDATE public.customer_debts
SET paid_amount = total_amount,
    remaining_amount = 0,
    status = 'paid'
WHERE order_id = 'fa475019-09cc-45f2-9f40-25540a47956f';