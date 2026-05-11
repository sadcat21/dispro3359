import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SalesTrackingRow = {
  id: string;
  source: 'direct_sale' | 'delivery_sale' | 'warehouse_sale';
  order_id: string | null;
  order_item_id: string | null;
  product_id: string | null;
  product_name: string | null;
  pieces_per_box: number;
  sold_boxes: number;
  sold_pieces: number;
  gift_boxes: number;
  gift_pieces: number;
  total_boxes: number;
  total_pieces: number;
  unit_price: number;
  total_price: number;
  branch_id: string | null;
  worker_id: string | null;
  customer_id: string | null;
  worker_name: string | null;
  customer_name: string | null;
  branch_name: string | null;
  notes: string | null;
  sold_at: string;
};

export interface SalesTrackingFilters {
  branchId?: string | null;
  workerId?: string | null;
  customerId?: string | null;
  productId?: string | null;
  source?: SalesTrackingRow['source'];
  /** ISO date (inclusive) */
  from?: string;
  /** ISO date (exclusive upper bound) */
  to?: string;
  /** include only rows with gifts */
  giftsOnly?: boolean;
  enabled?: boolean;
}

/**
 * Unified read of the sales_tracking ledger.
 * Source of truth for sales + gift quantities across the stats and review screens.
 */
export const useSalesTracking = (filters: SalesTrackingFilters = {}) => {
  return useQuery({
    queryKey: ['sales-tracking', filters],
    enabled: filters.enabled ?? true,
    queryFn: async () => {
      let q = (supabase as any).from('sales_tracking').select('*').order('sold_at', { ascending: false });
      if (filters.branchId) q = q.eq('branch_id', filters.branchId);
      if (filters.workerId) q = q.eq('worker_id', filters.workerId);
      if (filters.customerId) q = q.eq('customer_id', filters.customerId);
      if (filters.productId) q = q.eq('product_id', filters.productId);
      if (filters.source) q = q.eq('source', filters.source);
      if (filters.from) q = q.gte('sold_at', filters.from);
      if (filters.to) q = q.lt('sold_at', filters.to);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data || []) as SalesTrackingRow[];
      // Enrich missing worker_name / customer_name / branch_name / product_name from related tables
      try {
        const missingWorkerIds = Array.from(new Set(rows.filter(r => r.worker_id && !r.worker_name).map(r => r.worker_id as string)));
        if (missingWorkerIds.length) {
          const { data: ws } = await (supabase as any).from('workers').select('id, full_name').in('id', missingWorkerIds);
          const map = new Map<string, string>((ws || []).map((w: any) => [w.id, w.full_name]));
          rows = rows.map(r => (r.worker_id && !r.worker_name && map.has(r.worker_id)) ? { ...r, worker_name: map.get(r.worker_id) || null } : r);
        }
        const missingCustomerIds = Array.from(new Set(rows.filter(r => r.customer_id && !r.customer_name).map(r => r.customer_id as string)));
        if (missingCustomerIds.length) {
          const { data: cs } = await (supabase as any).from('customers').select('id, name').in('id', missingCustomerIds);
          const map = new Map<string, string>((cs || []).map((c: any) => [c.id, c.name]));
          rows = rows.map(r => (r.customer_id && !r.customer_name && map.has(r.customer_id)) ? { ...r, customer_name: map.get(r.customer_id) || null } : r);
        }
        const missingBranchIds = Array.from(new Set(rows.filter(r => r.branch_id && !r.branch_name).map(r => r.branch_id as string)));
        if (missingBranchIds.length) {
          const { data: bs } = await (supabase as any).from('branches').select('id, name').in('id', missingBranchIds);
          const map = new Map<string, string>((bs || []).map((b: any) => [b.id, b.name]));
          rows = rows.map(r => (r.branch_id && !r.branch_name && map.has(r.branch_id)) ? { ...r, branch_name: map.get(r.branch_id) || null } : r);
        }
        const missingProductIds = Array.from(new Set(rows.filter(r => r.product_id && !r.product_name).map(r => r.product_id as string)));
        if (missingProductIds.length) {
          const { data: ps } = await (supabase as any).from('products').select('id, name').in('id', missingProductIds);
          const map = new Map<string, string>((ps || []).map((p: any) => [p.id, p.name]));
          rows = rows.map(r => (r.product_id && !r.product_name && map.has(r.product_id)) ? { ...r, product_name: map.get(r.product_id) || null } : r);
        }
      } catch (e) {
        console.warn('[useSalesTracking] enrichment failed', e);
      }
      if (filters.giftsOnly) {
        rows = rows.filter((r) => Number(r.gift_boxes || 0) > 0 || Number(r.gift_pieces || 0) > 0);
      }
      return rows;
    },
  });
};

export interface ProductSalesAggregate {
  productId: string;
  productName: string | null;
  piecesPerBox: number;
  soldBoxes: number;
  soldPieces: number;
  giftBoxes: number;
  giftPieces: number;
  totalBoxes: number;
  totalPieces: number;
  totalAmount: number;
}

/** Aggregate rows by product, normalizing pieces into boxes. */
export const aggregateSalesByProduct = (rows: SalesTrackingRow[]): ProductSalesAggregate[] => {
  const map = new Map<string, ProductSalesAggregate>();
  for (const r of rows) {
    if (!r.product_id) continue;
    const ppb = Math.max(1, Number(r.pieces_per_box || 20));
    const cur = map.get(r.product_id) || {
      productId: r.product_id,
      productName: r.product_name,
      piecesPerBox: ppb,
      soldBoxes: 0, soldPieces: 0,
      giftBoxes: 0, giftPieces: 0,
      totalBoxes: 0, totalPieces: 0,
      totalAmount: 0,
    };
    cur.soldBoxes += Number(r.sold_boxes || 0);
    cur.soldPieces += Number(r.sold_pieces || 0);
    cur.giftBoxes += Number(r.gift_boxes || 0);
    cur.giftPieces += Number(r.gift_pieces || 0);
    cur.totalAmount += Number(r.total_price || 0);
    map.set(r.product_id, cur);
  }
  // Normalize piece overflow into boxes
  for (const a of map.values()) {
    const ppb = a.piecesPerBox;
    const soldP = a.soldBoxes * ppb + a.soldPieces;
    a.soldBoxes = Math.floor(soldP / ppb); a.soldPieces = soldP % ppb;
    const giftP = a.giftBoxes * ppb + a.giftPieces;
    a.giftBoxes = Math.floor(giftP / ppb); a.giftPieces = giftP % ppb;
    const totP = soldP + giftP;
    a.totalBoxes = Math.floor(totP / ppb); a.totalPieces = totP % ppb;
  }
  return Array.from(map.values());
};
