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
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);

      const { data, error } = await query;
      if (error) throw error;
      const reviews = (data || []) as ManagerReviewSession[];
      if (reviews.length === 0) return reviews;

      const ids = reviews.map((r) => r.id);
      const { data: sessions } = await supabase
        .from('accounting_sessions')
        .select('id, review_session_id, completed_at, created_at, period_start, period_end, items:accounting_session_items(item_type, actual_amount)')
        .in('review_session_id', ids);

      const CASH_TYPES = new Set([
        'invoice1_espace_cash',
        'invoice1_versement_cash',
        'invoice2_cash',
        'debt_collections_cash',
      ]);

      const DOC_TYPES = new Set([
        'invoice1_check', 'invoice1_receipt', 'invoice1_transfer',
        'debt_collections_check', 'debt_collections_receipt', 'debt_collections_transfer',
      ]);

      type Agg = {
        totalCash: number; sessionsCount: number; earliest: string | null; latest: string | null;
        totalSales: number; newDebts: number; debtCollections: number; expenses: number;
        cashPayments: number; docPayments: number;
      };
      const byReview = new Map<string, Agg>();
      for (const s of (sessions || []) as any[]) {
        const key = s.review_session_id as string;
        const agg: Agg = byReview.get(key) || {
          totalCash: 0, sessionsCount: 0, earliest: null, latest: null,
          totalSales: 0, newDebts: 0, debtCollections: 0, expenses: 0,
          cashPayments: 0, docPayments: 0,
        };
        agg.sessionsCount += 1;
        for (const it of (s.items || [])) {
          const amt = Number(it.actual_amount || 0);
          if (CASH_TYPES.has(it.item_type)) {
            agg.totalCash += amt;
            if (it.item_type !== 'debt_collections_cash') agg.cashPayments += amt;
          }
          else if (DOC_TYPES.has(it.item_type)) agg.docPayments += amt;
          if (it.item_type === 'expenses') { agg.totalCash -= amt; agg.expenses += amt; }
          else if (it.item_type === 'total_sales') agg.totalSales += amt;
          else if (it.item_type === 'new_debts') agg.newDebts += amt;
          else if (it.item_type === 'debt_collections_total') agg.debtCollections += amt;
        }
        const start = s.period_start || s.created_at;
        const end = s.period_end || s.completed_at || s.created_at;
        if (start && (!agg.earliest || start < agg.earliest)) agg.earliest = start;
        if (end && (!agg.latest || end > agg.latest)) agg.latest = end;
        byReview.set(key, agg);
      }

      return reviews.map((r) => {
        const a = byReview.get(r.id);
        return {
          ...r,
          total_cash: a?.totalCash || 0,
          sessions_count: a?.sessionsCount || 0,
          period_earliest: a?.earliest || null,
          period_latest: a?.latest || null,
          total_sales: a?.totalSales || 0,
          new_debts: a?.newDebts || 0,
          debt_collections: a?.debtCollections || 0,
          expenses: a?.expenses || 0,
          cash_payments: a?.cashPayments || 0,
          doc_payments: a?.docPayments || 0,
        };
      }) as any[];
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

      if (activeBranch?.id) query = query.or(`branch_id.eq.${activeBranch.id},branch_id.is.null`);

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
    mutationFn: async (params: { notes?: string; sessionIds: string[] }) => {
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
        })
        .select()
        .single();

      if (reviewErr) throw reviewErr;

      // 2. Link accounting sessions to review and mark as posted
      const { data: updatedSessions, error: updateSessionsError } = await supabase
        .from('accounting_sessions')
        .update({ review_session_id: review.id, is_treasury_posted: true })
        .in('id', params.sessionIds)
        .eq('manager_id', workerId)
        .select('id');

      if (updateSessionsError) throw updateSessionsError;

      if ((updatedSessions?.length ?? 0) !== params.sessionIds.length) {
        throw new Error('تعذر ربط بعض جلسات المحاسبة بالمراجعة');
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
      queryClient.invalidateQueries({ queryKey: ['worker-accounting-sessions'] });
    },
  });
};

// Undo a confirmed review: unlink accounting sessions, remove treasury rows, delete review
export const useUndoManagerReview = () => {
  const queryClient = useQueryClient();
  const { workerId } = useAuth();

  return useMutation({
    mutationFn: async (reviewId: string) => {
      if (!workerId) throw new Error('No worker');

      const { data: linkedSessions, error: linkedErr } = await supabase
        .from('accounting_sessions')
        .select('id')
        .eq('review_session_id', reviewId)
        .eq('manager_id', workerId);
      if (linkedErr) throw linkedErr;

      const sessionIds = (linkedSessions || []).map((s: any) => s.id);
      if (sessionIds.length > 0) {
        const { error: delTreasuryErr } = await supabase
          .from('manager_treasury')
          .delete()
          .in('session_id', sessionIds)
          .eq('manager_id', workerId)
          .eq('source_type', 'accounting_session');
        if (delTreasuryErr) throw delTreasuryErr;

        const { error: unlinkErr } = await supabase
          .from('accounting_sessions')
          .update({ review_session_id: null, is_treasury_posted: false })
          .in('id', sessionIds)
          .eq('manager_id', workerId);
        if (unlinkErr) throw unlinkErr;
      }

      const { error: delReviewErr } = await supabase
        .from('manager_review_sessions')
        .delete()
        .eq('id', reviewId)
        .eq('manager_id', workerId);
      if (delReviewErr) throw delReviewErr;

      return { reviewId, sessionsCount: sessionIds.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreviewed-accounting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['manager-review-sessions-list'] });
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['worker-accounting-sessions'] });
    },
  });
};
