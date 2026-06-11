import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getEffectiveAccountingSessionEnd } from '@/utils/accountingSessionTime';

interface DebtCollectionsSummaryProps {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  completedAt?: string | null;
}

interface CollectedDebtRow {
  customerName: string;
  totalDebt: number;
  paidBefore: number;
  collectedNow: number;
  remainingAfter: number;
  paymentMethod: string;
}

const fmt = (n: number) => n.toLocaleString();

// Extract just the date part (YYYY-MM-DD) from any timestamp format
const extractDate = (v: string): string => {
  // Handle ISO format with T or space separator
  const cleaned = v.replace('T', ' ');
  return cleaned.substring(0, 10);
};

const DebtCollectionsSummary: React.FC<DebtCollectionsSummaryProps> = ({ workerId, periodStart, periodEnd, completedAt }) => {
  const { t } = useLanguage();
  const effectiveEnd = getEffectiveAccountingSessionEnd(periodEnd, completedAt);
  const { data: rows, isLoading } = useQuery({
    queryKey: ['session-debt-collections-detail', workerId, periodStart, effectiveEnd],
    queryFn: async () => {
      const startDate = extractDate(periodStart);
      const endDate = extractDate(effectiveEnd);

      // Use exact period timestamps for debt_payments (timestamp column)
      const toTz = (v: string, isEnd: boolean) => {
        if (v.includes('+') || v.includes('Z')) return v;
        if (v.includes('T')) return v + ':00+01:00';
        return isEnd ? v + 'T23:59:59+01:00' : v + 'T00:00:00+01:00';
      };
      const startTz = toTz(periodStart, false);
      const endTz = toTz(effectiveEnd, true);

      const { data: payments, error } = await supabase
        .from('debt_payments')
        .select('amount, payment_method, debt_id')
        .eq('worker_id', workerId)
        .gte('collected_at', startTz)
        .lte('collected_at', endTz);

      // Also query debt_collections by collection_date (DATE type)
      // Use exact dates but filter with period timestamps where possible
      const { data: collections } = await supabase
        .from('debt_collections')
        .select('amount_collected, payment_method, debt_id, action, collection_date, created_at')
        .eq('worker_id', workerId)
        .gte('collection_date', startDate)
        .lte('collection_date', endDate)
        .gte('created_at', startTz)
        .lte('created_at', endTz)
        .in('action', ['partial_payment', 'full_payment']);

      if (error) throw error;

      // Merge both sources, grouping by debt_id, tracking cash vs document amounts
      const debtMap: Record<string, { collected: number; cash: number; doc: number; methods: Set<string> }> = {};
      const isCashMethod = (m: string | null | undefined) => !m || m === 'cash';

      // Add from debt_payments
      for (const p of (payments || [])) {
        if (!debtMap[p.debt_id]) debtMap[p.debt_id] = { collected: 0, cash: 0, doc: 0, methods: new Set() };
        const amt = Number(p.amount || 0);
        debtMap[p.debt_id].collected += amt;
        if (isCashMethod(p.payment_method)) debtMap[p.debt_id].cash += amt;
        else debtMap[p.debt_id].doc += amt;
        debtMap[p.debt_id].methods.add(p.payment_method || 'cash');
      }

      // Add from debt_collections (only if not already covered by debt_payments)
      for (const c of (collections || [])) {
        if (!debtMap[c.debt_id]) {
          const amt = Number(c.amount_collected || 0);
          debtMap[c.debt_id] = { collected: amt, cash: 0, doc: 0, methods: new Set() };
          if (isCashMethod(c.payment_method)) debtMap[c.debt_id].cash += amt;
          else debtMap[c.debt_id].doc += amt;
          if (c.payment_method) debtMap[c.debt_id].methods.add(c.payment_method);
        }
      }

      const debtIds = Object.keys(debtMap);
      if (debtIds.length === 0) return [];

      // Fetch debt details with customer info
      const { data: debts, error: dErr } = await supabase
        .from('customer_debts')
        .select('id, total_amount, paid_amount, remaining_amount, customer:customers(name)')
        .in('id', debtIds);

      if (dErr) throw dErr;

      const result: (CollectedDebtRow & { cashAmount: number; docAmount: number })[] = (debts || []).map((d: any) => {
        const info = debtMap[d.id];
        const totalDebt = Number(d.total_amount || 0);
        const currentPaid = Number(d.paid_amount || 0);
        const collectedNow = info?.collected || 0;
        const paidBefore = currentPaid - collectedNow;
        const remainingAfter = Number(d.remaining_amount ?? (totalDebt - currentPaid));

        return {
          customerName: d.customer?.name || t('debt_collections.unknown_customer'),
          totalDebt,
          paidBefore: Math.max(0, paidBefore),
          collectedNow,
          remainingAfter: Math.max(0, remainingAfter),
          paymentMethod: info ? Array.from(info.methods).join(', ') : 'cash',
          cashAmount: info?.cash || 0,
          docAmount: info?.doc || 0,
        };
      });

      return result.sort((a, b) => b.collectedNow - a.collectedNow);
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!rows || rows.length === 0) return <p data-empty="true" className="text-xs text-muted-foreground text-center py-3">{t('debt_collections.no_collections')}</p>;

  const totalCollected = rows.reduce((s, r) => s + r.collectedNow, 0);
  const totalCash = rows.reduce((s, r: any) => s + (r.cashAmount || 0), 0);
  const totalDoc = rows.reduce((s, r: any) => s + (r.docAmount || 0), 0);

  const methodLabel = (m: string) => {
    const map: Record<string, string> = {
      cash: t('debt_collections.method_cash'),
      check: t('debt_collections.method_check'),
      transfer: t('debt_collections.method_transfer'),
      receipt: t('debt_collections.method_receipt'),
    };
    return m.split(', ').map(x => map[x] || x).join(', ');
  };

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="border rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{row.customerName}</span>
            <Badge variant="outline" className="text-[10px]">{methodLabel(row.paymentMethod)}</Badge>
          </div>
          <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
            <div className="bg-muted/50 rounded p-1.5">
              <p className="text-muted-foreground mb-0.5">{t('debt_collections.original_debt')}</p>
              <p className="font-bold text-xs">{fmt(row.totalDebt)}</p>
            </div>
            <div className="bg-muted/50 rounded p-1.5">
              <p className="text-muted-foreground mb-0.5">{t('debt_collections.paid_before')}</p>
              <p className="font-bold text-xs">{fmt(row.paidBefore)}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded p-1.5">
              <p className="text-muted-foreground mb-0.5">{t('debt_collections.collected')}</p>
              <p className="font-bold text-xs text-green-600">{fmt(row.collectedNow)}</p>
            </div>
            <div className={`rounded p-1.5 ${row.remainingAfter > 0 ? 'bg-destructive/10' : 'bg-green-50 dark:bg-green-900/20'}`}>
              <p className="text-muted-foreground mb-0.5">{t('debt_collections.remaining')}</p>
              <p className={`font-bold text-xs ${row.remainingAfter > 0 ? 'text-destructive' : 'text-green-600'}`}>{fmt(row.remainingAfter)}</p>
            </div>
          </div>
        </div>
      ))}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-1.5">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-green-50 dark:bg-green-900/20 rounded p-2 flex justify-between items-center">
            <span className="font-semibold text-green-700 dark:text-green-400">نقدي</span>
            <span className="font-bold text-green-600">{fmt(totalCash)} DA</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 flex justify-between items-center">
            <span className="font-semibold text-blue-700 dark:text-blue-400">وثائق</span>
            <span className="font-bold text-blue-600">{fmt(totalDoc)} DA</span>
          </div>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-primary/20">
          <span className="text-sm font-bold">{t('debt_collections.total')}</span>
          <span className="font-bold text-primary">{fmt(totalCollected)} DA</span>
        </div>
      </div>
    </div>
  );
};

export default DebtCollectionsSummary;
