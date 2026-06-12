import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AlertTriangle, Flame, Activity, Snowflake } from 'lucide-react';
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

const PARTIES: PartyType[] = ['worker', 'driver', 'cashier', 'customer', 'external'];

const OpenInvestigationDialog: React.FC<Props> = ({ open, onClose, treasury }) => {
  const navigate = useNavigate();
  const { data: investigators = [] } = useInvestigators();
  const openCase = useOpenInvestigation();

  const [severity, setSeverity] = useState<InvestigationSeverity>('medium');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [investigatorId, setInvestigatorId] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [parties, setParties] = useState<PartyType[]>([]);

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

  useEffect(() => {
    const days = SEVERITY_META[severity].days;
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDeadline(d.toISOString().slice(0, 10));
  }, [severity]);

  const toggleParty = (p: PartyType) =>
    setParties((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const canSave = title.trim().length > 2 && investigatorId && deadline && parties.length > 0;

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
            <Label>الأطراف المشتبه بهم (واحد أو أكثر)</Label>
            <div className="flex flex-wrap gap-2">
              {PARTIES.map((p) => {
                const on = parties.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleParty(p)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                      on ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-border hover:bg-muted/50',
                    )}
                  >
                    {PARTY_META[p].ar}
                  </button>
                );
              })}
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
                parties: parties.map((p) => ({ type: p })),
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
