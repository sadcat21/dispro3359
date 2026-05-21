import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * "Accounting Filtering" — reusable date-range resolver that mirrors the
 * logic used on /my-achievements.
 *
 * Given a worker + a [from,to] day range (yyyy-MM-dd), it returns ISO
 * lowerBound/upperBound suitable for filtering rows by created_at.
 *
 * Special case: when from === to === today, lowerBound is shifted to
 * `max(lastCompletedAccountingSession.completed_at, startOfLocalDay)` and
 * upperBound becomes `now()`. This excludes operations already settled in
 * an earlier accounting session.
 */
export function useAccountingDateRange(
  workerId: string | null | undefined,
  dateFrom: string,
  dateTo: string,
) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [bounds, setBounds] = useState<{ lowerBound: string; upperBound: string; isLoading: boolean }>(() => ({
    lowerBound: new Date(`${dateFrom}T00:00:00`).toISOString(),
    upperBound: new Date(`${dateTo}T23:59:59`).toISOString(),
    isLoading: true,
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lowerBound = new Date(`${dateFrom}T00:00:00`).toISOString();
      let upperBound = new Date(`${dateTo}T23:59:59`).toISOString();
      const isTodayOnly = dateFrom === today && dateTo === today;

      if (isTodayOnly && workerId) {
        const { data: lastSession } = await supabase
          .from('accounting_sessions')
          .select('completed_at, period_end')
          .eq('worker_id', workerId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const lastEnd = lastSession?.completed_at || lastSession?.period_end;
        if (lastEnd) {
          const lastEndDate = new Date(lastEnd);
          const startOfLocalDay = new Date();
          startOfLocalDay.setHours(0, 0, 0, 0);
          lowerBound = lastEndDate > startOfLocalDay
            ? lastEndDate.toISOString()
            : startOfLocalDay.toISOString();
        }
        upperBound = new Date().toISOString();
      }

      if (!cancelled) setBounds({ lowerBound, upperBound, isLoading: false });
    })();
    return () => { cancelled = true; };
  }, [workerId, dateFrom, dateTo, today]);

  return bounds;
}
