import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Hooks for the multi-stage approval workflow on factory_orders.
 * Uses the new RPC functions created in Phase 2:
 *   - submit_factory_order_for_approval
 *   - approve_factory_order   (auto-detects stage)
 *   - reject_factory_order    (requires reason)
 *   - transition_factory_order_status (in_production, ready_for_delivery, delivered, closed, cancelled)
 */

const FACTORY_KEYS = ['factory_orders', 'factory-orders', 'v_factory_orders_localized'];

function invalidateFactoryQueries(qc: ReturnType<typeof useQueryClient>) {
  FACTORY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

function extractError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'حدث خطأ غير متوقع';
}

export function useSubmitFactoryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc(
        'submit_factory_order_for_approval' as never,
        { p_order_id: orderId } as never,
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'تم إرسال الطلب', description: 'الطلب الآن بانتظار موافقة مدير الفرع.' });
      invalidateFactoryQueries(qc);
    },
    onError: (err) => {
      toast({ title: 'تعذّر إرسال الطلب', description: extractError(err), variant: 'destructive' });
    },
  });
}

export function useApproveFactoryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { orderId: string; notes?: string }) => {
      const { data, error } = await supabase.rpc(
        'approve_factory_order' as never,
        { p_order_id: params.orderId, p_notes: params.notes ?? null } as never,
      );
      if (error) throw error;
      return data as { ok: boolean; previous_status: string; next_status: string };
    },
    onSuccess: (data) => {
      toast({
        title: 'تمت الموافقة',
        description: `تم الانتقال من "${data?.previous_status}" إلى "${data?.next_status}".`,
      });
      invalidateFactoryQueries(qc);
    },
    onError: (err) => {
      toast({ title: 'تعذّرت الموافقة', description: extractError(err), variant: 'destructive' });
    },
  });
}

export function useRejectFactoryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { orderId: string; reason: string }) => {
      if (!params.reason || !params.reason.trim()) {
        throw new Error('سبب الرفض مطلوب');
      }
      const { data, error } = await supabase.rpc(
        'reject_factory_order' as never,
        { p_order_id: params.orderId, p_reason: params.reason } as never,
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'تم الرفض', description: 'تم تسجيل سبب الرفض في السجل.' });
      invalidateFactoryQueries(qc);
    },
    onError: (err) => {
      toast({ title: 'تعذّر الرفض', description: extractError(err), variant: 'destructive' });
    },
  });
}

export function useTransitionFactoryOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      orderId: string;
      toStatus:
        | 'in_production'
        | 'ready_for_delivery'
        | 'delivered'
        | 'closed'
        | 'cancelled';
      reason?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc(
        'transition_factory_order_status' as never,
        {
          p_order_id: params.orderId,
          p_to_status: params.toStatus,
          p_reason: params.reason ?? null,
          p_notes: params.notes ?? null,
        } as never,
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'تم تحديث الحالة' });
      invalidateFactoryQueries(qc);
    },
    onError: (err) => {
      toast({ title: 'تعذّر تحديث الحالة', description: extractError(err), variant: 'destructive' });
    },
  });
}
