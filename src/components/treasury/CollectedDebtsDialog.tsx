import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
const isPerManagerRole = (role: string | null | undefined) => role === 'branch_admin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CustomerSummary from '@/components/customers/CustomerSummary';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CheckCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range?: { from: string | null; to: string | null };
}

interface PaymentRow {
  id: string;
  amount: number;
  collected_at: string;
  payment_method: string | null;
  notes: string | null;
  debt?: {
    branch_id: string | null;
    customer_id: string;
    customer?: { name: string | null; store_name: string | null } | null;
  } | null;
}

interface Group {
  customer_id: string;
  customer_name: string;
  store_name: string | null;
  payments: PaymentRow[];
  total: number;
}

const CollectedDebtsDialog = ({ open, onOpenChange, range }: Props) => {
  const { activeBranch, workerId, role } = useAuth();
  const perManager = isPerManagerRole(role) && workerId ? workerId : null;

  const { data: groups, isLoading } = useQuery({
    queryKey: ['treasury-collected-debts', activeBranch?.id, perManager, range?.from, range?.to],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from('debt_payments')
        .select(`
          id, amount, collected_at, payment_method, notes, worker_id,
          debt:customer_debts!debt_payments_debt_id_fkey(
            branch_id, customer_id,
            customer:customers(name, store_name)
          )
        `)
        .order('collected_at', { ascending: false });
      if (perManager) q = q.eq('worker_id', perManager);
      if (range?.from) q = q.gte('collected_at', `${range.from}T00:00:00`);
      if (range?.to) q = q.lte('collected_at', `${range.to}T23:59:59`);

      const { data, error } = await q;
      if (error) throw error;

      const grouped = new Map<string, Group>();
      for (const p of (data || []) as PaymentRow[]) {
        if (!(p.payment_method === 'cash' || !p.payment_method)) continue;
        const branchId = p.debt?.branch_id || null;
        if (activeBranch?.id && branchId && branchId !== activeBranch.id) continue;
        const cid = p.debt?.customer_id;
        if (!cid) continue;
        const existing = grouped.get(cid);
        if (existing) {
          existing.payments.push(p);
          existing.total += Number(p.amount || 0);
        } else {
          grouped.set(cid, {
            customer_id: cid,
            customer_name: p.debt?.customer?.name || 'عميل غير معروف',
            store_name: p.debt?.customer?.store_name || null,
            payments: [p],
            total: Number(p.amount || 0),
          });
        }
      }
      return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
    },
  });

  const totalCollected = (groups || []).reduce((s, g) => s + g.total, 0);
  const totalPayments = (groups || []).reduce((s, g) => s + g.payments.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            تحصيلات ديون نقدية
            <Badge variant="secondary" className="mr-auto">
              {totalPayments} تحصيل - {groups?.length || 0} عميل
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-center mb-2">
          <p className="text-xs text-muted-foreground">الإجمالي</p>
          <p className="text-xl font-bold text-green-600">{totalCollected.toLocaleString()} د.ج</p>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">جارٍ التحميل...</p>
        ) : !groups || groups.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">لا توجد تحصيلات</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card key={group.customer_id}>
                <CardContent className="p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <CustomerSummary
                      customer={{ name: group.customer_name, store_name: group.store_name }}
                      compact
                      showAvatar={false}
                      showMeta={false}
                    />
                    <div className="text-left">
                      <p className="font-bold text-green-600">{group.total.toLocaleString()} د.ج</p>
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {group.payments.length} تحصيل
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t pt-2">
                    {group.payments.map((p) => (
                      <div key={p.id} className="rounded-lg bg-muted/30 p-2 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-muted-foreground">
                              {format(new Date(p.collected_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                            </p>
                            {p.notes && <p className="text-[10px] text-muted-foreground">{p.notes}</p>}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-green-600">{Number(p.amount || 0).toLocaleString()} د.ج</p>
                          </div>
                        </div>
                      </div>
                    ))}
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

export default CollectedDebtsDialog;
