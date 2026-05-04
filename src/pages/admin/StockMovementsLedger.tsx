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
import { Loader2, RefreshCw, Download, AlertTriangle, ArrowDownLeft, ArrowUpRight, Package } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LedgerAdminActions } from '@/components/admin/LedgerAdminActions';
import { STOCK_MOVEMENT_LABELS, LOCATION_TYPE_LABELS, REASON_LABELS, tr } from '@/lib/ledgerLabels';
import { getProductDisplayName } from '@/utils/productDisplayName';

const MOVEMENT_TYPES = [
  { value: 'all', label: 'كل الحركات' },
  { value: 'load', label: 'تحميل (load)' },
  { value: 'delivery', label: 'تسليم (delivery)' },
  { value: 'receipt', label: 'استلام (receipt)' },
  { value: 'return', label: 'إرجاع (return)' },
  { value: 'transfer_in', label: 'تحويل وارد' },
  { value: 'transfer_out', label: 'تحويل صادر' },
  { value: 'customer_return', label: 'مرتجع زبون' },
  { value: 'damage', label: 'تالف' },
  { value: 'exchange', label: 'استبدال' },
  { value: 'adjustment', label: 'تسوية جرد' },
];

const typeColor = (t: string) => {
  switch (t) {
    case 'load':
    case 'delivery':
    case 'transfer_out':
    case 'damage':
    case 'exchange':
      return 'destructive';
    case 'receipt':
    case 'return':
    case 'transfer_in':
    case 'customer_return':
      return 'default';
    case 'adjustment':
      return 'secondary';
    default:
      return 'outline';
  }
};

