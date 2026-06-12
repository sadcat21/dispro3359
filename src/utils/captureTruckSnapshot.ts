import { supabase } from '@/integrations/supabase/client';

// Convert period string (date or datetime) to timestamptz boundary
const toTz = (v: string, isEnd: boolean) => {
  if (v.includes('+') || v.includes('Z')) return v;
  if (v.includes('T')) return v + ':00+01:00';
  return isEnd ? v + 'T23:59:59+01:00' : v + 'T00:00:00+01:00';
};

interface SnapshotRow {
  session_id: string;
  product_id: string | null;
  product_name: string;
  loaded: number;
  unloaded: number;
  sold: number;
  system_qty: number;
  actual_qty: number | null;
  diff: number | null;
}

/**
 * Persists the truck balance state for a worker at the moment an accounting
 * session is saved. The branch-manager review dialog reads from this snapshot
 * so values stay frozen at save-time, independent of the worker's live truck.
 */
export async function captureTruckSnapshot(
  sessionId: string,
  workerId: string,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  if (!sessionId || !workerId || !periodStart || !periodEnd) return;

  const startTz = toTz(periodStart, false);
  const endTz = toTz(periodEnd, true);

  // Run all reads in parallel
  const [
    workerStockRes,
    loadMovesRes,
    deliveryMovesRes,
    loadingSessionsRes,
    reviewSessionsRes,
  ] = await Promise.all([
    supabase
      .from('worker_stock')
      .select('product_id, quantity, product:products(name)')
      .eq('worker_id', workerId),
    supabase
      .from('stock_movements')
      .select('product_id, quantity, status, product:products(name)')
      .eq('worker_id', workerId)
      .eq('movement_type', 'load')
      .gte('created_at', startTz)
      .lte('created_at', endTz),
    supabase
      .from('stock_movements')
      .select('product_id, quantity, product:products(name)')
      .eq('worker_id', workerId)
      .eq('movement_type', 'delivery')
      .gte('created_at', startTz)
      .lte('created_at', endTz),
    supabase
      .from('loading_sessions')
      .select('id, status, unloading_details')
      .eq('worker_id', workerId)
      .gte('created_at', startTz),
    supabase
      .from('loading_sessions')
      .select('id, status, created_at')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const map = new Map<string, SnapshotRow>();
  const getRow = (productId: string | null, productName: string) => {
    const key = productName || productId || '';
    if (!map.has(key)) {
      map.set(key, {
        session_id: sessionId,
        product_id: productId,
        product_name: productName || '—',
        loaded: 0,
        unloaded: 0,
        sold: 0,
        system_qty: 0,
        actual_qty: null,
        diff: null,
      });
    }
    return map.get(key)!;
  };

  // Truck stock (system_qty)
  for (const r of (workerStockRes.data || []) as any[]) {
    const name = r.product?.name || '';
    if (!name) continue;
    const row = getRow(r.product_id, name);
    row.system_qty = Number(r.quantity || 0);
  }

  // Loaded
  for (const m of (loadMovesRes.data || []) as any[]) {
    if (m.status === 'rejected') continue;
    const name = m.product?.name || '';
    if (!name) continue;
    const row = getRow(m.product_id, name);
    row.loaded += Number(m.quantity || 0);
  }

  // Sold (delivery movements)
  for (const m of (deliveryMovesRes.data || []) as any[]) {
    const name = m.product?.name || '';
    if (!name) continue;
    const row = getRow(m.product_id, name);
    row.sold += Number(m.quantity || 0);
  }

  // Unloaded — from loading_session_items + unloading_details JSON fallback
  const allSessions = (loadingSessionsRes.data || []) as any[];
  const unloadSessionIds = allSessions.filter(s => s.status === 'unloaded').map(s => s.id);
  const unloadSessionsWithItems = new Set<string>();
  if (unloadSessionIds.length > 0) {
    const { data: items } = await supabase
      .from('loading_session_items')
      .select('session_id, quantity, gift_quantity, product_id, product:products(name)')
      .in('session_id', unloadSessionIds);
    for (const it of (items || []) as any[]) {
      const name = it.product?.name || '';
      if (!name) continue;
      const giftPieces = Number(it.gift_quantity || 0);
      const qty = Number(it.quantity || 0) + giftPieces / 100;
      const row = getRow(it.product_id, name);
      row.unloaded += qty;
      unloadSessionsWithItems.add(it.session_id);
    }
  }
  for (const session of allSessions) {
    if (session.status !== 'unloaded' || unloadSessionsWithItems.has(session.id)) continue;
    const details = Array.isArray(session.unloading_details) ? session.unloading_details : [];
    for (const d of details) {
      const name = d?.product_name || '';
      if (!name) continue;
      const qty = Number(d.return_qty || d.actual_qty || 0) + Number(d.surplus_qty || 0);
      if (qty <= 0) continue;
      const row = getRow(d.product_id || null, name);
      row.unloaded += qty;
    }
  }

  // Review (actual / diff) — only when latest session is a review
  const latestSession = (reviewSessionsRes.data || [])[0] as any;
  if (latestSession?.status === 'review') {
    const { data: reviewItems } = await supabase
      .from('loading_session_items')
      .select('product_id, previous_quantity, quantity, product:products(name)')
      .eq('session_id', latestSession.id);
    for (const it of (reviewItems || []) as any[]) {
      const name = it.product?.name || '';
      if (!name) continue;
      const systemQty = Number(it.previous_quantity || 0);
      const actualQty = Number(it.quantity || 0);
      const row = getRow(it.product_id, name);
      row.actual_qty = actualQty;
      row.diff = actualQty - systemQty;
      // Override system_qty with review's previous_quantity so the snapshot
      // mirrors what the manager saw at save time.
      row.system_qty = systemQty;
    }
  }

  const rows = Array.from(map.values()).filter(
    r => r.loaded > 0 || r.unloaded > 0 || r.sold > 0 || r.system_qty > 0 || r.actual_qty !== null,
  );

  // Replace any existing snapshot for this session (edit flow)
  await supabase.from('accounting_session_truck_snapshots').delete().eq('session_id', sessionId);
  if (rows.length > 0) {
    const { error } = await supabase.from('accounting_session_truck_snapshots').insert(rows);
    if (error) {
      console.warn('captureTruckSnapshot insert failed', error);
    }
  }
}
