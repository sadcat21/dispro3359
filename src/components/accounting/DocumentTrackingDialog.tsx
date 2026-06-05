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
import { FileStack, Inbox, CheckCircle2, Truck, ArrowLeft } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId?: string | null;
}

type Stage = 'pending' | 'received' | 'ready' | 'handed';
type DocType = 'check' | 'receipt' | 'transfer' | 'cash' | null;

interface Row {
  id: string;
  customerName: string;
  total: number;
  createdAt: string;
  stage: Stage;
  docType: DocType;
}

const DOC_TYPE_LABEL: Record<Exclude<DocType, null>, string> = {
  check: 'شيك',
  receipt: 'وصل دفع',
  transfer: 'تحويل',
  cash: 'نقدي',
};

const DOC_TYPE_CLASS: Record<Exclude<DocType, null>, string> = {
  check: 'bg-blue-100 text-blue-700 border-blue-200',
  receipt: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  transfer: 'bg-purple-100 text-purple-700 border-purple-200',
  cash: 'bg-amber-100 text-amber-700 border-amber-200',
};

const formatMoney = (n: number) => new Intl.NumberFormat('ar-DZ').format(n);

const NEXT_STAGE: Record<Exclude<Stage, 'handed'>, Stage> = {
  pending: 'received',
  received: 'ready',
  ready: 'handed',
};

const NEXT_LABEL: Record<Exclude<Stage, 'handed'>, string> = {
  pending: 'استلام',
  received: 'جاهزة',
  ready: 'تسليم',
};

const NEXT_ICON: Record<Exclude<Stage, 'handed'>, React.ReactNode> = {
  pending: <Inbox className="w-3 h-3" />,
  received: <CheckCircle2 className="w-3 h-3" />,
  ready: <Truck className="w-3 h-3" />,
};

const DocumentTrackingDialog: React.FC<Props> = ({ open, onOpenChange, branchId }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Exclude<Stage, 'handed'>>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invoicePrompt, setInvoicePrompt] = useState<Row | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['document-tracking', branchId],
    enabled: open && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, total_amount, created_at, document_stage, invoice_payment_method,
          customer:customers!orders_customer_id_fkey(name)
        `)
        .eq('branch_id', branchId!)
        .eq('payment_type', 'with_invoice')
        .in('document_stage', ['pending', 'received', 'ready'])
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).map((o: any): Row => ({
        id: o.id,
        customerName: o.customer?.name || '—',
        total: Number(o.total_amount || 0),
        createdAt: o.created_at,
        stage: (o.document_stage || 'pending') as Stage,
        docType: (o.invoice_payment_method || null) as DocType,
      }));
    },
  });

  const groups = useMemo(() => ({
    pending: rows.filter(r => r.stage === 'pending'),
    received: rows.filter(r => r.stage === 'received'),
    ready: rows.filter(r => r.stage === 'ready'),
  }), [rows]);

  const advance = async (row: Row, invoiceNo?: string) => {
    if (row.stage === 'handed') return;
    const next = NEXT_STAGE[row.stage];
    if (row.stage === 'ready' && !invoiceNo) {
      setInvoiceNumber('');
      setInvoicePrompt(row);
      return;
    }
    setBusyId(row.id);
    try {
      const updates: any = { document_stage: next };
      if (invoiceNo) updates.invoice_number = invoiceNo;
      const { data: updated, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', row.id)
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('لا تملك صلاحية تعديل هذه الوثيقة (RLS)');
      }
      toast({ title: 'تم التحديث', description: `الوثيقة انتقلت إلى: ${next === 'received' ? 'مستلمة' : next === 'ready' ? 'جاهزة' : 'مُسلَّمة'}` });
      await qc.invalidateQueries({ queryKey: ['document-tracking', branchId] });
      setInvoicePrompt(null);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('invoice_number_required')) {
        setInvoiceNumber('');
        setInvoicePrompt(row);
        toast({ title: 'مطلوب', description: 'يجب إدخال رقم الفاتورة قبل تسليم الوثيقة', variant: 'destructive' });
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

  const renderList = (list: Row[], emptyText: string) => {
    if (isLoading) return <p className="text-center text-sm text-muted-foreground py-6">جاري التحميل...</p>;
    if (list.length === 0) return <p className="text-center text-sm text-muted-foreground py-6">{emptyText}</p>;
    return (
      <div className="space-y-2">
        {list.map(r => {
          const stage = r.stage as Exclude<Stage, 'handed'>;
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-white border-slate-200">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setInvoiceNumber(''); setInvoicePrompt(r); }}
                    className="font-semibold text-sm text-slate-900 truncate hover:text-purple-600 hover:underline text-start"
                  >
                    {r.customerName}
                  </button>
                  {r.docType ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${DOC_TYPE_CLASS[r.docType]}`}>
                      {DOC_TYPE_LABEL[r.docType]}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200 shrink-0">
                      غير محدد
                    </span>
                  )}
                </div>
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
            <FileStack className="w-5 h-5 text-purple-600" />
            تتبع الوثائق
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="gap-1 text-xs">
              غير مستلمة
              <span className="ms-1 text-[10px] bg-amber-100 text-amber-700 rounded px-1">
                {groups.pending.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="received" className="gap-1 text-xs">
              مستلمة
              <span className="ms-1 text-[10px] bg-blue-100 text-blue-700 rounded px-1">
                {groups.received.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="ready" className="gap-1 text-xs">
              جاهزة
              <span className="ms-1 text-[10px] bg-emerald-100 text-emerald-700 rounded px-1">
                {groups.ready.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-3">
            {renderList(groups.pending, 'لا توجد وثائق غير مستلمة')}
          </TabsContent>
          <TabsContent value="received" className="mt-3">
            {renderList(groups.received, 'لا توجد وثائق مستلمة')}
          </TabsContent>
          <TabsContent value="ready" className="mt-3">
            {renderList(groups.ready, 'لا توجد وثائق جاهزة للتسليم')}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

      <Dialog open={!!invoicePrompt} onOpenChange={(o) => !o && setInvoicePrompt(null)}>
        <DialogContent className="max-w-sm !z-[10000]">
          <DialogHeader>
            <DialogTitle>رقم الفاتورة</DialogTitle>
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
    </>
  );
};

export default DocumentTrackingDialog;
