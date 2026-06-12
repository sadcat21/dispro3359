import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Flame, Activity, Snowflake, Sparkles, X, UserRound, Users, Store, UserPlus } from 'lucide-react';
import {
  useInvestigators,
  useOpenInvestigation,
  SEVERITY_META,
  PARTY_META,
  type InvestigationSeverity,
  type PartyType,
} from '@/hooks/useInvestigations';
import WorkerPickerDialog from '@/components/stock/WorkerPickerDialog';
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import type { Customer, Sector } from '@/types/database';

interface Props {
  open: boolean;
  onClose: () => void;
  treasury: any | null;
}

interface PartyEntry {
  id: string;
  type: PartyType;
  user_id?: string | null;
  label?: string;
  suggested?: boolean;
}

const SEV_ICONS: Record<InvestigationSeverity, React.ComponentType<{ className?: string }>> = {
  low: Snowflake,
  medium: Activity,
  high: AlertTriangle,
  critical: Flame,
};

const SEVERITY_ACTIVE: Record<InvestigationSeverity, string> = {
  low: 'border-slate-500 bg-slate-50 text-slate-700 ring-2 ring-slate-200',
  medium: 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200',
  high: 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-200',
  critical: 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200',
};

const PARTY_BADGE_STYLE: Record<PartyType, string> = {
  worker: 'bg-blue-50 text-blue-700 border-blue-300',
  driver: 'bg-amber-50 text-amber-700 border-amber-300',
  cashier: 'bg-purple-50 text-purple-700 border-purple-300',
  customer: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  external: 'bg-slate-50 text-slate-700 border-slate-300',
};

const useSessionContext = (treasury: any | null) =>
  useQuery({
    enabled: !!treasury?.session_id || !!treasury?.manager_id,
    queryKey: ['investigation-session-context', treasury?.session_id, treasury?.manager_id],
    queryFn: async () => {
      const out: { worker?: { id: string; full_name: string }; manager?: { id: string; full_name: string }; branch_id?: string | null } = {};
      if (treasury?.session_id) {
        const { data } = await supabase
          .from('accounting_sessions')
          .select('worker_id, manager_id, branch_id, worker:workers!accounting_sessions_worker_id_fkey(id, full_name), manager:workers!accounting_sessions_manager_id_fkey(id, full_name)')
          .eq('id', treasury.session_id)
          .maybeSingle();
        if (data) {
          if ((data as any).worker) out.worker = (data as any).worker;
          if ((data as any).manager) out.manager = (data as any).manager;
          out.branch_id = (data as any).branch_id ?? null;
        }
      }
      if (!out.manager && treasury?.manager_id) {
        const { data } = await supabase.from('workers').select('id, full_name').eq('id', treasury.manager_id).maybeSingle();
        if (data) out.manager = data as any;
      }
      return out;
    },
  });

const useBranchWorkers = (branchId?: string | null, open?: boolean) =>
  useQuery({
    enabled: !!open,
    queryKey: ['investigation-branch-workers', branchId ?? null],
    queryFn: async () => {
      let q = supabase.from('workers').select('id, full_name, username').eq('is_active', true).order('full_name');
      if (branchId) q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string; username: string }[];
    },
  });

const useBranchCustomers = (branchId?: string | null, open?: boolean) =>
  useQuery({
    enabled: !!open,
    queryKey: ['investigation-branch-customers', branchId ?? null],
    queryFn: async () => {
      let cq: any = supabase.from('customers').select('*').eq('status', 'active').order('name');
      let sq: any = supabase.from('sectors').select('*').order('name');
      if (branchId) {
        cq = cq.eq('branch_id', branchId);
        sq = sq.eq('branch_id', branchId);
      }
      const [c, s] = await Promise.all([cq, sq]);
      return {
        customers: (c.data ?? []) as Customer[],
        sectors: (s.data ?? []) as Sector[],
      };
    },
  });

