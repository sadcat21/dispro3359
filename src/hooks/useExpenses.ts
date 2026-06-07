import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExpenseCategory, ExpenseWithDetails } from '@/types/expense';
import { toast } from 'sonner';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export const useExpenseCategories = () => {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });
};

export const useExpenses = (workerFilter?: string | null) => {
  const { workerId, role, activeBranch } = useAuth();

  useRealtimeSubscription(
    'expenses-realtime',
    [{ table: 'expenses' }],
    [['expenses']],
  );

  return useQuery({
    queryKey: ['expenses', workerFilter, role, activeBranch?.id],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (workerFilter) {
        query = query.eq('worker_id', workerFilter);
      }

      if (role === 'branch_admin' && activeBranch) {
        query = query.eq('branch_id', activeBranch.id);
      }

      // Hide expenses already handed over to higher authority — they now live
      // in the project manager treasury and must not appear in branch lists.
      query = query.is('handover_id', null);

      const { data, error } = await query;
      if (error) throw error;

      const categoryIds = [...new Set((data || []).map(e => e.category_id))];
      const workerIds = [...new Set((data || []).map(e => e.worker_id).filter(Boolean))];
      const reviewerIds = [...new Set((data || []).map(e => e.reviewed_by).filter(Boolean))];

      const [categoriesRes, workersRes] = await Promise.all([
        categoryIds.length > 0
          ? supabase.from('expense_categories').select('*').in('id', categoryIds)
          : { data: [] },
        [...new Set([...workerIds, ...reviewerIds])].length > 0
          ? supabase.from('workers_safe').select('id, full_name, username').in('id', [...new Set([...workerIds, ...reviewerIds])])
          : { data: [] },
      ]);

      const categoriesMap = new Map((categoriesRes.data || []).map(c => [c.id, c]));
      const workersMap = new Map((workersRes.data || []).map(w => [w.id, w]));

      return (data || []).map(expense => ({
        ...expense,
        category: categoriesMap.get(expense.category_id),
        worker: workersMap.get(expense.worker_id),
        reviewer: expense.reviewed_by ? workersMap.get(expense.reviewed_by) : null,
      })) as ExpenseWithDetails[];
    },
  });
};

export const useCreateExpense = () => {
  const queryClient = useQueryClient();
  const { workerId, activeBranch } = useAuth();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (data: {
      category_id: string;
      amount: number;
      description?: string;
      expense_date: string;
      receipt_url?: string;
      receipt_urls?: string[];
      payment_method?: string;
    }) => {
      // Auto-approve: skip manager review and pass directly to accounting session
      const { error } = await supabase.from('expenses').insert({
        ...data,
        worker_id: workerId!,
        branch_id: activeBranch?.id || null,
        receipt_urls: data.receipt_urls || (data.receipt_url ? [data.receipt_url] : []),
        payment_method: data.payment_method || 'cash',
        status: 'approved',
        reviewed_by: workerId!,
        reviewed_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(t('common.success'));
    },
    onError: (error: any) => {
      toast.error(t('common.error') + ': ' + error.message);
    },
  });
};

export const useUpdateExpenseStatus = () => {
  const queryClient = useQueryClient();
  const { workerId } = useAuth();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      status: 'approved' | 'rejected';
      rejection_reason?: string;
    }) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: data.status,
          reviewed_by: workerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: data.rejection_reason || null,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(t('common.success'));
    },
    onError: (error: any) => {
      toast.error(t('common.error') + ': ' + error.message);
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(t('common.success'));
    },
    onError: (error: any) => {
      toast.error(t('common.error') + ': ' + error.message);
    },
  });
};

export const useUpdateExpense = () => {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      category_id?: string;
      amount?: number;
      description?: string | null;
      expense_date?: string;
      receipt_url?: string | null;
      receipt_urls?: string[];
      payment_method?: string;
    }) => {
      const { id, ...patch } = data;
      const { error } = await supabase.from('expenses').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(t('common.success'));
    },
    onError: (error: any) => {
      toast.error(t('common.error') + ': ' + error.message);
    },
  });
};

export const useWorkerAccountedRanges = (workerId?: string | null) => {
  return useQuery({
    queryKey: ['worker-accounted-ranges', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_sessions')
        .select('period_start, period_end, completed_at')
        .eq('worker_id', workerId!)
        .eq('status', 'completed');
      if (error) throw error;
      return (data || []).map((r: any) => {
        const start = new Date(r.period_start).getTime();
        const endRaw = r.completed_at && new Date(r.completed_at).getTime() > new Date(r.period_end).getTime()
          ? r.completed_at
          : r.period_end;
        return { start, end: new Date(endRaw).getTime() };
      });
    },
  });
};
