import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface StockConfirmationItem {
  product_id: string;
  product_name: string;
  product_app_name?: string | null;
  quantity: number;
  gift_quantity?: number;
  gift_unit?: string;
  pieces_per_box?: number;
  image_url?: string | null;
}

export interface StockConfirmation {
  id: string;
  operation_type: string;
  worker_id: string;
  manager_id: string;
  branch_id: string | null;
  status: string;
  items: StockConfirmationItem[];
  previous_items: StockConfirmationItem[] | null;
  source_session_id: string | null;
  rejection_note: string | null;
  amendment_note: string | null;
  parent_confirmation_id: string | null;
  created_at: string;
  responded_at: string | null;
  updated_at: string;
  manager?: { full_name: string };
  worker?: { full_name: string };
}

export const useStockConfirmations = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Get current worker_id from user_roles (maps auth uid → workers table id)
  const { data: workerId } = useQuery({
    queryKey: ['current-worker-id-for-confirmations', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('user_roles')
        .select('worker_id')
        .eq('user_id', userId)
        .single();
      return data?.worker_id || null;
    },
    enabled: !!userId,
  });

  // Pending confirmations count for badge
  const pendingCountQuery = useQuery({
    queryKey: ['stock-confirmations-count', workerId],
    queryFn: async () => {
      if (!workerId) return 0;
      const { count, error } = await supabase
        .from('stock_confirmations')
        .select('id', { count: 'exact', head: true })
        .eq('worker_id', workerId)
        .eq('status', 'pending');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!workerId,
    refetchInterval: 30000,
  });

  // Full list for the popover (all statuses for tabs)
  const confirmationsQuery = useQuery({
    queryKey: ['stock-confirmations', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data, error } = await supabase
        .from('stock_confirmations')
        .select(`
          *,
          manager:workers!stock_confirmations_manager_id_fkey(full_name),
          worker:workers!stock_confirmations_worker_id_fkey(full_name)
        `)
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as StockConfirmation[];
    },
    enabled: !!workerId,
  });

  const approveConfirmation = useMutation({
    mutationFn: async (confirmationId: string) => {
      // First get the confirmation details
      const { data: conf, error: fetchErr } = await supabase
        .from('stock_confirmations')
        .select('*')
        .eq('id', confirmationId)
        .eq('worker_id', workerId!)
        .single();
      if (fetchErr || !conf) throw fetchErr || new Error('لم يتم العثور على العملية');

      const confirmation = conf as any;

      // For load operations, run the atomic RPC to apply stock changes
      if (confirmation.operation_type === 'load' && confirmation.source_session_id) {
        const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
          'confirm_loading_session_atomic',
          { p_session_id: confirmation.source_session_id }
        );
        if (rpcError) throw rpcError;
      }

      // Mark confirmation as approved
      const { error } = await supabase
        .from('stock_confirmations')
        .update({
          status: 'approved',
          responded_at: new Date().toISOString(),
        } as any)
        .eq('id', confirmationId)
        .eq('worker_id', workerId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations-count'] });
      queryClient.invalidateQueries({ queryKey: ['loading-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      toast.success('تمت الموافقة على العملية وتم تحديث المخزون');
    },
    onError: (err: any) => toast.error(err?.message || 'فشلت الموافقة'),
  });

  const rejectConfirmation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from('stock_confirmations')
        .update({
          status: 'rejected',
          rejection_note: note,
          responded_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('worker_id', workerId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations-count'] });
      toast.success('تم رفض العملية');
    },
    onError: () => toast.error('فشل الرفض'),
  });

  return {
    pendingCount: pendingCountQuery.data || 0,
    confirmations: confirmationsQuery.data || [],
    isLoading: confirmationsQuery.isLoading,
    workerId,
    approveConfirmation,
    rejectConfirmation,
    refetch: () => {
      confirmationsQuery.refetch();
      pendingCountQuery.refetch();
    },
  };
};
