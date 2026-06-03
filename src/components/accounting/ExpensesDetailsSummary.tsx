import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Receipt, Image } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import ReceiptViewerDialog from '@/components/expenses/ReceiptViewerDialog';
import { getEffectiveAccountingSessionEnd } from '@/utils/accountingSessionTime';

interface Props {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  completedAt?: string | null;
}

const fmt = (n: number) => Number(n || 0).toLocaleString();

const ExpensesDetailsSummary: React.FC<Props> = ({ workerId, periodStart, periodEnd, completedAt }) => {
  const { t } = useLanguage();
  const [viewerUrls, setViewerUrls] = useState<string[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    approved: { label: t('expenses_summary.status_approved'), cls: 'bg-green-100 text-green-700' },
    pending: { label: t('expenses_summary.status_pending'), cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: t('expenses_summary.status_rejected'), cls: 'bg-red-100 text-red-700' },
  };

  const { data, isLoading } = useQuery({
    queryKey: ['session-expenses', workerId, periodStart, periodEnd, completedAt],
    queryFn: async () => {
      const toTz = (v: string, isEnd: boolean) => {
        if (v.includes('+') || v.includes('Z')) return v;
        if (v.includes('T')) return v + ':00+01:00';
        return isEnd ? v + 'T23:59:59+01:00' : v + 'T00:00:00+01:00';
      };
      const effectivePeriodEnd = getEffectiveAccountingSessionEnd(periodEnd, completedAt);
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, description, expense_date, created_at, payment_method, status, receipt_url, receipt_urls, category:expense_categories(name, name_fr, icon)')
        .eq('worker_id', workerId)
        .gt('created_at', toTz(periodStart, false))
        .lte('created_at', toTz(effectivePeriodEnd, true))
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

  if (!data || data.length === 0) {
    return (
      <div data-empty="true" className="text-center py-4 text-muted-foreground text-xs">
        <Receipt className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
        {t('expenses_summary.no_expenses')}
      </div>
    );
  }

  const total = data.reduce((s, e) => s + Number(e.amount || 0), 0);
  const counted = data.filter(e => e.status !== 'rejected').reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">{t('expenses_summary.count')}</p>
          <p className="font-bold text-sm">{data.length}</p>
        </div>
        <div className="bg-primary/10 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">{t('expenses_summary.counted_in_session')}</p>
          <p className="font-bold text-sm text-primary">{fmt(counted)} DA</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.map((e: any) => {
          const receipts: string[] = e.receipt_urls?.length ? e.receipt_urls : (e.receipt_url ? [e.receipt_url] : []);
          const hasReceipt = receipts.length > 0;
          return (
            <div
              key={e.id}
              onClick={() => { if (hasReceipt) { setViewerUrls(receipts); setViewerOpen(true); } }}
              className={`border rounded-lg p-2.5 bg-card flex items-center justify-between gap-2 ${hasReceipt ? 'cursor-pointer hover:bg-muted/40' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-semibold truncate">
                  {e.category?.name_fr || e.category?.name || t('expenses_summary.fallback_label')}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(e.expense_date), 'dd/MM/yyyy')}
                </span>
                {hasReceipt && <Image className="w-3.5 h-3.5 text-primary shrink-0" />}
              </div>
              <span className="font-bold text-sm text-destructive shrink-0">-{fmt(Number(e.amount))} DA</span>
            </div>
          );
        })}
      </div>


      <div className="flex items-center justify-between border-t pt-2 mt-2 text-xs">
        <span className="text-muted-foreground">{t('expenses_summary.total_all_statuses')}</span>
        <span className="font-bold">{fmt(total)} DA</span>
      </div>

      <ReceiptViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        receiptUrls={viewerUrls}
      />
    </div>
  );
};

export default ExpensesDetailsSummary;
