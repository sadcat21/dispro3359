import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Download, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LedgerAdminActions } from '@/components/admin/LedgerAdminActions';

const MOVEMENT_TYPES = [
  { value: 'all', label: 'كل الحركات' },
  { value: 'collection', label: 'تحصيل' },
  { value: 'debt_payment_in', label: 'تسديد دين (وارد)' },
  { value: 'sale_cash', label: 'بيع نقدي' },
  { value: 'deposit', label: 'إيداع' },
  { value: 'withdrawal', label: 'سحب' },
  { value: 'transfer_in', label: 'تحويل وارد' },
  { value: 'transfer_out', label: 'تحويل صادر' },
  { value: 'payment', label: 'دفع' },
  { value: 'expense', label: 'مصروف' },
  { value: 'adjustment', label: 'تسوية' },
];

const ACCOUNT_TYPES = [
  { value: 'all', label: 'كل الحسابات' },
  { value: 'worker_treasury', label: 'خزينة موظف' },
  { value: 'manager_treasury', label: 'خزينة مدير' },
  { value: 'branch_safe', label: 'خزنة الفرع' },
  { value: 'customer_account', label: 'حساب زبون' },
  { value: 'expense_pool', label: 'مصروفات' },
];

const typeColor = (t: string) => {
  if (['collection', 'deposit', 'transfer_in', 'debt_payment_in', 'sale_cash'].includes(t)) return 'default';
  if (['payment', 'withdrawal', 'transfer_out', 'expense', 'debt_payment_out'].includes(t)) return 'destructive';
  return 'secondary';
};

