import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface StockDispute {
  id: string;
  branch_id: string | null;
  raised_by: string;
  warehouse_worker_id: string;
  delivery_worker_id: string;
  session_type: string;
  session_id: string | null;
  product_id: string | null;
  product_name: string | null;
  warehouse_qty: number;
  delivery_qty: number;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  guilty_worker_id: string | null;
  guilty_accepted: boolean;
  guilty_accepted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  warehouse_worker?: { full_name: string };
  delivery_worker?: { full_name: string };
  resolver?: { full_name: string };
  raiser?: { full_name: string };
}

export const useStockDisputes = () => {
  const { workerId, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = activeRole?.role === 'admin' || activeRole?.role === 'branch_admin' || activeRole?.role === 'project_manager';

  const disputesQuery = useQuery({
    queryKey: ['stock-disputes', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data, error } = await supabase
        .from('stock_disputes')
        .select(`
          *,
          warehouse_worker:workers!stock_disputes_warehouse_worker_id_fkey(full_name),
          delivery_worker:workers!stock_disputes_delivery_worker_id_fkey(full_name),
          resolver:workers!stock_disputes_resolved_by_fkey(full_name),
          raiser:workers!stock_disputes_raised_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as StockDispute[];
    },
    enabled: !!workerId,
    refetchInterval: 30000,
  });

  const pendingCount = (disputesQuery.data || []).filter(d => {
    if (isAdmin) return d.status === 'pending';
    // For workers: show count of pending disputes they're involved in + resolved disputes awaiting their acceptance
    return (d.status === 'pending' && (d.warehouse_worker_id === workerId || d.delivery_worker_id === workerId)) ||
      (d.status === 'resolved' && d.guilty_worker_id === workerId && !d.guilty_accepted);
  }).length;

  const createDispute = useMutation({
    mutationFn: async (dispute: {
      branch_id?: string;
      warehouse_worker_id: string;
      delivery_worker_id: string;
      session_type: string;
      session_id?: string;
      product_id?: string;
      product_name?: string;
      warehouse_qty: number;
      delivery_qty: number;
      notes?: string;
    }) => {
      if (!workerId) throw new Error('غير مسجل');
      const { error } = await supabase
        .from('stock_disputes')
        .insert({
          ...dispute,
          raised_by: workerId,
          status: 'pending',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-disputes'] });
      toast.success('تم رفع طلب الفصل بنجاح');
    },
    onError: (err: any) => toast.error(err.message || 'خطأ في رفع الخلاف'),
  });

  const resolveDispute = useMutation({
    mutationFn: async ({ disputeId, guiltyWorkerId, notes }: {
      disputeId: string;
      guiltyWorkerId: string;
      notes?: string;
    }) => {
      if (!workerId) throw new Error('غير مسجل');
      const { error } = await supabase
        .from('stock_disputes')
        .update({
          status: 'resolved',
          resolved_by: workerId,
          resolved_at: new Date().toISOString(),
          guilty_worker_id: guiltyWorkerId,
          notes,
        })
        .eq('id', disputeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-disputes'] });
      toast.success('تم الفصل في الخلاف');
    },
    onError: (err: any) => toast.error(err.message || 'خطأ في الفصل'),
  });

  const acceptVerdict = useMutation({
    mutationFn: async (disputeId: string) => {
      if (!workerId) throw new Error('غير مسجل');
      const { error } = await supabase
        .from('stock_disputes')
        .update({
          status: 'accepted',
          guilty_accepted: true,
          guilty_accepted_at: new Date().toISOString(),
        })
        .eq('id', disputeId)
        .eq('guilty_worker_id', workerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-disputes'] });
      toast.success('تم قبول الحكم');
    },
    onError: (err: any) => toast.error(err.message || 'خطأ في القبول'),
  });

  return {
    disputes: disputesQuery.data || [],
    isLoading: disputesQuery.isLoading,
    pendingCount,
    createDispute,
    resolveDispute,
    acceptVerdict,
    refetch: () => disputesQuery.refetch(),
  };
};
