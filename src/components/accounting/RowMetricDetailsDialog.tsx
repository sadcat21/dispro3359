import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { User, Coins } from 'lucide-react';
import DebtCollectionsSummary from './DebtCollectionsSummary';
import ExpensesDetailsSummary from './ExpensesDetailsSummary';
import NewDebtsSummary from './NewDebtsSummary';

export type RowMetric = 'new_debts' | 'debt_collections' | 'expenses' | 'coin_amount';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: any[];
  metric: RowMetric | null;
}

const TITLES: Record<RowMetric, string> = {
  new_debts: 'تفاصيل الديون الجديدة',
  debt_collections: 'تفاصيل تحصيلات الديون',
  expenses: 'تفاصيل المصاريف',
  coin_amount: 'تفاصيل صرف العملة',
};

const fmt = (n: number) => Number(n || 0).toLocaleString('fr-FR');

const getItem = (s: any, key: string) => {
  const found = (s.items || []).find((i: any) => i.item_key === key);
  return Number(found?.amount || 0);
};

const RowMetricDetailsDialog: React.FC<Props> = ({ open, onOpenChange, sessions, metric }) => {
  if (!metric) return null;

  const renderSessionBody = (s: any) => {
    const workerId = s.worker?.id || s.worker_id;
    if (!workerId || !s.period_start || !s.period_end) return null;

    if (metric === 'debt_collections') {
      return (
        <DebtCollectionsSummary
          workerId={workerId}
          periodStart={s.period_start}
          periodEnd={s.period_end}
          completedAt={s.completed_at}
        />
      );
    }
    if (metric === 'expenses') {
      return (
        <ExpensesDetailsSummary
          workerId={workerId}
          periodStart={s.period_start}
          periodEnd={s.period_end}
          completedAt={s.completed_at}
        />
      );
    }
    if (metric === 'new_debts') {
      return (
        <NewDebtsSummary
          workerId={workerId}
          periodStart={s.period_start}
          periodEnd={s.period_end}
          completedAt={s.completed_at}
        />
      );
    }
    if (metric === 'coin_amount') {
      const amount = getItem(s, 'coin_amount');
      return (
        <div className="text-sm bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-yellow-800 font-medium">
            <Coins className="w-4 h-4" /> صرف العملة
          </span>
          <span className="font-bold text-yellow-900">{fmt(amount)} DA</span>
        </div>
      );
    }
    return null;
  };

  // Filter sessions that actually have a value for this metric (for new_debts / coin_amount)
  const visibleSessions = sessions.filter((s) => {
    if (metric === 'new_debts') return true;
    if (metric === 'coin_amount') return getItem(s, 'coin_amount') > 0;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle>{TITLES[metric]}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-4rem)] p-4">
          {visibleSessions.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              لا توجد بيانات لعرضها
            </div>
          ) : (
            <div className="space-y-4">
              {visibleSessions.map((s: any) => (
                <div key={s.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm">{s.worker?.full_name || '—'}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {s.period_start?.slice(0, 10)} → {s.period_end?.slice(0, 10)}
                    </Badge>
                  </div>
                  <div className="p-3">{renderSessionBody(s)}</div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RowMetricDetailsDialog;
