import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ArrowUpRight, FileText, Calendar, Hash, Store } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  method: 'check' | 'transfer';
  sessions: any[];
}

const fmt = (n: number) => Number(n || 0).toLocaleString();
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy', { locale: ar }); } catch { return '—'; }
};

const SessionChecksTransfersDialog: React.FC<Props> = ({ open, onOpenChange, method, sessions }) => {
  const windows = React.useMemo(() => {
    return (sessions || [])
      .map((s: any) => ({
        worker_id: s.worker?.id ?? s.worker_id,
        start: s.period_start ? new Date(s.period_start).getTime() : 0,
        end: s.period_end ? new Date(s.period_end).getTime() : Date.now(),
      }))
      .filter((w) => !!w.worker_id);
  }, [sessions]);

  const workerIds = React.useMemo(
    () => Array.from(new Set(windows.map((w) => w.worker_id))),
    [windows],
  );

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['session-checks-transfers', method, workerIds, windows.map((w) => `${w.start}-${w.end}`)],
    enabled: open && workerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, total_amount, created_at, check_due_date, doc_due_date,
          invoice_number, invoice_received_at, assigned_worker_id,
          invoice_payment_method, status, payment_type,
          customer:customers(name, store_name)
        `)
        .eq('status', 'delivered')
        .eq('payment_type', 'with_invoice')
        .eq('invoice_payment_method', method)
        .in('assigned_worker_id', workerIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((o: any) => {
        const t = new Date(o.created_at).getTime();
        return windows.some((w) => w.worker_id === o.assigned_worker_id && t >= w.start && t <= w.end);
      });
    },
  });

  const total = orders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
  const Icon = method === 'check' ? CreditCard : ArrowUpRight;
  const label = method === 'check' ? 'Chèques' : 'Virements';
  const dueLabel = method === 'check' ? 'تاريخ سحب الشيك' : 'تاريخ التحويل';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${method === 'check' ? 'text-blue-600' : 'text-cyan-600'}`} />
            {label}
            <Badge variant="secondary" className="ms-auto">{orders.length} عملية</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className={`rounded-lg p-3 text-center border ${method === 'check' ? 'bg-blue-50 border-blue-200' : 'bg-cyan-50 border-cyan-200'}`}>
          <p className="text-[11px] text-muted-foreground">الإجمالي</p>
          <p className={`text-lg font-bold ${method === 'check' ? 'text-blue-700' : 'text-cyan-700'}`}>
            {fmt(total)} د.ج
          </p>
        </div>

        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-6">جارٍ التحميل...</p>
        ) : orders.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">لا توجد عمليات</p>
        ) : (
          <div className="space-y-2 mt-2">
            {orders.map((o: any) => {
              const dueDate = method === 'check' ? o.check_due_date : o.doc_due_date;
              return (
                <div key={o.id} className="rounded-lg border bg-white p-3 space-y-1.5">
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
                    <Badge variant="outline" className={`shrink-0 ${method === 'check' ? 'text-blue-700 border-blue-200 bg-blue-50' : 'text-cyan-700 border-cyan-200 bg-cyan-50'}`}>
                      {fmt(Number(o.total_amount || 0))} د.ج
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-slate-600 pt-1 border-t">
                    {/* Row 1: Check — number | date */}
                    <div className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-slate-400" />
                      <span className="text-muted-foreground">رقم الشيك:</span>
                      <span className="font-medium">{(o as any).check_number || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span className="text-muted-foreground">{dueLabel}:</span>
                      <span className="font-medium">{fmtDate(dueDate)}</span>
                    </div>
                    {/* Row 2: Invoice — number | date */}
                    <div className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-slate-400" />
                      <span className="text-muted-foreground">رقم الفاتورة:</span>
                      <span className="font-medium">{o.invoice_number || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-400" />
                      <span className="text-muted-foreground">تاريخ الفاتورة:</span>
                      <span className="font-medium">{fmtDate(o.invoice_received_at || o.created_at)}</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SessionChecksTransfersDialog;
