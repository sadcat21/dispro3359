import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileCheck2, Truck, Clock, ShieldCheck, ShieldAlert, AlertCircle, ClipboardCheck, Stamp, CheckCircle, XCircle, Package, ImageIcon, Gift, Paperclip } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DocumentFlowDialog from '@/components/documents/DocumentFlowDialog';
import { toast } from 'sonner';

interface StampedInvoice {
  orderId: string;
  customerName: string;
  storeName: string | null;
  customerPhone: string | null;
  orderTotal: number;
  paymentMethod: string;
  bucket: 'cash' | 'doc' | null;
  received: boolean;
  receivedAt: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  documentVerification: any;
  documentStatus: string | null;
}

interface DocumentCollectionsSummaryProps {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  receivedDocs?: Record<string, boolean>;
  onReceivedDocsChange?: (docs: Record<string, boolean>) => void;
}

interface CollectedDoc {
  orderId: string;
  customerName: string;
  documentType: string;
  orderTotal: number;
  source: 'delivery' | 'pending_collection';
  documentStatus: string | null;
  verification: {
    checkNumber?: string;
    checkDate?: string;
    checkBank?: string;
    receiptNumber?: string;
    transferReference?: string;
    verified?: boolean;
    verifiedFields?: number;
    totalFields?: number;
  };
}

const fmt = (n: number) => n.toLocaleString();
const extractDate = (v: string): string => v.replace('T', ' ').substring(0, 10);

const docTypeLabel = (t: string) => {
  const map: Record<string, string> = { check: 'Chèque', receipt: 'Versement', transfer: 'Virement', versement: 'Versement', virement: 'Virement' };
  return map[t] || t;
};

const stampedMethodLabel = (method: string, bucket: 'cash' | 'doc' | null): string => {
  const m = (method || '').toLowerCase();
  if (m === 'check') return 'Chèque';
  if (m === 'cash') return 'كاش';
  if (m === 'receipt' || m === 'versement') return bucket === 'cash' ? 'Versement Cash' : 'Versement Doc';
  if (m === 'transfer' || m === 'virement') return bucket === 'cash' ? 'Virement Cash' : 'Virement Doc';
  return m;
};

const docTypeColor = (t: string) => {
  switch (t) {
    case 'check': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'receipt': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    default: return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
  }
};

const docStatusLabel = (s: string | null) => {
  const map: Record<string, string> = { none: 'غير مطلوب', pending: 'معلق', collected: 'تم الاستلام', verified: 'تم التحقق' };
  return map[s || 'none'] || s || 'غير محدد';
};

const parseVerification = (v: any, docType: string) => {
  if (!v || typeof v !== 'object') return { verifiedFields: 0, totalFields: 0 };
  
  let totalFields = 0;
  let verifiedFields = 0;

  const checkField = (val: any) => {
    totalFields++;
    if (val && val !== '' && val !== null && val !== undefined) verifiedFields++;
  };

  if (docType === 'check') {
    checkField(v.check_number || v.checkNumber);
    checkField(v.check_date || v.checkDate);
    checkField(v.check_bank || v.checkBank);
    checkField(v.check_amount || v.checkAmount || v.amount);
  } else if (docType === 'receipt' || docType === 'versement') {
    checkField(v.receipt_number || v.receiptNumber);
    checkField(v.receipt_amount || v.amount);
  } else if (docType === 'transfer' || docType === 'virement') {
    checkField(v.transfer_reference || v.transferReference);
    checkField(v.transfer_amount || v.amount);
  }

  return {
    checkNumber: v.check_number || v.checkNumber,
    checkDate: v.check_date || v.checkDate,
    checkBank: v.check_bank || v.checkBank,
    receiptNumber: v.receipt_number || v.receiptNumber,
    transferReference: v.transfer_reference || v.transferReference,
    verified: totalFields > 0 && verifiedFields === totalFields,
    verifiedFields,
    totalFields,
  };
};

