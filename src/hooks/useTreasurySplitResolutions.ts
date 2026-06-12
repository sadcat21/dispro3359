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
      resolution_type: SplitResolutionType;
      amount: number;
      party_type?: 'customer' | 'worker' | null;
      party_id?: string | null;
      party_label?: string | null;
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
      const splitId = genId();
      const current = await fetchSplits(row.treasury_id);

      // Create an actual worker_debt for "worker_debt" resolutions
      let linkedDebtId: string | null = null;
      if (row.resolution_type === 'worker_debt' && row.party_id && Number(row.amount) > 0) {
        const { data: debtRow, error: debtErr } = await supabase
          .from('worker_debts')
          .insert({
            worker_id: row.party_id,
            amount: Number(row.amount),
            debt_type: 'deficit',
            description: row.notes || 'تحويل عجز خزينة لدين العامل',
            branch_id: row.branch_id ?? null,
            created_by: row.resolved_by ?? null,
          })
          .select('id')
          .single();
        if (debtErr) throw debtErr;
        linkedDebtId = (debtRow as any)?.id ?? null;
      }

      const next = [
        ...current,
        {
          id: splitId,
          resolution_type: row.resolution_type,
          amount: Number(row.amount),
          party_type: row.party_type ?? null,
          party_id: row.party_id ?? null,
          party_label: row.party_label ?? null,
          linked_debt_id: linkedDebtId,
          customer_credit_id: null,
          status,
          notes: row.notes ?? null,
          resolved_by: row.resolved_by ?? null,
          resolved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ];
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
