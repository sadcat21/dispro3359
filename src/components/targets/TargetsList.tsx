import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Users, User, RefreshCw } from 'lucide-react';
import { useWorkerTargets, useDeleteTarget, METRIC_LABELS, PERIOD_LABELS, type WorkerTarget } from '@/hooks/useWorkerTargets';
import { TargetFormDialog } from './TargetFormDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export const TargetsList: React.FC = () => {
  const { data: targets, isLoading } = useWorkerTargets();
  const del = useDeleteTarget();
  const [editing, setEditing] = useState<WorkerTarget | null>(null);
  const [open, setOpen] = useState(false);

  const { data: workers } = useQuery({
    queryKey: ['workers-name-map'],
    queryFn: async () => {
      const { data } = await supabase.from('workers').select('id, full_name');
      const map: Record<string, string> = {};
      (data ?? []).forEach((w: any) => { map[w.id] = w.full_name; });
      return map;
    },
  });

  const formatMetric = (t: WorkerTarget) => {
    if (t.metric_type === 'sales_amount') return `${Number(t.target_value).toLocaleString()} د.ج`;
    if (t.metric_type === 'deliveries_count') return `${t.target_value} توصيلة`;
    return `${t.target_value} كرتونة`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">الأهداف المُسجّلة</h3>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> هدف جديد
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">جاري التحميل...</p>}

      {!isLoading && targets?.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          لا توجد أهداف بعد. أنشئ أول هدف لتبدأ بقياس الأداء.
        </Card>
      )}

      <div className="grid gap-3">
        {targets?.map(t => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold">{t.name}</h4>
                  <Badge variant={t.is_active ? 'default' : 'secondary'}>
                    {t.is_active ? 'مفعّل' : 'معطّل'}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    {t.worker_id ? <><User className="w-3 h-3" />{workers?.[t.worker_id] ?? '...'}</> : <><Users className="w-3 h-3" />جميع العمال</>}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                  <div><span className="text-muted-foreground">المقياس:</span> {METRIC_LABELS[t.metric_type]}</div>
                  <div><span className="text-muted-foreground">الفترة:</span> {PERIOD_LABELS[t.period_type]}</div>
                  <div><span className="text-muted-foreground">المستهدف:</span> {formatMetric(t)}</div>
                  <div><span className="text-muted-foreground">الحد الأدنى:</span> {t.min_achievement_pct}%</div>
                  <div><span className="text-muted-foreground">المكافأة:</span> {Number(t.reward_amount).toLocaleString()} د.ج</div>
                  <div><span className="text-muted-foreground">الخصم:</span> {Number(t.penalty_amount).toLocaleString()} د.ج</div>
                  <div><span className="text-muted-foreground">من:</span> {t.start_date}</div>
                  <div><span className="text-muted-foreground">إلى:</span> {t.end_date}</div>
                </div>

                {t.notes && <p className="text-xs text-muted-foreground mt-2">📝 {t.notes}</p>}
              </div>

              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>حذف الهدف؟</AlertDialogTitle>
                      <AlertDialogDescription>سيتم حذف الهدف وجميع سجلات إنجازه. لا يمكن التراجع.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del.mutate(t.id)}>حذف</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <TargetFormDialog open={open} onOpenChange={setOpen} initial={editing} />
    </div>
  );
};