const OpenInvestigationDialog: React.FC<Props> = ({ open, onClose, treasury }) => {
  const navigate = useNavigate();
  const { data: investigators = [] } = useInvestigators();
  const { data: ctx } = useSessionContext(treasury);
  const openCase = useOpenInvestigation();

  const branchId = ctx?.branch_id ?? treasury?.branch_id ?? null;
  const { data: workers = [] } = useBranchWorkers(branchId, open);
  const { data: custData } = useBranchCustomers(branchId, open);

  const [severity, setSeverity] = useState<InvestigationSeverity>('medium');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [investigatorId, setInvestigatorId] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [parties, setParties] = useState<PartyEntry[]>([]);

  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [externalDraft, setExternalDraft] = useState('');

  // Reset form when opening
  useEffect(() => {
    if (!open) return;
    setTitle(treasury ? `متابعة ${treasury.source_type === 'accounting_deficit' ? 'عجز' : 'فائض'} بمبلغ ${treasury.amount} DA` : '');
    setSummary(treasury?.notes ?? '');
    setSeverity('medium');
    setInvestigatorId('');
    setParties([]);
    setExternalDraft('');
    const days = SEVERITY_META.medium.days;
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDeadline(d.toISOString().slice(0, 10));
  }, [open, treasury]);

  // Auto-suggest parties when session context arrives
  useEffect(() => {
    if (!open || !ctx) return;
    setParties((prev) => {
      if (prev.length > 0) return prev;
      const suggestions: PartyEntry[] = [];
      if (ctx.worker) {
        suggestions.push({
          id: `s-w-${ctx.worker.id}`,
          type: 'worker',
          user_id: ctx.worker.id,
          label: ctx.worker.full_name,
          suggested: true,
        });
      }
      if (ctx.manager) {
        suggestions.push({
          id: `s-m-${ctx.manager.id}`,
          type: 'cashier',
          user_id: ctx.manager.id,
          label: `${ctx.manager.full_name} (مسؤول الجلسة)`,
          suggested: true,
        });
      }
      return suggestions;
    });
  }, [open, ctx]);

  // Update deadline when severity changes
  useEffect(() => {
    const days = SEVERITY_META[severity].days;
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDeadline(d.toISOString().slice(0, 10));
  }, [severity]);

  const removeParty = (id: string) =>
    setParties((prev) => prev.filter((p) => p.id !== id));

  const addExternal = () => {
    const label = externalDraft.trim();
    if (!label) return;
    setParties((prev) => [
      ...prev,
      { id: `ext-${Date.now()}`, type: 'external', label },
    ]);
    setExternalDraft('');
  };

  const onPickWorker = (workerId: string) => {
    const w = workers.find((x) => x.id === workerId);
    if (!w) return;
    setParties((prev) =>
      prev.some((p) => p.user_id === w.id && p.type === 'worker')
        ? prev
        : [...prev, { id: `w-${w.id}-${Date.now()}`, type: 'worker', user_id: w.id, label: w.full_name }],
    );
  };

  const onPickCustomer = (customer: Customer) => {
    setParties((prev) =>
      prev.some((p) => p.user_id === customer.id && p.type === 'customer')
        ? prev
        : [...prev, {
            id: `c-${customer.id}-${Date.now()}`,
            type: 'customer',
            user_id: customer.id,
            label: customer.store_name || customer.name,
          }],
    );
    setCustomerPickerOpen(false);
  };

  const canSave = title.trim().length > 2 && investigatorId && deadline && parties.length > 0;

  const hasContextSuggestion = useMemo(
    () => parties.some((p) => p.suggested),
    [parties],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>فتح ملف متابعة</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>درجة الخطورة</Label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(SEVERITY_META) as InvestigationSeverity[]).map((k) => {
                  const Icon = SEV_ICONS[k];
                  const selected = severity === k;
                  return (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setSeverity(k)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all',
                        selected ? SEVERITY_ACTIVE[k] : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-semibold">{SEVERITY_META[k].ar}</span>
                      <span className="text-[10px] text-muted-foreground">{SEVERITY_META[k].days} يوم</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>عنوان الملف</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: متابعة فرق نقدي في جلسة #..." />
            </div>

            <div className="space-y-1.5">
              <Label>ملخص الحالة</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="اكتب باختصار ما تعرفه حتى الآن..." />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>الأطراف المعنية</Label>
                {hasContextSuggestion && (
                  <span className="text-[10px] text-emerald-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> اقتراحات تلقائية من الجلسة
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-[2rem] rounded-lg border border-dashed border-border p-2">
                {parties.length === 0 && (
                  <p className="text-[11px] text-muted-foreground self-center">
                    أضف طرفًا واحدًا على الأقل ↓
                  </p>
                )}
                {parties.map((p) => (
                  <Badge
                    key={p.id}
                    variant="outline"
                    className={cn(
                      'gap-1 pr-1 pl-2 py-1 text-[11px] font-medium',
                      PARTY_BADGE_STYLE[p.type],
                      p.suggested && 'ring-1 ring-emerald-400',
                    )}
                  >
                    <span className="opacity-70">{PARTY_META[p.type].ar}:</span>
                    <span className="font-semibold">{p.label || '—'}</span>
                    <button
                      type="button"
                      onClick={() => removeParty(p.id)}
                      className="ml-0.5 rounded-full hover:bg-black/10 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={() => setWorkerPickerOpen(true)}
                >
                  <UserRound className="w-3.5 h-3.5" /> عامل
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setCustomerPickerOpen(true)}
                >
                  <Store className="w-3.5 h-3.5" /> زبون
                </Button>
                <div className="flex items-center gap-1 flex-1 min-w-[180px]">
                  <Input
                    value={externalDraft}
                    onChange={(e) => setExternalDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExternal(); } }}
                    placeholder="طرف خارجي (اسم/وصف)"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs h-8 shrink-0"
                    disabled={!externalDraft.trim()}
                    onClick={addExternal}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> إضافة
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المسؤول عن المتابعة</Label>
                <select
                  value={investigatorId}
                  onChange={(e) => setInvestigatorId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                >
                  <option value="">— اختر —</option>
                  {investigators.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ المتابعة</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button
              disabled={!canSave || openCase.isPending}
              onClick={async () => {
                const caseId = await openCase.mutateAsync({
                  treasury_id: treasury?.id ?? null,
                  title,
                  summary,
                  severity,
                  investigator_id: investigatorId,
                  deadline,
                  parties: parties.map((p) => ({
                    type: p.type,
                    user_id: p.user_id ?? null,
                    label: p.label ?? '',
                  })),
                });
                onClose();
                navigate(`/admin/investigations/${caseId}`);
              }}
            >
              بدء المتابعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkerPickerDialog
        open={workerPickerOpen}
        onOpenChange={setWorkerPickerOpen}
        workers={workers.filter(w => !parties.some(p => p.user_id === w.id))}
        selectedWorkerId=""
        onSelect={(id) => { onPickWorker(id); setWorkerPickerOpen(false); }}
        hideStatusBadge
      />

      <CustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        customers={custData?.customers ?? []}
        sectors={custData?.sectors ?? []}
        onSelect={onPickCustomer}
      />
    </>
  );
};

export default OpenInvestigationDialog;
