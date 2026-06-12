import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AlertTriangle, Flame, Activity, Snowflake, Sparkles, X } from 'lucide-react';
import {
  useInvestigators,
  useOpenInvestigation,
  SEVERITY_META,
  PARTY_META,
  type InvestigationSeverity,
  type PartyType,
} from '@/hooks/useInvestigations';

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

const QUICK_ADD: PartyType[] = ['worker', 'driver', 'cashier', 'customer', 'external'];

const useSessionContext = (treasury: any | null) =>
  useQuery({
    enabled: !!treasury?.session_id || !!treasury?.manager_id,
    queryKey: ['investigation-session-context', treasury?.session_id, treasury?.manager_id],
    queryFn: async () => {
      const out: { worker?: { id: string; full_name: string }; manager?: { id: string; full_name: string } } = {};
      if (treasury?.session_id) {
        const { data } = await supabase
          .from('accounting_sessions')
          .select('worker_id, manager_id, worker:workers!accounting_sessions_worker_id_fkey(id, full_name), manager:workers!accounting_sessions_manager_id_fkey(id, full_name)')
          .eq('id', treasury.session_id)
          .maybeSingle();
        if (data) {
          if ((data as any).worker) out.worker = (data as any).worker;
          if ((data as any).manager) out.manager = (data as any).manager;
        }
      }
      if (!out.manager && treasury?.manager_id) {
        const { data } = await supabase.from('workers').select('id, full_name').eq('id', treasury.manager_id).maybeSingle();
        if (data) out.manager = data as any;
      }
      return out;
    },
  });

const OpenInvestigationDialog: React.FC<Props> = ({ open, onClose, treasury }) => {
  const navigate = useNavigate();
  const { data: investigators = [] } = useInvestigators();
  const { data: ctx } = useSessionContext(treasury);
  const openCase = useOpenInvestigation();

  const [severity, setSeverity] = useState<InvestigationSeverity>('medium');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [investigatorId, setInvestigatorId] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [parties, setParties] = useState<PartyEntry[]>([]);

  // Reset form when opening
  useEffect(() => {
    if (!open) return;
    setTitle(treasury ? `تحقيق في ${treasury.source_type === 'accounting_deficit' ? 'عجز' : 'فائض'} بمبلغ ${treasury.amount} DA` : '');
    setSummary(treasury?.notes ?? '');
    setSeverity('medium');
    setInvestigatorId('');
    setParties([]);
    const days = SEVERITY_META.medium.days;
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDeadline(d.toISOString().slice(0, 10));
  }, [open, treasury]);

  // Auto-suggest parties when session context arrives
  useEffect(() => {
    if (!open || !ctx) return;
    setParties((prev) => {
      // Don't overwrite manual edits — only add suggestions if list still empty
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

  const addQuickParty = (type: PartyType) => {
    setParties((prev) => [
      ...prev,
      { id: `m-${type}-${Date.now()}`, type, label: '' },
    ]);
  };

  const removeParty = (id: string) =>
    setParties((prev) => prev.filter((p) => p.id !== id));

  const updatePartyLabel = (id: string, label: string) =>
    setParties((prev) => prev.map((p) => (p.id === id ? { ...p, label } : p)));

  const canSave = title.trim().length > 2 && investigatorId && deadline && parties.length > 0;

  const hasContextSuggestion = useMemo(
    () => parties.some((p) => p.suggested),
    [parties],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>فتح قضية تحقيق</DialogTitle>
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
            <Label>عنوان القضية</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: عجز نقدي مشبوه في الجلسة #..." />
          </div>

          <div className="space-y-1.5">
            <Label>الملخص الأولي</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="اشرح ما تعرفه حتى الآن..." />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>الأطراف المشتبه بهم</Label>
              {hasContextSuggestion && (
                <span className="text-[10px] text-emerald-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> اقتراحات تلقائية من الجلسة
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {parties.length === 0 && (
                <p className="text-[11px] text-muted-foreground">أضف طرفًا واحدًا على الأقل ↓</p>
              )}
              {parties.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2',
                    p.suggested ? 'border-emerald-300 bg-emerald-50/50' : 'border-border',
                  )}
                >
                  <span className="text-xs font-semibold shrink-0 w-16">{PARTY_META[p.type].ar}</span>
                  <Input
                    value={p.label ?? ''}
                    onChange={(e) => updatePartyLabel(p.id, e.target.value)}
                    placeholder="اسم/وصف"
                    className="h-7 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeParty(p.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground self-center">إضافة:</span>
              {QUICK_ADD.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => addQuickParty(p)}
                  className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] hover:bg-muted/50"
                >
                  + {PARTY_META[p].ar}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>المحقّق المُكلَّف</Label>
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
              <Label>المهلة النهائية</Label>
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
            فتح القضية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpenInvestigationDialog;
