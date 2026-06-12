import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronLeft, FileText, ShieldCheck, MessageSquare, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useInvestigation,
  useAddEvidence,
  useCloseInvestigation,
  SEVERITY_META,
  STATUS_META,
  DECISION_META,
  PARTY_META,
  type InvestigationDecision,
} from '@/hooks/useInvestigations';

const DECISIONS: { key: InvestigationDecision; cls: string }[] = [
  { key: 'manager_approved_writeoff', cls: 'border-rose-500 bg-rose-50 text-rose-700' },
  { key: 'worker_debt', cls: 'border-purple-500 bg-purple-50 text-purple-700' },
  { key: 'customer_repayment', cls: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { key: 'fraud_confirmed', cls: 'border-red-700 bg-red-50 text-red-800' },
  { key: 'inconclusive_writeoff', cls: 'border-slate-500 bg-slate-50 text-slate-700' },
];

const InvestigationCase: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dir } = useLanguage();
  const { workerId } = useAuth();
  const { data, isLoading } = useInvestigation(id);
  const addEvidence = useAddEvidence();
  const closeCase = useCloseInvestigation();

  const [note, setNote] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [decision, setDecision] = useState<InvestigationDecision>('manager_approved_writeoff');
  const [closeNotes, setCloseNotes] = useState('');

  if (isLoading || !data?.case) {
    return <div className="p-4 text-center text-sm text-muted-foreground">جاري التحميل...</div>;
  }

  const c = data.case;
  const sev = SEVERITY_META[c.severity];
  const st = STATUS_META[c.status];
  const isOpener = workerId && c.opened_by === workerId;
  const canClose = c.status !== 'concluded' && c.status !== 'cancelled' && !isOpener;

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto" dir={dir}>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> رجوع
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${st.cls}`}>{st.ar}</Badge>
          <Badge variant="outline" className={`text-xs ${sev.cls}`}>خطورة {sev.ar}</Badge>
        </div>
      </div>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">ملف #{c.case_number}</span>
        </div>
        <h2 className="text-lg font-bold">{c.title}</h2>
        {c.summary && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.summary}</p>}

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t mt-2">
          <div><span className="text-muted-foreground">فُتحت:</span> {format(new Date(c.opened_at), 'dd/MM/yyyy HH:mm')}</div>
          {c.deadline && <div><span className="text-muted-foreground">تاريخ المتابعة:</span> {format(new Date(c.deadline), 'dd/MM/yyyy')}</div>}
          {c.closed_at && <div><span className="text-muted-foreground">أُغلقت:</span> {format(new Date(c.closed_at), 'dd/MM/yyyy HH:mm')}</div>}
          {c.decision && <div><span className="text-muted-foreground">القرار:</span> {DECISION_META[c.decision].ar}</div>}
        </div>

        {data.parties.length > 0 && (
          <div className="pt-2 border-t mt-2">
            <Label className="text-xs">الأطراف المشتبه بهم</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {data.parties.map((p) => (
                <Badge key={p.id} variant="outline" className="text-[11px]">
                  {PARTY_META[p.party_type as keyof typeof PARTY_META]?.ar ?? p.party_type}
                  {p.label ? ` — ${p.label}` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {c.status !== 'concluded' && c.status !== 'cancelled' && (
        <Card className="p-3 space-y-2">
          <Label className="flex items-center gap-1 text-sm"><MessageSquare className="w-4 h-4" /> إضافة دليل / ملاحظة</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="اكتب الدليل أو الملاحظة..." />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={note.trim().length < 2 || addEvidence.isPending}
              onClick={async () => {
                await addEvidence.mutateAsync({ case_id: c.id, kind: 'note', body: note });
                setNote('');
              }}
            >
              إضافة
            </Button>
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1"><FileText className="w-4 h-4" /> خط زمني للأدلة</h3>
        <ScrollArea className="max-h-[40vh]">
          <div className="space-y-2">
            {data.evidence.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد أدلة بعد</p>
            )}
            {data.evidence.map((e) => (
              <Card key={e.id} className="p-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{e.kind === 'system' ? 'النظام' : 'محقّق'}</span>
                  <span>{format(new Date(e.created_at), 'dd/MM HH:mm')}</span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{e.body}</p>
                {e.storage_path && (
                  <p className="text-[10px] text-blue-600 mt-1">مرفق: {e.storage_path}</p>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1"><Activity className="w-4 h-4" /> سجل التدقيق</h3>
        <div className="space-y-1">
          {data.audit.map((a) => (
            <div key={a.id} className="text-[11px] flex items-center justify-between border-b py-1">
              <span>{a.action}</span>
              <span className="text-muted-foreground">{format(new Date(a.created_at), 'dd/MM HH:mm')}</span>
            </div>
          ))}
        </div>
      </div>

      {canClose && (
        <Button className="w-full gap-2" onClick={() => setCloseOpen(true)}>
          <ShieldCheck className="w-4 h-4" /> إغلاق القضية وتطبيق القرار
        </Button>
      )}
      {isOpener && c.status !== 'concluded' && (
        <p className="text-[11px] text-amber-700 text-center">لا يمكنك إغلاق قضية فتحتها بنفسك — يجب أن يُغلقها مديرٌ آخر</p>
      )}

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إغلاق القضية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>القرار النهائي</Label>
              <div className="grid grid-cols-1 gap-2">
                {DECISIONS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDecision(d.key)}
                    className={cn(
                      'rounded-lg border p-2 text-right text-sm transition-all',
                      decision === d.key ? `${d.cls} ring-2` : 'border-border hover:bg-muted/50',
                    )}
                  >
                    {DECISION_META[d.key].ar}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>مبرر القرار</Label>
              <Textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseOpen(false)}>إلغاء</Button>
            <Button
              disabled={closeCase.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                await closeCase.mutateAsync({ case_id: c.id, decision, notes: closeNotes });
                setCloseOpen(false);
              }}
            >
              تأكيد الإغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvestigationCase;
