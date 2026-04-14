import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { StockConfirmation, StockConfirmationItem } from './useStockConfirmations';

export const useManagerConfirmations = () => {
  const { workerId: currentWorkerId, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const isReady = !isAuthLoading && isAuthenticated && !!currentWorkerId;

  const confirmationsQuery = useQuery({
    queryKey: ['manager-confirmations', currentWorkerId],
    queryFn: async () => {
      if (!currentWorkerId) return [];
      const { data, error } = await supabase
        .from('stock_confirmations')
        .select(`
          *,
          manager:workers!stock_confirmations_manager_id_fkey(full_name),
          worker:workers!stock_confirmations_worker_id_fkey(full_name)
        `)
        .eq('manager_id', currentWorkerId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as StockConfirmation[];
    },
    enabled: isReady,
  });

  const needsAttentionCount = (confirmationsQuery.data || []).filter(
    c => c.status === 'rejected'
  ).length;

  const amendConfirmation = useMutation({
    mutationFn: async ({
      confirmationId,
      newItems,
      note,
    }: {
      confirmationId: string;
      newItems: StockConfirmationItem[];
      note: string;
    }) => {
      if (!currentWorkerId) throw new Error('تعذر تحديد مسؤول المخزن الحالي');

      const { data: original, error: fetchErr } = await supabase
        .from('stock_confirmations')
        .select('*')
        .eq('id', confirmationId)
        .eq('manager_id', currentWorkerId)
        .single();
      if (fetchErr || !original) throw fetchErr || new Error('لم يتم العثور على العملية');

      const orig = original as any;

      const { error } = await supabase
        .from('stock_confirmations')
        .update({
          items: newItems as any,
          previous_items: orig.items,
          amendment_note: note,
          status: 'amended',
          responded_at: null,
        } as any)
        .eq('id', confirmationId)
        .eq('manager_id', currentWorkerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations-count'] });
      toast.success('تم تعديل العملية وإعادة إرسالها للعامل');
    },
    onError: (err: any) => toast.error(err?.message || 'فشل التعديل'),
  });

  return {
    confirmations: confirmationsQuery.data || [],
    isLoading: isAuthLoading || confirmationsQuery.isLoading,
    needsAttentionCount,
    currentWorkerId,
    amendConfirmation,
    refetch: () => confirmationsQuery.refetch(),
  };
};
