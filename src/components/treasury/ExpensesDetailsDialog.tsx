import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import MoneyValue from '@/components/common/MoneyValue';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range?: { from: string | null; to: string | null };
  currency?: string;
}

interface ExpenseRow {
  id: string;
  amount: number;
  description: string | null;
  expense_date: string;
  worker?: { full_name: string | null } | null;
  category?: { name: string | null } | null;
}

const ExpensesDetailsDialog = ({ open, onOpenChange, range, currency = 'DA' }: Props) => {
  const { data: rows, isLoading } = useQuery<ExpenseRow[]>({
    queryKey: ['treasury-expenses-details', range?.from, range?.to],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select(`
          id, amount, description, expense_date,
          worker:workers!expenses_worker_id_fkey(full_name),
          category:expense_categories!expenses_category_id_fkey(name)
        `)
        .eq('status', 'approved')
        .order('expense_date', { ascending: false });
      if (range?.from) q = q.gte('expense_date', range.from);
      if (range?.to) q = q.lte('expense_date', range.to);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const total = (rows || []).reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-600" />
            سجل المصاريف
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 mr-auto">
              <MoneyValue value={total} currency={currency} />
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-8">جارٍ التحميل...</p>
        ) : !rows || rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">لا توجد مصاريف</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="border-amber-500/30">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{r.category?.name || 'بدون تصنيف'}</p>
                      {r.description && (
                        <p className="text-xs text-muted-foreground mt-1 break-words">{r.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{r.worker?.full_name || '—'}</span>
                        <span>•</span>
                        <span>{format(new Date(r.expense_date), 'dd MMM yyyy', { locale: ar })}</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <MoneyValue value={Number(r.amount || 0)} currency={currency} className="font-bold text-amber-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExpensesDetailsDialog;
