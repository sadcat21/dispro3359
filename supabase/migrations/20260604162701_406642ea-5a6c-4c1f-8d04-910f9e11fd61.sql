-- Backfill: reclassify historical debt_payments from 'cash' to 'versement_cash'
-- when the originating order's invoice was receipt/transfer marked paid_by_cash.
UPDATE public.debt_payments dp
SET payment_method = 'versement_cash'
FROM public.customer_debts cd
JOIN public.orders o ON o.id = cd.order_id
WHERE dp.debt_id = cd.id
  AND lower(dp.payment_method) = 'cash'
  AND o.payment_type = 'with_invoice'
  AND lower(coalesce(o.invoice_payment_method, '')) IN ('receipt', 'versement', 'transfer', 'virement')
  AND (o.document_verification->>'paid_by_cash')::boolean IS TRUE;