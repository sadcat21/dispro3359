import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TreasuryToleranceSettings {
  id: string;
  branch_id: string | null;
  cash_tolerance_amount: number;
  cash_tolerance_pct: number;
  auto_writeoff_below_amount: number;
  require_approval_above_amount: number;
  default_due_days: number;
}

export const useTreasuryToleranceSettings = (branchId?: string | null) => {
  return useQuery({
    queryKey: ['treasury-tolerance', branchId ?? 'global'],
    queryFn: async (): Promise<TreasuryToleranceSettings | null> => {
      // Try branch-specific first, then fall back to global (branch_id IS NULL)
      if (branchId) {
        const { data } = await supabase
          .from('treasury_tolerance_settings')
          .select('*')
          .eq('branch_id', branchId)
          .maybeSingle();
        if (data) return data as TreasuryToleranceSettings;
      }
      const { data } = await supabase
        .from('treasury_tolerance_settings')
        .select('*')
        .is('branch_id', null)
        .maybeSingle();
      return (data as TreasuryToleranceSettings) || null;
    },
  });
};

/**
 * Decide lifecycle fields for a new cash surplus/deficit entry.
 * - auto_writeoff: |amount| <= auto_writeoff_below_amount → status='settled', resolution='auto_writeoff'
 * - under_review : |amount| >  require_approval_above_amount → status='under_review'
 * - else         : status='open' (needs manager action)
 */
export const decideTreasuryLifecycle = (
  amountAbs: number,
  settings: TreasuryToleranceSettings | null,
) => {
  const autoBelow = Number(settings?.auto_writeoff_below_amount ?? 0);
  const reviewAbove = Number(settings?.require_approval_above_amount ?? 0);
  const dueDays = Number(settings?.default_due_days ?? 30);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  if (autoBelow > 0 && amountAbs <= autoBelow) {
    return {
      status: 'settled' as const,
      resolution_type: 'auto_writeoff' as const,
      resolved_at: new Date().toISOString(),
      due_date: null as string | null,
    };
  }
  if (reviewAbove > 0 && amountAbs > reviewAbove) {
    return {
      status: 'under_review' as const,
      resolution_type: null,
      resolved_at: null,
      due_date: dueDate.toISOString().slice(0, 10),
    };
  }
  return {
    status: 'open' as const,
    resolution_type: null,
    resolved_at: null,
    due_date: dueDate.toISOString().slice(0, 10),
  };
};

export const useResolveTreasuryEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      resolution_type:
        | 'manager_approved_writeoff'
        | 'worker_debt'
        | 'investigation'
        | 'customer_repayment'
        | 'auto_writeoff'
        | 'tolerance_writeoff'
        | 'carry_forward'
        | 'split_writeoff_debt'
        | 'deduct_from_reward'
        | 'offset_against_return'
        | 'worker_acknowledged'
        | 'credit_to_customer';
      resolution_notes?: string;
      linked_debt_id?: string | null;
      resolver_user_id?: string | null;
    }) => {
      const t = params.resolution_type;
      const status =
        t === 'worker_debt' || t === 'worker_acknowledged' || t === 'split_writeoff_debt' ? 'transferred_to_debt'
        : t === 'investigation' || t === 'offset_against_return' ? 'under_review'
        : t === 'customer_repayment' || t === 'deduct_from_reward' || t === 'credit_to_customer' ? 'settled'
        : t === 'carry_forward' ? 'open'
        : 'written_off';
      const { error } = await supabase
        .from('manager_treasury')
        .update({
          status,
          resolution_type: params.resolution_type,
          resolution_notes: params.resolution_notes ?? null,
          linked_debt_id: params.linked_debt_id ?? null,
          resolved_by: params.resolver_user_id ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surplus-deficit-cash'] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-customer'] });
      toast.success('تم تحديث القيد');
    },
    onError: (e: any) => toast.error(e.message || 'فشل التحديث'),
  });
};

// Four-eyes approval via RPC: only admin-level users; cannot approve own entries.
export const useApproveTreasuryEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      decision: 'manager_approved_writeoff' | 'worker_debt' | 'investigation' | 'customer_repayment';
      notes?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc('approve_treasury_entry', {
        p_entry_id: params.id,
        p_decision: params.decision,
        p_notes: params.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surplus-deficit-cash'] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-customer'] });
      toast.success('تم اعتماد القرار');
    },
    onError: (e: any) => toast.error(e.message || 'فشل الاعتماد'),
  });
};

export const useUpdateToleranceSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<TreasuryToleranceSettings> & { id: string }) => {
      const { error } = await supabase
        .from('treasury_tolerance_settings')
        .update({
          cash_tolerance_amount: s.cash_tolerance_amount,
          cash_tolerance_pct: s.cash_tolerance_pct,
          auto_writeoff_below_amount: s.auto_writeoff_below_amount,
          require_approval_above_amount: s.require_approval_above_amount,
          default_due_days: s.default_due_days,
        })
        .eq('id', s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury-tolerance'] });
      toast.success('تم حفظ الإعدادات');
    },
    onError: (e: any) => toast.error(e.message || 'فشل الحفظ'),
  });
};
