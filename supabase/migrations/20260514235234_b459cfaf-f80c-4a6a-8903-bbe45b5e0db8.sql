ALTER TABLE public.pending_offer_confirmations
  ADD COLUMN IF NOT EXISTS purchased_boxes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchased_pieces integer NOT NULL DEFAULT 0;