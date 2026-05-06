import { supabase } from '@/integrations/supabase/client';

interface ItemLike {
  order_id?: string | null;
  product_id?: string | null;
  gift_quantity?: number | null;
  gift_pieces?: number | null;
  [key: string]: any;
}

/**
 * Mutates `items` in place: overrides `gift_quantity` and `gift_pieces` from
 * the authoritative `sales_tracking` ledger. Items without a tracking row keep
 * their original values. Errors are swallowed (best-effort enrichment).
 */
export async function mergeGiftsFromSalesTracking<T extends ItemLike>(items: T[]): Promise<T[]> {
  try {
    const orderIds = Array.from(new Set(items.map((i) => i.order_id).filter(Boolean) as string[]));
    if (!orderIds.length) return items;
    const { data, error } = await (supabase as any)
      .from('sales_tracking')
      .select('order_id, product_id, gift_boxes, gift_pieces')
      .in('order_id', orderIds);
    if (error || !data) return items;
    const map = new Map<string, { gb: number; gp: number }>();
    for (const r of data as any[]) {
      const k = `${r.order_id}::${r.product_id}`;
      const cur = map.get(k) || { gb: 0, gp: 0 };
      cur.gb += Number(r.gift_boxes || 0);
      cur.gp += Number(r.gift_pieces || 0);
      map.set(k, cur);
    }
    for (const it of items) {
      const k = `${it.order_id}::${it.product_id}`;
      const t = map.get(k);
      if (t) {
        it.gift_quantity = t.gb;
        it.gift_pieces = t.gp;
      }
    }
  } catch (e) {
    // ignore
  }
  return items;
}
