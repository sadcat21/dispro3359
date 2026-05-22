import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Receipt, Image } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import ReceiptViewerDialog from '@/components/expenses/ReceiptViewerDialog';

interface Props {
  workerId: string;
  periodStart: string;
  periodEnd: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString();

const ExpensesDetailsSummary: React.FC<Props> = ({ workerId, periodStart, periodEnd }) => {
  const { t } = useLanguage();
  const [viewerUrls, setViewerUrls] = useState<string[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    approved: { label: t('expenses_summary.status_approved'), cls: 'bg-green-100 text-green-700' },
    pending: { label: t('expenses_summary.status_pending'), cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: t('expenses_summary.status_rejected'), cls: 'bg-red-100 text-red-700' },
  };

  const { data, isLoading } = useQuery({
    queryKey: ['session-expenses', workerId, periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, description, expense_date, payment_method, status, receipt_url, receipt_urls, category:expense_categories(name, name_fr, icon)')
        .eq('worker_id', workerId)
        .gte('expense_date', periodStart)
        .lte('expense_date', periodEnd)
        .order('expense_date', { ascending: false });
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
      <div className="text-center py-4 text-muted-foreground text-xs">
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
          const status = STATUS_LABEL[e.status] || STATUS_LABEL.pending;
          const receipts: string[] = e.receipt_urls?.length ? e.receipt_urls : (e.receipt_url ? [e.receipt_url] : []);
          return (
            <div key={e.id} className="border rounded-lg p-2.5 space-y-1.5 bg-card">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base shrink-0">{e.category?.icon || '🧾'}</span>
                  <span className="text-xs font-semibold truncate">
                    {e.category?.name_fr || e.category?.name || t('expenses_summary.fallback_label')}
                  </span>
                </div>
                <span className="font-bold text-sm text-destructive shrink-0">-{fmt(Number(e.amount))} DA</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{format(new Date(e.expense_date), 'dd/MM/yyyy')}</span>
                <span className={`px-1.5 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
              </div>
              {e.description && (
                <p className="text-[11px] text-foreground/80 bg-muted/40 rounded p-1.5">{e.description}</p>
              )}
              {receipts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {receipts.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setViewerUrls(receipts); setViewerOpen(true); }}
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <Image className="w-3 h-3" />
                      {t('expenses_summary.receipt')} {receipts.length > 1 ? i + 1 : ''}
                    </button>
                  ))}
                </div>
              )}
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
