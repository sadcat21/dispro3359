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

  if (!data) return null;

  const hasLimit = data.limit > 0;
  const remaining = hasLimit ? Math.max(0, data.limit - data.used) : 0;
  const pct = hasLimit ? Math.min(100, (data.used / data.limit) * 100) : 0;
  const isFull = hasLimit && remaining <= 0;

  const monthLabel = new Date().toLocaleDateString(
    language === 'fr' ? 'fr-FR' : language === 'en' ? 'en-US' : 'ar-DZ',
    { month: 'long', year: 'numeric' },
  );

  // Dynamic color tiers based on consumption percentage
  const tier = !hasLimit
    ? { card: 'bg-card border-border', icon: 'text-primary', bar: 'bg-primary', text: 'text-primary' }
    : pct >= 100
      ? { card: 'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800', icon: 'text-red-600', bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400' }
      : pct >= 75
        ? { card: 'bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-800', icon: 'text-orange-600', bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400' }
        : pct >= 50
          ? { card: 'bg-yellow-50 border-yellow-300 dark:bg-yellow-950/30 dark:border-yellow-800', icon: 'text-yellow-600', bar: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-500' }
          : { card: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800', icon: 'text-emerald-600', bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' };

  return (
    <>
      <Card
        className={`p-3 cursor-pointer hover:shadow-md transition-all border ${tier.card}`}
        onClick={() => setOpen(true)}
        role="button"
      >
        <div className="flex items-center gap-2 mb-2">
          <Wallet className={`w-4 h-4 ${tier.icon}`} />
          <span className="text-sm font-semibold">سلفة شهر {monthLabel}</span>
          <span className="ms-auto text-xs text-muted-foreground">
            {hasLimit
              ? `${formatNumber(data.used, language as any)} / ${formatNumber(data.limit, language as any)} دج`
              : `${formatNumber(data.used, language as any)} دج`}
          </span>
        </div>
        {hasLimit && (
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${tier.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={`font-medium ${tier.text}`}>
            {!hasLimit
              ? 'لم يحدد المدير حدًّا شهريًا للسلفة'
              : isFull
                ? 'تم استنفاد سلفة الراتب لهذا الشهر'
                : `يمكنك أخذ سلفة بقيمة ${formatNumber(remaining, language as any)} دج`}
          </span>
          <span className="text-muted-foreground">اضغط لعرض السجل</span>
        </div>
      </Card>



      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>سجل سلف شهر {monthLabel}</DialogTitle>
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
