import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveAccountingSessionEnd } from '@/utils/accountingSessionTime';

export interface AccountingSessionItem {
  id: string;
  session_id: string;
  item_type: string;
  expected_amount: number;
  actual_amount: number;
  difference: number;
  notes: string | null;
  created_at: string;
}

export interface AccountingSession {
  id: string;
  worker_id: string;
  branch_id: string | null;
  manager_id: string;
  session_date: string;
  status: 'open' | 'completed' | 'disputed';
  period_start: string;
  period_end: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  worker?: { id: string; full_name: string; username: string };
  manager?: { id: string; full_name: string };
  items?: AccountingSessionItem[];
}


export const useAccountingSessions = (filters?: { status?: string }) => {
  const { activeBranch } = useAuth();
  return useQuery({
    queryKey: ['accounting-sessions', filters, activeBranch?.id],
    queryFn: async () => {
      let query = supabase
        .from('accounting_sessions')
        .select(`
          *,
          worker:workers!accounting_sessions_worker_id_fkey(id, full_name, username),
          manager:workers!accounting_sessions_manager_id_fkey(id, full_name),
          items:accounting_session_items(*)
        `)
        .is('review_session_id', null)
        .or('is_treasury_posted.eq.false,is_treasury_posted.is.null')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AccountingSession[];
    },
  });
};

export const useSessionItems = (sessionId: string | null) => {
  return useQuery({
    queryKey: ['session-items', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('accounting_session_items')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at');

      if (error) throw error;
      return data as AccountingSessionItem[];
    },
    enabled: !!sessionId,
  });
};

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  const { workerId, activeBranch } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      worker_id: string;
      period_start: string;
      period_end: string;
      notes?: string;
      items: { item_type: string; expected_amount: number; actual_amount: number; notes?: string }[];
      unload_notes?: string;
    }) => {
      // Create session
      // Convert datetime-local to timestamptz with Algeria timezone (+01:00)
      const toTz = (v: string) => v.includes('T') ? v + ':00+01:00' : v + 'T00:00:00+01:00';
      const completedAt = new Date().toISOString();
      const effectivePeriodEnd = getEffectiveAccountingSessionEnd(toTz(params.period_end), completedAt);
      
      // Fallback: if no active branch in context, derive branch from worker or manager
      let resolvedBranchId: string | null = activeBranch?.id || null;
      if (!resolvedBranchId) {
        const { data: w } = await supabase
          .from('workers')
          .select('branch_id')
          .in('id', [params.worker_id, workerId!])
          .not('branch_id', 'is', null)
          .limit(1)
          .maybeSingle();
        resolvedBranchId = (w as any)?.branch_id || null;
      }

      const { data: session, error: sessionErr } = await supabase
        .from('accounting_sessions')
        .insert({
          worker_id: params.worker_id,
          manager_id: workerId!,
          branch_id: resolvedBranchId,
          period_start: toTz(params.period_start),
          period_end: effectivePeriodEnd,
          notes: params.notes || null,
          status: 'completed',
          completed_at: completedAt,
          is_treasury_posted: false,
          unload_confirmed: true,
          unload_notes: params.unload_notes || null,
          unload_confirmed_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      // Insert items
      const itemsData = params.items.map(item => ({
        session_id: session.id,
        item_type: item.item_type,
        expected_amount: item.expected_amount,
        actual_amount: item.actual_amount,
        notes: item.notes || null,
      }));

      const { error: itemsErr } = await supabase
        .from('accounting_session_items')
        .insert(itemsData);

      if (itemsErr) throw itemsErr;

      // NOTE: Treasury entries are NO LONGER inserted here.
      // They will be created when the manager completes their review session.

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['worker-last-accounting-session'] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['worker-liability'] });
      queryClient.invalidateQueries({ queryKey: ['all-workers-liability'] });
      queryClient.invalidateQueries({ queryKey: ['session-items'] });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('frozen-workers') });
    },
  });
};

export const useUpdateSessionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, status, notes }: { sessionId: string; status: string; notes?: string }) => {
      const updates: any = { status };
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      if (notes !== undefined) updates.notes = notes;

      const { error } = await supabase
        .from('accounting_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['worker-liability'] });
      queryClient.invalidateQueries({ queryKey: ['all-workers-liability'] });
      queryClient.invalidateQueries({ queryKey: ['worker-last-accounting-session'] });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('frozen-workers') });
    },
  });
};

