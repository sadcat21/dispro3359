import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export interface SelectedSessionRange { id: string; start: string; end: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workerId: string;
  workerName?: string;
  selectedIds: Set<string>;
  onApply: (ranges: SelectedSessionRange[]) => void;
}

const AccountingSessionsTimelineDialog: React.FC<Props> = ({ open, onOpenChange, workerId, workerName, selectedIds, onApply }) => {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['worker-accounting-sessions-timeline', workerId],
    enabled: open && !!workerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_sessions')
        .select('id, period_start, period_end, completed_at, created_at, status')
        .eq('worker_id', workerId)
        .order('period_start', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const displaySessions = useMemo(() => {
    const list = [...sessions];
    const latest = list[0];
    if (latest && latest.status === 'completed' && latest.period_end) {
      const endT = new Date(latest.period_end).getTime();
      if (endT < Date.now()) {
        list.unshift({
          id: 'virtual-open',
          period_start: latest.period_end,
          period_end: new Date().toISOString(),
          completed_at: null,
          created_at: latest.period_end,
          status: 'open',
          __virtual: true,
        } as any);
      }
    }
    return list;
  }, [sessions]);

  const [localSel, setLocalSel] = useState<Set<string>>(new Set());
  useEffect(() => { if (open) setLocalSel(new Set(selectedIds)); }, [open, selectedIds]);

  const toggle = (id: string) => {
    setLocalSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const apply = () => {
    const ranges: SelectedSessionRange[] = displaySessions
      .filter((s: any) => localSel.has(s.id) && s.period_start && s.period_end)
      .map((s: any) => ({ id: s.id, start: s.period_start, end: s.period_end }));
    onApply(ranges);
    onOpenChange(false);
  };

  const clearAll = () => { setLocalSel(new Set()); onApply([]); onOpenChange(false); };

  const statusLabel: Record<string, { ar: string; cls: string }> = {
    completed: { ar: 'مكتملة', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    open: { ar: 'مفتوحة', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    pending: { ar: 'معلّقة', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    cancelled: { ar: 'ملغاة', cls: 'bg-red-100 text-red-700 border-red-200' },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-primary" />
            <span>ترتيب أوقات الجلسات المحاسبية</span>
          </DialogTitle>
          {workerName && (
            <p className="text-xs text-muted-foreground">{workerName}</p>
          )}
          <p className="text-[11px] text-muted-foreground">حدد جلسة أو أكثر لعرض الإنجازات والعروض المرتبطة بها فقط.</p>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : displaySessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد جلسات محاسبية لهذا العامل</p>
        ) : (
          <>
            <ol className="relative border-r-2 border-border pr-4 space-y-3">
              {displaySessions.map((s: any) => {
                const sl = statusLabel[s.status] || { ar: s.status, cls: 'bg-muted text-muted-foreground border-border' };
                const checked = localSel.has(s.id);
                const isVirtualOpen = s.__virtual;
                return (
                  <li key={s.id} className="relative">
                    <span className={`absolute -right-[1.4rem] top-1.5 w-3 h-3 rounded-full border-2 border-background ${isVirtualOpen ? 'bg-blue-500 animate-pulse' : 'bg-primary'}`} />
                    <label className={`flex items-start gap-2 rounded-lg border p-2.5 shadow-sm cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5' : isVirtualOpen ? 'bg-blue-50/50 border-blue-200 border-dashed' : 'bg-card'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="mt-1 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isVirtualOpen ? 'bg-blue-100 text-blue-700 border-blue-300' : sl.cls}`}>
                            {isVirtualOpen ? 'جلسة مفتوحة' : sl.ar}
                          </span>
                          <span className="text-[10px] text-muted-foreground" dir="ltr">
                            {isVirtualOpen ? 'قيد الانتظار' : (s.completed_at ? format(new Date(s.completed_at), 'dd/MM/yyyy HH:mm') : '—')}
                          </span>
                        </div>
                        <div className="text-xs text-foreground/80" dir="ltr">
                          <span className="text-muted-foreground">من: </span>
                          {s.period_start ? format(new Date(s.period_start), 'dd/MM HH:mm') : '—'}
                          <span className="mx-1 text-muted-foreground">←</span>
                          <span className="text-muted-foreground">إلى: </span>
                          {isVirtualOpen ? <span className="text-blue-600">الآن (حتى الحفظ)</span> : (s.period_end ? format(new Date(s.period_end), 'dd/MM HH:mm') : '—')}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ol>
            <div className="sticky bottom-0 mt-3 pt-2 bg-background border-t flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted"
              >
                إلغاء التحديد
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={localSel.size === 0}
                className="text-xs px-4 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              >
                تطبيق ({localSel.size})
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AccountingSessionsTimelineDialog;
