export interface SalesTrackingLikeRow {
  order_id?: string | null;
  product_id?: string | null;
  sold_at?: string | null;
  source?: string | null;
  sold_boxes?: number | null;
  sold_pieces?: number | null;
  gift_boxes?: number | null;
  gift_pieces?: number | null;
  worker_id?: string | null;
  customer_id?: string | null;
}

const getPriority = (row: SalesTrackingLikeRow) => {
  switch (row.source) {
    case 'warehouse_sale':
      return 3;
    case 'delivery_sale':
      return 2;
    case 'direct_sale':
      return 1;
    default:
      return 0;
  }
};

const toTime = (value?: string | null) => new Date(value || 0).getTime() || 0;

const shouldReplace = (current: SalesTrackingLikeRow, next: SalesTrackingLikeRow) => {
  const currentPriority = getPriority(current);
  const nextPriority = getPriority(next);
  if (nextPriority !== currentPriority) return nextPriority > currentPriority;
  return toTime(next.sold_at) > toTime(current.sold_at);
};

export const dedupeSalesTrackingRows = <T extends SalesTrackingLikeRow>(rows: T[]): T[] => {
  const byOrderProduct = new Map<string, T>();
  const passthrough: T[] = [];
  const seenFallback = new Set<string>();

  for (const row of rows) {
    if (row.order_id && row.product_id) {
      const key = `${row.order_id}::${row.product_id}::${row.worker_id || ''}`;
      const existing = byOrderProduct.get(key);
      if (!existing || shouldReplace(existing, row)) {
        byOrderProduct.set(key, row);
      }
      continue;
    }

    const fallbackKey = [
      row.product_id || '',
      row.worker_id || '',
      row.customer_id || '',
      row.sold_at || '',
      Number(row.sold_boxes || 0),
      Number(row.sold_pieces || 0),
      Number(row.gift_boxes || 0),
      Number(row.gift_pieces || 0),
      row.source || '',
    ].join('|');

    if (!seenFallback.has(fallbackKey)) {
      seenFallback.add(fallbackKey);
      passthrough.push(row);
    }
  }

  return [...passthrough, ...byOrderProduct.values()];
};