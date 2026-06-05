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
import { ClipboardList, Stamp, CheckCircle2, Truck, ArrowLeft } from 'lucide-react';

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

const InvoiceTrackingDialog: React.FC<Props> = ({ open, onOpenChange, branchId }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Exclude<Stage, 'delivered'>>('unsealed');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invoicePrompt, setInvoicePrompt] = useState<Row | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');

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
      setInvoiceNumber('');
      setInvoicePrompt(row);
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
      toast({ title: 'خطأ', description: e?.message || 'تعذّر التحديث', variant: 'destructive' });
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
                <p className="font-semibold text-sm text-slate-900 truncate">{r.customerName}</p>
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
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            تتبع الفواتير
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

      <Dialog open={!!invoicePrompt} onOpenChange={(o) => !o && setInvoicePrompt(null)}>
        <DialogContent className="max-w-sm">
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
    </Dialog>
  );
};

export default InvoiceTrackingDialog;
