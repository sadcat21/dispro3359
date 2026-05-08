import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, History, CheckCircle2, XCircle, FileText, Inbox, Send } from 'lucide-react';
import FactoryReceiptQuickDialog from '@/components/stock/FactoryReceiptQuickDialog';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { parseReceiptItemBreakdown, parseReceiptMeta } from '@/utils/stockReceipt';
import {
  printFactoryReceiptDetails,
  printFactoryDeliveryDetails,
  PrintReceiptInput,
  PrintDeliveryInput,
} from '@/utils/printFactoryDocs';
import { toast } from 'sonner';

export type ApprovalHistoryType = 'factory_in' | 'sector' | 'invoices';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: ApprovalHistoryType;
  title: string;
  branchFilter?: string | null;
}

const statusBadge = (status: string) => {
  const ok = ['approved', 'received'].includes(status);
  return (
    <Badge className={ok ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}>
      {ok ? <CheckCircle2 className="w-3 h-3 me-1" /> : <XCircle className="w-3 h-3 me-1" />}
      {ok ? 'مقبول' : 'مرفوض'}
    </Badge>
  );
};

const ApprovalHistoryDialog: React.FC<Props> = ({ open, onOpenChange, type, title, branchFilter }) => {
  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const [factorySubTab, setFactorySubTab] = useState<'receipts' | 'deliveries'>('receipts');
  const [printingId, setPrintingId] = useState<string | null>(null);
  const { companyInfo } = useCompanyInfo();

  // Receipts (factory_in receipts tab)
  const receiptsQ = useQuery({
    queryKey: ['approval-history', 'factory_in', 'receipts', branchFilter],
    enabled: open && type === 'factory_in' && factorySubTab === 'receipts',
    queryFn: async () => {
      let q = supabase
        .from('stock_receipts')
        .select('id, receipt_date, invoice_number, total_items, status, branch_approved_at, branches(name)')
        .in('status', ['approved', 'received', 'rejected'])
        .order('branch_approved_at', { ascending: false })
        .limit(100);
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Deliveries (factory_in deliveries tab)
  const deliveriesQ = useQuery({
    queryKey: ['approval-history', 'factory_in', 'deliveries', branchFilter],
    enabled: open && type === 'factory_in' && factorySubTab === 'deliveries',
    queryFn: async () => {
      let q = supabase
        .from('factory_orders')
        .select('id, created_at, status, pallet_count, branch_id, branches(name)')
        .eq('order_type', 'sending')
        .in('status', ['approved', 'received', 'rejected', 'completed'])
        .order('created_at', { ascending: false })
        .limit(100);
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Sector
  const sectorQ = useQuery({
    queryKey: ['approval-history', 'sector', branchFilter],
    enabled: open && type === 'sector',
    queryFn: async () => {
      let q = supabase
        .from('sector_coverage')
        .select(`id, start_date, end_date, approval_status,
          absent_worker:workers!sector_coverage_absent_worker_id_fkey(full_name),
          substitute_worker:workers!sector_coverage_substitute_worker_id_fkey(full_name),
          sectors!inner(name, branch_id, branches(name))`)
        .in('approval_status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(100);
      if (branchFilter) q = q.eq('sectors.branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Invoices
  const invoicesQ = useQuery({
    queryKey: ['approval-history', 'invoices', branchFilter],
    enabled: open && type === 'invoices',
    queryFn: async () => {
      let q = supabase
        .from('manual_invoice_requests')
        .select('id, invoice_number, status, assistant_approved_at, branch_approved_at, customers(name), branches(name)')
        .in('status', ['approved', 'rejected'])
        .order('assistant_approved_at', { ascending: false })
        .limit(100);
      if (branchFilter) q = q.eq('branch_id', branchFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const handlePrintReceipt = async (receiptId: string) => {
    setPrintingId(receiptId);
    try {
      const { data: receipt, error: rErr } = await supabase
        .from('stock_receipts')
        .select('*')
        .eq('id', receiptId)
        .maybeSingle();
      if (rErr || !receipt) throw rErr || new Error('not found');

      const { data: rItems } = await supabase
        .from('stock_receipt_items')
        .select('*, product:products(name, app_name, pieces_per_box)')
        .eq('receipt_id', receiptId);

      // aggregate items by product
      const grouped = new Map<string, any>();
      (rItems || []).forEach((it: any) => {
        const ppb = it.product?.pieces_per_box || 1;
        const breakdown = parseReceiptItemBreakdown(it);
        const existing = grouped.get(it.product_id);
        if (existing) {
          existing.new_qty += breakdown.new_qty;
          existing.comp_qty += breakdown.comp_qty;
          existing.comp_offers_qty += breakdown.comp_offers_qty;
        } else {
          grouped.set(it.product_id, {
            product_name: it.product?.name || '',
            product_app_name: it.product?.app_name,
            pieces_per_box: ppb,
            new_qty: breakdown.new_qty,
            comp_qty: breakdown.comp_qty,
            comp_offers_qty: breakdown.comp_offers_qty,
          });
        }
      });

      // Try to find linked delivery (factory_orders) created same day to same branch
      let linked: PrintDeliveryInput | null = null;
      const { data: linkedDeliv } = await supabase
        .from('factory_orders')
        .select('*, factory_order_items(*, product:products(name, app_name, pieces_per_box))')
        .eq('branch_id', (receipt as any).branch_id)
        .eq('order_type', 'sending')
        .gte('created_at', new Date(new Date((receipt as any).created_at).getTime() - 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', new Date(new Date((receipt as any).created_at).getTime() + 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (linkedDeliv) {
        const d: any = linkedDeliv;
        linked = {
          notes: d.notes,
          created_at: d.created_at,
          pallet_count: d.pallet_count,
          items: (d.factory_order_items || []).map((it: any) => ({
            product_name: it.product?.name || '',
            product_app_name: it.product?.app_name,
            pieces_per_box: it.product?.pieces_per_box || 1,
            quantity: Number(it.product_quantity) || 0,
            lot_number: it.lot_number,
            manufacturing_date: it.manufacturing_date,
            manufacturing_time: it.manufacturing_time,
            delivery_date: it.delivery_date,
          })),
        };
      }

      const r: any = receipt;
      const input: PrintReceiptInput = {
        invoice_number: r.invoice_number,
        notes: r.notes,
        created_at: r.created_at,
        pallet_count: r.pallet_count,
        receipt_expenses: r.receipt_expenses,
        expenses_description: r.expenses_description,
        expenses_breakdown: r.expenses_breakdown,
        meta: parseReceiptMeta(r.notes),
        items: Array.from(grouped.values()),
      };
      printFactoryReceiptDetails(input, linked, companyInfo);
    } catch (e: any) {
      toast.error(e?.message || 'فشل التحميل للطباعة');
    } finally {
      setPrintingId(null);
    }
  };

  const handlePrintDelivery = async (deliveryId: string) => {
    setPrintingId(deliveryId);
    try {
      const { data: d, error } = await supabase
        .from('factory_orders')
        .select('*, factory_order_items(*, product:products(name, app_name, pieces_per_box)), creator:workers!factory_orders_created_by_fkey(full_name)')
        .eq('id', deliveryId)
        .maybeSingle();
      if (error || !d) throw error || new Error('not found');
      const dd: any = d;
      const input: PrintDeliveryInput = {
        notes: dd.notes,
        created_at: dd.created_at,
        creator_name: dd.creator?.full_name,
        pallet_count: dd.pallet_count,
        items: (dd.factory_order_items || []).map((it: any) => ({
          product_name: it.product?.name || '',
          product_app_name: it.product?.app_name,
          pieces_per_box: it.product?.pieces_per_box || 1,
          quantity: Number(it.product_quantity) || 0,
          lot_number: it.lot_number,
          manufacturing_date: it.manufacturing_date,
          manufacturing_time: it.manufacturing_time,
          delivery_date: it.delivery_date,
        })),
      };
      printFactoryDeliveryDetails(input, companyInfo);
    } catch (e: any) {
      toast.error(e?.message || 'فشل التحميل للطباعة');
    } finally {
      setPrintingId(null);
    }
  };

  const renderList = (
    items: { id: string; status: string; title: string; subtitle: string; date?: string | null }[] | undefined,
    isLoading: boolean,
    extra?: (id: string) => React.ReactNode,
    onClickRow?: (id: string) => void,
  ) => {
    if (isLoading) {
      return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
    }
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>لا يوجد سجل بعد</p>
        </div>
      );
    }
    return items.map((row) => (
      <Card
        key={row.id}
        className={`border-slate-200 ${onClickRow ? 'cursor-pointer hover:border-primary hover:shadow-md transition' : ''}`}
        onClick={() => onClickRow?.(row.id)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <p className="font-semibold text-sm truncate">{row.title}</p>
              <p className="text-xs text-muted-foreground">{row.subtitle}</p>
              {row.date && <p className="text-[11px] text-muted-foreground">{new Date(row.date).toLocaleString()}</p>}
            </div>
            {statusBadge(row.status)}
          </div>
          {extra && (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              {extra(row.id)}
            </div>
          )}
        </CardContent>
      </Card>
    ));
  };

  const receiptItems = (receiptsQ.data || []).map((r: any) => ({
    id: r.id,
    status: r.status,
    title: `فاتورة ${r.invoice_number || '—'}`,
    subtitle: `${r.branches?.name || '—'} · ${r.receipt_date} · عناصر ${r.total_items || 0}`,
    date: r.branch_approved_at,
  }));

  const deliveryItems = (deliveriesQ.data || []).map((d: any) => ({
    id: d.id,
    status: d.status,
    title: `تسليم للمصنع`,
    subtitle: `${d.branches?.name || '—'} · باليطات ${d.pallet_count ?? 0}`,
    date: d.created_at,
  }));

  const sectorItems = (sectorQ.data || []).map((c: any) => ({
    id: c.id,
    status: c.approval_status,
    title: `${c.sectors?.name || '—'}`,
    subtitle: `${c.absent_worker?.full_name || '—'} → ${c.substitute_worker?.full_name || '—'} · ${c.start_date} → ${c.end_date}`,
    date: c.start_date,
  }));

  const invoiceItems = (invoicesQ.data || []).map((i: any) => ({
    id: i.id,
    status: i.status,
    title: `${i.customers?.name || '—'} — ${i.invoice_number || '—'}`,
    subtitle: `${i.branches?.name || '—'}`,
    date: i.assistant_approved_at || i.branch_approved_at,
  }));

  const printBtn = (id: string, kind: 'receipt' | 'delivery') => (
    <Button
      size="sm"
      variant="outline"
      className="border-purple-500 text-purple-700"
      disabled={printingId === id}
      onClick={() => kind === 'receipt' ? handlePrintReceipt(id) : handlePrintDelivery(id)}
    >
      {printingId === id ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <FileText className="w-3.5 h-3.5 ml-1" />}
      {kind === 'receipt' ? 'طباعة تفاصيل الاستلام' : 'طباعة تفاصيل التسليم'}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            سجل {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {type === 'factory_in' ? (
            <Tabs value={factorySubTab} onValueChange={(v) => setFactorySubTab(v as any)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="receipts"><Inbox className="w-4 h-4 ml-1" /> الاستلامات</TabsTrigger>
                <TabsTrigger value="deliveries"><Send className="w-4 h-4 ml-1" /> التسليمات</TabsTrigger>
              </TabsList>
              <TabsContent value="receipts" className="space-y-2 mt-3">
                {renderList(
                  receiptItems,
                  receiptsQ.isLoading,
                  (id) => printBtn(id, 'receipt'),
                  (id) => setPreviewReceiptId(id),
                )}
              </TabsContent>
              <TabsContent value="deliveries" className="space-y-2 mt-3">
                {renderList(
                  deliveryItems,
                  deliveriesQ.isLoading,
                  (id) => printBtn(id, 'delivery'),
                )}
              </TabsContent>
            </Tabs>
          ) : type === 'sector' ? (
            renderList(sectorItems, sectorQ.isLoading)
          ) : (
            renderList(invoiceItems, invoicesQ.isLoading)
          )}
        </div>

        {previewReceiptId && (
          <FactoryReceiptQuickDialog
            open={!!previewReceiptId}
            onOpenChange={(v) => { if (!v) setPreviewReceiptId(null); }}
            editReceiptId={previewReceiptId}
            previewOnly
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalHistoryDialog;
