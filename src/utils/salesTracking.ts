import { supabase } from '@/integrations/supabase/client';
import { recordPendingOfferConfirmation } from '@/utils/pendingOfferConfirmations';

export type SalesSource = 'direct_sale' | 'delivery_sale' | 'warehouse_sale';

interface RecordSaleItem {
  productId: string;
  productName?: string | null;
  /** Quantity in B.P format (e.g. 6.03 = 6 boxes + 3 pieces) */
  quantity: number;
  giftBoxes?: number;
  giftPieces?: number;
  piecesPerBox?: number | null;
  unitPrice?: number;
  totalPrice?: number;
  orderItemId?: string | null;
  /** Offer applied for the gift on this line. When the offer has
   *  is_deferred_confirmation=true, the gift is recorded as pending
   *  (not deducted from worker stock) instead of being inserted into
   *  sales_tracking directly. */
  offerId?: string | null;
  giftProductId?: string | null;
  giftProductName?: string | null;
}

interface RecordSaleParams {
  source: SalesSource;
  orderId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  workerId?: string | null;
  workerName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  items: RecordSaleItem[];
}

/**
 * Insert one row per product into sales_tracking. Best-effort: errors are
 * logged but never thrown, so they cannot break the main sale flow.
 *
 * If a line has an offer with `is_deferred_confirmation = true`, the gift
 * portion is diverted to `pending_offer_confirmations` and NOT included in
 * the sales_tracking row, so the worker's stock is not deducted yet.
 */
export async function recordSaleTracking(params: RecordSaleParams): Promise<void> {
  try {
    if (!params.items.length) return;

    // Resolve deferred-offer flags in one batch
    const offerIds = Array.from(
      new Set(params.items.map((it) => it.offerId).filter(Boolean) as string[])
    );
    const deferredOfferIds = new Set<string>();
    if (offerIds.length > 0) {
      const { data } = await supabase
        .from('product_offers')
        .select('id, is_deferred_confirmation')
        .in('id', offerIds);
      for (const o of (data || []) as any[]) {
        if (o.is_deferred_confirmation) deferredOfferIds.add(o.id);
      }
    }

    const sourceForPending: 'order' | 'direct_sale' | 'delivery_sale' | 'warehouse_sale' =
      params.source as any;

    const rows: any[] = [];
    for (const it of params.items) {
      const ppb = Math.max(1, Number(it.piecesPerBox || 20));
      const qty = Math.round(Number(it.quantity || 0) * 100) / 100;
      const giftBoxes = Number(it.giftBoxes || 0);
      const giftPieces = Number(it.giftPieces || 0);

      const isDeferred = !!(it.offerId && deferredOfferIds.has(it.offerId));
      const hasGift = giftBoxes > 0 || giftPieces > 0;
      // Stored line quantity includes full-box gifts. For deferred offers,
      // remove those gifts from the immediate sale ledger so stock/achievement
      // summaries do not count them before manager confirmation.
      const trackedSoldQty = isDeferred ? Math.max(0, qty - giftBoxes) : qty;
      const soldBoxes = Math.floor(trackedSoldQty);
      const soldPieces = Math.round((trackedSoldQty - soldBoxes) * 100);

      // Divert gift to pending confirmations
      if (isDeferred && hasGift) {
        await recordPendingOfferConfirmation({
          orderId: params.orderId || null,
          orderItemId: it.orderItemId || null,
          offerId: it.offerId || null,
          productId: it.productId,
          productName: it.productName || null,
          piecesPerBox: ppb,
          giftProductId: it.giftProductId || null,
          giftProductName: it.giftProductName || it.productName || null,
          giftBoxes,
          giftPieces,
          customerId: params.customerId || null,
          customerName: params.customerName || null,
          workerId: params.workerId || null,
          workerName: params.workerName || null,
          branchId: params.branchId || null,
          branchName: params.branchName || null,
          source: sourceForPending,
        });
      }

      rows.push({
        source: params.source,
        order_id: params.orderId || null,
        order_item_id: it.orderItemId || null,
        product_id: it.productId,
        product_name: it.productName || null,
        pieces_per_box: ppb,
        sold_boxes: soldBoxes,
        sold_pieces: soldPieces,
        gift_boxes: isDeferred ? 0 : giftBoxes,
        gift_pieces: isDeferred ? 0 : giftPieces,
        unit_price: Number(it.unitPrice || 0),
        total_price: Number(it.totalPrice || 0),
        branch_id: params.branchId || null,
        worker_id: params.workerId || null,
        customer_id: params.customerId || null,
        worker_name: params.workerName || null,
        customer_name: params.customerName || null,
        branch_name: params.branchName || null,
        notes: params.notes || null,
      });
    }

    if (!rows.length) return;
    const { error } = await supabase.from('sales_tracking' as any).insert(rows as any);
    if (error) console.warn('[salesTracking] insert failed', error);
  } catch (e) {
    console.warn('[salesTracking] unexpected error', e);
  }
}
