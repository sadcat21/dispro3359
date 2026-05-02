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
import { Loader2, RefreshCw, Download, Receipt, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LedgerAdminActions } from '@/components/admin/LedgerAdminActions';
import { DEBT_MOVEMENT_LABELS, DEBTOR_TYPE_LABELS, PAYMENT_METHOD_LABELS, REASON_LABELS, tr } from '@/lib/ledgerLabels';

const MOVEMENT_TYPES = [
  { value: 'all', label: 'كل الحركات' },
  { value: 'debt_created', label: 'إنشاء دين' },
  { value: 'partial_payment', label: 'تسديد جزئي' },
  { value: 'full_payment', label: 'تسديد كامل' },
  { value: 'debt_writeoff', label: 'شطب' },
  { value: 'debt_adjustment', label: 'تسوية' },
  { value: 'discount', label: 'خصم' },
  { value: 'interest', label: 'فوائد' },
  { value: 'debt_increase', label: 'زيادة دين' },
];

const typeColor = (t: string) => {
  if (['debt_created', 'debt_increase', 'interest', 'debt_adjustment'].includes(t)) return 'destructive';
  if (['partial_payment', 'full_payment', 'debt_writeoff', 'discount'].includes(t)) return 'default';
  return 'secondary';
};

const DebtLedger: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [movementType, setMovementType] = useState('all');
  const [debtorType, setDebtorType] = useState('all');
  const [branchId, setBranchId] = useState('all');
  const [search, setSearch] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => (await supabase.from('branches').select('id, name').order('name')).data ?? [],
  });
  const { data: workers } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => (await supabase.from('workers').select('id, full_name').limit(2000)).data ?? [],
  });
  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => (await supabase.from('customers').select('id, name').limit(5000)).data ?? [],
  });

  const branchMap = useMemo(() => Object.fromEntries((branches ?? []).map((b: any) => [b.id, b.name])), [branches]);
  const workerMap = useMemo(() => Object.fromEntries((workers ?? []).map((w: any) => [w.id, w.full_name])), [workers]);
  const customerMap = useMemo(() => Object.fromEntries((customers ?? []).map((c: any) => [c.id, c.name])), [customers]);

  const debtorName = (type: string, id: string) => {
    if (type === 'customer') return customerMap[id] ?? id?.slice(0, 8);
    if (type === 'worker') return workerMap[id] ?? id?.slice(0, 8);
    return id?.slice(0, 8);
  };

  const { data: movements, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['debt-movements', from, to, movementType, debtorType, branchId, showArchive],
    queryFn: async () => {
      const table = showArchive ? 'debt_movements_archive' : 'debt_movements';
      let q = supabase
        .from(table as any)
        .select('*')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (movementType !== 'all') q = q.eq('movement_type', movementType);
      if (debtorType !== 'all') q = q.eq('debtor_type', debtorType);
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
      debtorName(m.debtor_type, m.debtor_id).toLowerCase().includes(s)
    );
  }, [movements, search, customerMap, workerMap]);

  const stats = useMemo(() => {
    const list = filtered;
    const totalCreated = list.filter((m: any) => Number(m.signed_amount) > 0).reduce((s: number, m: any) => s + Number(m.signed_amount ?? 0), 0);
    const totalPaid = list.filter((m: any) => Number(m.signed_amount) < 0).reduce((s: number, m: any) => s + Math.abs(Number(m.signed_amount ?? 0)), 0);
    return { count: list.length, totalCreated, totalPaid, net: totalCreated - totalPaid };
  }, [filtered]);

  const { data: reconciliation, refetch: refetchRecon, isFetching: reconLoading } = useQuery({
    queryKey: ['debt-reconciliation'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_debt_reconciliation' as any).select('*').limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: false,
  });

  const exportCsv = () => {
    if (!filtered.length) { toast.error('لا توجد بيانات'); return; }
    const headers = ['التاريخ', 'النوع', 'المدين', 'الفرع', 'المبلغ', 'موقّع', 'رصيد الدين', 'طريقة الدفع', 'السبب', 'ملاحظات'];
    const lines = filtered.map((m: any) => [
      format(new Date(m.created_at), 'yyyy-MM-dd HH:mm'),
      m.movement_type,
      `${m.debtor_type}:${debtorName(m.debtor_type, m.debtor_id)}`,
      branchMap[m.branch_id] ?? '',
      m.amount, m.signed_amount ?? '', m.running_debt_balance ?? '',
      m.payment_method ?? '', m.reason ?? '',
      (m.notes ?? '').replace(/[\r\n,]/g, ' '),
    ].map(v => `"${String(v ?? '')}"`).join(','));
    const csv = '\ufeff' + headers.join(',') + '\n' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debt-ledger-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> سجل حركة الديون (Debt Ledger)</h1>
          <p className="text-sm text-muted-foreground">سجل تراكمي لكل حركات الديون (إنشاء، تسديد، شطب) مع رصيد الدين المتبقي</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 ml-2" /> تصدير CSV</Button>
          <LedgerAdminActions kind="debt" onDone={() => refetch()} showArchive={showArchive} onToggleArchive={() => setShowArchive(v => !v)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">عدد الحركات</div><div className="text-2xl font-bold">{stats.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي ديون مُنشأة</div><div className="text-2xl font-bold text-red-600">+{stats.totalCreated.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي مُسدّد</div><div className="text-2xl font-bold text-green-600">−{stats.totalPaid.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">صافي التغيّر</div><div className={`text-2xl font-bold ${stats.net <= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.net.toFixed(2)}</div></CardContent></Card>
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
          <div><Label className="text-xs">نوع المدين</Label>
            <Select value={debtorType} onValueChange={setDebtorType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="customer">زبون</SelectItem>
                <SelectItem value="worker">موظف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">الفرع</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">كل الفروع</SelectItem>{(branches ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">بحث</Label><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="مدين / سبب / ملاحظة" /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">سجل الحركات</TabsTrigger>
          <TabsTrigger value="reconciliation" onClick={() => refetchRecon()}>المطابقة (تباين الأرصدة)</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card><CardContent className="p-0 overflow-x-auto">
            {isLoading ? <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>التاريخ</TableHead><TableHead>النوع</TableHead>
                  <TableHead>المدين</TableHead><TableHead>الفرع</TableHead>
                  <TableHead className="text-center">المبلغ</TableHead>
                  <TableHead className="text-center">موقّع</TableHead>
                  <TableHead className="text-center">رصيد الدين</TableHead>
                  <TableHead>طريقة الدفع</TableHead><TableHead>السبب</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center p-8 text-muted-foreground">لا توجد حركات</TableCell></TableRow>
                  : filtered.map((m: any) => {
                    const signed = Number(m.signed_amount ?? 0);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(new Date(m.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell><Badge variant={typeColor(m.movement_type) as any}>{tr(DEBT_MOVEMENT_LABELS, m.movement_type)}</Badge></TableCell>
                        <TableCell className="text-xs"><div className="font-medium">{debtorName(m.debtor_type, m.debtor_id)}</div><div className="text-muted-foreground">{tr(DEBTOR_TYPE_LABELS, m.debtor_type)}</div></TableCell>
                        <TableCell className="text-xs">{branchMap[m.branch_id] ?? '—'}</TableCell>
                        <TableCell className="text-center font-mono">{Number(m.amount).toFixed(2)}</TableCell>
                        <TableCell className={`text-center font-mono font-bold ${signed > 0 ? 'text-red-600' : 'text-green-600'}`}>{signed > 0 ? '+' : ''}{signed.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono font-bold">{m.running_debt_balance != null ? Number(m.running_debt_balance).toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-xs">{tr(PAYMENT_METHOD_LABELS, m.payment_method)}</TableCell>
                        <TableCell className="text-xs">{tr(REASON_LABELS, m.reason)}</TableCell>
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
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> مطابقة الديون</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {reconLoading ? <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>المدين</TableHead><TableHead>النوع</TableHead>
                    <TableHead className="text-center">المتبقي الفعلي</TableHead>
                    <TableHead className="text-center">رصيد السجل</TableHead>
                    <TableHead className="text-center">الفرق</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {!reconciliation || reconciliation.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center p-8 text-muted-foreground">اضغط على التبويب لتحميل البيانات</TableCell></TableRow>
                    : (reconciliation as any[]).map((r: any, i: number) => {
                      const variance = Number(r.variance ?? 0);
                      return (
                        <TableRow key={i} className={Math.abs(variance) > 0.01 ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          <TableCell>{debtorName(r.debtor_type, r.debtor_id)}</TableCell>
                          <TableCell>{tr(DEBTOR_TYPE_LABELS, r.debtor_type)}</TableCell>
                          <TableCell className="text-center font-mono">{Number(r.actual_remaining ?? 0).toFixed(2)}</TableCell>
                          <TableCell className="text-center font-mono">{Number(r.ledger_balance ?? 0).toFixed(2)}</TableCell>
                          <TableCell className={`text-center font-mono font-bold ${Math.abs(variance) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>{variance.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
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

export default DebtLedger;
