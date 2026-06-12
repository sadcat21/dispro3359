import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SplitResolutionType =
  | 'manager_approved_writeoff'
  | 'worker_debt'
  | 'investigation'
  | 'customer_repayment'
  | 'tolerance_writeoff'
  | 'split_writeoff_debt'
  | 'deduct_from_reward'
  | 'offset_against_return'
  | 'worker_acknowledged'
  | 'credit_to_customer'
  | 'carry_forward'
  | 'transfer_to_other_employee'
  | 'peer_cash_handover';

export interface TreasuryResolutionRow {
  id: string;
  treasury_id: string;
  resolution_type: SplitResolutionType;
  amount: number;
  party_type: 'customer' | 'worker' | null;
  party_id: string | null;
  party_label: string | null;
  linked_debt_id: string | null;
  customer_credit_id: string | null;
  status: 'settled' | 'under_review' | 'open';
  notes: string | null;
  resolved_by: string | null;
  resolved_at: string;
  created_at: string;
}

const fetchSplits = async (treasuryId: string): Promise<TreasuryResolutionRow[]> => {
  const { data, error } = await supabase
    .from('manager_treasury')
    .select('id, resolution_splits')
    .eq('id', treasuryId)
    .maybeSingle();
  if (error) throw error;
  const arr = ((data as any)?.resolution_splits ?? []) as any[];
  return arr.map((r) => ({ ...r, treasury_id: treasuryId })) as TreasuryResolutionRow[];
};

export const useTreasuryResolutions = (treasuryId: string | null | undefined) =>
  useQuery({
    enabled: !!treasuryId,
    queryKey: ['treasury-resolutions', treasuryId],
    queryFn: () => fetchSplits(treasuryId!),
  });

