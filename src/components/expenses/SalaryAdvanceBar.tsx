import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, Loader2 } from 'lucide-react';
import { formatNumber, formatDate } from '@/utils/formatters';

interface Props {
  workerId: string;
  language: string;
}

const SalaryAdvanceBar: React.FC<Props> = ({ workerId, language }) => {
  const [open, setOpen] = useState(false);

  const monthStart = React.useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['salary-advance-bar', workerId, monthStart],
    enabled: !!workerId,
    queryFn: async () => {
      const [{ data: worker }, { data: debts }] = await Promise.all([
        supabase.from('workers').select('max_monthly_salary_advance').eq('id', workerId).maybeSingle(),
        supabase
          .from('worker_debts')
          .select('id, amount, description, created_at')
          .eq('worker_id', workerId)
          .eq('debt_type', 'advance')
          .gte('created_at', monthStart)
          .order('created_at', { ascending: false }),
      ]);
      const limit = Number((worker as any)?.max_monthly_salary_advance || 0);
      const used = (debts || []).reduce((s, d: any) => s + Number(d.amount || 0), 0);
      return { limit, used, debts: debts || [] };
    },
  });

  if (!data || data.limit <= 0) return null;

  const remaining = Math.max(0, data.limit - data.used);
  const pct = Math.min(100, (data.used / data.limit) * 100);
  const isFull = remaining <= 0;

  return (
    <>
      <Card
        className="p-3 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setOpen(true)}
        role="button"
      >
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">سلفة الراتب لهذا الشهر</span>
          <span className="ms-auto text-xs text-muted-foreground">
            {formatNumber(data.used, language as any)} / {formatNumber(data.limit, language as any)} دج
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${isFull ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={isFull ? 'text-destructive font-medium' : 'text-primary font-medium'}>
            {isFull
              ? 'تم استنفاد سلفة الراتب لهذا الشهر'
              : `يمكنك أخذ سلفة بقيمة ${formatNumber(remaining, language as any)} دج`}
          </span>
          <span className="text-muted-foreground">اضغط لعرض السجل</span>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>سجل سلف الراتب لهذا الشهر</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : data.debts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              لا توجد سلف مسجلة لهذا الشهر
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.debts.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-start justify-between gap-2 p-2 rounded-md bg-muted/50"
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {formatNumber(Number(d.amount), language as any)} دج
                    </p>
                    {d.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDate(d.created_at, 'dd MMM', language as any)}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t mt-2 flex justify-between text-sm font-semibold">
                <span>المجموع</span>
                <span className="text-primary">
                  {formatNumber(data.used, language as any)} دج
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>المتبقي</span>
                <span>{formatNumber(remaining, language as any)} دج</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SalaryAdvanceBar;
