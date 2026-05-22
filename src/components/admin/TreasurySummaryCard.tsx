import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTreasurySummary } from '@/hooks/useManagerTreasury';
import { Wallet, Loader2, X, UserCog } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const fmt = (n: number) => Math.round(n).toLocaleString();
const DISMISS_KEY = 'treasury-summary-card-dismissed';

interface Props {
  periodStart?: string;
  periodLabel?: string;
}

interface ManagerRow {
  manager_id: string;
  name: string;
  total: number;
  handed: number;
  remaining: number;
}

const TreasurySummaryCard: React.FC<Props> = ({ periodStart, periodLabel }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { activeBranch } = useAuth();
  const branchId = activeBranch?.id || null;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (dismissed) localStorage.setItem(DISMISS_KEY, '1');
      else localStorage.removeItem(DISMISS_KEY);
    } catch {}
  }, [dismissed]);

  const range = periodStart ? { from: periodStart.slice(0, 10) } : undefined;
  const { data: aggregate, isLoading: aggLoading } = useTreasurySummary(range);

  const { data: perManager, isLoading: pmLoading } = useQuery({
    queryKey: ['treasury-summary-card-managers', branchId],
    enabled: open && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_branch_manager_treasury_balances', {
        p_branch_id: branchId,
      });
      if (error) {
        console.warn('get_branch_manager_treasury_balances error', error);
        return [] as ManagerRow[];
      }
      const rows: ManagerRow[] = (data || []).map((r: any) => ({
        manager_id: r.manager_id,
        name: r.full_name || '',
        total: Number(r.total_in || 0),
        handed: Number(r.handed_over || 0),
        remaining: Number(r.remaining || 0),
      }));
      return rows;
    },
  });

  if (dismissed) return null;

  const rows = perManager || [];

  const aggTotal = aggregate?.total || 0;
  const aggHanded = aggregate?.handedOver || 0;
  const aggRemaining = aggregate?.remaining || 0;

  return (
    <div className="relative rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 shadow-sm dark:border-emerald-900 dark:from-emerald-950/30 dark:via-background dark:to-sky-950/20">
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
            {periodLabel ? `${periodLabel} · ` : ''}{t('admin_home.treasury_summary')}
          </h3>
        </div>
        {aggLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-xl border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-2 hover:shadow-md transition"
      >
        <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
          {t('admin_home.treasury_branch_total') || 'إجمالي الفرع'}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">{t('admin_home.treasury_total')}</div>
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">{fmt(aggTotal)} DA</p>
          </div>
          <div>
            <div className="text-[9px] text-sky-700 dark:text-sky-400 font-semibold">{t('admin_home.treasury_handed')}</div>
            <p className="text-xs font-bold text-sky-900 dark:text-sky-200">{fmt(aggHanded)} DA</p>
          </div>
          <div>
            <div className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">{t('admin_home.treasury_remaining')}</div>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{fmt(aggRemaining)} DA</p>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {t('admin_home.treasury_summary')}
            </DialogTitle>
          </DialogHeader>
          {pmLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">—</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.manager_id}
                  onClick={() => { setOpen(false); navigate('/manager-treasury'); }}
                  className="cursor-pointer rounded-xl border border-emerald-200/60 bg-white/70 dark:bg-background/40 dark:border-emerald-900/60 p-2 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <UserCog className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">
                      {r.name || r.manager_id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded-lg bg-emerald-100/70 dark:bg-emerald-950/40 px-2 py-1">
                      <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        {t('admin_home.treasury_total')}
                      </div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">{fmt(r.total)} DA</p>
                    </div>
                    <div className="rounded-lg bg-sky-100/70 dark:bg-sky-950/40 px-2 py-1">
                      <div className="text-[9px] text-sky-700 dark:text-sky-400 font-semibold">
                        {t('admin_home.treasury_handed')}
                      </div>
                      <p className="text-xs font-bold text-sky-900 dark:text-sky-200">{fmt(r.handed)} DA</p>
                    </div>
                    <div className="rounded-lg bg-amber-100/70 dark:bg-amber-950/40 px-2 py-1">
                      <div className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">
                        {t('admin_home.treasury_remaining')}
                      </div>
                      <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{fmt(r.remaining)} DA</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TreasurySummaryCard;
