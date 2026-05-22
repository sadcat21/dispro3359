import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTreasurySummary } from '@/hooks/useManagerTreasury';
import { Wallet, Loader2, X, UserCog } from 'lucide-react';

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
  useEffect(() => {
    try {
      if (dismissed) localStorage.setItem(DISMISS_KEY, '1');
      else localStorage.removeItem(DISMISS_KEY);
    } catch {}
  }, [dismissed]);

  const range = periodStart ? { from: periodStart.slice(0, 10) } : undefined;
  const { data: aggregate, isLoading: aggLoading } = useTreasurySummary(range);

  const { data: perManager, isLoading: pmLoading } = useQuery({
    queryKey: ['treasury-summary-card-managers', branchId, periodStart],
    queryFn: async () => {
      let mtQ = supabase.from('manager_treasury').select('manager_id, amount, created_at');
      if (branchId) mtQ = mtQ.eq('branch_id', branchId);
      if (periodStart) mtQ = mtQ.gte('created_at', periodStart);
      const { data: mt, error: mtErr } = await mtQ;
      if (mtErr) console.warn('manager_treasury fetch error', mtErr);

      let mhQ = supabase.from('manager_handovers').select('manager_id, amount, handover_date');
      if (branchId) mhQ = mhQ.eq('branch_id', branchId);
      if (periodStart) mhQ = mhQ.gte('handover_date', periodStart.slice(0, 10));
      const { data: mh, error: mhErr } = await mhQ;
      if (mhErr) console.warn('manager_handovers fetch error', mhErr);

      // Fetch all branch managers (so they appear with 0 even without activity)
      let mgrQ = supabase
        .from('workers_safe')
        .select('id, full_name, role, branch_id')
        .eq('is_active', true)
        .eq('role', 'branch_admin');
      if (branchId) mgrQ = mgrQ.eq('branch_id', branchId);
      const { data: managers } = await mgrQ;

      const map = new Map<string, ManagerRow>();
      const ensure = (id: string, name = '') => {
        if (!map.has(id)) map.set(id, { manager_id: id, name, total: 0, handed: 0, remaining: 0 });
        const row = map.get(id)!;
        if (name && !row.name) row.name = name;
        return row;
      };
      (managers || []).forEach((m: any) => ensure(m.id, m.full_name || ''));
      (mt || []).forEach((r: any) => { if (r.manager_id) ensure(r.manager_id).total += Number(r.amount || 0); });
      (mh || []).forEach((r: any) => { if (r.manager_id) ensure(r.manager_id).handed += Number(r.amount || 0); });

      const missingNames = Array.from(map.values()).filter((r) => !r.name).map((r) => r.manager_id);
      if (missingNames.length > 0) {
        const { data: ws } = await supabase.from('workers_safe').select('id, full_name').in('id', missingNames);
        (ws || []).forEach((w: any) => {
          const row = map.get(w.id);
          if (row) row.name = w.full_name || '';
        });
      }
      const rows = Array.from(map.values()).map((r) => ({ ...r, remaining: r.total - r.handed }));
      rows.sort((a, b) => b.total - a.total);
      return rows;
    },
  });

  if (dismissed) return null;

  const rows = perManager || [];
  const isLoading = aggLoading || pmLoading;

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
      <div
        onClick={() => navigate('/manager-treasury')}
        className="flex items-center justify-between mb-3 pe-6 cursor-pointer"
      >
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <Wallet className="h-5 w-5" />
          <h3 className="text-sm font-bold">
            {periodLabel ? `${periodLabel} · ` : ''}{t('admin_home.treasury_summary')}
          </h3>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {rows.length > 0 && (
        <div className="space-y-2 mb-2">
          {rows.map((r) => (
            <div
              key={r.manager_id}
              onClick={() => navigate('/manager-treasury')}
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

      <div
        onClick={() => navigate('/manager-treasury')}
        className="cursor-pointer rounded-xl border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-2"
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
    </div>
  );
};

export default TreasurySummaryCard;
