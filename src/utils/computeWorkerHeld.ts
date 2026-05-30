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

  const workerIds = Array.from(byWorker.keys());
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
