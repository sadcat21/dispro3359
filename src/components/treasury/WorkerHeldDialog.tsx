import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatAmount } from '@/utils/amountFormatting';

const MoneyValue = ({ value, currency, className = '' }: { value: number; currency: string; className?: string }) => (
  <span className={className}>{formatAmount(value)} {currency}</span>
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range?: { from?: string; to?: string };
  currency?: string;
}

const WorkerHeldDialog: React.FC<Props> = ({ open, onOpenChange, range, currency = 'DA' }) => {
  const { activeBranch } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['worker-held-breakdown', activeBranch?.id, range?.from, range?.to],
    enabled: open,
    queryFn: async () => {
      let oQuery = supabase
        .from('orders')
        .select('id, payment_type, invoice_payment_method, payment_status, total_amount, partial_amount, assigned_worker_id, delivery_date, created_at')
        .eq('status', 'delivered');
      if (activeBranch?.id) oQuery = oQuery.eq('branch_id', activeBranch.id);
      if (range?.from) oQuery = oQuery.gte('delivery_date', range.from);
      if (range?.to) oQuery = oQuery.lte('delivery_date', range.to);
      const { data: orders } = await oQuery;

      let sQuery = supabase
        .from('accounting_sessions')
        .select('worker_id, period_start, period_end')
        .eq('status', 'completed');
      if (activeBranch?.id) sQuery = sQuery.eq('branch_id', activeBranch.id);
      const { data: sessions } = await sQuery;

      const windows = (sessions || []).map((s: any) => ({
        worker_id: s.worker_id,
        start: new Date(s.period_start).getTime(),
        end: new Date(s.period_end).getTime(),
      }));

      const byWorker = new Map<string, { cash: number; document: number; total: number }>();
      (orders || []).forEach((o: any) => {
        if (!o.assigned_worker_id) return;
        let paid = Number(o.total_amount || 0);
        if (o.payment_status === 'partial') paid = Number(o.partial_amount || 0);
        else if (o.payment_status === 'debt') paid = 0;
        if (paid <= 0) return;
        const t = new Date(o.delivery_date || o.created_at).getTime();
        const covered = windows.some(w => w.worker_id === o.assigned_worker_id && t >= w.start && t <= w.end);
        if (covered) return;
        const method = String(o.invoice_payment_method || '').toLowerCase();
        const isCash = o.payment_type === 'without_invoice' || method === 'cash' || method === '';
        const cur = byWorker.get(o.assigned_worker_id) || { cash: 0, document: 0, total: 0 };
        if (isCash) cur.cash += paid; else cur.document += paid;
        cur.total += paid;
        byWorker.set(o.assigned_worker_id, cur);
      });

      const workerIds = Array.from(byWorker.keys());
      if (workerIds.length === 0) return [];
      const { data: workers } = await supabase.from('workers').select('id, full_name').in('id', workerIds);
      const nameMap = new Map((workers || []).map((w: any) => [w.id, w.full_name]));

      return workerIds.map(id => ({
        worker_id: id,
        name: nameMap.get(id) || '—',
        ...byWorker.get(id)!,
      })).sort((a, b) => b.total - a.total);
    },
  });

  const totalAll = rows.reduce((s, r) => s + r.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>👷 ما بحوزة كل عامل (لم يُسلَّم بعد)</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">الإجمالي</p>
          <MoneyValue value={totalAll} currency={currency} className="text-lg font-bold text-amber-600" />
        </div>
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد بيانات</p>
          ) : rows.map(r => (
            <Card key={r.worker_id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">{r.name}</p>
                  <MoneyValue value={r.total} currency={currency} className="text-sm font-bold text-amber-600" />
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <p>💵 نقداً: <span className="font-semibold">{r.cash.toLocaleString()} {currency}</span></p>
                  <p>🧾 مستند: <span className="font-semibold">{r.document.toLocaleString()} {currency}</span></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerHeldDialog;
