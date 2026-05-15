import { supabase } from '@/integrations/supabase/client';

export interface RecordPendingOfferInput {
  orderId?: string | null;
  orderItemId?: string | null;
  offerId?: string | null;
  productId: string;
  productName?: string | null;
  piecesPerBox?: number | null;
  giftProductId?: string | null;
  giftProductName?: string | null;
  giftBoxes?: number;
  giftPieces?: number;
  purchasedBoxes?: number;
  purchasedPieces?: number;
  customerId?: string | null;
  customerName?: string | null;
  workerId?: string | null;
  workerName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  source?: 'order' | 'direct_sale' | 'delivery_sale' | 'warehouse_sale';
  notes?: string | null;
}

/** Insert one pending-offer record. Best-effort; logs on failure. */
export async function recordPendingOfferConfirmation(input: RecordPendingOfferInput): Promise<void> {
  try {
    if (!input.productId) return;
    const giftBoxes = Math.max(0, Math.floor(Number(input.giftBoxes || 0)));
    const giftPieces = Math.max(0, Math.floor(Number(input.giftPieces || 0)));
    if (giftBoxes === 0 && giftPieces === 0) return;

    const row: any = {
      order_id: input.orderId || null,
      order_item_id: input.orderItemId || null,
      offer_id: input.offerId || null,
      product_id: input.productId,
      product_name: input.productName || null,
      pieces_per_box: Math.max(1, Number(input.piecesPerBox || 1)),
      gift_product_id: input.giftProductId || null,
      gift_product_name: input.giftProductName || null,
      gift_boxes: giftBoxes,
      gift_pieces: giftPieces,
      purchased_boxes: Math.max(0, Math.floor(Number(input.purchasedBoxes || 0))),
      purchased_pieces: Math.max(0, Math.floor(Number(input.purchasedPieces || 0))),
      customer_id: input.customerId || null,
      customer_name: input.customerName || null,
      worker_id: input.workerId || null,
      worker_name: input.workerName || null,
      branch_id: input.branchId || null,
      branch_name: input.branchName || null,
      source: input.source || 'order',
      notes: input.notes || null,
    };

    // De-duplicate: when the same order line / offer already has a pending
    // confirmation card, refresh it in place instead of stacking a new card.
    // This prevents "modifying a sale from 1 box to 2 boxes" from creating a
    // second confirmation card next to the original.
    try {
      let delQuery = (supabase as any)
        .from('pending_offer_confirmations')
        .delete()
        .eq('product_id', input.productId)
        .eq('status', 'pending');
      if (input.orderId) {
        delQuery = delQuery.eq('order_id', input.orderId);
      } else {
        delQuery = delQuery.is('order_id', null);
      }
      if (input.orderItemId) {
        delQuery = delQuery.eq('order_item_id', input.orderItemId);
      } else {
        delQuery = delQuery.is('order_item_id', null);
      }
      if (input.offerId) {
        delQuery = delQuery.eq('offer_id', input.offerId);
      } else {
        delQuery = delQuery.is('offer_id', null);
      }
      await delQuery;
    } catch (e) {
      console.warn('[pendingOfferConfirmations] dedup delete failed', e);
    }

    const { error } = await supabase.from('pending_offer_confirmations' as any).insert(row);
    if (error) console.warn('[pendingOfferConfirmations] insert failed', error);
  } catch (e) {
    console.warn('[pendingOfferConfirmations] unexpected error', e);
  }
}

export async function confirmPendingOffer(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any).rpc('confirm_pending_offer', { p_id: id });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function rejectPendingOffer(id: string, notes?: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any).rpc('reject_pending_offer', { p_id: id, p_notes: notes || null });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
