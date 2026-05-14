-- Restore worker stock for CAFE AROMA POT 700 Gr (worker Hicham) by removing
-- an orphan promo whose order was already cancelled but whose ledger entries
-- still deducted gift+sale pieces from worker_stock. The DELETE fires
-- promo_ledger_trigger → delete_promo_ledger_entries which converts pieces
-- back to b.p and adds them to worker_stock with row-level locks.
DELETE FROM public.promos WHERE id = 'ed00c776-da58-41c7-b6c8-d6975c113af4';