const StockMovementsLedger: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState<string>(weekAgo);
  const [to, setTo] = useState<string>(today);
  const [movementType, setMovementType] = useState<string>('all');
  const [productId, setProductId] = useState<string>('all');
  const [branchId, setBranchId] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [showArchive, setShowArchive] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('id, name').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, app_name').order('name').limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: workers } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workers').select('id, full_name').limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const productMap = useMemo(() => Object.fromEntries((products ?? []).map((p: any) => [p.id, getProductDisplayName(p)])), [products]);
  const branchMap = useMemo(() => Object.fromEntries((branches ?? []).map((b: any) => [b.id, b.name])), [branches]);
  const workerMap = useMemo(() => Object.fromEntries((workers ?? []).map((w: any) => [w.id, w.full_name])), [workers]);

  const { data: movements, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stock-movements-ledger', from, to, movementType, productId, branchId, showArchive],
    queryFn: async () => {
      const table = showArchive ? 'stock_movements_archive' : 'stock_movements';
      let q = supabase
        .from(table as any)
        .select('*')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (movementType !== 'all') q = q.eq('movement_type', movementType);
      if (productId !== 'all') q = q.eq('product_id', productId);
      if (branchId !== 'all') q = q.eq('branch_id', branchId);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return movements ?? [];
    const s = search.toLowerCase();
    return (movements ?? []).filter((m: any) => {
      const pname = productMap[m.product_id]?.toLowerCase() ?? '';
      const bname = branchMap[m.branch_id]?.toLowerCase() ?? '';
      const wname = workerMap[m.worker_id]?.toLowerCase() ?? '';
      return (
        pname.includes(s) ||
        bname.includes(s) ||
        wname.includes(s) ||
        (m.reason ?? '').toLowerCase().includes(s) ||
        (m.notes ?? '').toLowerCase().includes(s)
      );
    });
  }, [movements, search, productMap, branchMap, workerMap]);

  const stats = useMemo(() => {
    const list = filtered ?? [];
    const totalIn = list
      .filter((m: any) => Number(m.signed_quantity) > 0)
      .reduce((s: number, m: any) => s + Number(m.signed_quantity ?? 0), 0);
    const totalOut = list
      .filter((m: any) => Number(m.signed_quantity) < 0)
      .reduce((s: number, m: any) => s + Number(m.signed_quantity ?? 0), 0);
    return { count: list.length, totalIn, totalOut };
  }, [filtered]);

  const { data: reconciliation, refetch: refetchRecon, isFetching: reconLoading } = useQuery({
    queryKey: ['stock-reconciliation'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_stock_reconciliation' as any).select('*').limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: false,
  });

  const exportCsv = () => {
    const rows = filtered ?? [];
    if (!rows.length) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }
    const headers = ['التاريخ', 'النوع', 'المنتج', 'الفرع', 'الكمية', 'الكمية الموقعة', 'الرصيد التراكمي', 'السبب', 'من', 'إلى', 'الموظف', 'ملاحظات'];
    const lines = rows.map((m: any) => [
      format(new Date(m.created_at), 'yyyy-MM-dd HH:mm'),
      m.movement_type,
      productMap[m.product_id] ?? m.product_id,
      branchMap[m.branch_id] ?? m.branch_id ?? '',
      m.quantity,
      m.signed_quantity ?? '',
      m.running_balance ?? '',
      m.reason ?? '',
      m.from_location_type ?? '',
      m.to_location_type ?? '',
      workerMap[m.worker_id] ?? '',
      (m.notes ?? '').replace(/[\r\n,]/g, ' '),
    ].map(v => `"${String(v ?? '')}"`).join(','));
    const csv = '\ufeff' + headers.join(',') + '\n' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-movements-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            سجل حركات المخزون (Ledger)
          </h1>
          <p className="text-sm text-muted-foreground">فحص كامل لجميع حركات المخزون مع الرصيد التراكمي والمطابقة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 ml-2" /> تصدير CSV
          </Button>
          <LedgerAdminActions kind="stock" onDone={() => refetch()} showArchive={showArchive} onToggleArchive={() => setShowArchive(v => !v)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">عدد الحركات</div>
            <div className="text-2xl font-bold">{stats.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <ArrowDownLeft className="h-4 w-4 text-green-600" /> إجمالي الوارد
            </div>
            <div className="text-2xl font-bold text-green-600">+{stats.totalIn.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4 text-red-600" /> إجمالي الصادر
            </div>
            <div className="text-2xl font-bold text-red-600">{stats.totalOut.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">فلاتر البحث</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <Label className="text-xs">من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">نوع الحركة</Label>
            <Select value={movementType} onValueChange={setMovementType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">الفرع</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفروع</SelectItem>
                {(branches ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">المنتج</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">كل المنتجات</SelectItem>
                {(products ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{getProductDisplayName(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">بحث نصي</Label>
            <Input placeholder="منتج / فرع / موظف / سبب..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">سجل الحركات</TabsTrigger>
          <TabsTrigger value="reconciliation" onClick={() => refetchRecon()}>المطابقة (تباين الرصيد)</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>المنتج</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">موقّعة</TableHead>
                      <TableHead className="text-center">الرصيد التراكمي</TableHead>
                      <TableHead>من → إلى</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead>الموظف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground p-8">لا توجد حركات</TableCell></TableRow>
                    ) : filtered.map((m: any) => {
                      const signed = Number(m.signed_quantity ?? 0);
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(m.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                          <TableCell><Badge variant={typeColor(m.movement_type) as any}>{tr(STOCK_MOVEMENT_LABELS, m.movement_type)}</Badge></TableCell>
                          <TableCell className="max-w-[180px] truncate">{productMap[m.product_id] ?? '—'}</TableCell>
                          <TableCell>{branchMap[m.branch_id] ?? '—'}</TableCell>
                          <TableCell className="text-center font-mono">{Number(m.quantity).toFixed(2)}</TableCell>
                          <TableCell className={`text-center font-mono font-bold ${signed > 0 ? 'text-green-600' : signed < 0 ? 'text-red-600' : ''}`}>
                            {signed > 0 ? '+' : ''}{signed.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center font-mono">{m.running_balance != null ? Number(m.running_balance).toFixed(2) : '—'}</TableCell>
                          <TableCell className="text-xs">
                            {tr(LOCATION_TYPE_LABELS, m.from_location_type)} → {tr(LOCATION_TYPE_LABELS, m.to_location_type)}
                          </TableCell>
                          <TableCell className="text-xs">{tr(REASON_LABELS, m.reason)}</TableCell>
                          <TableCell className="text-xs">{workerMap[m.worker_id] ?? workerMap[m.created_by] ?? '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                مطابقة المخزون مقابل سجل الحركات
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {reconLoading ? (
                <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>الموقع</TableHead>
                      <TableHead className="text-center">الرصيد الفعلي</TableHead>
                      <TableHead className="text-center">رصيد السجل</TableHead>
                      <TableHead className="text-center">الفرق</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!reconciliation || reconciliation.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground p-8">
                        اضغط على التبويب لتحميل البيانات. النتيجة الفارغة = ✅ كل شيء مطابق.
                      </TableCell></TableRow>
                    ) : (reconciliation as any[]).map((r: any, idx: number) => (
                      <TableRow key={idx} className={Math.abs(Number(r.variance ?? 0)) > 0.001 ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                        <TableCell>{productMap[r.product_id] ?? r.product_id}</TableCell>
                        <TableCell className="text-xs">{r.location_type} / {branchMap[r.location_id] ?? workerMap[r.location_id] ?? r.location_id}</TableCell>
                        <TableCell className="text-center font-mono">{Number(r.actual_quantity ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono">{Number(r.ledger_balance ?? 0).toFixed(2)}</TableCell>
                        <TableCell className={`text-center font-mono font-bold ${Math.abs(Number(r.variance ?? 0)) > 0.001 ? 'text-red-600' : 'text-green-600'}`}>
                          {Number(r.variance ?? 0).toFixed(2)}
                        </TableCell>
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

export default StockMovementsLedger;
