import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, FileCheck2, FileWarning, Receipt, Inbox } from 'lucide-react';
import DocCollectDialog from '@/components/documents/DocCollectDialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId?: string | null;
}

type Bucket = 'invoice_no_doc' | 'doc_no_invoice' | 'both';
type DocType = 'check' | 'receipt' | 'transfer' | null;

interface Row {
  id: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  createdAt: string;
  bucket: Bucket;
  documentStatus: string | null;
  documentType: DocType;
  invoiceReceivedAt: string | null;
  unloadConfirmedAt: string | null;
}

const formatMoney = (n: number) => new Intl.NumberFormat('ar-DZ').format(n);

const DOC_TYPE_META: Record<Exclude<DocType, null>, { label: string; cls: string }> = {
  check:    { label: 'Chèque',   cls: 'bg-red-100 text-red-700 border-red-200' },
  receipt:  { label: 'Versement', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  transfer: { label: 'Virement', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const Invoice1StatusDialog: React.FC<Props> = ({ open, onOpenChange, branchId }) => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Bucket>('invoice_no_doc');
  const [collectFor, setCollectFor] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['invoice1-status', branchId],
    enabled: open && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, total_amount, created_at, document_status, document_verification,
          invoice_received_at, invoice_payment_method, assigned_worker_id,
          customer:customers!orders_customer_id_fkey(name, phone)
        `)
        .eq('branch_id', branchId!)
        .eq('status', 'delivered')
        .eq('payment_type', 'with_invoice')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const { data: sessions } = await supabase
        .from('accounting_sessions')
        .select('worker_id, period_start, period_end, unload_confirmed, unload_confirmed_at')
        .eq('branch_id', branchId!)
        .eq('unload_confirmed', true)
        .order('unload_confirmed_at', { ascending: false });

      const sessionList = (sessions || []) as Array<{
        worker_id: string; period_start: string; period_end: string;
        unload_confirmed_at: string | null;
      }>;

      const findUnloadAt = (workerId: string | null, createdAt: string): string | null => {
        if (!workerId) return null;
        const t = new Date(createdAt).getTime();
        const match = sessionList.find(s =>
          s.worker_id === workerId &&
          t >= new Date(s.period_start).getTime() &&
          t <= new Date(s.period_end).getTime()
        );
        return match?.unload_confirmed_at || null;
      };

      const mapped: Row[] = (data || []).map((o: any) => {
        const dv = (o.document_verification && typeof o.document_verification === 'object')
          ? o.document_verification : {};
        const docReceived = o.document_status === 'received';
        const invoiceReceived = !!o.invoice_received_at;
        const attached = dv.attached_to_invoice === true;

        let bucket: Bucket;
        if (attached || (docReceived && invoiceReceived)) bucket = 'both';
        else if (invoiceReceived && !docReceived) bucket = 'invoice_no_doc';
        else if (docReceived && !invoiceReceived) bucket = 'doc_no_invoice';
        else bucket = 'invoice_no_doc';

        const ipm = o.invoice_payment_method;
        const documentType: DocType = (ipm === 'check' || ipm === 'receipt' || ipm === 'transfer') ? ipm : null;

        return {
          id: o.id,
          customerName: o.customer?.name || '—',
          customerPhone: o.customer?.phone || null,
          total: Number(o.total_amount || 0),
          createdAt: o.created_at,
          bucket,
          documentStatus: o.document_status,
          documentType,
          invoiceReceivedAt: o.invoice_received_at,
          unloadConfirmedAt: findUnloadAt(o.assigned_worker_id, o.created_at),
        };
      });

      mapped.sort((a, b) => {
        if (a.unloadConfirmedAt && b.unloadConfirmedAt) {
          return new Date(b.unloadConfirmedAt).getTime() - new Date(a.unloadConfirmedAt).getTime();
        }
        if (a.unloadConfirmedAt) return -1;
        if (b.unloadConfirmedAt) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return mapped;
    },
  });

  const groups = useMemo(() => ({
    invoice_no_doc: rows.filter(r => r.bucket === 'invoice_no_doc'),
    doc_no_invoice: rows.filter(r => r.bucket === 'doc_no_invoice'),
    both: rows.filter(r => r.bucket === 'both'),
  }), [rows]);

  const renderList = (list: Row[], emptyText: string, showReceiveAction = false) => {
    if (isLoading) return <p className="text-center text-sm text-muted-foreground py-6">جاري التحميل...</p>;
    if (list.length === 0) return <p className="text-center text-sm text-muted-foreground py-6">{emptyText}</p>;
    return (
      <div className="space-y-2">
        {list.map(r => {
          const meta = r.documentType ? DOC_TYPE_META[r.documentType] : null;
          return (
            <div key={r.id} className={`flex items-center justify-between gap-2 p-3 rounded-lg border bg-white ${r.unloadConfirmedAt ? 'border-emerald-300' : 'border-slate-200'}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-slate-900 truncate">{r.customerName}</p>
                  {meta && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.cls}`}>
                      {meta.label}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {new Date(r.createdAt).toLocaleDateString('ar-DZ')}
                  {r.unloadConfirmedAt && <span className="ms-2 text-emerald-600">• مؤكَّد في الجلسة</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-xs">{formatMoney(r.total)} دج</Badge>
                {showReceiveAction && r.documentType && (
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[11px] gap-1"
                    onClick={() => setCollectFor(r)}
                  >
                    <Inbox className="w-3 h-3" />
                    استلام الوثيقة
                  </Button>
                )}
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
              <Receipt className="w-5 h-5 text-blue-600" />
              حالة فاتورة 1 والوثائق
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as Bucket)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="invoice_no_doc" className="gap-1 text-xs">
                <FileWarning className="w-3.5 h-3.5" />
                فاتورة بدون وثيقة
                <span className="ms-1 text-[10px] bg-amber-100 text-amber-700 rounded px-1">
                  {groups.invoice_no_doc.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="doc_no_invoice" className="gap-1 text-xs">
                <FileText className="w-3.5 h-3.5" />
                وثيقة بدون فاتورة
                <span className="ms-1 text-[10px] bg-rose-100 text-rose-700 rounded px-1">
                  {groups.doc_no_invoice.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="both" className="gap-1 text-xs">
                <FileCheck2 className="w-3.5 h-3.5" />
                فاتورة مع وثيقة
                <span className="ms-1 text-[10px] bg-emerald-100 text-emerald-700 rounded px-1">
                  {groups.both.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invoice_no_doc" className="mt-3">
              {renderList(groups.invoice_no_doc, 'لا توجد فواتير بدون وثائق', true)}
            </TabsContent>
            <TabsContent value="doc_no_invoice" className="mt-3">
              {renderList(groups.doc_no_invoice, 'لا توجد وثائق بدون فواتير ممهورة')}
            </TabsContent>
            <TabsContent value="both" className="mt-3">
              {renderList(groups.both, 'لا توجد فواتير مكتملة')}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {collectFor && collectFor.documentType && (
        <DocCollectDialog
          open={!!collectFor}
          onOpenChange={(v) => {
            if (!v) {
              const wasOpen = !!collectFor;
              setCollectFor(null);
              if (wasOpen) {
                qc.invalidateQueries({ queryKey: ['invoice1-status', branchId] });
                setTab('both');
              }
            }
          }}
          orderId={collectFor.id}
          customerName={collectFor.customerName}
          customerPhone={collectFor.customerPhone}
          documentType={collectFor.documentType}
          totalAmount={collectFor.total}
        />
      )}
    </>
  );
};

export default Invoice1StatusDialog;
