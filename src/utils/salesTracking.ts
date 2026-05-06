import { supabase } from '@/integrations/supabase/client';

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
 */
export async function recordSaleTracking(params: RecordSaleParams): Promise<void> {
  try {
    const rows = params.items.map((it) => {
      const ppb = Math.max(1, Number(it.piecesPerBox || 20));
      const qty = Math.round(Number(it.quantity || 0) * 100) / 100;
      const soldBoxes = Math.floor(qty);
      const soldPieces = Math.round((qty - soldBoxes) * 100);
      return {
        source: params.source,
        order_id: params.orderId || null,
        order_item_id: it.orderItemId || null,
        product_id: it.productId,
        product_name: it.productName || null,
        pieces_per_box: ppb,
        sold_boxes: soldBoxes,
        sold_pieces: soldPieces,
        gift_boxes: Number(it.giftBoxes || 0),
        gift_pieces: Number(it.giftPieces || 0),
        unit_price: Number(it.unitPrice || 0),
        total_price: Number(it.totalPrice || 0),
        branch_id: params.branchId || null,
        worker_id: params.workerId || null,
        customer_id: params.customerId || null,
        worker_name: params.workerName || null,
        customer_name: params.customerName || null,
        branch_name: params.branchName || null,
        notes: params.notes || null,
      };
    });
    if (!rows.length) return;
    const { error } = await supabase.from('sales_tracking' as any).insert(rows as any);
    if (error) console.warn('[salesTracking] insert failed', error);
  } catch (e) {
    console.warn('[salesTracking] unexpected error', e);
  }
}