export const useUpdateFullSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      session_id: string;
      period_start: string;
      period_end: string;
      notes?: string;
      items: { item_type: string; expected_amount: number; actual_amount: number; notes?: string }[];
    }) => {
      // Update session
      // Convert datetime-local to timestamptz with Algeria timezone (+01:00)
      const toTz = (v: string) => v.includes('T') ? v + ':00+01:00' : v + 'T00:00:00+01:00';
      const completedAt = new Date().toISOString();
      const effectivePeriodEnd = getEffectiveAccountingSessionEnd(toTz(params.period_end), completedAt);
      
      const { error: sessionErr } = await supabase
        .from('accounting_sessions')
        .update({
          period_start: toTz(params.period_start),
          period_end: effectivePeriodEnd,
          notes: params.notes || null,
          completed_at: completedAt,
        })
        .eq('id', params.session_id);

      if (sessionErr) throw sessionErr;

      // Delete old items
      const { error: deleteErr } = await supabase
        .from('accounting_session_items')
        .delete()
        .eq('session_id', params.session_id);

      if (deleteErr) throw deleteErr;

      // Insert new items
      const itemsData = params.items.map(item => ({
        session_id: params.session_id,
        item_type: item.item_type,
        expected_amount: item.expected_amount,
        actual_amount: item.actual_amount,
        notes: item.notes || null,
      }));

      const { error: itemsErr } = await supabase
        .from('accounting_session_items')
        .insert(itemsData);

      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session-items'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['worker-last-accounting-session'] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['worker-liability'] });
      queryClient.invalidateQueries({ queryKey: ['all-workers-liability'] });
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('frozen-workers') });
    },
  });
};

export const useCancelSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data: sessionRow, error: sessionFetchError } = await supabase
        .from('accounting_sessions')
        .select('worker_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (sessionFetchError) throw sessionFetchError;

      // Revert any document/invoice decisions applied with this session
      try {
        await (supabase as any).rpc('revert_accounting_session_decisions', { p_session_id: sessionId });
      } catch (e) { console.warn('revert_accounting_session_decisions failed', e); }

      // Cancel = full revert: delete treasury entries, items, then session
      await supabase.from('manager_treasury').delete().eq('session_id', sessionId);
      await supabase.from('accounting_session_items').delete().eq('session_id', sessionId);
      const { error } = await supabase.from('accounting_sessions').delete().eq('id', sessionId);
      if (error) throw error;

      if (sessionRow?.worker_id) {
        const { error: recalibrateError } = await supabase.rpc('recalibrate_worker_stock', {
          p_worker_id: sessionRow.worker_id,
        });
        if (recalibrateError) throw recalibrateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['manager-treasury'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-summary'] });
      queryClient.invalidateQueries({ queryKey: ['worker-last-accounting-session'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['worker-liability'] });
      queryClient.invalidateQueries({ queryKey: ['all-workers-liability'] });
      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['pending-documents'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['manager-confirmations'] });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('frozen-workers') });
    },
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data: sessionRow, error: sessionFetchError } = await supabase
        .from('accounting_sessions')
        .select('worker_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (sessionFetchError) throw sessionFetchError;

      // Revert any document/invoice decisions applied with this session
      try {
        await (supabase as any).rpc('revert_accounting_session_decisions', { p_session_id: sessionId });
      } catch (e) { console.warn('revert_accounting_session_decisions failed', e); }

      // Delete = remove session record only (no treasury revert)
      await supabase.from('accounting_session_items').delete().eq('session_id', sessionId);
      const { error } = await supabase.from('accounting_sessions').delete().eq('id', sessionId);
      if (error) throw error;

      if (sessionRow?.worker_id) {
        const { error: recalibrateError } = await supabase.rpc('recalibrate_worker_stock', {
          p_worker_id: sessionRow.worker_id,
        });
        if (recalibrateError) throw recalibrateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['worker-last-accounting-session'] });
      queryClient.invalidateQueries({ queryKey: ['worker-liability'] });
      queryClient.invalidateQueries({ queryKey: ['all-workers-liability'] });
      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['pending-documents'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['manager-confirmations'] });
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('frozen-workers') });
    },
  });
};