const isCollectedDuringDelivery = (order: any) => {
  const status = String(order?.document_status || '').toLowerCase();
  const verification = order?.document_verification;
  const method = String(order?.invoice_payment_method || '').toLowerCase();

  if (status === 'received' || status === 'verified') return true;
  if (status !== 'pending' || !verification || typeof verification !== 'object') return false;
  if ((verification as any).status === 'not_received') return false;

  if (method === 'check') return true;
  if (method === 'receipt' || method === 'versement') {
    return (verification as any).receipt_received === true || !!((verification as any).receipt_number || (verification as any).receiptNumber);
  }
  if (method === 'transfer' || method === 'virement') {
    return (verification as any).receipt_received === true || !!((verification as any).transfer_reference || (verification as any).transferReference);
  }

  return false;
};

const DocumentCollectionsSummary: React.FC<DocumentCollectionsSummaryProps> = ({ workerId, periodStart, periodEnd, receivedDocs, onReceivedDocsChange }) => {
  const queryClient = useQueryClient();
  const [verifyDoc, setVerifyDoc] = useState<CollectedDoc | null>(null);
  const [stampDialog, setStampDialog] = useState<StampedInvoice | null>(null);
  const [stampInvoiceNumber, setStampInvoiceNumber] = useState('');
  const [stampIssueDate, setStampIssueDate] = useState('');
  const [stampSaving, setStampSaving] = useState(false);
  const [docDialog, setDocDialog] = useState<CollectedDoc | null>(null);
  const [docSaving, setDocSaving] = useState(false);
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState('');
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (docDialog) {
      const v = docDialog.verification || {};
      const t = docDialog.documentType;
      if (t === 'check') {
        setDocNumber(v.checkNumber || '');
        setDocDate(v.checkDate || '');
      } else {
        setDocNumber(v.receiptNumber || v.transferReference || '');
        setDocDate('');
      }
    }
  }, [docDialog]);

  const docNumberLabel = (t: string) =>
    t === 'check' ? 'رقم الشيك' : (t === 'transfer' || t === 'virement') ? 'رقم الوصل' : 'رقم الوصل';
  const docDateLabel = (t: string) =>
    t === 'check' ? 'تاريخ سحب الشيك' : 'تاريخ الدفع';

  const { data: orderDetailsItems, isLoading: orderDetailsLoading } = useQuery({
    queryKey: ['order-details-items', detailsOrderId],
    enabled: !!detailsOrderId,
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select('id, quantity, gift_quantity, gift_pieces, pricing_unit, product:products(id, name, image_url, product_code)')
        .eq('order_id', detailsOrderId!);
      return data || [];
    },
  });

  useEffect(() => {
    if (stampDialog) {
      setStampInvoiceNumber(stampDialog.invoiceNumber || '');
      setStampIssueDate(stampDialog.issueDate || new Date().toISOString().substring(0, 10));
    }
  }, [stampDialog]);

  const handleConfirmStamp = async () => {
    if (!stampDialog) return;
    if (!stampInvoiceNumber.trim() || !stampIssueDate) {
      toast.error('يرجى إدخال رقم الفاتورة وتاريخ إصدارها');
      return;
    }
    setStampSaving(true);
    const { data, error } = await (supabase as any).rpc('confirm_order_invoice_receipt', {
      p_order_id: stampDialog.orderId,
      p_invoice_number: stampInvoiceNumber.trim(),
      p_issue_date: stampIssueDate,
    });
    setStampSaving(false);
    if (error) {
      console.error('[stamp confirm] rpc error', error);
      const msg = String(error.message || '');
      if (msg.includes('permission_denied')) {
        toast.error('لا تملك صلاحية تأكيد استلام هذه الفاتورة');
      } else if (msg.includes('order_not_invoice_based')) {
        toast.error('هذا الطلب ليس بفاتورة');
      } else if (msg.includes('order_not_found')) {
        toast.error('الطلب غير موجود');
      } else if (msg.includes('invoice_number_required')) {
        toast.error('يرجى إدخال رقم الفاتورة');
      } else {
        toast.error('فشل تأكيد استلام الفاتورة: ' + msg);
      }
      return;
    }
    console.info('[stamp confirm] rpc ok', data);
    toast.success('تم تأكيد استلام الفاتورة');
    if (onReceivedDocsChange) {
      onReceivedDocsChange({ ...(receivedDocs || {}), [`stamp_${stampDialog.orderId}`]: true });
    }
    await queryClient.invalidateQueries({ queryKey: ['session-stamped-invoices'] });
    await queryClient.refetchQueries({ queryKey: ['session-stamped-invoices'] });
    await queryClient.invalidateQueries({ queryKey: ['invoice-tracking'] });
    setStampDialog(null);
  };

  const { data: docs, isLoading } = useQuery({
    queryKey: ['session-document-collections', workerId, periodStart, periodEnd],
    queryFn: async () => {
      const startDate = extractDate(periodStart);
      const endDate = extractDate(periodEnd);
      // Use exact period timestamps
      const toTz = (v: string, isEnd: boolean) => {
        if (v.includes('+') || v.includes('Z')) return v;
        if (v.includes('T')) return v + ':00+01:00';
        return isEnd ? v + 'T23:59:59+01:00' : v + 'T00:00:00+01:00';
      };
      const startTz = toTz(periodStart, false);
      const endTz = toTz(periodEnd, true);

      const result: CollectedDoc[] = [];

      // 1) Pending documents that were actually collected (source of truth)
      const { data: pendingCollections } = await supabase
        .from('document_collections')
        .select(`id, action, status, collection_date, created_at, order_id, order:orders!document_collections_order_id_fkey(id, total_amount, invoice_payment_method, document_status, document_verification, customer:customers!orders_customer_id_fkey(name))`)
        .eq('worker_id', workerId)
        .eq('action', 'collected')
        .neq('status', 'rejected')
        .gte('created_at', startTz)
        .lte('created_at', endTz);

      for (const c of (pendingCollections || [])) {
        const order = c.order as any;
        if (!order) continue;
        const docType = order.invoice_payment_method || 'check';
        result.push({
          orderId: order.id,
          customerName: order.customer?.name || 'غير معروف',
          documentType: docType,
          orderTotal: Number(order.total_amount || 0),
          source: 'pending_collection',
          documentStatus: order.document_status,
          verification: parseVerification(order.document_verification, docType),
        });
      }

      const pendingOrderIds = new Set(result.map((r) => r.orderId));

      const { data: deliveryOrders } = await supabase
        .from('orders')
        .select(`id, total_amount, invoice_payment_method, document_status, document_verification, updated_at, customer:customers!orders_customer_id_fkey(name)`)
        .eq('assigned_worker_id', workerId)
        .eq('status', 'delivered')
        .in('invoice_payment_method', ['check', 'receipt', 'transfer', 'versement', 'virement'])
        .in('document_status', ['pending', 'received', 'verified'])
        .gte('updated_at', startTz)
        .lte('updated_at', endTz);

      for (const o of (deliveryOrders || [])) {
        if (pendingOrderIds.has(o.id)) continue;
        if (!isCollectedDuringDelivery(o)) continue;

        const docType = o.invoice_payment_method || 'check';
        result.push({
          orderId: o.id,
          customerName: (o.customer as any)?.name || 'غير معروف',
          documentType: docType,
          orderTotal: Number(o.total_amount || 0),
          source: 'delivery',
          documentStatus: o.document_status,
          verification: parseVerification(o.document_verification, docType),
        });
      }

      return result;
    },
  });

  // Query stamped invoices (فاتورة مختومة) - for with_invoice + check/cash
  const { data: stampedInvoices } = useQuery({
    queryKey: ['session-stamped-invoices', workerId, periodStart, periodEnd],
    queryFn: async () => {
      const toTz2 = (v: string, isEnd: boolean) => {
        if (v.includes('+') || v.includes('Z')) return v;
        if (v.includes('T')) return v + ':00+01:00';
        return isEnd ? v + 'T23:59:59+01:00' : v + 'T00:00:00+01:00';
      };
      const startTz = toTz2(periodStart, false);
      const endTz = toTz2(periodEnd, true);

      const { data } = await supabase
        .from('orders')
        .select(`id, total_amount, invoice_payment_method, invoice_received_at, invoice_number, invoice_sent_at, updated_at, created_at, payment_type, document_status, document_verification, customer:customers!orders_customer_id_fkey(name, store_name, phone)`)
        .eq('assigned_worker_id', workerId)
        .eq('status', 'delivered')
        .eq('payment_type', 'with_invoice')
        .in('invoice_payment_method', ['check', 'cash', 'receipt', 'versement', 'transfer', 'virement'])
        .gte('created_at', startTz)
        .lte('created_at', endTz);

      return (data || []).map((o: any): StampedInvoice => {
        const v = o.document_verification && typeof o.document_verification === 'object' ? o.document_verification : {};
        const bucket: 'cash' | 'doc' | null =
          v.manager_receipt_bucket === 'cash' || v.manager_receipt_bucket === 'doc'
            ? v.manager_receipt_bucket
            : (v.paid_by_cash === true ? 'cash' : null);
        return {
          orderId: o.id,
          customerName: o.customer?.name || 'غير معروف',
          storeName: o.customer?.store_name || null,
          customerPhone: o.customer?.phone || null,
          orderTotal: Number(o.total_amount || 0),
          paymentMethod: o.invoice_payment_method || 'cash',
          bucket,
          received: !!o.invoice_received_at,
          receivedAt: o.invoice_received_at,
          invoiceNumber: o.invoice_number || null,
          issueDate: o.invoice_sent_at ? String(o.invoice_sent_at).substring(0, 10) : null,
          documentVerification: o.document_verification,
          documentStatus: o.document_status,
        };
      }).sort((a, b) => {
        if (a.received !== b.received) return a.received ? 1 : -1;
        return 0;
      });
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if ((!docs || docs.length === 0) && (!stampedInvoices || stampedInvoices.length === 0)) return <p data-empty="true" className="text-xs text-muted-foreground text-center py-3">لا توجد مستندات محصلة في هذه الفترة</p>;

  const allDocs = docs || [];
  const deliveryDocs = allDocs.filter(d => d.source === 'delivery');
  const pendingDocs = allDocs.filter(d => d.source === 'pending_collection');
  const totalAmount = allDocs.reduce((s, d) => s + d.orderTotal, 0);

  const renderDocCard = (doc: CollectedDoc) => {
    const v = doc.verification;
    const pct = v.totalFields > 0 ? Math.round((v.verifiedFields! / v.totalFields) * 100) : 0;
    const docKey = `doc_${doc.orderId}`;
    const isReceived = receivedDocs ? receivedDocs[docKey] !== false : true;

    return (
      <div
        key={doc.orderId}
        onClick={() => setDocDialog(doc)}
        className={`border rounded-lg p-3 space-y-2 cursor-pointer transition-colors hover:bg-muted/40 ${!isReceived ? 'border-destructive/40 bg-destructive/5' : ''}`}
      >
        {/* Header: customer + amount */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{doc.customerName}</p>
              <p className="text-[10px] text-muted-foreground">#{doc.orderId.slice(0, 8)}</p>
            </div>
          </div>
          <div className="text-end">
            <span className="font-bold text-sm">{fmt(doc.orderTotal)} DA</span>
            <div className="mt-0.5">
              <Badge className={`${docTypeColor(doc.documentType)} text-[9px] px-1.5 py-0`}>
                {docTypeLabel(doc.documentType)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Verification details */}
        {doc.documentType === 'check' && (
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <div className="bg-muted/50 rounded p-1.5 text-center">
              <p className="text-muted-foreground mb-0.5">رقم الشيك</p>
              <p className="font-bold">{v.checkNumber || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-1.5 text-center">
              <p className="text-muted-foreground mb-0.5">تاريخ الشيك</p>
              <p className="font-bold">{v.checkDate || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded p-1.5 text-center">
              <p className="text-muted-foreground mb-0.5">البنك</p>
              <p className="font-bold">{v.checkBank || '—'}</p>
            </div>
          </div>
        )}

        {(doc.documentType === 'receipt' || doc.documentType === 'versement') && v.receiptNumber && (
          <div className="bg-muted/50 rounded p-1.5 text-[10px] text-center">
            <p className="text-muted-foreground mb-0.5">رقم الوصل</p>
            <p className="font-bold">{v.receiptNumber}</p>
          </div>
        )}

        {(doc.documentType === 'transfer' || doc.documentType === 'virement') && v.transferReference && (
          <div className="bg-muted/50 rounded p-1.5 text-[10px] text-center">
            <p className="text-muted-foreground mb-0.5">مرجع التحويل</p>
            <p className="font-bold">{v.transferReference}</p>
          </div>
        )}

        {/* Verification progress + button */}
        <div className="flex items-center gap-2">
          {v.verified ? (
            <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
          ) : v.verifiedFields! > 0 ? (
            <ShieldAlert className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
          )}
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className={`text-[10px] font-bold ${v.verified ? 'text-green-600' : pct > 0 ? 'text-orange-500' : 'text-destructive'}`}>
            {pct}%
          </span>
          {!v.verified && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1"
              onClick={(e) => { e.stopPropagation(); setVerifyDoc(doc); }}
            >
              <ClipboardCheck className="w-3 h-3" />
              تحقق
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderDocList = (items: CollectedDoc[]) => items.map(renderDocCard);

  return (
    <div className="space-y-3">
      {deliveryDocs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-green-700 dark:text-green-400">
            <Truck className="w-3.5 h-3.5" />
            <span>مستندات مستلمة أثناء التوصيل ({deliveryDocs.length})</span>
          </div>
          <div className="border-2 border-green-200 dark:border-green-900/40 rounded-xl p-2.5 space-y-2 bg-green-50/30 dark:bg-green-900/10">
            {renderDocList(deliveryDocs)}
          </div>
        </div>
      )}

      {pendingDocs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
            <Clock className="w-3.5 h-3.5" />
            <span>مستندات معلقة تم تحصيلها ({pendingDocs.length})</span>
          </div>
          <div className="border-2 border-orange-200 dark:border-orange-900/40 rounded-xl p-2.5 space-y-2 bg-orange-50/30 dark:bg-orange-900/10">
            {renderDocList(pendingDocs)}
          </div>
        </div>
      )}

      {/* Stamped invoices section */}
      {stampedInvoices && stampedInvoices.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-400">
            <Stamp className="w-3.5 h-3.5" />
            <span>فواتير مختومة ({stampedInvoices.filter(s => s.received).length}/{stampedInvoices.length})</span>
          </div>
          <div className="border-2 border-violet-200 dark:border-violet-900/40 rounded-xl p-2.5 space-y-2 bg-violet-50/30 dark:bg-violet-900/10">
            {stampedInvoices.map(inv => {
              const stampKey = `stamp_${inv.orderId}`;
              const isStampReceived = receivedDocs ? receivedDocs[stampKey] !== false : true;
              return (
              <div
                key={inv.orderId}
                onClick={() => setStampDialog(inv)}
                className={`border rounded-lg p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors hover:bg-muted/40 ${
                  inv.received
                    ? 'border-green-300 dark:border-green-800 bg-green-50/60 dark:bg-green-900/20'
                    : !isStampReceived ? 'border-destructive/40 bg-destructive/5' : ''
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {onReceivedDocsChange && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onReceivedDocsChange({ ...receivedDocs, [stampKey]: !isStampReceived }); }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isStampReceived ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-destructive/10 text-destructive'}`}
                    >
                      {isStampReceived ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                  )}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${inv.received ? 'bg-green-100 dark:bg-green-900/30' : 'bg-destructive/10'}`}>
                    {inv.received ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{inv.customerName}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">#{inv.orderId.slice(0, 8)}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {stampedMethodLabel(inv.paymentMethod, inv.bucket)}
                      </Badge>
                      {inv.invoiceNumber && (
                        <span className="text-[10px] text-muted-foreground">فاتورة: {inv.invoiceNumber}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const m = (inv.paymentMethod || '').toLowerCase();
                    if (m === 'cash') return null;
                    const v = inv.documentVerification && typeof inv.documentVerification === 'object' ? inv.documentVerification : {};
                    const attached = (v as any).attached_to_invoice === true;
                    return (
                      <div
                        title={attached ? 'المستند مرفق بالفاتورة' : 'المستند غير مرفق'}
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${attached ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-destructive/10 text-destructive'}`}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </div>
                    );
                  })()}
                  <div className="text-end">
                    <span className="font-bold text-xs">{fmt(inv.orderTotal)} DA</span>
                    <p className={`text-[10px] font-medium ${inv.received ? 'text-green-600' : 'text-destructive'}`}>
                      {inv.received ? 'تم الاستلام ✓' : 'لم تُستلم'}
                    </p>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex justify-between items-center">
        <span className="text-sm font-bold">إجمالي المستندات: {(docs?.length || 0) + (stampedInvoices?.length || 0)}</span>
        <span className="font-bold text-primary">{fmt(totalAmount)} DA</span>
      </div>

      {/* Verification dialog */}
      {verifyDoc && (
        <DocumentFlowDialog
          open={!!verifyDoc}
          onOpenChange={(open) => { if (!open) setVerifyDoc(null); }}
          mode="verify"
          orderId={verifyDoc.orderId}
          orderTotal={verifyDoc.orderTotal}
          customerName={verifyDoc.customerName}
          documentType={verifyDoc.documentType === 'check' ? 'check' : verifyDoc.documentType === 'transfer' || verifyDoc.documentType === 'virement' ? 'transfer' : 'receipt'}
          initialCheckReceived={true}
          initialVerification={verifyDoc.verification}
          onConfirm={async (data) => {
            if (!data.checkReceived || !data.verification) {
              setVerifyDoc(null);
              return;
            }
            const { error } = await supabase
              .from('orders')
              .update({
                document_verification: data.verification,
                document_status: data.skippedVerification ? 'received' : 'verified',
                invoice_received_at: new Date().toISOString(),
              })
              .eq('id', verifyDoc.orderId);
            if (error) {
              toast.error('فشل حفظ التحقق');
            } else {
              toast.success('تم حفظ التحقق بنجاح');
              await queryClient.invalidateQueries({ queryKey: ['session-document-collections'] });
              await queryClient.invalidateQueries({ queryKey: ['session-stamped-invoices'] });
              await queryClient.refetchQueries({ queryKey: ['session-stamped-invoices'] });
            }
            setVerifyDoc(null);
          }}
        />
      )}

      {/* Stamped invoice receipt confirmation */}
      <Dialog open={!!stampDialog} onOpenChange={(open) => { if (!open) setStampDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">تأكيد استلام الفاتورة المختومة</DialogTitle>
          </DialogHeader>
          {stampDialog && (
            <div className="space-y-3 text-right">
              <div className="rounded-xl border-2 border-primary/15 bg-gradient-to-br from-primary/5 to-primary/0 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold leading-tight truncate">{stampDialog.customerName}</p>
                    <p className="text-xs font-semibold text-primary truncate flex items-center gap-1 mt-0.5">
                      <Stamp className="w-3 h-3 shrink-0" />
                      {stampDialog.storeName || <span className="text-muted-foreground font-normal">بدون اسم محل</span>}
                    </p>
                    {stampDialog.customerPhone && (
                      <p className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">{stampDialog.customerPhone}</p>
                    )}
                  </div>
                  <Badge className={`${docTypeColor(stampDialog.paymentMethod)} text-[10px] px-2 py-0.5 shrink-0`}>
                    {stampedMethodLabel(stampDialog.paymentMethod, stampDialog.bucket)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-primary/10">
                  <span className="text-[10px] text-muted-foreground font-mono">#{stampDialog.orderId.slice(0, 8)}</span>
                  <span className="text-sm font-black text-primary" dir="ltr">{fmt(stampDialog.orderTotal)} DA</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {stampDialog.received ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> تم الاستلام
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" /> لم تُستلم
                    </span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDetailsOrderId(stampDialog.orderId)}
                className="w-full gap-2"
              >
                <Package className="w-4 h-4" />
                عرض تفاصيل الطلب
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stamp-inv-num">رقم الفاتورة *</Label>
                  <Input
                    id="stamp-inv-num"
                    value={stampInvoiceNumber}
                    onChange={(e) => setStampInvoiceNumber(e.target.value)}
                    placeholder="أدخل رقم الفاتورة"
                    className="text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stamp-inv-date">تاريخ إصدار الفاتورة *</Label>
                  <Input
                    id="stamp-inv-date"
                    type="date"
                    value={stampIssueDate}
                    onChange={(e) => setStampIssueDate(e.target.value)}
                  />
                </div>
              </div>
              {(() => {
                const m = (stampDialog.paymentMethod || '').toLowerCase();
                const label = m === 'check' ? 'إرفاق الشيك' : (m === 'transfer' || m === 'virement') ? 'إرفاق التحويل (Virement)' : 'إرفاق الوصل (Versement)';
                const v = stampDialog.documentVerification && typeof stampDialog.documentVerification === 'object' ? stampDialog.documentVerification : {};
                const attached = v.attached_to_invoice === true;
                return (
                  <button
                    type="button"
                    onClick={async () => {
                      const newAttached = !attached;
                      const { error } = await (supabase as any).rpc('set_invoice_document_attached', {
                        p_order_id: stampDialog.orderId,
                        p_attached: newAttached,
                      });
                      if (error) {
                        const msg = String(error.message || '');
                        if (msg.includes('permission_denied')) toast.error('لا تملك صلاحية تعديل الإرفاق');
                        else toast.error('فشل تحديث الإرفاق: ' + msg);
                        return;
                      }
                      const newVerification = { ...v, attached_to_invoice: newAttached };
                      setStampDialog({ ...stampDialog, documentVerification: newVerification });
                      toast.success(newAttached ? 'تم تسجيل إرفاق المستند' : 'تم إلغاء الإرفاق');
                      await queryClient.invalidateQueries({ queryKey: ['session-stamped-invoices'] });
                      await queryClient.refetchQueries({ queryKey: ['session-stamped-invoices'] });
                    }}
                    className={`w-full flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                      attached
                        ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                        : 'bg-destructive/10 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
                    }`}
                  >
                    {attached ? <CheckCircle className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                    {attached ? `${label} ✓` : label}
                  </button>
                );
              })()}
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setStampDialog(null)}
              disabled={stampSaving}
              className="flex-1"
            >
              إغلاق
            </Button>
            <Button
              variant="destructive"
              disabled={stampSaving}
              className="flex-1"
              onClick={async () => {
                if (!stampDialog) return;
                setStampSaving(true);
                const { error } = await (supabase as any).rpc('set_manager_invoice_decision', {
                  p_order_id: stampDialog.orderId,
                  p_decision: 'not_received',
                });
                setStampSaving(false);
                if (error) { toast.error('فشل التحديث: ' + String(error.message || '')); return; }
                toast.success('تم تسجيل: لم تُستلم');
                await queryClient.invalidateQueries({ queryKey: ['session-stamped-invoices'] });
                await queryClient.invalidateQueries({ queryKey: ['invoice-tracking'] });
                setStampDialog(null);
              }}
            >
              <XCircle className="w-4 h-4 me-1" />
              لم تُستلم
            </Button>
            <Button
              onClick={handleConfirmStamp}
              disabled={stampSaving || !stampInvoiceNumber.trim() || !stampIssueDate}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {stampSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الاستلام'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order details dialog */}
      <Dialog open={!!detailsOrderId} onOpenChange={(open) => { if (!open) setDetailsOrderId(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2 justify-end">
              <span>تفاصيل المنتجات</span>
              <Package className="w-4 h-4" />
            </DialogTitle>
          </DialogHeader>
          {orderDetailsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !orderDetailsItems || orderDetailsItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا توجد منتجات</p>
          ) : (
            <div className="space-y-2">
              {orderDetailsItems.map((it: any) => {
                const p = it.product || {};
                const unit = (it.pricing_unit === 'piece' || it.pricing_unit === 'unit') ? 'قطعة' : 'صندوق';
                return (
                  <div key={it.id} className="flex items-center gap-3 border rounded-lg p-2.5 bg-card">
                    <div className="w-14 h-14 rounded-md bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-semibold truncate">{p.name || 'منتج'}</p>
                      {p.product_code && <p className="text-[10px] text-muted-foreground">#{p.product_code}</p>}
                      <div className="flex items-center gap-2 mt-1 justify-end flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {it.quantity} {unit}
                        </Badge>
                        {(it.gift_quantity > 0 || it.gift_pieces > 0) && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                            <Gift className="w-3 h-3" />
                            {it.gift_quantity > 0 ? `${it.gift_quantity} هدية` : `${it.gift_pieces} قطعة هدية`}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOrderId(null)} className="w-full">إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document receipt confirmation */}
      <Dialog open={!!docDialog} onOpenChange={(open) => { if (!open) setDocDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">تأكيد استلام المستند</DialogTitle>
          </DialogHeader>
          {docDialog && (
            <div className="space-y-3 text-right">
              <div className="rounded-xl border-2 border-primary/15 bg-gradient-to-br from-primary/5 to-primary/0 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold leading-tight truncate">{docDialog.customerName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">#{docDialog.orderId.slice(0, 8)}</p>
                  </div>
                  <Badge className={`${docTypeColor(docDialog.documentType)} text-[10px] px-2 py-0.5 shrink-0`}>
                    {docTypeLabel(docDialog.documentType)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-primary/10">
                  <span className="text-[11px] text-muted-foreground">{docStatusLabel(docDialog.documentStatus)}</span>
                  <span className="text-sm font-black text-primary" dir="ltr">{fmt(docDialog.orderTotal)} DA</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDetailsOrderId(docDialog.orderId)}
                className="w-full gap-2"
              >
                <Package className="w-4 h-4" />
                عرض تفاصيل الطلب
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-num">{docNumberLabel(docDialog.documentType)} *</Label>
                  <Input
                    id="doc-num"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="..."
                    className="text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-date">{docDateLabel(docDialog.documentType)} *</Label>
                  <Input
                    id="doc-date"
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDocDialog(null)}
              disabled={docSaving}
              className="flex-1"
            >
              إغلاق
            </Button>
            <Button
              variant="destructive"
              disabled={docSaving}
              className="flex-1"
              onClick={async () => {
                if (!docDialog) return;
                setDocSaving(true);
                const { error } = await (supabase as any).rpc('set_manager_document_decision', {
                  p_order_id: docDialog.orderId,
                  p_decision: 'not_received',
                });
                setDocSaving(false);
                if (error) { toast.error('فشل التحديث: ' + String(error.message || '')); return; }
                toast.success('تم تسجيل: لم تُستلم');
                await queryClient.invalidateQueries({ queryKey: ['session-document-collections'] });
                await queryClient.invalidateQueries({ queryKey: ['document-tracking'] });
                setDocDialog(null);
              }}
            >
              <XCircle className="w-4 h-4 me-1" />
              لم تُستلم
            </Button>
            <Button
              disabled={docSaving}
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (!docDialog) return;
                setDocSaving(true);
                const { error } = await (supabase as any).rpc('set_manager_document_decision', {
                  p_order_id: docDialog.orderId,
                  p_decision: 'received',
                });
                setDocSaving(false);
                if (error) { toast.error('فشل التحديث: ' + String(error.message || '')); return; }
                toast.success('تم تأكيد استلام المستند');
                await queryClient.invalidateQueries({ queryKey: ['session-document-collections'] });
                await queryClient.invalidateQueries({ queryKey: ['document-tracking'] });
                setDocDialog(null);
              }}
            >
              {docSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الاستلام'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentCollectionsSummary;
