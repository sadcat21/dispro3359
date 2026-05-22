import { supabase } from '@/integrations/supabase/client';

export interface ProjectManagerWorkerActivityItem {
  workerId: string;
  workerName: string;
  count: number;
  last: string;
}

export interface ProjectManagerWorkerActivitySummary {
  activeWorkersToday: number;
  deliveriesToday: number;
  list: ProjectManagerWorkerActivityItem[];
}

const startOfTodayIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
};

export async function fetchProjectManagerWorkerActivity(
  branchId?: string | null,
  sinceIso?: string,
): Promise<ProjectManagerWorkerActivitySummary> {
  let branchWorkerIds: string[] | null = null;

  if (branchId) {
    const { data: branchWorkers, error: branchWorkersError } = await supabase
      .from('workers_safe')
      .select('id')
      .eq('branch_id', branchId);

    if (branchWorkersError) throw branchWorkersError;

    branchWorkerIds = (branchWorkers || []).map((worker) => worker.id).filter(Boolean);

    if (branchWorkerIds.length === 0) {
      return { activeWorkersToday: 0, deliveriesToday: 0, list: [] };
    }
  }

  let movementsQuery = supabase
    .from('stock_movements')
    .select('worker_id, created_at')
    .eq('movement_type', 'delivery')
    .eq('status', 'approved')
    .gte('created_at', sinceIso || startOfTodayIso());

  if (branchWorkerIds) {
    movementsQuery = movementsQuery.in('worker_id', branchWorkerIds);
  }

  const { data: movementRows, error: movementsError } = await movementsQuery;
  if (movementsError) throw movementsError;

  const rows = (movementRows || []).filter(
    (row): row is { worker_id: string; created_at: string } => Boolean(row.worker_id),
  );

  if (rows.length === 0) {
    return { activeWorkersToday: 0, deliveriesToday: 0, list: [] };
  }

  const workerIds = [...new Set(rows.map((row) => row.worker_id))];
  const { data: workers, error: workersError } = await supabase
    .from('workers_safe')
    .select('id, full_name')
    .in('id', workerIds);

  if (workersError) throw workersError;

  const workerNames = new Map((workers || []).map((worker) => [worker.id, worker.full_name || '—']));
  const activityMap = new Map<string, ProjectManagerWorkerActivityItem>();

  for (const row of rows) {
    const current = activityMap.get(row.worker_id);
    if (current) {
      current.count += 1;
      if (row.created_at > current.last) current.last = row.created_at;
      continue;
    }

    activityMap.set(row.worker_id, {
      workerId: row.worker_id,
      workerName: workerNames.get(row.worker_id) || '—',
      count: 1,
      last: row.created_at,
    });
  }

  const list = [...activityMap.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));

  return {
    activeWorkersToday: list.length,
    deliveriesToday: rows.length,
    list,
  };
}