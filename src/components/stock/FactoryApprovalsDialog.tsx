import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Loader2, Package, Truck, Inbox, Send, CheckCircle, XCircle, Lock, Unlock,
  Edit, Save, X, AlertTriangle, Boxes, Sparkles, Wrench, FileText, User, Phone, Car,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/utils/formatters';
import { parseReceiptItemBreakdown, parseReceiptMeta } from '@/utils/stockReceipt';
import { boxesToBP, dbBPDisplay } from '@/utils/boxPieceInput';
import { getProductDisplayName } from '@/utils/productDisplayName';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReceiptItemDetail {
  id: string;
  product_id: string;
  product_name: string;
  product_app_name?: string | null;
  image_url?: string | null;
  pieces_per_box: number;
  new_qty: number;       // raw db quantity (box.piece format if ppb>1)
  comp_qty: number;
  comp_offers_qty: number;
}

interface DeliveryItemDetail {
  id: string;
  product_id: string;
  product_name: string;
  product_app_name?: string | null;
  image_url?: string | null;
  pieces_per_box: number;
  quantity: number;
}

interface ReceiptRecord {
  id: string;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  status: string;
  created_by: string;
  creator_name?: string;
  branch_id: string;
  invoice_photo_url: string | null;
  frozen_at: string | null;
  rejection_note: string | null;
  linked_delivery_id: string | null;
  pallet_count?: number;
  receipt_expenses?: number;
  expenses_description?: string | null;
  items: ReceiptItemDetail[];
  meta: ReturnType<typeof parseReceiptMeta>;
}

interface DeliveryRecord {
  id: string;
  notes: string | null;
  created_at: string;
  status: string;
  created_by: string;
  creator_name?: string;
  branch_id: string;
  pallet_count: number;
  frozen_at: string | null;
  rejection_note: string | null;
  linked_receipt_id: string | null;
  items: DeliveryItemDetail[];
}

const fmt = (qty: number, ppb: number): string => ppb > 1 ? dbBPDisplay(qty, ppb) : String(qty);

const FactoryApprovalsDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { workerId, activeBranch } = useAuth();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [tab, setTab] = useState<'receipts' | 'deliveries'>('receipts');
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReceiptItems, setEditReceiptItems] = useState<ReceiptItemDetail[]>([]);
  const [editDeliveryItems, setEditDeliveryItems] = useState<DeliveryItemDetail[]>([]);
  const [editPallets, setEditPallets] = useState(0);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [summaryReceipt, setSummaryReceipt] = useState<ReceiptRecord | null>(null);

  useEffect(() => {
    if (!open) return;
    if (activeBranch?.id) setBranchId(activeBranch.id);
    else if (workerId) {
      supabase.from('workers').select('branch_id').eq('id', workerId).maybeSingle()
        .then(({ data }) => setBranchId(data?.branch_id || null));
    }
  }, [open, activeBranch?.id, workerId]);

  const fetchData = useCallback(async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      // Fetch receipts
      const { data: rData } = await supabase
        .from('stock_receipts')
        .select('*')
        .eq('branch_id', branchId)
        .in('status', ['pending_approval', 'pending_branch', 'pending_assistant'])
        .order('created_at', { ascending: false });

      const receiptIds = (rData || []).map(r => r.id);
      const creatorIds = [...new Set((rData || []).map(r => r.created_by))];

      const [{ data: rItems }, { data: workers }] = await Promise.all([
        receiptIds.length > 0
          ? supabase.from('stock_receipt_items').select('*, product:products(name, app_name, image_url, pieces_per_box)').in('receipt_id', receiptIds)
          : Promise.resolve({ data: [] as any[] }),
        creatorIds.length > 0
          ? supabase.from('workers').select('id, full_name').in('id', creatorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const workerMap = new Map((workers || []).map((w: any) => [w.id, w.full_name]));

      // Group items by receipt and aggregate breakdown per product
      const receiptsBuilt: ReceiptRecord[] = (rData || []).map((r: any) => {
        const itemsRaw = (rItems || []).filter((it: any) => it.receipt_id === r.id);
        const grouped = new Map<string, ReceiptItemDetail>();
        itemsRaw.forEach((it: any) => {
          const ppb = it.product?.pieces_per_box || 1;
          const breakdown = parseReceiptItemBreakdown(it);
          const existing = grouped.get(it.product_id);
          if (existing) {
            existing.new_qty += Number(breakdown.new_qty) || 0;
            existing.comp_qty += Number(breakdown.comp_qty) || 0;
            existing.comp_offers_qty += Number(breakdown.comp_offers_qty) || 0;
          } else {
            grouped.set(it.product_id, {
              id: it.id,
              product_id: it.product_id,
              product_name: it.product?.name || '',
              product_app_name: it.product?.app_name,
              image_url: it.product?.image_url,
              pieces_per_box: ppb,
              new_qty: Number(breakdown.new_qty) || 0,
              comp_qty: Number(breakdown.comp_qty) || 0,
              comp_offers_qty: Number(breakdown.comp_offers_qty) || 0,
            });
          }
        });
        return {
          ...r,
          creator_name: workerMap.get(r.created_by) || '',
          meta: parseReceiptMeta(r.notes),
          items: Array.from(grouped.values()),
        } as ReceiptRecord;
      });

      // Fetch deliveries
      const { data: dData } = await supabase
        .from('factory_orders')
        .select('*')
        .eq('branch_id', branchId)
        .eq('order_type', 'sending')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      const dIds = (dData || []).map(d => d.id);
      const dCreatorIds = [...new Set((dData || []).map(d => d.created_by))];

      const [{ data: dItems }, { data: dWorkers }] = await Promise.all([
        dIds.length > 0
          ? supabase.from('factory_order_items').select('*, product:products(name, app_name, image_url, pieces_per_box)').in('factory_order_id', dIds)
          : Promise.resolve({ data: [] as any[] }),
        dCreatorIds.length > 0
          ? supabase.from('workers').select('id, full_name').in('id', dCreatorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const dWorkerMap = new Map((dWorkers || []).map((w: any) => [w.id, w.full_name]));

      const deliveriesBuilt: DeliveryRecord[] = (dData || []).map((d: any) => ({
        ...d,
        creator_name: dWorkerMap.get(d.created_by) || '',
        items: (dItems || []).filter((it: any) => it.factory_order_id === d.id).map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product?.name || '',
          product_app_name: it.product?.app_name,
          image_url: it.product?.image_url,
          pieces_per_box: it.product?.pieces_per_box || 1,
          quantity: Number(it.product_quantity) || 0,
        })),
      }));

      setReceipts(receiptsBuilt);
      setDeliveries(deliveriesBuilt);
    } catch (e: any) {
      toast.error(e.message || 'فشل التحميل');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => { if (open && branchId) fetchData(); }, [open, branchId, fetchData]);

  // ─── Actions ───────────────────────────────────────────────────────
  const approveReceipt = async (r: ReceiptRecord) => {
    if (!workerId || r.frozen_at) return;
    setProcessingId(r.id);
    try {
      // مدير الفرع لا يوافق نهائياً — فقط يحوّل للإدارة العليا (مساعد المدير العام / مدير النظام)
      await supabase.from('stock_receipts').update({
        status: 'pending_assistant',
        branch_approved_by: workerId,
        branch_approved_at: new Date().toISOString(),
        pallet_count: r.pallet_count || 0,
      }).eq('id', r.id);

      // إذا كان مرتبطاً بتسليم، نحوّله أيضاً للإدارة
      if (r.linked_delivery_id) {
        await supabase.from('factory_orders').update({
          status: 'pending_assistant',
          branch_approved_by: workerId,
          branch_approved_at: new Date().toISOString(),
        }).eq('id', r.linked_delivery_id);
      }

      toast.success('تم إرسال الطلب للإدارة العليا للموافقة النهائية');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally { setProcessingId(null); }
  };

  const approveDeliveryInternal = async (d: DeliveryRecord) => {
    for (const item of d.items) {
      if (item.quantity > 0) {
        const { data: stock } = await supabase.from('warehouse_stock')
          .select('id, quantity, damaged_quantity, factory_return_quantity')
          .eq('branch_id', d.branch_id).eq('product_id', item.product_id).maybeSingle();
        if (stock) {
          await supabase.from('warehouse_stock').update({
            quantity: Math.max(0, (Number(stock.quantity) || 0) - item.quantity),
            damaged_quantity: Math.max(0, (Number(stock.damaged_quantity) || 0) - item.quantity),
            factory_return_quantity: (Number(stock.factory_return_quantity) || 0) + item.quantity,
          }).eq('id', stock.id);
        }
      }
    }
    if (d.pallet_count > 0) {
      const { data: bp } = await supabase.from('branch_pallets').select('id, quantity').eq('branch_id', d.branch_id).maybeSingle();
      if (bp) await supabase.from('branch_pallets').update({ quantity: Math.max(0, bp.quantity - d.pallet_count) }).eq('id', bp.id);
      await supabase.from('pallet_movements').insert({
        branch_id: d.branch_id, quantity: -d.pallet_count, movement_type: 'delivery',
        reference_id: d.id, notes: 'تسليم باليطات للمصنع', created_by: workerId,
      });
    }
    await supabase.from('factory_orders').update({
      status: 'confirmed', confirmed_at: new Date().toISOString(),
      branch_approved_by: workerId, branch_approved_at: new Date().toISOString(),
    }).eq('id', d.id);
  };

  const approveDelivery = async (d: DeliveryRecord) => {
    if (!workerId || d.frozen_at) return;
    setProcessingId(d.id);
    try {
      // مدير الفرع يحوّل التسليم للإدارة العليا — لا تطبيق نهائي للحركات هنا
      await supabase.from('factory_orders').update({
        status: 'pending_assistant',
        branch_approved_by: workerId,
        branch_approved_at: new Date().toISOString(),
      }).eq('id', d.id);
      toast.success('تم إرسال طلب التسليم للإدارة العليا');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally { setProcessingId(null); }
  };

  const reject = async (kind: 'receipt' | 'delivery', id: string) => {
    if (!rejectNote.trim()) { toast.error('اكتب سبب الرفض'); return; }
    setProcessingId(id);
    try {
      const table = kind === 'receipt' ? 'stock_receipts' : 'factory_orders';
      await supabase.from(table).update({
        status: 'rejected', rejection_note: rejectNote.trim(),
      }).eq('id', id);
      toast.success('تم الرفض');
      setRejectingId(null); setRejectNote('');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally { setProcessingId(null); }
  };

  const toggleFreeze = async (kind: 'receipt' | 'delivery', id: string, freeze: boolean) => {
    setProcessingId(id);
    try {
      const table = kind === 'receipt' ? 'stock_receipts' : 'factory_orders';
      await supabase.from(table).update({
        frozen_at: freeze ? new Date().toISOString() : null,
        frozen_by: freeze ? workerId : null,
      }).eq('id', id);
      toast.success(freeze ? 'تم التأجيل' : 'تم فك التأجيل');
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally { setProcessingId(null); }
  };

  const startEditReceipt = (r: ReceiptRecord) => {
    setEditingId(r.id);
    setEditReceiptItems(r.items.map(i => ({ ...i })));
    setEditPallets(r.pallet_count || 0);
  };

  const startEditDelivery = (d: DeliveryRecord) => {
    setEditingId(d.id);
    setEditDeliveryItems(d.items.map(i => ({ ...i })));
    setEditPallets(d.pallet_count || 0);
  };

  const saveReceiptEdits = async (r: ReceiptRecord) => {
    setProcessingId(r.id);
    try {
      // Replace items: delete old, insert new aggregated rows
      await supabase.from('stock_receipt_items').delete().eq('receipt_id', r.id);
      const rows: any[] = [];
      editReceiptItems.forEach(item => {
        if (item.new_qty > 0) rows.push({
          receipt_id: r.id, product_id: item.product_id, quantity: item.new_qty, pallet_quantity: 0,
          notes: JSON.stringify({ item_type: 'new', new_qty: item.new_qty, comp_qty: 0, comp_offers_qty: 0 }),
        });
        if (item.comp_qty > 0) rows.push({
          receipt_id: r.id, product_id: item.product_id, quantity: item.comp_qty, pallet_quantity: 0,
          notes: JSON.stringify({ item_type: 'compensation', new_qty: 0, comp_qty: item.comp_qty, comp_offers_qty: 0 }),
        });
        if (item.comp_offers_qty > 0) rows.push({
          receipt_id: r.id, product_id: item.product_id, quantity: item.comp_offers_qty, pallet_quantity: 0,
          notes: JSON.stringify({ item_type: 'compensation_offers', new_qty: 0, comp_qty: 0, comp_offers_qty: item.comp_offers_qty }),
        });
      });
      if (rows.length > 0) await supabase.from('stock_receipt_items').insert(rows);
      await supabase.from('stock_receipts').update({ pallet_count: editPallets || 0 }).eq('id', r.id);
      toast.success('تم حفظ التعديلات');
      setEditingId(null);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'فشل التعديل');
    } finally { setProcessingId(null); }
  };

  const saveDeliveryEdits = async (d: DeliveryRecord) => {
    setProcessingId(d.id);
    try {
      for (const item of editDeliveryItems) {
        await supabase.from('factory_order_items').update({ product_quantity: item.quantity }).eq('id', item.id);
      }
      await supabase.from('factory_orders').update({ pallet_count: editPallets }).eq('id', d.id);
      toast.success('تم حفظ التعديلات');
      setEditingId(null);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'فشل التعديل');
    } finally { setProcessingId(null); }
  };

  // ─── Render helpers ────────────────────────────────────────────────
  const renderActionsBar = (
    kind: 'receipt' | 'delivery',
    record: ReceiptRecord | DeliveryRecord,
    onApprove: () => void,
    onSaveEdit: () => void,
    onStartEdit: () => void,
  ) => {
    const isEditing = editingId === record.id;
    const isFrozen = !!record.frozen_at;
    const isProcessing = processingId === record.id;

    if (rejectingId === record.id) {
      return (
        <div className="space-y-2 border-t pt-2">
          <Textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
            placeholder="اكتب سبب الرفض..." rows={2} className="text-xs" />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="flex-1" disabled={isProcessing}
              onClick={() => reject(kind, record.id)}>
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 ml-1" />}
              تأكيد الرفض
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setRejectingId(null); setRejectNote(''); }}>
              <X className="w-3.5 h-3.5 ml-1" /> إلغاء
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2 border-t pt-2">
        {isEditing ? (
          <>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={isProcessing} onClick={onSaveEdit}>
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 ml-1" />}
              حفظ التعديلات
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
              <X className="w-3.5 h-3.5 ml-1" /> إلغاء التعديل
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={isProcessing || isFrozen}
              onClick={onApprove}>
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 ml-1" />}
              إرسال للإدارة
            </Button>
            <Button size="sm" variant="destructive" disabled={isProcessing || isFrozen}
              onClick={() => { setRejectingId(record.id); setRejectNote(''); }}>
              <XCircle className="w-3.5 h-3.5 ml-1" /> رفض
            </Button>
            <Button size="sm" variant="outline" disabled={isProcessing || isFrozen} onClick={onStartEdit}>
              <Edit className="w-3.5 h-3.5 ml-1" /> تعديل
            </Button>
            <Button size="sm" variant="outline" disabled={isProcessing}
              className={isFrozen ? 'border-blue-500 text-blue-700' : 'border-amber-500 text-amber-700'}
              onClick={() => toggleFreeze(kind, record.id, !isFrozen)}>
              {isFrozen ? <><Unlock className="w-3.5 h-3.5 ml-1" /> فك التأجيل</> : <><Lock className="w-3.5 h-3.5 ml-1" /> تأجيل</>}
            </Button>
          </>
        )}
      </div>
    );
  };

  // ─── Receipts list ─────────────────────────────────────────────────
  const renderReceipts = () => {
    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    if (receipts.length === 0) return <div className="text-center py-8 text-sm text-muted-foreground">لا توجد عمليات استلام معلقة</div>;

    return receipts.map(r => {
      const isExpanded = expandedId === r.id;
      const isEditing = editingId === r.id;
      const linkedD = r.linked_delivery_id ? deliveries.find(d => d.id === r.linked_delivery_id) : null;

      return (
        <div key={r.id} className="border rounded-lg overflow-hidden bg-card">
          <button className="w-full flex items-center gap-2 p-3 text-start"
            onClick={() => setExpandedId(isExpanded ? null : r.id)}>
            <Inbox className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold">
                  استلام من {r.meta.source === 'branch' ? 'فرع آخر' : 'المصنع'}
                </span>
                {r.invoice_number && <Badge variant="outline" className="text-[10px]">#{r.invoice_number}</Badge>}
                {r.frozen_at && <Badge className="bg-blue-600 text-white text-[10px]"><Lock className="w-2.5 h-2.5 ml-0.5" />مؤجّل</Badge>}
                {r.linked_delivery_id && <Badge className="bg-purple-600 text-white text-[10px]"><Truck className="w-2.5 h-2.5 ml-0.5" />مرتبط بتسليم</Badge>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {r.creator_name} • {formatDate(r.created_at, 'dd/MM HH:mm', 'ar')}
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">{r.items.length} منتج</Badge>
          </button>

          {isExpanded && (
            <div className="p-3 pt-0 space-y-3">
              {/* Driver/Source info */}
              {(r.meta.driver_name || r.meta.driver_phone || r.meta.license_plate) && (
                <div className="bg-muted/50 rounded p-2 text-[11px] flex flex-wrap gap-3">
                  {r.meta.driver_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{r.meta.driver_name}</span>}
                  {r.meta.driver_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.meta.driver_phone}</span>}
                  {r.meta.license_plate && <span className="flex items-center gap-1"><Car className="w-3 h-3" />{r.meta.license_plate}</span>}
                </div>
              )}

              {r.meta.text && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2 text-[11px]">
                  <FileText className="w-3 h-3 inline ml-1" />{r.meta.text}
                </div>
              )}

              {r.invoice_photo_url && (
                <a href={r.invoice_photo_url} target="_blank" rel="noopener noreferrer"
                  className="block text-[11px] text-primary underline">📷 عرض صورة الفاتورة</a>
              )}

              {/* Pallets */}
              {(r.pallet_count || 0) > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2 flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1">🪵 باليطات مستلمة</span>
                  <Badge className="bg-amber-600 text-white">{r.pallet_count}</Badge>
                </div>
              )}

              {/* Products grid */}
              <div className="grid grid-cols-2 gap-2">
                {(isEditing ? editReceiptItems : r.items).map((item, idx) => {
                  const displayName = getProductDisplayName({ name: item.product_name, app_name: item.product_app_name });
                  const ppb = item.pieces_per_box;
                  return (
                    <div key={item.product_id} className="border rounded-lg p-2 bg-background">
                      <div className="flex items-start gap-2 mb-2">
                        {item.image_url ? (
                          <img src={item.image_url} className="w-12 h-12 rounded object-cover border shrink-0" alt="" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 border">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold leading-tight line-clamp-2">{displayName}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{ppb} قطعة/صندوق</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {/* New */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                            <Sparkles className="w-3 h-3" />جديد
                          </span>
                          {isEditing ? (
                            <Input type="number" min={0} step={0.01} value={item.new_qty}
                              onChange={e => setEditReceiptItems(prev => prev.map((p, i) =>
                                i === idx ? { ...p, new_qty: parseFloat(e.target.value) || 0 } : p))}
                              className="h-6 w-20 text-[10px] text-center px-1" />
                          ) : (
                            <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-1.5">{fmt(item.new_qty, ppb)}</Badge>
                          )}
                        </div>

                        {/* Compensation damaged */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-orange-700 dark:text-orange-400 flex items-center gap-1 font-semibold">
                            <Wrench className="w-3 h-3" />تعويض تالف
                          </span>
                          {isEditing ? (
                            <Input type="number" min={0} step={0.01} value={item.comp_qty}
                              onChange={e => setEditReceiptItems(prev => prev.map((p, i) =>
                                i === idx ? { ...p, comp_qty: parseFloat(e.target.value) || 0 } : p))}
                              className="h-6 w-20 text-[10px] text-center px-1" />
                          ) : (
                            <Badge className="bg-orange-600 text-white text-[10px] h-5 px-1.5">{fmt(item.comp_qty, ppb)}</Badge>
                          )}
                        </div>

                        {/* Compensation offers */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-purple-700 dark:text-purple-400 flex items-center gap-1 font-semibold">
                            <Boxes className="w-3 h-3" />تعويض عروض
                          </span>
                          {isEditing ? (
                            <Input type="number" min={0} step={0.01} value={item.comp_offers_qty}
                              onChange={e => setEditReceiptItems(prev => prev.map((p, i) =>
                                i === idx ? { ...p, comp_offers_qty: parseFloat(e.target.value) || 0 } : p))}
                              className="h-6 w-20 text-[10px] text-center px-1" />
                          ) : (
                            <Badge className="bg-purple-600 text-white text-[10px] h-5 px-1.5">{fmt(item.comp_offers_qty, ppb)}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Linked delivery preview */}
              {linkedD && (
                <div className="border-2 border-purple-300 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg p-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300">
                    <Truck className="w-3.5 h-3.5" />تسليم مرتبط — سيتم تأكيده تلقائياً عند الموافقة
                  </div>
                  <div className="text-[11px] space-y-0.5">
                    {linkedD.pallet_count > 0 && <div>🪵 باليطات للتسليم: <strong>{linkedD.pallet_count}</strong></div>}
                    {linkedD.items.map(it => (
                      <div key={it.id}>
                        • {getProductDisplayName({ name: it.product_name, app_name: it.product_app_name })}: <strong>{fmt(it.quantity, it.pieces_per_box)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {renderActionsBar('receipt', r, () => setSummaryReceipt(r), () => saveReceiptEdits(r), () => startEditReceipt(r))}
            </div>
          )}
        </div>
      );
    });
  };

  // ─── Deliveries list ───────────────────────────────────────────────
  const renderDeliveries = () => {
    if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    const standalone = deliveries.filter(d => !receipts.some(r => r.linked_delivery_id === d.id));
    if (standalone.length === 0) return <div className="text-center py-8 text-sm text-muted-foreground">لا توجد عمليات تسليم معلقة</div>;

    return standalone.map(d => {
      const isExpanded = expandedId === d.id;
      const isEditing = editingId === d.id;

      return (
        <div key={d.id} className="border rounded-lg overflow-hidden bg-card">
          <button className="w-full flex items-center gap-2 p-3 text-start"
            onClick={() => setExpandedId(isExpanded ? null : d.id)}>
            <Send className="w-4 h-4 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold">تسليم تالف للمصنع</span>
                {d.frozen_at && <Badge className="bg-blue-600 text-white text-[10px]"><Lock className="w-2.5 h-2.5 ml-0.5" />مؤجّل</Badge>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {d.creator_name} • {formatDate(d.created_at, 'dd/MM HH:mm', 'ar')}
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">{d.items.length + (d.pallet_count > 0 ? 1 : 0)} عنصر</Badge>
          </button>

          {isExpanded && (
            <div className="p-3 pt-0 space-y-3">
              {d.notes && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2 text-[11px]">
                  <FileText className="w-3 h-3 inline ml-1" />{d.notes}
                </div>
              )}

              {/* Pallets */}
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2 flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1">🪵 باليطات للتسليم</span>
                {isEditing ? (
                  <Input type="number" min={0} value={editPallets}
                    onChange={e => setEditPallets(parseInt(e.target.value) || 0)}
                    className="h-7 w-20 text-xs text-center" />
                ) : (
                  <Badge className="bg-amber-600 text-white">{d.pallet_count}</Badge>
                )}
              </div>

              {/* Damaged products grid */}
              {(isEditing ? editDeliveryItems : d.items).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {(isEditing ? editDeliveryItems : d.items).map((item, idx) => {
                    const displayName = getProductDisplayName({ name: item.product_name, app_name: item.product_app_name });
                    return (
                      <div key={item.id} className="border rounded-lg p-2 bg-background">
                        <div className="flex items-start gap-2 mb-2">
                          {item.image_url ? (
                            <img src={item.image_url} className="w-12 h-12 rounded object-cover border shrink-0" alt="" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 border">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold leading-tight line-clamp-2">{displayName}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{item.pieces_per_box} قطعة/صندوق</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-destructive flex items-center gap-1 font-semibold">
                            <AlertTriangle className="w-3 h-3" />تالف للتسليم
                          </span>
                          {isEditing ? (
                            <Input type="number" min={0} step={0.01} value={item.quantity}
                              onChange={e => setEditDeliveryItems(prev => prev.map((p, i) =>
                                i === idx ? { ...p, quantity: parseFloat(e.target.value) || 0 } : p))}
                              className="h-6 w-20 text-[10px] text-center px-1" />
                          ) : (
                            <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{fmt(item.quantity, item.pieces_per_box)}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {renderActionsBar('delivery', d, () => approveDelivery(d), () => saveDeliveryEdits(d), () => startEditDelivery(d))}
            </div>
          )}
        </div>
      );
    });
  };

  const totalReceipts = receipts.length;
  const standaloneDeliveries = deliveries.filter(d => !receipts.some(r => r.linked_delivery_id === d.id)).length;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            موافقات استلام/تسليم المصنع
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => { setTab(v as any); setExpandedId(null); setEditingId(null); }} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="receipts" className="relative">
              <Inbox className="w-4 h-4 ml-1" />الاستلام
              {totalReceipts > 0 && <Badge variant="destructive" className="absolute -top-1 -left-1 h-5 w-5 p-0 text-[10px]">{totalReceipts}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="relative">
              <Send className="w-4 h-4 ml-1" />التسليم
              {standaloneDeliveries > 0 && <Badge variant="destructive" className="absolute -top-1 -left-1 h-5 w-5 p-0 text-[10px]">{standaloneDeliveries}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receipts" className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
            {renderReceipts()}
          </TabsContent>
          <TabsContent value="deliveries" className="flex-1 overflow-y-auto space-y-2 mt-3 pr-1">
            {renderDeliveries()}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* نافذة ملخص الإرسال للإدارة */}
      <Dialog open={!!summaryReceipt} onOpenChange={(o) => { if (!o) setSummaryReceipt(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              ملخص الإرسال للإدارة العليا
            </DialogTitle>
          </DialogHeader>

          {summaryReceipt && (
            <div id="receipt-summary-print" className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30">
                <div><span className="text-muted-foreground">رقم الفاتورة:</span> <strong>{summaryReceipt.invoice_number || '—'}</strong></div>
                <div><span className="text-muted-foreground">التاريخ:</span> <strong>{new Date(summaryReceipt.created_at).toLocaleString('ar')}</strong></div>
                <div><span className="text-muted-foreground">المُنشئ:</span> <strong>{summaryReceipt.creator_name || '—'}</strong></div>
                <div><span className="text-muted-foreground">المصدر:</span> <strong>{summaryReceipt.meta.source === 'branch' ? 'فرع آخر' : 'المصنع'}</strong></div>
                {summaryReceipt.meta.driver_name && (
                  <div><span className="text-muted-foreground">السائق:</span> <strong>{summaryReceipt.meta.driver_name}</strong></div>
                )}
                {summaryReceipt.meta.license_plate && (
                  <div><span className="text-muted-foreground">رقم اللوحة:</span> <strong>{summaryReceipt.meta.license_plate}</strong></div>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-right">المنتج</th>
                      <th className="p-2 text-center text-emerald-700">جديد</th>
                      <th className="p-2 text-center text-amber-700">تعويض تالف</th>
                      <th className="p-2 text-center text-purple-700">تعويض عروض</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryReceipt.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2">{getProductDisplayName({ name: it.product_name, app_name: it.product_app_name })}</td>
                        <td className="p-2 text-center font-semibold">{fmt(it.new_qty, it.pieces_per_box)}</td>
                        <td className="p-2 text-center">{fmt(it.comp_qty, it.pieces_per_box)}</td>
                        <td className="p-2 text-center">{fmt(it.comp_offers_qty, it.pieces_per_box)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <div className="text-xs text-muted-foreground">🪵 عدد الباليطات</div>
                  <div className="text-lg font-bold">{summaryReceipt.pallet_count || 0}</div>
                </div>
                <div className="p-3 border rounded-lg bg-rose-50 dark:bg-rose-950/20">
                  <div className="text-xs text-muted-foreground">💰 مصاريف الاستلام</div>
                  <div className="text-lg font-bold">{(summaryReceipt.receipt_expenses || 0).toLocaleString()} دج</div>
                  {summaryReceipt.expenses_description && (
                    <div className="text-[10px] text-muted-foreground mt-1">{summaryReceipt.expenses_description}</div>
                  )}
                </div>
              </div>

              {summaryReceipt.meta.text && (
                <div className="p-2 border rounded text-xs bg-muted/20">
                  <span className="text-muted-foreground">ملاحظات: </span>{summaryReceipt.meta.text}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t no-print">
            <Button variant="outline" className="flex-1" onClick={() => {
              const node = document.getElementById('receipt-summary-print');
              if (!node) return;
              const w = window.open('', '_blank', 'width=800,height=600');
              if (!w) return;
              w.document.write(`<html dir="rtl"><head><title>ملخص الاستلام</title>
                <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f3f4f6}</style>
                </head><body><h2>ملخص الاستلام للإدارة</h2>${node.innerHTML}</body></html>`);
              w.document.close();
              w.focus();
              setTimeout(() => { w.print(); w.close(); }, 300);
            }}>
              <FileText className="w-4 h-4 ml-1" /> طباعة
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={processingId === summaryReceipt?.id}
              onClick={async () => {
                if (!summaryReceipt) return;
                await approveReceipt(summaryReceipt);
                setSummaryReceipt(null);
              }}>
              {processingId === summaryReceipt?.id
                ? <Loader2 className="w-4 h-4 animate-spin ml-1" />
                : <Send className="w-4 h-4 ml-1" />}
              تأكيد الإرسال للإدارة
            </Button>
            <Button variant="ghost" onClick={() => setSummaryReceipt(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default FactoryApprovalsDialog;
