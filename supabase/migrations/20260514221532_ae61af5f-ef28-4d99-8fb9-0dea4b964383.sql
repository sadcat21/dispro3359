DO $$
DECLARE
  rec RECORD;
  restore_qty NUMERIC;
BEGIN
  FOR rec IN
    SELECT poc.id, poc.worker_id, poc.product_id, poc.gift_product_id,
           poc.gift_pieces, poc.gift_boxes, poc.pieces_per_box
    FROM pending_offer_confirmations poc
    JOIN orders o ON o.id = poc.order_id
    WHERE poc.status = 'confirmed'
      AND o.status = 'cancelled'
  LOOP
    restore_qty := COALESCE(rec.gift_boxes,0)
                 + COALESCE(rec.gift_pieces,0)::numeric / GREATEST(rec.pieces_per_box,1);
    IF restore_qty > 0 THEN
      UPDATE worker_stock
        SET quantity = quantity + restore_qty
        WHERE worker_id = rec.worker_id
          AND product_id = COALESCE(rec.gift_product_id, rec.product_id);
    END IF;
    UPDATE pending_offer_confirmations
      SET status = 'rejected',
          notes = COALESCE(notes,'') || ' | استرجاع: تم تأكيد الهدية بعد إلغاء البيع'
      WHERE id = rec.id;
  END LOOP;
END $$;