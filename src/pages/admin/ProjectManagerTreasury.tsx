import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  Banknote,
  Coins,
  CreditCard,
  Receipt,
  ArrowUpRight,
  HandCoins,
  Stamp,
  Eye,
  ArrowRight,
  Building2,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import HandoverPrintView from '@/components/treasury/HandoverPrintView';

const Money = ({ value, className = '' }: { value: number; className?: string }) => (
  <bdi dir="ltr" className={`inline-block whitespace-nowrap tabular-nums ${className}`.trim()}>
    {Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} DA
  </bdi>
);

type ColorKey = 'emerald' | 'amber' | 'blue' | 'purple' | 'cyan' | 'rose' | 'indigo' | 'orange';

const colorMap: Record<ColorKey, { bg: string; border: string; text: string; iconBg: string }> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   iconBg: 'bg-amber-100' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    iconBg: 'bg-blue-100' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  iconBg: 'bg-purple-100' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    iconBg: 'bg-cyan-100' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    iconBg: 'bg-rose-100' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  iconBg: 'bg-indigo-100' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  iconBg: 'bg-orange-100' },
};

const TreasuryCard = ({
  icon,
  label,
  total,
  color,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  total: number;
  color: ColorKey;
  count: number;
  onClick?: () => void;
}) => {
  const c = colorMap[color];
  return (
    <Card
      onClick={onClick}
      className={`${c.bg} ${c.border} hover:shadow-md transition-shadow rounded-2xl ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-bold ${c.text} truncate`}>{label}</span>
          <span className={`flex items-center justify-center w-8 h-8 rounded-full ${c.iconBg} shrink-0`}>
            {icon}
          </span>
        </div>
        <div className="text-center">
          <Money value={total} className={`text-xl font-bold ${c.text}`} />
        </div>
        <div className="flex justify-center">
          <Badge variant="outline" className={`text-[10px] ${c.text} bg-white/60`}>{count} تسليم</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

type CardType = 'cash_invoice1' | 'cash_invoice2' | 'checks' | 'receipts' | 'transfers' | 'debt_cash' | 'stamps' | 'expenses';

const cardLabel: Record<CardType, string> = {
  cash_invoice1: 'كاش فاتورة 1',
  cash_invoice2: 'كاش فاتورة 2',
  checks: 'الشيكات',
  receipts: 'Versement Doc',
  transfers: 'Virement (فاتورة 2)',
  debt_cash: 'تحصيلات الديون',
  stamps: 'الطوابع',
  expenses: 'المصاريف',
};

const cardField: Record<Exclude<CardType, 'expenses'>, string> = {
  cash_invoice1: 'cash_invoice1',
  cash_invoice2: 'cash_invoice2',
  checks: 'checks_amount',
  receipts: 'receipts_amount',
  transfers: 'transfers_amount',
  debt_cash: 'debt_cash_amount',
  stamps: 'stamp_amount',
};


const ProjectManagerTreasury = () => {
  const navigate = useNavigate();
  const { activeBranch } = useAuth();
  const branchId = activeBranch?.id || 'all';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [openCard, setOpenCard] = useState<CardType | null>(null);


  const { data: handovers, isLoading } = useQuery({
    queryKey: ['project-manager-treasury', dateFrom, dateTo, branchId],
    queryFn: async () => {
      let q = supabase
        .from('manager_handovers')
        .select('*, branch:branches(id, name, wilaya), manager:workers!manager_handovers_manager_id_fkey(id, full_name)')
        .eq('approval_status', 'approved')
        .order('approved_at', { ascending: false });
      if (dateFrom) q = q.gte('handover_date', dateFrom);
      if (dateTo) q = q.lte('handover_date', dateTo);
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: expensesList } = useQuery({
    queryKey: ['pmt-expenses', dateFrom, dateTo, branchId],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('*, branch:branches(id, name)')
        .eq('status', 'approved')
        .order('expense_date', { ascending: false });
      if (dateFrom) q = q.gte('expense_date', dateFrom);
      if (dateTo) q = q.lte('expense_date', dateTo);
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const expensesTotal = useMemo(
    () => (expensesList || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
    [expensesList]
  );

  const totals = useMemo(() => {
    const init = {
      cash_invoice1: 0,
      cash_invoice2: 0,
      checks: 0,
      receipts: 0,
      transfers: 0,
      debt_cash: 0,
      stamps: 0,
      grand: 0,
    };
    if (!handovers) return init;
    for (const h of handovers as any[]) {
      init.cash_invoice1 += Number(h.cash_invoice1 || 0);
      init.cash_invoice2 += Number(h.cash_invoice2 || 0);
      init.checks += Number(h.checks_amount || 0);
      init.receipts += Number(h.receipts_amount || 0);
      init.transfers += Number(h.transfers_amount || 0);
      init.debt_cash += Number(h.debt_cash_amount || 0);
      init.stamps += Number(h.stamp_amount || 0);
      init.grand += Number(h.amount || 0);
    }
    return init;
  }, [handovers]);

  // Per-branch breakdown
  const byBranch = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    (handovers || []).forEach((h: any) => {
      const key = h.branch?.id || 'unknown';
      const name = h.branch?.name || '—';
      const cur = map.get(key) || { name, total: 0, count: 0 };
      cur.total += Number(h.amount || 0);
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [handovers]);

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" />
              خزينة مدير المشروع
            </h1>
            <p className="text-sm text-muted-foreground">
              مجموع التسليمات الموافَق عليها من مدراء الفروع، كل نوع في مكانه
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <div className="text-xs text-muted-foreground">
              الفرع: <span className="font-bold text-foreground">{activeBranch?.name || 'جميع الفروع'}</span>
              <span className="block text-[10px]">(يُحدَّد من شارات الفروع في الأعلى)</span>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Totals header */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <span className="font-bold">إجمالي رصيد الخزينة</span>
          </div>
          <Money value={totals.grand} className="text-2xl font-bold text-primary" />
        </CardContent>
      </Card>

      {/* Treasury cards by type — same structure as branch manager treasury */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <TreasuryCard
          icon={<Banknote className="w-4 h-4 text-emerald-700" />}
          label="كاش فاتورة 1"
          total={totals.cash_invoice1}
          color="emerald"
          count={(handovers || []).filter((h: any) => Number(h.cash_invoice1) > 0).length}
          onClick={() => setOpenCard('cash_invoice1')}
        />
        <TreasuryCard
          icon={<Coins className="w-4 h-4 text-amber-700" />}
          label="كاش فاتورة 2"
          total={totals.cash_invoice2}
          color="amber"
          count={(handovers || []).filter((h: any) => Number(h.cash_invoice2) > 0).length}
          onClick={() => setOpenCard('cash_invoice2')}
        />
        <TreasuryCard
          icon={<CreditCard className="w-4 h-4 text-blue-700" />}
          label="الشيكات"
          total={totals.checks}
          color="blue"
          count={(handovers || []).filter((h: any) => Number(h.checks_amount) > 0).length}
          onClick={() => setOpenCard('checks')}
        />
        <TreasuryCard
          icon={<Receipt className="w-4 h-4 text-purple-700" />}
          label="Versement Doc"
          total={totals.receipts}
          color="purple"
          count={(handovers || []).filter((h: any) => Number(h.receipts_amount) > 0).length}
          onClick={() => setOpenCard('receipts')}
        />
        <TreasuryCard
          icon={<ArrowUpRight className="w-4 h-4 text-orange-700" />}
          label="Virement (فاتورة 2)"
          total={totals.transfers}
          color="orange"
          count={(handovers || []).filter((h: any) => Number(h.transfers_amount) > 0).length}
          onClick={() => setOpenCard('transfers')}
        />
        <TreasuryCard
          icon={<HandCoins className="w-4 h-4 text-rose-700" />}
          label="تحصيلات الديون"
          total={totals.debt_cash}
          color="rose"
          count={(handovers || []).filter((h: any) => Number(h.debt_cash_amount) > 0).length}
          onClick={() => setOpenCard('debt_cash')}
        />
        <TreasuryCard
          icon={<Stamp className="w-4 h-4 text-indigo-700" />}
          label="الطوابع"
          total={totals.stamps}
          color="indigo"
          count={(handovers || []).filter((h: any) => Number(h.stamp_amount) > 0).length}
          onClick={() => setOpenCard('stamps')}
        />
        <TreasuryCard
          icon={<Wallet className="w-4 h-4 text-amber-700" />}
          label="المصاريف"
          total={Number(expensesTotal || 0)}
          color="amber"
          count={(expensesList || []).length}
          onClick={() => setOpenCard('expenses')}
        />


      </div>


      <Tabs defaultValue="handovers">
        <TabsList>
          <TabsTrigger value="handovers">التسليمات</TabsTrigger>
          <TabsTrigger value="branches">حسب الفرع</TabsTrigger>
        </TabsList>

        <TabsContent value="handovers" className="mt-3">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">جاري التحميل...</div>
          ) : !handovers?.length ? (
            <Card><CardContent className="text-center text-muted-foreground py-12">لا توجد تسليمات موافَق عليها</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {handovers.map((h: any) => (
                <Card key={h.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        {h.branch?.name || '—'}
                      </CardTitle>
                      <Badge className="bg-green-100 text-green-800 border-green-300">موافَق</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {h.manager?.full_name || '—'} • {format(new Date(h.handover_date), 'PPP', { locale: ar })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">الإجمالي</span>
                      <Money value={Number(h.amount || 0)} className="font-bold text-primary" />
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span>كاش 1: {Number(h.cash_invoice1 || 0).toLocaleString()}</span>
                      <span>كاش 2: {Number(h.cash_invoice2 || 0).toLocaleString()}</span>
                      <span>شيكات: {Number(h.checks_amount || 0).toLocaleString()}</span>
                      <span>Vers. Doc: {Number(h.receipts_amount || 0).toLocaleString()}</span>
                      <span>Virement: {Number(h.transfers_amount || 0).toLocaleString()}</span>
                      <span>ديون: {Number(h.debt_cash_amount || 0).toLocaleString()}</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => setSelected(h)}>
                      <Eye className="w-4 h-4 ml-1" /> معاينة
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="branches" className="mt-3">
          {byBranch.length === 0 ? (
            <Card><CardContent className="text-center text-muted-foreground py-12">لا توجد بيانات</CardContent></Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {byBranch.map((b) => (
                <Card key={b.name}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <div>
                        <div className="font-bold text-sm">{b.name}</div>
                        <div className="text-xs text-muted-foreground">{b.count} تسليم</div>
                      </div>
                    </div>
                    <Money value={b.total} className="font-bold text-primary" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل التسليم</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="border rounded-lg p-2 bg-white">
              <HandoverPrintView
                handoverId={selected.id}
                handoverDate={selected.handover_date}
                cashInvoice1={Number(selected.cash_invoice1 || 0)}
                cashInvoice2={Number(selected.cash_invoice2 || 0)}
                checksAmount={Number(selected.checks_amount || 0)}
                receiptsAmount={Number(selected.receipts_amount || 0)}
                transfersAmount={Number(selected.transfers_amount || 0)}
                totalAmount={Number(selected.amount || 0)}
                branchWilaya={selected.branch?.wilaya}
                deliveryMethod={selected.delivery_method}
                intermediaryName={selected.intermediary_name}
                bankTransferReference={selected.bank_transfer_reference}
                receivedBy={selected.receiver_name}
                unifiedCash={selected.unified_cash}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Card details dialog */}
      <Dialog open={!!openCard} onOpenChange={(o) => !o && setOpenCard(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل: {openCard ? cardLabel[openCard] : ''}</DialogTitle>
          </DialogHeader>
          {openCard === 'expenses' ? (
            (expensesList || []).length === 0 ? (
              <div className="text-center text-muted-foreground py-8">لا توجد مصاريف</div>
            ) : (
              <div className="space-y-2">
                {(expensesList || []).map((e: any) => (
                  <Card key={e.id}>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          {e.branch?.name || '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {e.description || e.category || '—'} • {e.expense_date ? format(new Date(e.expense_date), 'PPP', { locale: ar }) : ''}
                        </div>
                      </div>
                      <Money value={Number(e.amount || 0)} className="font-bold text-amber-700" />
                    </CardContent>
                  </Card>
                ))}
                <div className="flex items-center justify-between border-t pt-2 mt-2">
                  <span className="font-bold">الإجمالي</span>
                  <Money value={expensesTotal} className="font-bold text-primary text-lg" />
                </div>
              </div>
            )
          ) : openCard ? (
            (() => {
              const field = cardField[openCard];
              const rows = (handovers || []).filter((h: any) => Number(h[field] || 0) > 0);
              const sum = rows.reduce((s: number, h: any) => s + Number(h[field] || 0), 0);
              if (rows.length === 0) {
                return <div className="text-center text-muted-foreground py-8">لا توجد بيانات</div>;
              }
              return (
                <div className="space-y-2">
                  {rows.map((h: any) => (
                    <Card key={h.id} className="hover:shadow-sm">
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            {h.branch?.name || '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {h.manager?.full_name || '—'} • {format(new Date(h.handover_date), 'PPP', { locale: ar })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Money value={Number(h[field] || 0)} className="font-bold text-primary" />
                          <Button size="sm" variant="outline" onClick={() => { setSelected(h); setOpenCard(null); }}>
                            <Eye className="w-4 h-4 ml-1" /> معاينة
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <div className="flex items-center justify-between border-t pt-2 mt-2">
                    <span className="font-bold">الإجمالي</span>
                    <Money value={sum} className="font-bold text-primary text-lg" />
                  </div>
                </div>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ProjectManagerTreasury;
