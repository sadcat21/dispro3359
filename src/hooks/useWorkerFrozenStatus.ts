import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export interface WorkerFrozenStatus {
  isFrozen: boolean;
  totalRemaining: number;
  debtsCount: number;
}

/**
 * يعتبر الموظف مجمَّداً إذا كان عليه أي دين عجز (debt_type='deficit')
 * غير مسدَّد بعدُ ناتج عن مراجعة المخزون.
 * بمجرد سداد الدين (remaining_amount=0 أو status='paid') يُرفع التجميد تلقائياً.
 */
export const useWorkerFrozenStatus = (workerId?: string | null) => {
  useRealtimeSubscription(
    `worker-frozen-${workerId || 'none'}`,
    workerId ? [{ table: 'worker_debts', filter: `worker_id=eq.${workerId}` }] : [],
    [['worker-frozen-status', workerId || undefined]],
    !!workerId
  );

  return useQuery<WorkerFrozenStatus>({
    queryKey: ['worker-frozen-status', workerId],
    queryFn: async () => {
      if (!workerId) return { isFrozen: false, totalRemaining: 0, debtsCount: 0 };
      const { data, error } = await supabase
        .from('worker_debts')
        .select('remaining_amount, status, debt_type')
        .eq('worker_id', workerId)
        .eq('debt_type', 'deficit')
        .neq('status', 'paid');
      if (error) throw error;
      const rows = (data || []).filter(d => Number(d.remaining_amount || 0) > 0);
      const totalRemaining = rows.reduce((s, r) => s + Number(r.remaining_amount || 0), 0);
      return {
        // Freezing disabled by policy — only show as warning. Always false to never block operations.
        isFrozen: false,
        totalRemaining,
        debtsCount: rows.length,
      };
    },
    enabled: !!workerId,
    staleTime: 30_000,
  });
};