const genId = () =>
  (globalThis.crypto as any)?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useAddTreasuryResolution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      treasury_id: string;
      split_id?: string | null;
      resolution_type: SplitResolutionType;
      amount: number;
      party_type?: 'customer' | 'worker' | null;
      party_id?: string | null;
      party_label?: string | null;
      linked_debt_id?: string | null;
      notes?: string | null;
      resolved_by?: string | null;
      status?: 'settled' | 'under_review' | 'open';
      sender_worker_id?: string | null;
      branch_id?: string | null;
    }) => {
      const status =
        row.status ??
        (row.resolution_type === 'offset_against_return' ||
        row.resolution_type === 'investigation' ||
        row.resolution_type === 'peer_cash_handover'
          ? 'under_review'
          : row.resolution_type === 'carry_forward'
          ? 'open'
          : 'settled');
      const current = await fetchSplits(row.treasury_id);
      const splitId = row.split_id ?? genId();
      const existingRow = row.split_id ? current.find((item) => item.id === row.split_id) ?? null : null;

      // Create an actual worker_debt for "worker_debt" resolutions
      let linkedDebtId: string | null = row.linked_debt_id ?? existingRow?.linked_debt_id ?? null;
      let resolvedPartyId: string | null = row.party_id ?? null;
      let resolvedPartyLabel: string | null = row.party_label ?? null;
      let resolvedBranchId: string | null = row.branch_id ?? null;

      if (existingRow?.resolution_type === 'worker_debt' && row.resolution_type !== 'worker_debt' && existingRow.linked_debt_id) {
        const { count, error: paymentsErr } = await supabase
          .from('worker_debt_payments')
          .select('id', { count: 'exact', head: true })
          .eq('worker_debt_id', existingRow.linked_debt_id);
        if (paymentsErr) throw paymentsErr;
        if ((count ?? 0) > 0) {
          throw new Error('لا يمكن تغيير نوع هذا السطر لأن الدين المرتبط عليه تسديدات مسجّلة');
        }

        const { error: deleteDebtErr } = await supabase
          .from('worker_debts')
          .delete()
          .eq('id', existingRow.linked_debt_id);
        if (deleteDebtErr) throw deleteDebtErr;
        linkedDebtId = null;
      }

      if (row.resolution_type === 'worker_debt' && Number(row.amount) > 0) {
        // Fallback: if caller didn't pass a worker, derive the original worker
        // from the treasury entry's accounting session.
        if (!resolvedPartyId) {
          const { data: mt } = await supabase
            .from('manager_treasury')
            .select('session_id, branch_id, accounting_sessions:session_id(worker_id, workers:worker_id(id, full_name))')
            .eq('id', row.treasury_id)
            .maybeSingle();
          const sess: any = (mt as any)?.accounting_sessions ?? null;
          resolvedPartyId = sess?.workers?.id ?? sess?.worker_id ?? null;
          resolvedPartyLabel = sess?.workers?.full_name ?? resolvedPartyLabel;
          resolvedBranchId = resolvedBranchId ?? (mt as any)?.branch_id ?? null;
        }

        if (!resolvedPartyId) {
          throw new Error('تعذّر تحديد العامل الأصلي لتسجيل الدين');
        }

        const debtPayload = {
          worker_id: resolvedPartyId,
          amount: Number(row.amount),
          debt_type: 'deficit' as const,
          description: row.notes || 'تحويل عجز خزينة لدين العامل',
          branch_id: resolvedBranchId,
        };

        const debtQuery = linkedDebtId
          ? supabase.from('worker_debts').update(debtPayload).eq('id', linkedDebtId).select('id').single()
          : supabase
              .from('worker_debts')
              .insert({
                ...debtPayload,
                created_by: row.resolved_by ?? null,
              })
              .select('id')
              .single();

        const { data: debtRow, error: debtErr } = await debtQuery;
        if (debtErr) throw debtErr;
        linkedDebtId = (debtRow as any)?.id ?? null;
      }

      const nextRow = {
        id: splitId,
        resolution_type: row.resolution_type,
        amount: Number(row.amount),
        party_type: row.resolution_type === 'worker_debt' ? 'worker' : (row.party_type ?? null),
        party_id: resolvedPartyId,
        party_label: resolvedPartyLabel,
        linked_debt_id: row.resolution_type === 'worker_debt' ? linkedDebtId : null,
        customer_credit_id: null,
        status,
        notes: row.notes ?? null,
        resolved_by: row.resolved_by ?? null,
        resolved_at: new Date().toISOString(),
        created_at: existingRow?.created_at ?? new Date().toISOString(),
      };

      const next = existingRow
        ? current.map((item) => (item.id === splitId ? nextRow : item))
        : [...current, nextRow];
      const { error } = await supabase
        .from('manager_treasury')
        .update({ resolution_splits: next as any })
        .eq('id', row.treasury_id);
      if (error) throw error;

      // For peer_cash_handover, create the awaiting-confirmation record
      if (row.resolution_type === 'peer_cash_handover' && row.party_id && row.sender_worker_id) {
        const { error: hErr } = await (supabase as any)
          .from('peer_cash_handovers')
          .insert({
            treasury_id: row.treasury_id,
            split_id: splitId,
            sender_worker_id: row.sender_worker_id,
            receiver_worker_id: row.party_id,
            amount: Number(row.amount),
            notes: row.notes ?? null,
            created_by: row.resolved_by ?? null,
          });
        if (hErr) throw hErr;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['treasury-resolutions', vars.treasury_id] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-cash'] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-customer'] });
      qc.invalidateQueries({ queryKey: ['peer-cash-handovers'] });
      qc.invalidateQueries({ queryKey: ['worker-debts'] });
      toast.success('تمت إضافة سطر التسوية');
    },
    onError: (e: any) => toast.error(e.message || 'فشل إضافة السطر'),
  });
};

export const useDeleteTreasuryResolution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; treasury_id: string }) => {
      const current = await fetchSplits(params.treasury_id);
      const next = current.filter((r) => r.id !== params.id);
      const { error } = await supabase
        .from('manager_treasury')
        .update({ resolution_splits: next as any })
        .eq('id', params.treasury_id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['treasury-resolutions', vars.treasury_id] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-cash'] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-customer'] });
      toast.success('تم حذف السطر');
    },
    onError: (e: any) => toast.error(e.message || 'فشل الحذف'),
  });
};
