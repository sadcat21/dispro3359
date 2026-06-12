import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, CreditCard, ArrowUpRight, Banknote, FileText, Store, ChevronRight, ArrowRight } from 'lucide-react';
import { resolveReceiptBucket } from '@/utils/treasuryDocumentClassification';

type MethodKey = 'check' | 'transfer' | 'receipt_cash' | 'receipt_doc' | 'cash';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: any[];
}

const fmt = (n: number) => Number(n || 0).toLocaleString();

const METHODS: { key: MethodKey; label: string; Icon: any; color: string }[] = [
  { key: 'check',        label: 'Chèque',        Icon: CreditCard,   color: 'red' },
  { key: 'transfer',     label: 'Virement',      Icon: ArrowUpRight, color: 'orange' },
  { key: 'receipt_cash', label: 'Versement Cash',Icon: Banknote,     color: 'emerald' },
  { key: 'receipt_doc',  label: 'Versement Doc', Icon: FileText,     color: 'indigo' },
  { key: 'cash',         label: 'Espèces',       Icon: Banknote,     color: 'green' },
];

const colorMap: Record<string, { btn: string; chip: string }> = {
  red:     { btn: 'bg-red-600 hover:bg-red-700 text-white',         chip: 'bg-red-50 text-red-700 border-red-200' },
  orange:  { btn: 'bg-orange-600 hover:bg-orange-700 text-white',   chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  emerald: { btn: 'bg-emerald-600 hover:bg-emerald-700 text-white', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  indigo:  { btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',   chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  green:   { btn: 'bg-green-600 hover:bg-green-700 text-white',     chip: 'bg-green-50 text-green-700 border-green-200' },
};

const SessionInvoiceMethodsDialog: React.FC<Props> = ({ open, onOpenChange, sessions }) => {
  const [selected, setSelected] = useState<MethodKey | null>(null);

  const windows = useMemo(() => (sessions || [])
    .map((s: any) => ({
      worker_id: s.worker?.id ?? s.worker_id,
      start: s.period_start ? new Date(s.period_start).getTime() : 0,
      end: s.period_end ? new Date(s.period_end).getTime() : Date.now(),
    }))
    .filter((w) => !!w.worker_id), [sessions]);

  const workerIds = useMemo(() => Array.from(new Set(windows.map((w) => w.worker_id))), [windows]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['session-invoice-methods', workerIds, windows.map((w) => `${w.start}-${w.end}`)],
    enabled: open && workerIds.length > 0,
    queryFn: async () => {
      const minStart = windows.length ? new Date(Math.min(...windows.map((w) => w.start))).toISOString() : undefined;
      const maxEnd = windows.length ? new Date(Math.max(...windows.map((w) => w.end))).toISOString() : undefined;
      let q = supabase
        .from('orders')
        .select(`
          id, total_amount, created_at, assigned_worker_id,
          payment_type, payment_status, payment_method_resolved,
          invoice_payment_method, document_verification,
          customer:customers(name, store_name)
        `)
        .eq('status', 'delivered')
        .eq('payment_type', 'with_invoice')
        .in('assigned_worker_id', workerIds)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (minStart) q = q.gte('created_at', minStart);
      if (maxEnd) q = q.lte('created_at', maxEnd);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).filter((o: any) => {
        const t = new Date(o.created_at).getTime();
        return windows.some((w) => w.worker_id === o.assigned_worker_id && t >= w.start && t <= w.end);
      });
    },
  });

  const classify = (o: any): MethodKey | null => {
    const m = o.invoice_payment_method;
    if (m === 'check') return 'check';
    if (m === 'transfer') return 'transfer';
    if (m === 'cash') return 'cash';
    if (m === 'receipt') {
      const bucket = resolveReceiptBucket(o.document_verification, o);
      return bucket === 'cash' ? 'receipt_cash' : 'receipt_doc';
    }
    return null;
  };

  const grouped = useMemo(() => {
    const acc: Record<MethodKey, { count: number; amount: number; orders: any[] }> = {
      check:        { count: 0, amount: 0, orders: [] },
      transfer:     { count: 0, amount: 0, orders: [] },
      receipt_cash: { count: 0, amount: 0, orders: [] },
      receipt_doc:  { count: 0, amount: 0, orders: [] },
      cash:         { count: 0, amount: 0, orders: [] },
    };
    for (const o of orders) {
      const k = classify(o);
      if (!k) continue;
      acc[k].count++;
      acc[k].amount += Number(o.total_amount || 0);
      acc[k].orders.push(o);
    }
    return acc;
  }, [orders]);

  const list = selected ? grouped[selected].orders : [];
  const selectedMeta = selected ? METHODS.find((m) => m.key === selected) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelected(null); }}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            {selected ? (
              <>
                <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5" /> رجوع
                </button>
                <span>{selectedMeta?.label}</span>
                <Badge variant="secondary" className="ms-auto">{list.length} عميل</Badge>
              </>
            ) : (
              <>
                مدفوعات الفواتير
                <Badge variant="secondary" className="ms-auto">{orders.length} إجمالي</Badge>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {METHODS.map(({ key, label, Icon, color }) => {
              const g = grouped[key];
              const c = colorMap[color];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelected(key);
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-md py-3 px-3 text-sm font-medium cursor-pointer ${c.btn} ${g.count === 0 ? 'opacity-60' : ''}`}
                >
                  <span className="flex items-center gap-2 pointer-events-none">
                    <Icon className="w-4 h-4" />
                    <span className="font-bold">{label}</span>
                  </span>
                  <span className="flex items-center gap-2 pointer-events-none">
                    <span className="text-xs opacity-90">{g.count} عملية</span>
                    <span className="text-sm font-bold">{fmt(g.amount)} DA</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </button>
              );
            })}
          </div>
        ) : isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-6">جارٍ التحميل...</p>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">لا توجد عمليات</p>
        ) : (
          <div className="space-y-2 mt-2">
            <div className={`rounded-lg p-3 text-center border ${selectedMeta ? colorMap[selectedMeta.color].chip : ''}`}>
              <p className="text-[11px] text-muted-foreground">الإجمالي</p>
              <p className="text-lg font-bold">{fmt(grouped[selected!].amount)} DA</p>
            </div>
            {list.map((o: any) => (
              <div key={o.id} className="rounded-lg border p-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {o.customer?.store_name || o.customer?.name || '—'}
                    </p>
                    {o.customer?.store_name && o.customer?.name && (
                      <p className="text-[11px] text-muted-foreground ms-5">{o.customer.name}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="font-bold">
                    {fmt(Number(o.total_amount || 0))} DA
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SessionInvoiceMethodsDialog;
