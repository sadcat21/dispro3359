UPDATE public.pending_offer_confirmations
SET purchased_boxes = GREATEST(0, purchased_boxes - gift_boxes)
WHERE id = '408c9f2f-8fc2-4cd3-84a9-ee9e9b6abf45'
  AND purchased_boxes = 26 AND gift_boxes = 1;

UPDATE public.pending_offer_confirmations p
SET purchased_boxes = GREATEST(0, p.purchased_boxes - p.gift_boxes)
FROM public.order_items oi
WHERE p.order_item_id = oi.id
  AND p.purchased_boxes = FLOOR(oi.quantity)::int
  AND p.gift_boxes > 0
  AND p.gift_boxes = oi.gift_quantity
  AND oi.quantity::int = (p.purchased_boxes);