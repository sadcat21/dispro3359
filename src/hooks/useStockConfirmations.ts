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
  const { workerId, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const isReady = !isAuthLoading && isAuthenticated && !!workerId;

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
    enabled: isReady,
    refetchInterval: 30000,
  });

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
    enabled: isReady,
  });

  const approveConfirmation = useMutation({
    mutationFn: async (confirmationId: string) => {
      if (!workerId) throw new Error('تعذر تحديد العامل الحالي');

      const { data: conf, error: fetchErr } = await supabase
        .from('stock_confirmations')
        .select('*')
        .eq('id', confirmationId)
        .eq('worker_id', workerId)
        .maybeSingle();
      if (fetchErr || !conf) throw fetchErr || new Error('لم يتم العثور على العملية');

      const confirmation = conf as any;

      if (confirmation.operation_type === 'load' && confirmation.source_session_id) {
        const { error: rpcError } = await (supabase.rpc as any)(
          'confirm_loading_session_atomic',
          { p_session_id: confirmation.source_session_id }
        );
        if (rpcError) throw rpcError;
      }

      // Handle review confirmation: sync stock + create discrepancies
      if (confirmation.operation_type === 'review') {
        const reviewItems = (confirmation.items || []) as any[];
        const discrepancyItems = reviewItems.filter((ri: any) => ri.status === 'deficit' || ri.status === 'surplus');

        // Sync worker stock with reviewed quantities
        for (const ri of reviewItems) {
          if (ri.stock_row_id) {
            await supabase
              .from('worker_stock')
              .update({ quantity: ri.quantity })
              .eq('id', ri.stock_row_id);
          }
        }

        // Record discrepancies
        if (discrepancyItems.length > 0) {
          const discRows = discrepancyItems.map((ri: any) => ({
            worker_id: confirmation.worker_id,
            product_id: ri.product_id,
            branch_id: confirmation.branch_id || null,
            discrepancy_type: ri.status,
            quantity: Math.abs(ri.difference),
            remaining_quantity: Math.abs(ri.difference),
            source_session_id: confirmation.source_session_id || null,
            notes: `جلسة مراجعة - ${ri.status === 'deficit' ? 'عجز' : 'فائض'}: ${Math.abs(ri.difference)}`,
          }));
          const { error: discErr } = await supabase
            .from('stock_discrepancies')
            .insert(discRows);
          if (discErr) throw discErr;
        }
      }

      const { error } = await supabase
        .from('stock_confirmations')
        .update({
          status: 'approved',
          responded_at: new Date().toISOString(),
        } as any)
        .eq('id', confirmationId)
        .eq('worker_id', workerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations-count'] });
      queryClient.invalidateQueries({ queryKey: ['loading-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['stock-discrepancies-pending'] });
      toast.success('تمت الموافقة على العملية وتم تحديث المخزون');
    },
    onError: (err: any) => toast.error(err?.message || 'فشلت الموافقة'),
  });

  const rejectConfirmation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      if (!workerId) throw new Error('تعذر تحديد العامل الحالي');

      const { error } = await supabase
        .from('stock_confirmations')
        .update({
          status: 'rejected',
          rejection_note: note,
          responded_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('worker_id', workerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-confirmations-count'] });
      toast.success('تم رفض العملية');
    },
    onError: (err: any) => toast.error(err?.message || 'فشل الرفض'),
  });

  return {
    pendingCount: pendingCountQuery.data || 0,
    confirmations: confirmationsQuery.data || [],
    isLoading: isAuthLoading || confirmationsQuery.isLoading,
    workerId,
    approveConfirmation,
    rejectConfirmation,
    refetch: () => {
      confirmationsQuery.refetch();
      pendingCountQuery.refetch();
    },
  };
};
