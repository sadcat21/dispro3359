import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type InvestigationStatus = 'open' | 'in_progress' | 'concluded' | 'cancelled';
export type InvestigationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type InvestigationDecision =
  | 'manager_approved_writeoff'
  | 'worker_debt'
  | 'customer_repayment'
  | 'fraud_confirmed'
  | 'inconclusive_writeoff';
export type PartyType = 'worker' | 'driver' | 'cashier' | 'customer' | 'external';
export type EvidenceKind = 'note' | 'file' | 'system';

export interface InvestigationCase {
  id: string;
  case_number: number;
  treasury_id: string | null;
  branch_id: string | null;
  title: string;
  summary: string | null;
  severity: InvestigationSeverity;
  status: InvestigationStatus;
  investigator_id: string | null;
  deadline: string | null;
  opened_by: string | null;
  opened_at: string;
  started_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  decision: InvestigationDecision | null;
  decision_notes: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = 'investigation_cases' as any;
const EV_TABLE = 'investigation_case_evidence' as any;
const PARTY_TABLE = 'investigation_case_parties' as any;
const AUDIT_TABLE = 'investigation_case_audit' as any;

export const useInvestigations = (filters?: { status?: InvestigationStatus | 'all'; branchId?: string | null }) => {
  return useQuery({
    queryKey: ['investigations', filters?.status ?? 'all', filters?.branchId ?? null],
    queryFn: async () => {
      let q = (supabase as any).from(TABLE).select('*').order('opened_at', { ascending: false });
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
      if (filters?.branchId) q = q.eq('branch_id', filters.branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InvestigationCase[];
    },
  });
};

export const useInvestigation = (caseId?: string | null) => {
  return useQuery({
    enabled: !!caseId,
    queryKey: ['investigation', caseId],
    queryFn: async () => {
      const [c, ev, pa, au] = await Promise.all([
        (supabase as any).from(TABLE).select('*').eq('id', caseId).maybeSingle(),
        (supabase as any).from(EV_TABLE).select('*').eq('case_id', caseId).order('created_at', { ascending: true }),
        (supabase as any).from(PARTY_TABLE).select('*').eq('case_id', caseId),
        (supabase as any).from(AUDIT_TABLE).select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
      ]);
      if (c.error) throw c.error;
      return {
        case: c.data as InvestigationCase,
        evidence: (ev.data ?? []) as any[],
        parties: (pa.data ?? []) as any[],
        audit: (au.data ?? []) as any[],
      };
    },
  });
};

export const useInvestigators = () => {
  return useQuery({
    queryKey: ['investigators'],
    queryFn: async () => {
      // Pull admin / supervisor / branch_admin workers from user_roles
      const { data: roles, error: rolesErr } = await (supabase as any)
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'branch_admin', 'supervisor', 'project_manager']);
      if (rolesErr) throw rolesErr;
      const ids = Array.from(new Set(((roles ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('workers')
        .select('id, full_name, role')
        .in('id', ids)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useOpenInvestigation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      treasury_id?: string | null;
      title: string;
      summary?: string;
      severity: InvestigationSeverity;
      investigator_id: string;
      deadline: string;
      parties: Array<{ type: PartyType; user_id?: string | null; label?: string }>;
    }) => {
      const { data, error } = await (supabase as any).rpc('open_investigation_case', {
        p_treasury_id: p.treasury_id ?? null,
        p_title: p.title,
        p_summary: p.summary ?? null,
        p_severity: p.severity,
        p_investigator_id: p.investigator_id,
        p_deadline: p.deadline,
        p_parties: p.parties as any,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investigations'] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-cash'] });
      toast.success('تم فتح ملف المتابعة');
    },
    onError: (e: any) => toast.error(e.message || 'فشل فتح الملف'),
  });
};

export const useAddEvidence = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { case_id: string; kind: EvidenceKind; body: string; storage_path?: string }) => {
      const { error } = await (supabase as any).rpc('add_case_evidence', {
        p_case_id: p.case_id,
        p_kind: p.kind,
        p_body: p.body,
        p_storage_path: p.storage_path ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['investigation', v.case_id] });
      qc.invalidateQueries({ queryKey: ['investigations'] });
      toast.success('تم إضافة الدليل');
    },
    onError: (e: any) => toast.error(e.message || 'فشل الإضافة'),
  });
};

export const useCloseInvestigation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { case_id: string; decision: InvestigationDecision; notes?: string }) => {
      const { error } = await (supabase as any).rpc('close_investigation_case', {
        p_case_id: p.case_id,
        p_decision: p.decision,
        p_notes: p.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['investigation', v.case_id] });
      qc.invalidateQueries({ queryKey: ['investigations'] });
      qc.invalidateQueries({ queryKey: ['surplus-deficit-cash'] });
      toast.success('تم إغلاق الملف وتطبيق القرار');
    },
    onError: (e: any) => toast.error(e.message || 'فشل الإغلاق'),
  });
};

export const SEVERITY_META: Record<InvestigationSeverity, { ar: string; cls: string; days: number }> = {
  low: { ar: 'منخفضة', cls: 'bg-slate-100 text-slate-700 border-slate-300', days: 21 },
  medium: { ar: 'متوسطة', cls: 'bg-blue-100 text-blue-700 border-blue-300', days: 14 },
  high: { ar: 'عالية', cls: 'bg-orange-100 text-orange-700 border-orange-300', days: 7 },
  critical: { ar: 'حرجة', cls: 'bg-rose-100 text-rose-700 border-rose-300', days: 3 },
};

export const STATUS_META: Record<InvestigationStatus, { ar: string; cls: string }> = {
  open: { ar: 'مفتوح', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  in_progress: { ar: 'قيد المتابعة', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  concluded: { ar: 'مغلق', cls: 'bg-green-100 text-green-700 border-green-300' },
  cancelled: { ar: 'ملغى', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
};

export const DECISION_META: Record<InvestigationDecision, { ar: string }> = {
  manager_approved_writeoff: { ar: 'شطب باعتماد المدير' },
  worker_debt: { ar: 'تحويل لدين العامل' },
  customer_repayment: { ar: 'استرداد من العميل' },
  fraud_confirmed: { ar: 'إثبات احتيال' },
  inconclusive_writeoff: { ar: 'شطب لعدم كفاية الأدلة' },
};

export const PARTY_META: Record<PartyType, { ar: string }> = {
  worker: { ar: 'عامل' },
  driver: { ar: 'سائق' },
  cashier: { ar: 'كاشير' },
  customer: { ar: 'عميل' },
  external: { ar: 'طرف خارجي' },
};
