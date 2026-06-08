import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Stamp, CheckCircle2, Truck, ArrowLeft, Eraser } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId?: string | null;
}

type Stage = 'unsealed' | 'sealed' | 'ready' | 'delivered';

interface Row {
  id: string;
  customerName: string;
  total: number;
  createdAt: string;
  stage: Stage;
}

const formatMoney = (n: number) => new Intl.NumberFormat('ar-DZ').format(n);

const NEXT_STAGE: Record<Exclude<Stage, 'delivered'>, Stage> = {
  unsealed: 'sealed',
  sealed: 'ready',
  ready: 'delivered',
};

const NEXT_LABEL: Record<Exclude<Stage, 'delivered'>, string> = {
  unsealed: 'مَهر',
  sealed: 'جاهزة',
  ready: 'تسليم',
};

const NEXT_ICON: Record<Exclude<Stage, 'delivered'>, React.ReactNode> = {
  unsealed: <Stamp className="w-3 h-3" />,
  sealed: <CheckCircle2 className="w-3 h-3" />,
  ready: <Truck className="w-3 h-3" />,
};

const deferOpenInvoicePrompt = (openPrompt: () => void) => {
  window.setTimeout(openPrompt, 0);
};

const InvoiceTrackingDialog: React.FC<Props> = ({ open, onOpenChange, branchId }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Exclude<Stage, 'delivered'>>('unsealed');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invoicePrompt, setInvoicePrompt] = useState<Row | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const openInvoicePrompt = (row: Row) => {
    setInvoiceNumber('');
    deferOpenInvoicePrompt(() => setInvoicePrompt(row));
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['invoice-tracking', branchId],
    enabled: open && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, total_amount, created_at, invoice_stage,
          customer:customers!orders_customer_id_fkey(name)
        `)
        .eq('branch_id', branchId!)
        .eq('payment_type', 'with_invoice')
        .in('invoice_stage', ['unsealed', 'sealed', 'ready'])
        .not('invoice_manager_decision', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((o: any): Row => ({
        id: o.id,
        customerName: o.customer?.name || '—',
        total: Number(o.total_amount || 0),
        createdAt: o.created_at,
        stage: (o.invoice_stage || 'unsealed') as Stage,
      }));
    },
  });

  const groups = useMemo(() => ({
    unsealed: rows.filter(r => r.stage === 'unsealed'),
    sealed: rows.filter(r => r.stage === 'sealed'),
    ready: rows.filter(r => r.stage === 'ready'),
  }), [rows]);

  const advance = async (row: Row, invoiceNo?: string) => {
    if (row.stage === 'delivered') return;
    const next = NEXT_STAGE[row.stage];
    if (row.stage === 'ready' && !invoiceNo) {
      openInvoicePrompt(row);
      return;
    }
    setBusyId(row.id);
    try {
      const updates: any = { invoice_stage: next };
      if (invoiceNo) updates.invoice_number = invoiceNo;
      const { data: updated, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', row.id)
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('لا تملك صلاحية تعديل هذه الفاتورة (RLS)');
      }
      toast({ title: 'تم التحديث', description: `الفاتورة انتقلت إلى: ${next === 'sealed' ? 'ممهورة' : next === 'ready' ? 'جاهزة' : 'مُسلَّمة'}` });
      await qc.invalidateQueries({ queryKey: ['invoice-tracking', branchId] });
      setInvoicePrompt(null);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('invoice_number_required')) {
        openInvoicePrompt(row);
        toast({ title: 'مطلوب', description: 'يجب إدخال رقم الفاتورة قبل تسليم الفاتورة', variant: 'destructive' });
      } else {
        toast({ title: 'خطأ', description: msg || 'تعذّر التحديث', variant: 'destructive' });
      }
    } finally {
      setBusyId(null);
    }
  };

  const confirmInvoicePrompt = () => {
    const v = invoiceNumber.trim();
    if (!v) {
      toast({ title: 'مطلوب', description: 'يجب إدخال رقم الفاتورة', variant: 'destructive' });
      return;
    }
    if (invoicePrompt) advance(invoicePrompt, v);
  };

  const currentList = groups[tab];

  const handleClearCurrent = async () => {
    if (!currentList.length) { setConfirmClear(false); return; }
    setClearing(true);
    try {
      const ids = currentList.map(r => r.id);
      // 1) Fetch order statuses to separate cancelled from active
      const { data: ords, error: fetchErr } = await supabase
        .from('orders')
        .select('id, status')
        .in('id', ids);
      if (fetchErr) throw fetchErr;
      const cancelledIds = (ords || []).filter(o => o.status === 'cancelled').map(o => o.id);
      const activeIds = ids.filter(id => !cancelledIds.includes(id));

      // 2) For cancelled sales: delete invoice references entirely
      if (cancelledIds.length) {
        const { error: delErr } = await supabase
          .from('orders')
          .update({ invoice_stage: 'cancelled' as any, invoice_number: null })
          .in('id', cancelledIds);
        if (delErr) throw delErr;
      }
      // 3) For active orders: clear stage only (no false "delivered" assumption)
      if (activeIds.length) {
        const { error } = await supabase
          .from('orders')
          .update({ invoice_stage: null })
          .in('id', activeIds);
        if (error) throw error;
      }
      toast({ title: 'تم التفريغ', description: `تم تفريغ ${ids.length} فاتورة من السجل` });
      await qc.invalidateQueries({ queryKey: ['invoice-tracking', branchId] });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e?.message || 'تعذّر التفريغ', variant: 'destructive' });
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };



  const renderList = (list: Row[], emptyText: string) => {
    if (isLoading) return <p className="text-center text-sm text-muted-foreground py-6">جاري التحميل...</p>;
    if (list.length === 0) return <p className="text-center text-sm text-muted-foreground py-6">{emptyText}</p>;
    return (
      <div className="space-y-2">
        {list.map(r => {
          const stage = r.stage as Exclude<Stage, 'delivered'>;
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-white border-slate-200">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openInvoicePrompt(r);
                  }}
                  className="font-semibold text-sm text-slate-900 truncate hover:text-purple-600 hover:underline text-start cursor-pointer"
                >
                  {r.customerName}
                </button>
                <p className="text-[11px] text-slate-500">{new Date(r.createdAt).toLocaleDateString('ar-DZ')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-xs">{formatMoney(r.total)} دج</Badge>
                <Button
                  size="sm"
                  className="h-7 px-2 text-[11px] gap-1"
                  disabled={busyId === r.id}
                  onClick={() => advance(r)}
                >
                  {NEXT_ICON[stage]}
                  {NEXT_LABEL[stage]}
                  <ArrowLeft className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              تتبع الفواتير
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 me-6"
              disabled={!currentList.length || clearing}
              onClick={() => setConfirmClear(true)}
            >
              <Eraser className="w-3.5 h-3.5" />
              تفريغ السجل
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="unsealed" className="gap-1 text-xs">
              غير ممهورة
              <span className="ms-1 text-[10px] bg-amber-100 text-amber-700 rounded px-1">
                {groups.unsealed.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="sealed" className="gap-1 text-xs">
              ممهورة
              <span className="ms-1 text-[10px] bg-blue-100 text-blue-700 rounded px-1">
                {groups.sealed.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="ready" className="gap-1 text-xs">
              جاهزة
              <span className="ms-1 text-[10px] bg-emerald-100 text-emerald-700 rounded px-1">
                {groups.ready.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unsealed" className="mt-3">
            {renderList(groups.unsealed, 'لا توجد فواتير غير ممهورة')}
          </TabsContent>
          <TabsContent value="sealed" className="mt-3">
            {renderList(groups.sealed, 'لا توجد فواتير ممهورة')}
          </TabsContent>
          <TabsContent value="ready" className="mt-3">
            {renderList(groups.ready, 'لا توجد فواتير جاهزة للتسليم')}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

      <Dialog open={!!invoicePrompt} onOpenChange={(o) => !o && setInvoicePrompt(null)}>
        <DialogContent className="max-w-sm !z-[10000]">

          <DialogHeader>
            <DialogTitle>إدخال رقم الفاتورة</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">العميل: {invoicePrompt?.customerName}</Label>
            <Input
              autoFocus
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmInvoicePrompt(); }}
              placeholder="رقم الفاتورة (إلزامي)"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInvoicePrompt(null)}>إلغاء</Button>
            <Button onClick={confirmInvoicePrompt} disabled={!invoiceNumber.trim() || busyId === invoicePrompt?.id}>تأكيد التسليم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="!z-[100000] !pointer-events-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>تفريغ السجل</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم نقل {currentList.length} فاتورة من هذه القائمة إلى الحالة "مُسلَّمة" وإزالتها من تتبع الفواتير. هل تريد المتابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCurrent} disabled={clearing} className="bg-destructive hover:bg-destructive/90">
              تأكيد التفريغ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InvoiceTrackingDialog;
