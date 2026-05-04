import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TargetMetric = 'sales_amount' | 'deliveries_count' | 'cartons_sold';
export type TargetPeriod = 'daily' | 'weekly' | 'monthly';
export type TargetStatus = 'in_progress' | 'achieved' | 'missed';

export interface WorkerTarget {
  id: string;
  name: string;
  description: string | null;
  metric_type: TargetMetric;
  period_type: TargetPeriod;
  target_value: number;
  start_date: string;
  end_date: string;
  worker_id: string | null;
  reward_amount: number;
  penalty_amount: number;
  min_achievement_pct: number;
  bonus_per_extra_unit: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerTargetProgress {
  id: string;
  target_id: string;
  worker_id: string;
  period_start: string;
  period_end: string;
  achieved_value: number;
  achievement_pct: number;
  status: TargetStatus;
  reward_calculated: number;
  penalty_calculated: number;
  reward_applied: boolean;
  last_calculated_at: string;
}

export const METRIC_LABELS: Record<TargetMetric, string> = {
  sales_amount: 'مبلغ المبيعات (د.ج)',
  deliveries_count: 'عدد التوصيلات',
  cartons_sold: 'عدد الكراتين المباعة',
};

export const PERIOD_LABELS: Record<TargetPeriod, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
};

export const STATUS_LABELS: Record<TargetStatus, string> = {
  in_progress: 'قيد التنفيذ',
  achieved: 'محقق ✅',
  missed: 'فاشل ❌',
};

export function useWorkerTargets() {
  return useQuery({
    queryKey: ['worker-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_targets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WorkerTarget[];
    },
  });
}

export function useWorkerTargetProgress(workerId?: string) {
  return useQuery({
    queryKey: ['worker-target-progress', workerId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('worker_target_progress').select('*').order('period_start', { ascending: false });
      if (workerId) q = q.eq('worker_id', workerId);
      const { data, error } = await q;
      if (error) throw error;
      return data as WorkerTargetProgress[];
    },
  });
}

export function useCreateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<WorkerTarget, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('worker_targets')
        .insert({ ...input, created_by: u.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-targets'] });
      toast.success('تم إنشاء الهدف');
    },
    onError: (e: any) => toast.error(e.message ?? 'فشل الإنشاء'),
  });
}

export function useUpdateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<WorkerTarget> & { id: string }) => {
      const { error } = await supabase.from('worker_targets').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-targets'] });
      toast.success('تم التحديث');
    },
    onError: (e: any) => toast.error(e.message ?? 'فشل التحديث'),
  });
}

export function useDeleteTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('worker_targets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-targets'] });
      toast.success('تم الحذف');
    },
    onError: (e: any) => toast.error(e.message ?? 'فشل الحذف'),
  });
}

/** Recalculate progress for all active targets for a given worker */
export function useRecalcWorkerTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workerId: string) => {
      const { data, error } = await supabase.rpc('recalculate_targets_for_worker', { _worker_id: workerId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-target-progress'] });
      toast.success('تم تحديث الإنجاز');
    },
    onError: (e: any) => toast.error(e.message ?? 'فشل التحديث'),
  });
}
