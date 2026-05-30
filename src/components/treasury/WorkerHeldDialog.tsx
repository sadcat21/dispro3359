import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { computeWorkerHeld } from '@/utils/computeWorkerHeld';
const MoneyValue = ({ value, currency, className = '' }: { value: number; currency: string; className?: string }) => (
  <span className={className}>{Number(value).toLocaleString()} {currency}</span>
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range?: { from?: string; to?: string };
  currency?: string;
}

const WorkerHeldDialog: React.FC<Props> = ({ open, onOpenChange, range, currency = 'DA' }) => {
  const { activeBranch } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['worker-held-breakdown', activeBranch?.id, range?.from, range?.to],
    enabled: open,
    queryFn: () => computeWorkerHeld(activeBranch?.id, range),
  });

  const rows = data?.rows || [];
  const totalAll = data?.total || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>👷 ما بحوزة كل عامل (لم يُسلَّم بعد)</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">الإجمالي</p>
          <MoneyValue value={totalAll} currency={currency} className="text-lg font-bold text-amber-600" />
        </div>
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد بيانات</p>
          ) : rows.map(r => (
            <Card key={r.worker_id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">{r.name}</p>
                  <MoneyValue value={r.total} currency={currency} className="text-sm font-bold text-amber-600" />
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <p>💵 نقداً: <span className="font-semibold">{r.cash.toLocaleString()} {currency}</span></p>
                  <p>🧾 مستند: <span className="font-semibold">{r.document.toLocaleString()} {currency}</span></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkerHeldDialog;
