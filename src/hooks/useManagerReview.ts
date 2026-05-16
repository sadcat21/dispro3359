import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ManagerReviewSession {
  id: string;
  manager_id: string;
  branch_id: string | null;
  status: string;
  notes: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  completed_at: string | null;
}

// Fetch review sessions history
export const useManagerReviewSessions = () => {
  const { workerId, activeBranch } = useAuth();
  return useQuery({
    queryKey: ['manager-review-sessions-list', workerId, activeBranch?.id],
    queryFn: async () => {
      if (!workerId) return [];
      let query = supabase
        .from('manager_review_sessions')
        .select('*')
        .eq('manager_id', workerId)
        .order('created_at', { ascending: false });

      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);

      const { data, error } = await query;
      if (error) throw error;
      return data as ManagerReviewSession[];
    },
    enabled: !!workerId,
  });
};

// Fetch unreviewed (pending) accounting sessions since last review
export const useUnreviewedSessions = () => {
  const { workerId, activeBranch } = useAuth();
  return useQuery({
    queryKey: ['unreviewed-accounting-sessions', workerId, activeBranch?.id],
    queryFn: async () => {
      if (!workerId) return [];
      let query = supabase
        .from('accounting_sessions')
        .select(`
          *,
          worker:workers!accounting_sessions_worker_id_fkey(id, full_name, username),
          items:accounting_session_items(*)
        `)
        .eq('manager_id', workerId)
        .eq('status', 'completed')
        .eq('is_treasury_posted', false)
        .is('review_session_id', null)
        .order('completed_at', { ascending: false });

      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!workerId,
  });
};

// Confirm review: create review session, link accounting sessions, post treasury
export const useConfirmManagerReview = () => {
  const queryClient = useQueryClient();
  const { workerId, activeBranch } = useAuth();

  return useMutation({
    mutationFn: async (params: { notes?: string; sessionIds: string[]; unloadConfirmed?: boolean; unloadNotes?: string }) => {
      if (!workerId) throw new Error('No worker');

      // 1. Create the review session
      const { data: review, error: reviewErr } = await supabase
        .from('manager_review_sessions')
        .insert({
          manager_id: workerId,
          branch_id: activeBranch?.id || null,
          status: 'completed',
          notes: params.notes || null,
          completed_at: new Date().toISOString(),
          unload_confirmed: params.unloadConfirmed ?? false,
          unload_notes: params.unloadNotes || null,
          unload_confirmed_at: params.unloadConfirmed ? new Date().toISOString() : null,
        } as any)
        .select()
        .single();

      if (reviewErr) throw reviewErr;

      // 2. Link accounting sessions to review and mark as posted
      for (const sid of params.sessionIds) {
        await supabase
          .from('accounting_sessions')
          .update({ review_session_id: review.id, is_treasury_posted: true })
          .eq('id', sid);
      }

      // 3. Fetch all items from these sessions to create treasury entries
      const { data: sessions } = await supabase
        .from('accounting_sessions')
        .select('id, items:accounting_session_items(*)')
        .in('id', params.sessionIds);

      const treasuryRows: any[] = [];
      for (const session of (sessions || [])) {
        const items = (session as any).items || [];
        for (const item of items) {
          if (item.actual_amount <= 0) continue;
          let payment_method: string | null = null;
          if (['invoice1_espace_cash', 'invoice1_versement_cash', 'invoice2_cash', 'debt_collections_cash'].includes(item.item_type)) {
            payment_method = 'cash';
          } else if (['invoice1_check', 'debt_collections_check'].includes(item.item_type)) {
            payment_method = 'check';
          } else if (['invoice1_receipt', 'debt_collections_receipt'].includes(item.item_type)) {
            payment_method = 'bank_receipt';
          } else if (['invoice1_transfer', 'debt_collections_transfer'].includes(item.item_type)) {
            payment_method = 'bank_transfer';
          }
          if (payment_method) {
            treasuryRows.push({
              manager_id: workerId,
              branch_id: activeBranch?.id || null,
              session_id: session.id,
              source_type: 'accounting_session',
              payment_method,
              amount: item.actual_amount,
              notes: item.item_type,
            });
          }
        }
      }

      if (treasuryRows.length > 0) {
        await supabase.from('manager_treasury').insert(treasuryRows);
      }

      return review;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreviewed-accounting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['manager-review-sessions-list'] });
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-sessions'] });
    },
  });
};
