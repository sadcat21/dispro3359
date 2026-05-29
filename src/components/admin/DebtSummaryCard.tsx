import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Banknote, HandCoins, CalendarDays, TrendingUp, Loader2, X } from 'lucide-react';

const fmt = (n: number) => Math.round(n).toLocaleString();
const DISMISS_KEY = 'debt-summary-card-dismissed';

interface DebtSummaryCardProps {
  periodStart?: string;
  periodLabel?: string;
}

const DebtSummaryCard: React.FC<DebtSummaryCardProps> = ({ periodStart, periodLabel }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { activeBranch } = useAuth();
  const branchId = activeBranch?.id || null;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try {
      if (dismissed) localStorage.setItem(DISMISS_KEY, '1');
      else localStorage.removeItem(DISMISS_KEY);
    } catch {}
  }, [dismissed]);

  useRealtimeSubscription(
    `debt-summary-card-${branchId || 'all'}`,
    [
      { table: 'customer_debts' },
      { table: 'debt_payments' },
      { table: 'debt_collections' },
    ],
    [['debt-summary-card', branchId || undefined, periodStart || undefined]],
    true,
  );

  const { data, isLoading } = useQuery({
    queryKey: ['debt-summary-card', branchId, periodStart],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const periodISO = periodStart || startOfDay.toISOString();

      // Active debts (principal remaining) — match Debt Management page (all branches, all statuses)
      const { data: debts } = await supabase
        .from('customer_debts')
        .select('remaining_amount, total_amount, created_at, branch_id, status');

      const principal = (debts || [])
        .reduce((s, d: any) => s + Number(d.remaining_amount || 0), 0);


      const todayNewDebts = (debts || []).filter((d: any) => d.created_at >= periodISO);
      const newDebtsCount = todayNewDebts.length;
      const newDebtsAmount = todayNewDebts.reduce(
        (s, d: any) => s + Number(d.total_amount || 0),
        0,
      );

      // Collections (debt_payments)
      let paymentsQ = supabase
        .from('debt_payments')
        .select('amount, collected_at, debt_id, customer_debts!inner(branch_id)');
      if (branchId) paymentsQ = paymentsQ.eq('customer_debts.branch_id', branchId);
      const { data: payments } = await paymentsQ;

      const totalCollections = (payments || []).reduce(
        (s, p: any) => s + Number(p.amount || 0),
        0,
      );
      const todayCollections = (payments || [])
        .filter((p: any) => p.collected_at >= periodISO)
        .reduce((s, p: any) => s + Number(p.amount || 0), 0);

      return {
        principal,
        totalCollections,
        todayCollections,
        newDebtsCount,
        newDebtsAmount,
      };
    },
  });

  if (dismissed) return null;

  return (
    <div
      onClick={() => navigate('/customer-debts')}
      className="relative cursor-pointer rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 shadow-sm transition hover:shadow-md dark:border-rose-900 dark:from-rose-950/30 dark:via-background dark:to-amber-950/20"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
        aria-label={t('common.dismiss') || 'إغلاق'}
        className="absolute top-2 end-2 rounded-full p-1 text-rose-600/70 hover:bg-rose-100 hover:text-rose-800 dark:hover:bg-rose-950/60 transition"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center justify-between mb-3 pe-6">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
          <Banknote className="h-5 w-5" />
          <h3 className="text-sm font-bold">{t('admin_home.debt_summary')}</h3>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-rose-100/70 dark:bg-rose-950/40 p-3 border border-rose-200/60 dark:border-rose-900/60">
          <div className="flex items-center gap-1 text-[10px] text-rose-700 dark:text-rose-400 font-semibold">
            <Banknote className="h-3 w-3" />
            {t('admin_home.principal_debt')}
          </div>
          <p className="mt-1 text-base font-bold text-rose-900 dark:text-rose-200">
            {fmt(data?.principal || 0)} DA
          </p>
        </div>


        <div className="rounded-xl bg-teal-100/70 dark:bg-teal-950/40 p-3 border border-teal-200/60 dark:border-teal-900/60">
          <div className="flex items-center gap-1 text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
            <CalendarDays className="h-3 w-3" />
            {periodLabel ? `${periodLabel} · ` : ''}{t('admin_home.today_collections')}
          </div>
          <p className="mt-1 text-base font-bold text-teal-900 dark:text-teal-200">
            {fmt(data?.todayCollections || 0)} DA
          </p>
        </div>

        <div className="rounded-xl bg-amber-100/70 dark:bg-amber-950/40 p-3 border border-amber-200/60 dark:border-amber-900/60">
          <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
            <TrendingUp className="h-3 w-3" />
            {periodLabel ? `${periodLabel} · ` : ''}{t('admin_home.new_debts_today')}
          </div>
          <p className="mt-1 text-base font-bold text-amber-900 dark:text-amber-200">
            {fmt(data?.newDebtsAmount || 0)} DA
          </p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            {data?.newDebtsCount || 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DebtSummaryCard;
