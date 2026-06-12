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
  | 'transfer_to_other_employee';

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

export const useTreasuryResolutions = (treasuryId: string | null | undefined) =>
  useQuery({
    enabled: !!treasuryId,
    queryKey: ['treasury-resolutions', treasuryId],
    queryFn: async (): Promise<TreasuryResolutionRow[]> => {
      const { data, error } = await supabase
        .from('manager_treasury_resolutions' as any)
        .select('*')
        .eq('treasury_id', treasuryId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any) || [];
    },
  });

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
    }) => {
      const status =
        row.status ??
        (row.resolution_type === 'offset_against_return' || row.resolution_type === 'investigation'
          ? 'under_review'
          : row.resolution_type === 'carry_forward'
          ? 'open'
          : 'settled');
      const { error } = await supabase.from('manager_treasury_resolutions' as any).insert({
        treasury_id: row.treasury_id,
        resolution_type: row.resolution_type,
        amount: row.amount,
        party_type: row.party_type ?? null,
        party_id: row.party_id ?? null,
        party_label: row.party_label ?? null,
        notes: row.notes ?? null,
        resolved_by: row.resolved_by ?? null,
        status,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['treasury-resolutions', vars.treasury_id] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-cash'] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-customer'] });
      toast.success('تمت إضافة سطر التسوية');
    },
    onError: (e: any) => toast.error(e.message || 'فشل إضافة السطر'),
  });
};

export const useDeleteTreasuryResolution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; treasury_id: string }) => {
      const { error } = await supabase
        .from('manager_treasury_resolutions' as any)
        .delete()
        .eq('id', params.id);
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