const CashLedger: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [movementType, setMovementType] = useState('all');
  const [accountType, setAccountType] = useState('all');
  const [branchId, setBranchId] = useState('all');
  const [search, setSearch] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: workers } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('workers').select('id, full_name').limit(2000);
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, name').limit(5000);
      return data ?? [];
    },
  });

  const branchMap = useMemo(() => Object.fromEntries((branches ?? []).map((b: any) => [b.id, b.name])), [branches]);
  const workerMap = useMemo(() => Object.fromEntries((workers ?? []).map((w: any) => [w.id, w.full_name])), [workers]);
  const customerMap = useMemo(() => Object.fromEntries((customers ?? []).map((c: any) => [c.id, c.name])), [customers]);

  const accountName = (type: string, id: string | null) => {
    if (!id) return '—';
    if (type === 'worker_treasury' || type === 'manager_treasury') return workerMap[id] ?? id.slice(0, 8);
    if (type === 'customer_account') return customerMap[id] ?? id.slice(0, 8);
    if (type === 'branch_safe') return branchMap[id] ?? id.slice(0, 8);
    return id.slice(0, 8);
  };

  const { data: movements, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cash-movements', from, to, movementType, accountType, branchId],
    queryFn: async () => {
      let q = supabase
        .from('cash_movements')
        .select('*')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (movementType !== 'all') q = q.eq('movement_type', movementType);
      if (accountType !== 'all') q = q.eq('account_type', accountType);
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return movements ?? [];
    const s = search.toLowerCase();
    return (movements ?? []).filter((m: any) =>
      (m.reason ?? '').toLowerCase().includes(s) ||
      (m.notes ?? '').toLowerCase().includes(s) ||
      accountName(m.account_type, m.account_id).toLowerCase().includes(s)
    );
  }, [movements, search, workerMap, customerMap, branchMap]);

  const stats = useMemo(() => {
    const list = filtered;
    const totalIn = list.filter((m: any) => Number(m.signed_amount) > 0).reduce((s: number, m: any) => s + Number(m.signed_amount ?? 0), 0);
    const totalOut = list.filter((m: any) => Number(m.signed_amount) < 0).reduce((s: number, m: any) => s + Number(m.signed_amount ?? 0), 0);
    return { count: list.length, totalIn, totalOut, net: totalIn + totalOut };
  }, [filtered]);

  const { data: reconciliation, refetch: refetchRecon, isFetching: reconLoading } = useQuery({
    queryKey: ['cash-reconciliation'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_cash_reconciliation' as any).select('*').limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: false,
  });

  const exportCsv = () => {
    if (!filtered.length) { toast.error('لا توجد بيانات'); return; }
    const headers = ['التاريخ', 'النوع', 'الحساب', 'الفرع', 'المبلغ', 'موقّع', 'الرصيد التراكمي', 'السبب', 'من', 'إلى', 'ملاحظات'];
    const lines = filtered.map((m: any) => [
      format(new Date(m.created_at), 'yyyy-MM-dd HH:mm'),
      m.movement_type,
      `${m.account_type}:${accountName(m.account_type, m.account_id)}`,
      branchMap[m.branch_id] ?? '',
      m.amount, m.signed_amount ?? '', m.running_balance ?? '',
      m.reason ?? '', m.from_account_type ?? '', m.to_account_type ?? '',
      (m.notes ?? '').replace(/[\r\n,]/g, ' '),
    ].map(v => `"${String(v ?? '')}"`).join(','));
    const csv = '\ufeff' + headers.join(',') + '\n' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-ledger-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> سجل حركة الأموال (Cash Ledger)</h1>
          <p className="text-sm text-muted-foreground">سجل تراكمي لكل الحركات المالية في كل الخزائن والحسابات</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 ml-2" /> تصدير CSV</Button>
          <LedgerAdminActions kind="cash" onDone={() => refetch()} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">عدد الحركات</div><div className="text-2xl font-bold">{stats.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownLeft className="h-4 w-4 text-green-600" /> الوارد</div><div className="text-2xl font-bold text-green-600">+{stats.totalIn.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpRight className="h-4 w-4 text-red-600" /> الصادر</div><div className="text-2xl font-bold text-red-600">{stats.totalOut.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">صافي</div><div className={`text-2xl font-bold ${stats.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.net.toFixed(2)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">فلاتر</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div><Label className="text-xs">من</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">إلى</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label className="text-xs">النوع</Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">نوع الحساب</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">الفرع</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">كل الفروع</SelectItem>{(branches ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">بحث</Label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="سبب / حساب / ملاحظة" /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">سجل الحركات</TabsTrigger>
          <TabsTrigger value="reconciliation" onClick={() => refetchRecon()}>أرصدة الحسابات</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card><CardContent className="p-0 overflow-x-auto">
            {isLoading ? <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>التاريخ</TableHead><TableHead>النوع</TableHead>
                  <TableHead>الحساب</TableHead><TableHead>الفرع</TableHead>
                  <TableHead className="text-center">المبلغ</TableHead>
                  <TableHead className="text-center">موقّع</TableHead>
                  <TableHead className="text-center">الرصيد التراكمي</TableHead>
                  <TableHead>من → إلى</TableHead><TableHead>السبب</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center p-8 text-muted-foreground">لا توجد حركات</TableCell></TableRow>
                  : filtered.map((m: any) => {
                    const signed = Number(m.signed_amount ?? 0);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(m.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell><Badge variant={typeColor(m.movement_type) as any}>{m.movement_type}</Badge></TableCell>
                        <TableCell className="text-xs"><div className="font-medium">{accountName(m.account_type, m.account_id)}</div><div className="text-muted-foreground">{m.account_type}</div></TableCell>
                        <TableCell className="text-xs">{branchMap[m.branch_id] ?? '—'}</TableCell>
                        <TableCell className="text-center font-mono">{Number(m.amount).toFixed(2)}</TableCell>
                        <TableCell className={`text-center font-mono font-bold ${signed > 0 ? 'text-green-600' : signed < 0 ? 'text-red-600' : ''}`}>{signed > 0 ? '+' : ''}{signed.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono">{m.running_balance != null ? Number(m.running_balance).toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-xs">{m.from_account_type ?? '—'} → {m.to_account_type ?? '—'}</TableCell>
                        <TableCell className="text-xs">{m.reason ?? '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader><CardTitle className="text-base">رصيد كل حساب من السجل</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {reconLoading ? <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>نوع الحساب</TableHead><TableHead>الحساب</TableHead>
                    <TableHead className="text-center">الرصيد الحالي</TableHead>
                    <TableHead className="text-center">عدد الحركات</TableHead>
                    <TableHead>آخر حركة</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {!reconciliation || reconciliation.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center p-8 text-muted-foreground">اضغط على التبويب لتحميل البيانات</TableCell></TableRow>
                    : (reconciliation as any[]).map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{r.account_type}</TableCell>
                        <TableCell>{accountName(r.account_type, r.account_id)}</TableCell>
                        <TableCell className={`text-center font-mono font-bold ${Number(r.ledger_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Number(r.ledger_balance ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-center">{r.movements_count}</TableCell>
                        <TableCell className="text-xs">{r.last_movement_at ? format(new Date(r.last_movement_at), 'yyyy-MM-dd HH:mm') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CashLedger;
