import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PackageOpen, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export interface SelectedReceiptRange { id: string; start: string; end: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  selectedIds: Set<string>;
  onApply: (ranges: SelectedReceiptRange[]) => void;
}

/**
 * نافذة تختار "جلسة استلام" أو أكثر.
 * كل جلسة = النافذة الزمنية من تاريخ وصل الاستلام حتى تاريخ الوصل التالي
 * (أو حتى الآن إذا كان الوصل هو الأحدث).
 */
const ReceiptSessionsTimelineDialog: React.FC<Props> = ({
  open, onOpenChange, branchId, selectedIds, onApply,
}) => {
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['warehouse-receipt-sessions', branchId],
    enabled: open && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_receipts')
        .select('id, created_at, invoice_number, status')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(120);
      if (error) throw error;
      return data || [];
    },
  });

  // ترتيب تنازلي (الأحدث في الأعلى) + بناء نافذة لكل وصل: من create_at إلى create_at للوصل التالي زمنياً (أو الآن).
  const sessions = useMemo(() => {
    const sorted = [...receipts].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return sorted.map((r: any, idx: number) => {
      const start = r.created_at;
      const end = idx === 0 ? new Date().toISOString() : sorted[idx - 1].created_at;
      const isOpen = idx === 0;
      return { id: r.id, start, end, invoice_number: r.invoice_number, isOpen };
    });
  }, [receipts]);

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
    const ranges: SelectedReceiptRange[] = sessions
      .filter((s) => localSel.has(s.id))
      .map((s) => ({ id: s.id, start: s.start, end: s.end }));
    onApply(ranges);
    onOpenChange(false);
  };

  const clearAll = () => { setLocalSel(new Set()); onApply([]); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="w-4 h-4 text-primary" />
            <span>ترتيب جلسات الاستلام</span>
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            حدد جلسة أو أكثر لعرض المستلم والمبيعات والعروض داخل النوافذ المختارة فقط.
            (الجلسة = ما فُتح من تاريخ آخر استلام)
          </p>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد وصولات استلام لهذا الفرع</p>
        ) : (
          <>
            <ol className="relative border-r-2 border-border pr-4 space-y-3">
              {sessions.map((s) => {
                const checked = localSel.has(s.id);
                return (
                  <li key={s.id} className="relative">
                    <span className={`absolute -right-[1.4rem] top-1.5 w-3 h-3 rounded-full border-2 border-background ${s.isOpen ? 'bg-blue-500 animate-pulse' : 'bg-primary'}`} />
                    <label className={`flex items-start gap-2 rounded-lg border p-2.5 shadow-sm cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5' : s.isOpen ? 'bg-blue-50/50 border-blue-200 border-dashed' : 'bg-card'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        className="mt-1 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.isOpen ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                            {s.isOpen ? 'جلسة مفتوحة' : 'مغلقة'}
                          </span>
                          <span className="text-[10px] text-muted-foreground" dir="ltr">
                            {s.invoice_number ? `#${s.invoice_number}` : '—'}
                          </span>
                        </div>
                        <div className="text-xs text-foreground/80" dir="ltr">
                          <span className="text-muted-foreground">من: </span>
                          {format(new Date(s.start), 'dd/MM HH:mm')}
                          <span className="mx-1 text-muted-foreground">←</span>
                          <span className="text-muted-foreground">إلى: </span>
                          {s.isOpen ? <span className="text-blue-600">الآن</span> : format(new Date(s.end), 'dd/MM HH:mm')}
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

/** يفحص هل وقت ما (ISO) داخل أي نافذة من النوافذ المختارة (start مُدرج، end مستثنى). */
export const isInRanges = (iso: string | null | undefined, ranges: SelectedReceiptRange[]) => {
  if (!iso || !ranges.length) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  for (const r of ranges) {
    const s = new Date(r.start).getTime();
    const e = new Date(r.end).getTime();
    if (t >= s && t < e) return true;
  }
  return false;
};

export default ReceiptSessionsTimelineDialog;
