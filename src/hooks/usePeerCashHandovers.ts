import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PeerCashHandoverRow {
  id: string;
  treasury_id: string;
  split_id: string;
  sender_worker_id: string;
  receiver_worker_id: string;
  amount: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
  sender?: { id: string; full_name: string } | null;
  receiver?: { id: string; full_name: string } | null;
}

const SELECT =
  'id, treasury_id, split_id, sender_worker_id, receiver_worker_id, amount, notes, status, response_note, created_at, responded_at, sender:workers!peer_cash_handovers_sender_worker_id_fkey(id, full_name), receiver:workers!peer_cash_handovers_receiver_worker_id_fkey(id, full_name)';

/** Handovers waiting for THIS worker (as receiver) to approve */
export const usePendingPeerHandoversForMe = (workerId: string | null | undefined) =>
  useQuery({
    enabled: !!workerId,
    queryKey: ['peer-cash-handovers', 'incoming', workerId],
    queryFn: async (): Promise<PeerCashHandoverRow[]> => {
      const { data, error } = await (supabase as any)
        .from('peer_cash_handovers')
        .select(SELECT)
        .eq('receiver_worker_id', workerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PeerCashHandoverRow[];
    },
  });

/** Handovers this worker has SENT (to see badges of confirmations) */
export const usePeerHandoversSentByMe = (workerId: string | null | undefined) =>
  useQuery({
    enabled: !!workerId,
    queryKey: ['peer-cash-handovers', 'outgoing', workerId],
    queryFn: async (): Promise<PeerCashHandoverRow[]> => {
      const { data, error } = await (supabase as any)
        .from('peer_cash_handovers')
        .select(SELECT)
        .eq('sender_worker_id', workerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PeerCashHandoverRow[];
    },
  });

export const useRespondPeerHandover = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { handover_id: string; decision: 'approved' | 'rejected'; note?: string }) => {
      const { data, error } = await (supabase as any).rpc('respond_peer_cash_handover', {
        p_handover_id: params.handover_id,
        p_decision: params.decision,
        p_note: params.note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['peer-cash-handovers'] });
      qc.invalidateQueries({ queryKey: ['treasury-resolutions'] });
      toast.success(vars.decision === 'approved' ? 'تمت الموافقة' : 'تم الرفض');
    },
    onError: (e: any) => toast.error(e.message || 'فشل تسجيل القرار'),
  });
};
