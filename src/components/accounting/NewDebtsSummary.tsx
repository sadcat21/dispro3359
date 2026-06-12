import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { getEffectiveAccountingSessionEnd } from '@/utils/accountingSessionTime';

interface Props {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  completedAt?: string | null;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR');

const toTz = (v: string, isEnd: boolean) => {
  if (v.includes('+') || v.includes('Z')) return v;
  if (v.includes('T')) return v + ':00+01:00';
  return isEnd ? v + 'T23:59:59+01:00' : v + 'T00:00:00+01:00';
};

const NewDebtsSummary: React.FC<Props> = ({ workerId, periodStart, periodEnd, completedAt }) => {
  const effectiveEnd = getEffectiveAccountingSessionEnd(periodEnd, completedAt);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['session-new-debts-detail', workerId, periodStart, effectiveEnd],
    queryFn: async () => {
      const startTz = toTz(periodStart, false);
      const endTz = toTz(effectiveEnd, true);

      const { data, error } = await supabase
        .from('customer_debts')
        .select('id, total_amount, paid_amount, remaining_amount, created_at, notes, customer:customers(name, store_name)')
        .eq('worker_id', workerId)
        .gte('created_at', startTz)
        .lte('created_at', endTz)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-3">لا توجد ديون جديدة في هذه الفترة</p>;
  }

  const total = rows.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="space-y-2">
      {rows.map((r: any) => (
        <div key={r.id} className="border rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {r.customer?.store_name || r.customer?.name || 'عميل غير معروف'}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {new Date(r.created_at).toLocaleDateString('fr-FR')}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
            <div className="bg-rose-50 dark:bg-rose-900/20 rounded p-1.5">
              <p className="text-muted-foreground mb-0.5">إجمالي الدين</p>
              <p className="font-bold text-xs text-rose-700">{fmt(r.total_amount)}</p>
            </div>
            <div className="bg-muted/50 rounded p-1.5">
              <p className="text-muted-foreground mb-0.5">مدفوع</p>
              <p className="font-bold text-xs">{fmt(r.paid_amount)}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-1.5">
              <p className="text-muted-foreground mb-0.5">متبقي</p>
              <p className="font-bold text-xs text-amber-700">{fmt(r.remaining_amount)}</p>
            </div>
          </div>
          {r.notes && <p className="text-[10px] text-muted-foreground">{r.notes}</p>}
        </div>
      ))}
      <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-2.5 flex justify-between items-center">
        <span className="text-sm font-bold">الإجمالي</span>
        <span className="font-bold text-rose-700">{fmt(total)} DA</span>
      </div>
    </div>
  );
};

export default NewDebtsSummary;
