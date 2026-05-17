import { supabase } from '@/integrations/supabase/client';

/**
 * Single source of truth for "which offers defer gift stock until confirmation".
 *
 * Every code path that deducts from `worker_stock` / `warehouse_stock` or
 * inserts into `stock_movements` for a sold/delivered item MUST resolve the
 * deferred set first and exclude `gift_quantity` (boxes) + `gift_pieces`
 * from the deducted amount for deferred items.
 *
 * @see mem://features/deferred-gift-stock
 */
export async function resolveDeferredOfferIds(offerIds: (string | null | undefined)[]): Promise<Set<string>> {
  const unique = Array.from(new Set(offerIds.filter((x): x is string => !!x)));
  const out = new Set<string>();
  if (unique.length === 0) return out;
  const { data } = await supabase
    .from('product_offers')
    .select('id, is_deferred_confirmation')
    .in('id', unique);
  for (const o of (data || []) as any[]) {
    if (o.is_deferred_confirmation) out.add(o.id);
  }
  return out;
}

/**
 * Returns the box count to actually deduct from stock for a sold item.
 * If the item's gift offer is deferred, gift boxes stay in the truck/warehouse
 * until the worker confirms the pending offer card.
 */
export function effectiveDeductBoxes(params: {
  quantity: number;        // total boxes (paid + gift)
  giftQuantity: number;    // gift boxes included in quantity
  giftOfferId?: string | null;
  deferredOfferIds: Set<string>;
}): number {
  const deferred = !!(params.giftOfferId && params.deferredOfferIds.has(params.giftOfferId));
  return deferred
    ? Math.max(0, Number(params.quantity || 0) - Number(params.giftQuantity || 0))
    : Number(params.quantity || 0);
}
