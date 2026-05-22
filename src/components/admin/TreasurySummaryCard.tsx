import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTreasurySummary } from '@/hooks/useManagerTreasury';
import { Wallet, Banknote, ArrowDownToLine, TrendingUp, Loader2, X } from 'lucide-react';

const fmt = (n: number) => Math.round(n).toLocaleString();
const DISMISS_KEY = 'treasury-summary-card-dismissed';

interface Props {
  periodStart?: string;
  periodLabel?: string;
}

const TreasurySummaryCard: React.FC<Props> = ({ periodStart, periodLabel }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try {
      if (dismissed) localStorage.setItem(DISMISS_KEY, '1');
      else localStorage.removeItem(DISMISS_KEY);
    } catch {}
  }, [dismissed]);

  const range = periodStart ? { from: periodStart.slice(0, 10) } : undefined;
  const { data, isLoading } = useTreasurySummary(range);

  if (dismissed) return null;

  const total = data?.total || 0;
  const handedOver = data?.handedOver || 0;
  const remaining = data?.remaining || 0;
  const totalSales = data?.totalSales || 0;

  return (
    <div
      onClick={() => navigate('/manager-treasury')}
      className="relative cursor-pointer rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 shadow-sm transition hover:shadow-md dark:border-emerald-900 dark:from-emerald-950/30 dark:via-background dark:to-sky-950/20"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
        aria-label={t('common.dismiss') || 'إغلاق'}
        className="absolute top-2 end-2 rounded-full p-1 text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900 dark:hover:bg-emerald-950/60 transition"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center justify-between mb-3 pe-6">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Wallet className="h-5 w-5" />
          <h3 className="text-sm font-bold">
            {periodLabel ? `${periodLabel} · ` : ''}{t('admin_home.treasury_summary') || 'ملخص خزينة الفرع'}
          </h3>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-xl bg-emerald-100/70 dark:bg-emerald-950/40 p-3 border border-emerald-200/60 dark:border-emerald-900/60">
          <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
            <Wallet className="h-3 w-3" />
            {t('admin_home.treasury_total') || 'الإجمالي'}
          </div>
          <p className="mt-1 text-base font-bold text-emerald-900 dark:text-emerald-200">{fmt(total)} DA</p>
        </div>

        <div className="rounded-xl bg-sky-100/70 dark:bg-sky-950/40 p-3 border border-sky-200/60 dark:border-sky-900/60">
          <div className="flex items-center gap-1 text-[10px] text-sky-700 dark:text-sky-400 font-semibold">
            <ArrowDownToLine className="h-3 w-3" />
            {t('admin_home.treasury_handed') || 'المُسلَّم'}
          </div>
          <p className="mt-1 text-base font-bold text-sky-900 dark:text-sky-200">{fmt(handedOver)} DA</p>
        </div>

        <div className="rounded-xl bg-amber-100/70 dark:bg-amber-950/40 p-3 border border-amber-200/60 dark:border-amber-900/60">
          <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
            <Banknote className="h-3 w-3" />
            {t('admin_home.treasury_remaining') || 'المتبقي'}
          </div>
          <p className="mt-1 text-base font-bold text-amber-900 dark:text-amber-200">{fmt(remaining)} DA</p>
        </div>

        <div className="rounded-xl bg-violet-100/70 dark:bg-violet-950/40 p-3 border border-violet-200/60 dark:border-violet-900/60">
          <div className="flex items-center gap-1 text-[10px] text-violet-700 dark:text-violet-400 font-semibold">
            <TrendingUp className="h-3 w-3" />
            {periodLabel ? `${periodLabel} · ` : ''}{t('admin_home.treasury_sales') || 'المبيعات'}
          </div>
          <p className="mt-1 text-base font-bold text-violet-900 dark:text-violet-200">{fmt(totalSales)} DA</p>
        </div>
      </div>
    </div>
  );
};

export default TreasurySummaryCard;
