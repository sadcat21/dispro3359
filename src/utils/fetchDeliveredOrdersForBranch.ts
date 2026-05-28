import { supabase } from '@/integrations/supabase/client';

interface FetchDeliveredOrdersForBranchOptions {
  branchId: string;
  minStart?: string | null;
  pageSize?: number;
  select: string;
  sinceIso?: string | null;
}

export async function fetchDeliveredOrdersForBranch({
  branchId,
  minStart,
  pageSize = 1000,
  select,
  sinceIso,
}: FetchDeliveredOrdersForBranchOptions) {
  if (!branchId) return [] as any[];

  const { data: branchWorkers, error: branchWorkersError } = await supabase
    .from('workers_safe')
    .select('id')
    .eq('branch_id', branchId);

  if (branchWorkersError) throw branchWorkersError;

  const branchWorkerIds = (branchWorkers || []).map((worker: any) => worker.id).filter(Boolean);
  const ordersById = new Map<string, any>();

  const fetchPagedOrders = async (applyFilter: (query: any) => any) => {
    let from = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = supabase
        .from('orders')
        .select(select)
        .eq('status', 'delivered')
        .order('updated_at', { ascending: false })
        .range(from, from + pageSize - 1);

      query = applyFilter(query);

      if (minStart) query = query.gte('updated_at', minStart);
      else if (sinceIso) query = query.gte('created_at', sinceIso);

      const { data: page, error } = await query;
      if (error) throw error;
      if (!page || page.length === 0) break;

      for (const order of (page as any[])) {
        if (order?.id) ordersById.set(order.id, order);
      }

      if (page.length < pageSize) break;
      from += pageSize;
    }
  };

  await fetchPagedOrders((query) => query.eq('branch_id', branchId));

  if (branchWorkerIds.length) {
    const chunkSize = 100;
    for (let i = 0; i < branchWorkerIds.length; i += chunkSize) {
      const chunk = branchWorkerIds.slice(i, i + chunkSize);
      await fetchPagedOrders((query) => query.in('assigned_worker_id', chunk).is('branch_id', null));
    }
  }

  return Array.from(ordersById.values());
}