import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkerTargets, useWorkerTargetProgress, useRecalcWorkerTargets, METRIC_LABELS, PERIOD_LABELS, STATUS_LABELS } from '@/hooks/useWorkerTargets';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, RefreshCw } from 'lucide-react';

export const TargetsLeaderboard: React.FC = () => {
  const { data: targets } = useWorkerTargets();
  const { data: progress } = useWorkerTargetProgress();
  const recalc = useRecalcWorkerTargets();

  const { data: workers } = useQuery({
    queryKey: ['workers-active'],
    queryFn: async () => {
      const { data } = await supabase.from('workers').select('id, full_name').eq('is_active', true);
      return data as { id: string; full_name: string }[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const activeTargets = useMemo(() => (targets ?? []).filter(t => t.is_active && t.start_date <= today && t.end_date >= today), [targets, today]);

  const recalcAll = async () => {
    if (!workers) return;
    for (const w of workers) {
      await recalc.mutateAsync(w.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> لوحة الأداء</h3>
        <Button variant="outline" size="sm" onClick={recalcAll} disabled={recalc.isPending} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${recalc.isPending ? 'animate-spin' : ''}`} /> إعادة حساب الكل
        </Button>
      </div>

      {activeTargets.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">لا توجد أهداف نشطة حالياً</Card>
      )}

      <div className="space-y-4">
        {activeTargets.map(t => {
          const tProgress = (progress ?? []).filter(p => p.target_id === t.id);
          // For "all workers" target, show row per worker
          const rows = t.worker_id
            ? tProgress.filter(p => p.worker_id === t.worker_id)
            : tProgress;
          const sorted = [...rows].sort((a, b) => Number(b.achievement_pct) - Number(a.achievement_pct));

          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <h4 className="font-semibold">{t.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {METRIC_LABELS[t.metric_type]} • {PERIOD_LABELS[t.period_type]} • مستهدف: {Number(t.target_value).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">مكافأة: {Number(t.reward_amount).toLocaleString()} د.ج</Badge>
              </div>

              {sorted.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">لا توجد بيانات إنجاز بعد. أغلق جلسات محاسبة لتحديث الأرقام.</p>
              )}

              <div className="space-y-2">
                {sorted.map(p => {
                  const wname = workers?.find(w => w.id === p.worker_id)?.full_name ?? '...';
                  const pct = Math.min(Number(p.achievement_pct), 100);
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{wname}</span>
                        <span className="flex items-center gap-2">
                          <Badge variant={p.status === 'achieved' ? 'default' : p.status === 'missed' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {STATUS_LABELS[p.status]}
                          </Badge>
                          <span className="text-muted-foreground">{Number(p.achieved_value).toLocaleString()} / {Number(t.target_value).toLocaleString()}</span>
                          <span className="font-bold">{Number(p.achievement_pct).toFixed(1)}%</span>
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      {(Number(p.reward_calculated) > 0 || Number(p.penalty_calculated) > 0) && (
                        <div className="text-xs flex gap-3">
                          {Number(p.reward_calculated) > 0 && <span className="text-green-600">💰 مكافأة: {Number(p.reward_calculated).toLocaleString()} د.ج</span>}
                          {Number(p.penalty_calculated) > 0 && <span className="text-red-600">⚠️ خصم: {Number(p.penalty_calculated).toLocaleString()} د.ج</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
