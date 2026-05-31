import { supabase } from '@/integrations/supabase/client';
import { orderAccountingTime, parseAccountingTime } from '@/hooks/useManagerTreasury';
import { fetchDeliveredOrdersForBranch } from '@/utils/fetchDeliveredOrdersForBranch';

export interface WorkerHeldRow {
  worker_id: string;
  name: string;
  cash: number;
  document: number;
  total: number;
}

export interface WorkerHeldResult {
  total: number;
  rows: WorkerHeldRow[];
}

export async function computeWorkerHeld(
  branchId: string | undefined,
  range?: { from?: string; to?: string }
): Promise<WorkerHeldResult> {
  if (!branchId) return { total: 0, rows: [] };

  // Paginated fetch to avoid 1000-row Supabase cap
  const orders = await fetchDeliveredOrdersForBranch({
    branchId,
    select:
      'id, payment_type, invoice_payment_method, payment_status, total_amount, partial_amount, assigned_worker_id, delivery_date, created_at',
  });

  let filtered = orders;
  if (range?.from) filtered = filtered.filter((o: any) => (o.delivery_date || '') >= range.from!);
  if (range?.to) filtered = filtered.filter((o: any) => (o.delivery_date || '') <= range.to!);

  // Only count orders that have an approved delivery stock_movement — this is the
  // source of truth aligned with SalesDetailsSummary. Orders flipped to delivered
  // without producing a delivery movement (e.g. deferred-offer confirms, manual
  // state restores) must be excluded to keep cash-held in sync with sales details.
  const orderIds = filtered.map((o: any) => o.id).filter(Boolean);
  const deliveredIds = new Set<string>();
  const chunkSize = 500;
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize);
    const { data: sm } = await supabase
      .from('stock_movements')
      .select('order_id')
      .eq('movement_type', 'delivery')
      .eq('status', 'approved')
      .in('order_id', chunk);
    (sm || []).forEach((r: any) => { if (r.order_id) deliveredIds.add(r.order_id); });
  }
  filtered = filtered.filter((o: any) => deliveredIds.has(o.id));

  const { data: sessions } = await supabase
    .from('accounting_sessions')
    .select('worker_id, period_start, period_end')
    .eq('status', 'completed')
    .eq('branch_id', branchId);

  const windows = (sessions || []).map((s: any) => ({
    worker_id: s.worker_id,
    start: parseAccountingTime(s.period_start),
    end: parseAccountingTime(s.period_end),
  }));

  const byWorker = new Map<string, { cash: number; document: number; total: number }>();
  let total = 0;
  filtered.forEach((o: any) => {
    if (!o.assigned_worker_id) return;
    let paid = Number(o.total_amount || 0);
    if (o.payment_status === 'partial') paid = Number(o.partial_amount || 0);
    else if (o.payment_status === 'debt') paid = 0;
    if (paid <= 0) return;
    const t = orderAccountingTime(o);
    const covered = windows.some(
      (w) => w.worker_id === o.assigned_worker_id && t >= w.start && t <= w.end
    );
    if (covered) return;
    const method = String(o.invoice_payment_method || '').toLowerCase();
    const isCash = o.payment_type === 'without_invoice' || method === 'cash' || method === '';
    const cur = byWorker.get(o.assigned_worker_id) || { cash: 0, document: 0, total: 0 };
    if (isCash) cur.cash += paid;
    else cur.document += paid;
    cur.total += paid;
    byWorker.set(o.assigned_worker_id, cur);
    total += paid;
  });

  // Apply manual liability adjustments (subtract reduces what worker holds)
  const { data: adjustments } = await supabase
    .from('worker_liability_adjustments')
    .select('worker_id, amount, adjustment_type')
    .eq('branch_id', branchId);
  (adjustments || []).forEach((a: any) => {
    const delta = a.adjustment_type === 'add' ? Number(a.amount || 0) : -Number(a.amount || 0);
    if (!delta) return;
    const cur = byWorker.get(a.worker_id) || { cash: 0, document: 0, total: 0 };
    // Distribute delta proportionally over cash + document so manual zeroing
    // collapses both buckets, not only the cash bucket.
    const gross = Math.abs(cur.cash) + Math.abs(cur.document);
    if (gross > 0) {
      const cashShare = Math.abs(cur.cash) / gross;
      cur.cash += delta * cashShare;
      cur.document += delta * (1 - cashShare);
    } else {
      cur.cash += delta;
    }
    cur.total += delta;
    byWorker.set(a.worker_id, cur);
    total += delta;
  });

  const workerIds = Array.from(byWorker.keys()).filter((id) => {
    const v = byWorker.get(id)!;
    return Math.abs(v.total) > 0.5;
  });
  let nameMap = new Map<string, string>();
  if (workerIds.length) {
    const { data: workers } = await supabase
      .from('workers')
      .select('id, full_name')
      .in('id', workerIds);
    nameMap = new Map((workers || []).map((w: any) => [w.id, w.full_name]));
  }

  const rows: WorkerHeldRow[] = workerIds
    .map((id) => ({ worker_id: id, name: nameMap.get(id) || '—', ...byWorker.get(id)! }))
    .sort((a, b) => b.total - a.total);

  return { total, rows };
}
