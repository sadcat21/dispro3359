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

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

const CollectedDebtsDialog = ({ open, onOpenChange, range }: Props) => {
  const { activeBranch, workerId, role } = useAuth();
  const perManager = isPerManagerRole(role) && workerId ? workerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ['treasury-collected-debts-reviewed', activeBranch?.id, perManager, range?.from, range?.to],
    enabled: open,
    queryFn: async () => {
      // 1) Confirmed (completed) review sessions for this manager
      let revQ = supabase
        .from('manager_review_sessions')
        .select('id')
        .eq('status', 'completed');
      if (perManager) revQ = revQ.eq('manager_id', perManager);
      if (activeBranch?.id) revQ = revQ.eq('branch_id', activeBranch.id);
      const { data: reviews, error: revErr } = await revQ;
      if (revErr) throw revErr;
      const reviewIds = (reviews || []).map((r: any) => r.id);

      if (reviewIds.length === 0) {
        return { groups: [] as Group[], totalCollections: 0, handedAmount: 0 };
      }

      // 2) Reviewed accounting sessions → periods + debt_collections_cash totals
      const { data: sessions, error: sessErr } = await supabase
        .from('accounting_sessions')
        .select('id, period_start, period_end, completed_at, created_at, items:accounting_session_items(item_type, actual_amount)')
        .in('review_session_id', reviewIds);
      if (sessErr) throw sessErr;

      let totalCollections = 0;
      const periods: { start: string; end: string }[] = [];
      for (const s of (sessions || []) as any[]) {
        for (const it of (s.items || [])) {
          if (it.item_type === 'debt_collections_cash') {
            totalCollections += Number(it.actual_amount || 0);
          }
        }
        const start = s.period_start || s.created_at;
        const end = s.period_end || s.completed_at || s.created_at;
        if (start && end) periods.push({ start, end });
      }

      // 3) Handed amount from manager_handovers (debt_cash_amount)
      let hQ = supabase.from('manager_handovers').select('debt_cash_amount, manager_id, branch_id, handover_date');
      if (perManager) hQ = hQ.eq('manager_id', perManager);
      if (activeBranch?.id) hQ = hQ.eq('branch_id', activeBranch.id);
      if (range?.from) hQ = hQ.gte('handover_date', `${range.from}T00:00:00`);
      if (range?.to) hQ = hQ.lte('handover_date', `${range.to}T23:59:59`);
      const { data: handovers } = await hQ;
      const handedAmount = (handovers || []).reduce((s: number, h: any) => s + Number(h.debt_cash_amount || 0), 0);

      // 4) Per-customer payments within reviewed periods
      let pQ = supabase
        .from('debt_payments')
        .select(`
          id, amount, collected_at, payment_method, notes, worker_id,
          debt:customer_debts!debt_payments_debt_id_fkey(
            branch_id, customer_id,
            customer:customers(name, store_name)
          )
        `)
        .order('collected_at', { ascending: false });
      if (perManager) pQ = pQ.eq('worker_id', perManager);
      if (range?.from) pQ = pQ.gte('collected_at', `${range.from}T00:00:00`);
      if (range?.to) pQ = pQ.lte('collected_at', `${range.to}T23:59:59`);
      const { data: payments, error: payErr } = await pQ;
      if (payErr) throw payErr;

      const inReviewedPeriod = (iso: string) => {
        if (!periods.length) return false;
        const t = new Date(iso).getTime();
        return periods.some((p) => {
          const a = new Date(p.start).getTime();
          const b = new Date(p.end).getTime();
          return t >= a && t <= b;
        });
      };

      const grouped = new Map<string, Group>();
      for (const p of (payments || []) as PaymentRow[]) {
        if (!(p.payment_method === 'cash' || !p.payment_method)) continue;
        if (!inReviewedPeriod(p.collected_at)) continue;
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

      return {
        groups: Array.from(grouped.values()).sort((a, b) => b.total - a.total),
        totalCollections,
        handedAmount,
      };
    },
  });

  const groups = data?.groups || [];
  const totalCollections = data?.totalCollections || 0;
  const handedAmount = data?.handedAmount || 0;
  const remaining = Math.max(0, totalCollections - handedAmount);
  const totalPayments = groups.reduce((s, g) => s + g.payments.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            تحصيلات ديون نقدية
            <Badge variant="secondary" className="mr-auto">
              {totalPayments} تحصيل - {groups.length} عميل
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Summary card: total / handed / remaining */}
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 mb-2">
          <p className="text-xs text-center text-muted-foreground mb-2">تحصيلات الديون (من جلسات المراجعة المؤكدة)</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-background p-2 border">
              <p className="text-[10px] text-muted-foreground">إجمالي التحصيلات</p>
              <p className="text-sm font-bold text-green-600">{fmt(totalCollections)} د.ج</p>
            </div>
            <div className="rounded-md bg-background p-2 border">
              <p className="text-[10px] text-muted-foreground">المُسلَّم</p>
              <p className="text-sm font-bold text-blue-600">{fmt(handedAmount)} د.ج</p>
            </div>
            <div className="rounded-md bg-background p-2 border">
              <p className="text-[10px] text-muted-foreground">المتبقي</p>
              <p className="text-sm font-bold text-amber-600">{fmt(remaining)} د.ج</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">جارٍ التحميل...</p>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">لا توجد تحصيلات في جلسات المراجعة المؤكدة</p>
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
                      <p className="font-bold text-green-600">{fmt(group.total)} د.ج</p>
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
                            <p className="font-medium text-green-600">{fmt(Number(p.amount || 0))} د.ج</p>
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
