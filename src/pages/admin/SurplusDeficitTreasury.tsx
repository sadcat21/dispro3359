import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, differenceInDays } from 'date-fns';
import { ArrowUpCircle, ArrowDownCircle, Package, Banknote, TrendingUp, TrendingDown, Users, Settings as SettingsIcon, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isAdminRole } from '@/lib/utils';
import {
  useTreasuryToleranceSettings,
  useUpdateToleranceSettings,
  useResolveTreasuryEntry,
  useApproveTreasuryEntry,
} from '@/hooks/useTreasuryTolerance';

const fmt = (n: number) => n.toLocaleString();

const STATUS_LABELS: Record<string, { ar: string; cls: string }> = {
  open: { ar: 'مفتوح', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  under_review: { ar: 'قيد المراجعة', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  settled: { ar: 'مغلق', cls: 'bg-green-100 text-green-800 border-green-300' },
  written_off: { ar: 'مشطوب', cls: 'bg-slate-200 text-slate-800 border-slate-300' },
  transferred_to_debt: { ar: 'محوّل لدين عامل', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
};

const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = STATUS_LABELS[status || 'open'] || STATUS_LABELS.open;
  return <Badge variant="outline" className={`text-[10px] ${s.cls}`}>{s.ar}</Badge>;
};

const ageBand = (createdAt: string): { label: string; days: number } => {
  const days = differenceInDays(new Date(), new Date(createdAt));
  if (days <= 30) return { label: '0-30 يوم', days };
  if (days <= 60) return { label: '31-60 يوم', days };
  if (days <= 90) return { label: '61-90 يوم', days };
  return { label: '+90 يوم', days };
};

// ───────────── Resolve dialog ─────────────
const ResolveDialog: React.FC<{
  entry: any | null;
  onClose: () => void;
}> = ({ entry, onClose }) => {
  const { workerId } = useAuth();
  const resolve = useResolveTreasuryEntry();
  const [resolution, setResolution] = useState<'manager_approved_writeoff' | 'worker_debt' | 'investigation'>('manager_approved_writeoff');
  const [notes, setNotes] = useState('');

  if (!entry) return null;

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية القيد ({fmt(Number(entry.amount))} DA)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>القرار</Label>
            <Select value={resolution} onValueChange={(v: any) => setResolution(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager_approved_writeoff">شطب باعتماد المدير</SelectItem>
                <SelectItem value="worker_debt">تحويل لدين العامل</SelectItem>
                <SelectItem value="investigation">إحالة للتحقيق</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المبرر / الملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="اكتب سبب القرار..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            disabled={resolve.isPending}
            onClick={async () => {
              await resolve.mutateAsync({
                id: entry.id,
                resolution_type: resolution,
                resolution_notes: notes || undefined,
                resolver_user_id: workerId || null,
              });
              onClose();
            }}
          >
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ───────────── Approve dialog (admin four-eyes) ─────────────
const ApproveDialog: React.FC<{ entry: any | null; onClose: () => void }> = ({ entry, onClose }) => {
  const approve = useApproveTreasuryEntry();
  const [decision, setDecision] = useState<'manager_approved_writeoff' | 'worker_debt' | 'investigation'>('manager_approved_writeoff');
  const [notes, setNotes] = useState('');

  if (!entry) return null;
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>اعتماد القيد ({fmt(Number(entry.amount))} DA)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            بصفتك مديرًا، يمكنك اعتماد القرار النهائي على هذا القيد. لا يمكن اعتماد قيد أنشأته بنفسك.
          </p>
          <div>
            <Label>القرار</Label>
            <Select value={decision} onValueChange={(v: any) => setDecision(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager_approved_writeoff">شطب باعتماد المدير</SelectItem>
                <SelectItem value="worker_debt">تحويل لدين العامل</SelectItem>
                <SelectItem value="investigation">إحالة للتحقيق</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>مبرر الاعتماد</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            disabled={approve.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={async () => {
              await approve.mutateAsync({ id: entry.id, decision, notes: notes || undefined });
              onClose();
            }}
          >
            اعتماد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ───────────── Tolerance settings dialog ─────────────
const ToleranceDialog: React.FC<{ open: boolean; onClose: () => void; branchId?: string | null }> = ({ open, onClose, branchId }) => {
  const { data: settings } = useTreasuryToleranceSettings(branchId);
  const update = useUpdateToleranceSettings();
  const [form, setForm] = useState({
    cash_tolerance_amount: 0,
    cash_tolerance_pct: 0,
    auto_writeoff_below_amount: 0,
    require_approval_above_amount: 0,
    default_due_days: 30,
  });

  React.useEffect(() => {
    if (settings) setForm({
      cash_tolerance_amount: Number(settings.cash_tolerance_amount),
      cash_tolerance_pct: Number(settings.cash_tolerance_pct),
      auto_writeoff_below_amount: Number(settings.auto_writeoff_below_amount),
      require_approval_above_amount: Number(settings.require_approval_above_amount),
      default_due_days: Number(settings.default_due_days),
    });
  }, [settings]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>إعدادات حدود التسامح</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>حد الشطب التلقائي (أي فرق أقل أو يساوي → يُغلق تلقائيًا)</Label>
            <Input type="number" value={form.auto_writeoff_below_amount}
              onChange={(e) => setForm({ ...form, auto_writeoff_below_amount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>حد إلزام الاعتماد (فوقه يدخل القيد قيد المراجعة)</Label>
            <Input type="number" value={form.require_approval_above_amount}
              onChange={(e) => setForm({ ...form, require_approval_above_amount: Number(e.target.value) })} />
          </div>
          <div>
            <Label>الموعد الافتراضي للإغلاق (أيام)</Label>
            <Input type="number" value={form.default_due_days}
              onChange={(e) => setForm({ ...form, default_due_days: Number(e.target.value) })} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            هذه الإعدادات تنطبق على القيود الجديدة في خزينة العجز والفائض. القيود الحالية لا تتأثر.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button disabled={!settings || update.isPending} onClick={async () => {
            if (!settings) return;
            await update.mutateAsync({ id: settings.id, ...form });
            onClose();
          }}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ───────────── Page ─────────────
const SurplusDeficitTreasury: React.FC = () => {
  const { activeBranch, role, workerId } = useAuth();
  const { dir, t } = useLanguage();
  const isAdmin = isAdminRole(role);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'settled'>('open');
  const [resolveTarget, setResolveTarget] = useState<any | null>(null);
  const [approveTarget, setApproveTarget] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const { data: cashEntries = [] } = useQuery({
    queryKey: ['surplus-deficit-cash', activeBranch?.id],
    queryFn: async () => {
      let q = supabase.from('manager_treasury').select('*')
        .in('source_type', ['accounting_surplus', 'accounting_deficit'])
        .order('created_at', { ascending: false });
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: customerSurplusEntries = [] } = useQuery({
    queryKey: ['surplus-deficit-customer', activeBranch?.id],
    queryFn: async () => {
      let q = supabase.from('manager_treasury').select('*')
        .eq('source_type', 'customer_surplus').order('created_at', { ascending: false });
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stockEntries = [] } = useQuery({
    queryKey: ['surplus-deficit-stock', activeBranch?.id],
    queryFn: async () => {
      let q = supabase.from('stock_discrepancies')
        .select('*, product:products(name), worker:workers(full_name)')
        .order('created_at', { ascending: false });
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Filter helpers
  const filterByStatus = (rows: any[]) => {
    if (statusFilter === 'all') return rows;
    if (statusFilter === 'open') return rows.filter((r) => ['open', 'under_review'].includes(r.status || 'open'));
    return rows.filter((r) => ['settled', 'written_off', 'transferred_to_debt'].includes(r.status || ''));
  };

  const cashRows = filterByStatus(cashEntries);
  const custRows = filterByStatus(customerSurplusEntries);

  const totalCashSurplus = cashEntries.filter((e: any) => e.source_type === 'accounting_surplus').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalCashDeficit = cashEntries.filter((e: any) => e.source_type === 'accounting_deficit').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalCustomerSurplus = customerSurplusEntries.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalStockSurplus = stockEntries.filter((e: any) => e.discrepancy_type === 'surplus').reduce((s: number, e: any) => s + Number(e.monetary_value || 0), 0);
  const totalStockDeficit = stockEntries.filter((e: any) => e.discrepancy_type === 'deficit').reduce((s: number, e: any) => s + Number(e.monetary_value || 0), 0);

  // Aging report (open cash entries only)
  const aging = useMemo(() => {
    const openCash = cashEntries.filter((e: any) => ['open', 'under_review'].includes(e.status || 'open'));
    const groups: Record<string, { count: number; total: number }> = {
      '0-30 يوم': { count: 0, total: 0 },
      '31-60 يوم': { count: 0, total: 0 },
      '61-90 يوم': { count: 0, total: 0 },
      '+90 يوم': { count: 0, total: 0 },
    };
    openCash.forEach((e: any) => {
      const b = ageBand(e.created_at).label;
      groups[b].count += 1;
      groups[b].total += Number(e.amount || 0);
    });
    return groups;
  }, [cashEntries]);

  return (
    <div className="p-4 space-y-4" dir={dir}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('surplus.title')}</h2>
        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5">
          <SettingsIcon className="w-4 h-4" /> إعدادات التسامح
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-xs font-bold text-green-800 dark:text-green-300">{t('surplus.total_surplus')}</span>
          </div>
          <p className="text-lg font-bold text-green-700 dark:text-green-400">{fmt(totalCashSurplus + totalStockSurplus + totalCustomerSurplus)} DA</p>
        </div>
        <div className="rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-5 h-5 text-destructive" />
            <span className="text-xs font-bold text-red-800 dark:text-red-300">{t('surplus.total_deficit')}</span>
          </div>
          <p className="text-lg font-bold text-destructive">{fmt(totalCashDeficit + totalStockDeficit)} DA</p>
        </div>
      </div>

      {/* Aging report */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">أعمار القيود المفتوحة (نقدي)</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(aging).map(([band, v]) => (
            <div key={band} className="rounded-lg border p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{band}</p>
              <p className="text-sm font-bold">{v.count}</p>
              <p className="text-[10px] text-muted-foreground">{fmt(v.total)} DA</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">عرض:</span>
        {(['open', 'all', 'settled'] as const).map((f) => (
          <Button key={f} size="sm" variant={statusFilter === f ? 'default' : 'outline'} onClick={() => setStatusFilter(f)}>
            {f === 'open' ? 'المفتوحة' : f === 'all' ? 'الكل' : 'المغلقة'}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="cash" dir={dir}>
        <TabsList className="w-full">
          <TabsTrigger value="cash" className="flex-1 gap-1.5"><Banknote className="w-4 h-4" />{t('surplus.treasury_tab')}</TabsTrigger>
          <TabsTrigger value="customers" className="flex-1 gap-1.5"><Users className="w-4 h-4" />{t('surplus.customer_surplus_tab')}</TabsTrigger>
          <TabsTrigger value="stock" className="flex-1 gap-1.5"><Package className="w-4 h-4" />{t('surplus.stock_tab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="cash">
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 mt-2">
              {cashRows.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">{t('surplus.no_records')}</p>}
              {cashRows.map((entry: any) => {
                const isSurplus = entry.source_type === 'accounting_surplus';
                const canResolve = ['open', 'under_review'].includes(entry.status || 'open');
                return (
                  <div key={entry.id} className={`rounded-xl border p-3 ${isSurplus ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' : 'border-red-200 bg-red-50/50 dark:bg-red-900/10'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isSurplus ? <ArrowUpCircle className="w-4 h-4 text-green-600" /> : <ArrowDownCircle className="w-4 h-4 text-destructive" />}
                        <span className={`text-sm font-bold ${isSurplus ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
                          {isSurplus ? t('surplus.surplus_word') : t('surplus.deficit_word')} {fmt(Number(entry.amount))} DA
                        </span>
                        <StatusBadge status={entry.status} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
                    {entry.resolution_notes && <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-1">قرار: {entry.resolution_notes}</p>}
                    {entry.due_date && canResolve && (
                      <p className="text-[10px] text-amber-700 mt-1">موعد الإغلاق: {format(new Date(entry.due_date), 'dd/MM/yyyy')}</p>
                    )}
                    {canResolve && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setResolveTarget(entry)}>
                          <CheckCircle2 className="w-3 h-3" /> تسوية
                        </Button>
                        {isAdmin && entry.manager_id !== workerId && (
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setApproveTarget(entry)}
                          >
                            <ShieldCheck className="w-3 h-3" /> اعتماد
                          </Button>
                        )}
                        {isAdmin && entry.manager_id === workerId && (
                          <span className="text-[10px] text-muted-foreground self-center">لا يمكنك اعتماد قيد أنشأته</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="customers">
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 mt-2">
              {custRows.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">{t('surplus.no_customer_surplus')}</p>}
              {custRows.map((entry: any) => (
                <div key={entry.id} className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                        {t('surplus.customer_surplus')} {fmt(Number(entry.amount))} DA
                      </span>
                      <StatusBadge status={entry.status} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                  {entry.customer_name && <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">{entry.customer_name}</p>}
                  {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="stock">
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 mt-2">
              {stockEntries.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">{t('surplus.no_records')}</p>}
              {stockEntries.map((entry: any) => {
                const isSurplus = entry.discrepancy_type === 'surplus';
                return (
                  <div key={entry.id} className={`rounded-xl border p-3 ${isSurplus ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' : 'border-red-200 bg-red-50/50 dark:bg-red-900/10'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isSurplus ? <ArrowUpCircle className="w-4 h-4 text-green-600" /> : <ArrowDownCircle className="w-4 h-4 text-destructive" />}
                        <span className={`text-sm font-bold ${isSurplus ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
                          {isSurplus ? t('surplus.surplus_word') : t('surplus.deficit_word')} - {(entry.product as any)?.name || ''}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                      <span>{t('surplus.quantity')} {Number(entry.quantity)} • {(entry.worker as any)?.full_name || ''}</span>
                      {entry.monetary_value > 0 && <span className="font-medium">{fmt(Number(entry.monetary_value))} DA</span>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block ${entry.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {entry.status === 'resolved' ? t('surplus.resolved') : t('surplus.pending')}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <ResolveDialog entry={resolveTarget} onClose={() => setResolveTarget(null)} />
      <ToleranceDialog open={showSettings} onClose={() => setShowSettings(false)} branchId={activeBranch?.id} />
    </div>
  );
};

export default SurplusDeficitTreasury;
