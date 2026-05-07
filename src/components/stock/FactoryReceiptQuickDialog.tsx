import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Package, Plus, Minus, Trash2, Loader2, ArrowDownToLine, Camera, CheckCircle, XCircle, Check, User, Phone, Car, X, Truck, ChevronRight, ChevronLeft, Printer, FileCheck2, Send, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole } from '@/lib/utils';
import { formatDate } from '@/utils/formatters';
import { parseBP, boxesToBP, boxesToBPAlways, dbBPDisplay, dbBPToBoxes } from '@/utils/boxPieceInput';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { buildReceiptItemRows, parseReceiptItemBreakdown, parseReceiptMeta, stringifyReceiptMeta, ReceiptSource } from '@/utils/stockReceipt';
import ReceiptPrintView from '@/components/stock/ReceiptPrintView';

interface ReceiptItem {
  product_id: string;
  new_quantity: number; // كمية جديدة
  compensation_quantity: number; // تعويض تالف
  compensation_offers_quantity: number; // تعويض عروض
  // Factory-return per-product details (used when source = factory & there's compensation)
  lot_number?: string | null;
  manufacturing_date?: string | null;
  manufacturing_time?: string | null;
  delivery_date?: string | null;
}

interface PendingReceipt {
  id: string;
  invoice_number: string | null;
  notes: string | null;
  total_items: number | null;
  created_at: string;
  status: string;
  created_by: string;
  creator_name?: string;
}

interface ProductOption {
  id: string;
  name: string;
  app_name?: string | null;
  image_url?: string | null;
  pieces_per_box?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editReceiptId?: string | null;
  onSaved?: () => void;
}

interface QuantityFields {
  boxes: string;
  pieces: string;
}

const sanitizeDigits = (value: string, maxDigits: number) => value.replace(/\D/g, '').slice(0, maxDigits);

const quantityToFields = (quantity: number, piecesPerBox: number): QuantityFields => {
  const parsed = parseBP(boxesToBP(quantity, piecesPerBox), piecesPerBox);
  return {
    boxes: String(parsed.boxes),
    pieces: parsed.pieces > 0 ? String(parsed.pieces) : '',
  };
};

const fieldsToQuantity = (fields: QuantityFields, piecesPerBox: number): number => {
  const boxes = sanitizeDigits(fields.boxes, 5) || '0';
  const pieces = sanitizeDigits(fields.pieces, 3) || '0';
  return parseBP(`${boxes}.${pieces}`, piecesPerBox).totalBoxes;
};

const normalizeFields = (fields: QuantityFields, piecesPerBox: number): QuantityFields => {
  return quantityToFields(fieldsToQuantity(fields, piecesPerBox), piecesPerBox);
};

const toDbQuantity = (quantity: number, piecesPerBox: number): number => {
  return piecesPerBox > 1 ? parseFloat(boxesToBP(quantity, piecesPerBox)) : quantity;
};

const fromDbQuantity = (quantity: number, piecesPerBox: number): number => {
  return piecesPerBox > 1 ? dbBPToBoxes(quantity, piecesPerBox) : quantity;
};

const formatDbQuantity = (quantity: number, piecesPerBox: number): string => {
  return piecesPerBox > 1 ? dbBPDisplay(quantity, piecesPerBox) : String(quantity);
};

const FactoryReceiptQuickDialog: React.FC<Props> = ({ open, onOpenChange, editReceiptId, onSaved }) => {
  const { workerId, role, activeRole, activeBranch } = useAuth();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [invoicePhoto, setInvoicePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [palletCount, setPalletCount] = useState(0);
  const [expenseLines, setExpenseLines] = useState<{ description: string; amount: number }[]>([]);
  const totalExpenses = expenseLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const expensesDescription = expenseLines
    .filter(l => l.description || l.amount)
    .map(l => `${l.description || 'مصروف'}: ${Number(l.amount || 0).toLocaleString()} دج`)
    .join(' • ');
  const [tab, setTab] = useState<'create' | 'pending'>('create');
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<{ product_name: string; quantity: number; image_url?: string | null; pieces_per_box?: number | null }[]>([]);
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);

  // New fields
  const [receiptSource, setReceiptSource] = useState<ReceiptSource>('factory');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  // Coupled "factory delivery" (تسليم للمصنع) — only when source = factory
  const [enableDelivery, setEnableDelivery] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState<Array<{
    product_id: string;
    quantity: number;
    lot_number?: string | null;
    manufacturing_date?: string | null;
    manufacturing_time?: string | null;
    delivery_date?: string | null;
  }>>([]);
  const [deliveryPalletCount, setDeliveryPalletCount] = useState(0);

  // Wizard step: 1=info, 2=receipt products, 3=delivery products
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Confirmation flags: user must explicitly confirm the lists before proceeding
  const [itemsConfirmed, setItemsConfirmed] = useState(false);
  const [deliveryItemsConfirmed, setDeliveryItemsConfirmed] = useState(false);
  // Reset confirmations whenever the underlying lists change
  useEffect(() => { setItemsConfirmed(false); }, [items]);
  useEffect(() => { setDeliveryItemsConfirmed(false); }, [deliveryItems]);

  // Product picker state (receipt)
  const [showPicker, setShowPicker] = useState(false);
  const [singleProductId, setSingleProductId] = useState<string | null>(null);
  const [newQtyFields, setNewQtyFields] = useState<QuantityFields>({ boxes: '0', pieces: '' });
  const [compQtyFields, setCompQtyFields] = useState<QuantityFields>({ boxes: '0', pieces: '' });
  const [compOffersQtyFields, setCompOffersQtyFields] = useState<QuantityFields>({ boxes: '0', pieces: '' });
  // Per-product factory-return detail fields
  const [lotNumber, setLotNumber] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const [manufacturingTime, setManufacturingTime] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Delivery picker state
  const [showDeliveryPicker, setShowDeliveryPicker] = useState(false);
  const [deliverySingleProductId, setDeliverySingleProductId] = useState<string | null>(null);
  const [delivQtyFields, setDelivQtyFields] = useState<QuantityFields>({ boxes: '0', pieces: '' });
  const [delivLotNumber, setDelivLotNumber] = useState('');
  const [delivManufacturingDate, setDelivManufacturingDate] = useState('');
  const [delivManufacturingTime, setDelivManufacturingTime] = useState('');
  const [delivDeliveryDate, setDelivDeliveryDate] = useState('');

  // Multi-select
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Review summary before submit (for warehouse manager)
  const [showReview, setShowReview] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const isWarehouseManager = activeRole?.custom_role_code === 'warehouse_manager';
  const isAdmin = isAdminRole(role);

  useEffect(() => {
    if (!open) return;
    if (activeBranch?.id) {
      setBranchId(activeBranch.id);
    } else if (workerId) {
      supabase.from('workers').select('branch_id').eq('id', workerId).maybeSingle()
        .then(({ data }) => setBranchId(data?.branch_id || null));
    }
  }, [open, activeBranch?.id, workerId]);

  useEffect(() => {
    if (!open || !branchId) return;
    supabase.from('products').select('id, name, app_name, image_url, pieces_per_box').eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []));
    fetchPendingReceipts();

    if (editReceiptId) {
      (async () => {
        const { data: r } = await supabase.from('stock_receipts').select('*').eq('id', editReceiptId).maybeSingle();
        if (!r) return;
        setInvoiceNumber(r.invoice_number || '');
        setPalletCount(Number((r as any).pallet_count) || 0);
        if (Array.isArray((r as any).expenses_breakdown)) {
          setExpenseLines((r as any).expenses_breakdown as any[]);
        }
        const meta = parseReceiptMeta(r.notes);
        setNotes(meta.text || '');
        setReceiptSource(meta.source || 'factory');
        setDriverName(meta.driver_name || '');
        setDriverPhone(meta.driver_phone || '');
        setLicensePlate(meta.license_plate || '');
        if (r.invoice_photo_url) setPhotoPreview(r.invoice_photo_url);

        const { data: rItems } = await supabase.from('stock_receipt_items')
          .select('*, product:products(pieces_per_box)').eq('receipt_id', editReceiptId);
        const grouped = new Map<string, ReceiptItem>();
        (rItems || []).forEach((it: any) => {
          const ppb = it.product?.pieces_per_box || 1;
          const breakdown = parseReceiptItemBreakdown(it);
          const newQ = fromDbQuantity(Number(breakdown.new_qty) || 0, ppb);
          const compQ = fromDbQuantity(Number(breakdown.comp_qty) || 0, ppb);
          const coQ = fromDbQuantity(Number(breakdown.comp_offers_qty) || 0, ppb);
          const existing = grouped.get(it.product_id);
          if (existing) {
            existing.new_quantity += newQ;
            existing.compensation_quantity += compQ;
            existing.compensation_offers_quantity += coQ;
          } else {
            grouped.set(it.product_id, {
              product_id: it.product_id,
              new_quantity: newQ,
              compensation_quantity: compQ,
              compensation_offers_quantity: coQ,
              lot_number: it.lot_number || null,
              manufacturing_date: it.manufacturing_date || null,
              manufacturing_time: it.manufacturing_time || null,
              delivery_date: it.delivery_date || null,
            });
          }
        });
        setItems(Array.from(grouped.values()));
      })();
    }
  }, [open, branchId, editReceiptId]);

  const fetchPendingReceipts = async () => {
    if (!branchId) return;
    setIsLoadingPending(true);
    const { data } = await supabase
      .from('stock_receipts')
      .select('id, invoice_number, notes, total_items, created_at, status, created_by')
      .eq('branch_id', branchId)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });
    const receipts = data || [];
    if (receipts.length > 0) {
      const creatorIds = [...new Set(receipts.map(r => r.created_by))];
      const { data: workers } = await supabase.from('workers').select('id, full_name').in('id', creatorIds);
      const workerMap = new Map((workers || []).map(w => [w.id, w.full_name]));
      receipts.forEach(r => { (r as any).creator_name = workerMap.get(r.created_by) || ''; });
    }
    setPendingReceipts(receipts as PendingReceipt[]);
    setIsLoadingPending(false);
  };

  const addItemFromPicker = (productId: string, newQty: number, compQty: number) => {
    if (newQty <= 0 && compQty <= 0) return;
    setItems(prev => {
      const existing = prev.findIndex(i => i.product_id === productId);
      if (existing >= 0) {
        return prev.map((item, idx) => idx === existing
          ? { ...item, new_quantity: item.new_quantity + newQty, compensation_quantity: item.compensation_quantity + compQty }
          : item
        );
      }
      return [...prev, { product_id: productId, new_quantity: newQty, compensation_quantity: compQty, compensation_offers_quantity: 0 }];
    });
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setInvoicePhoto(file); setPhotoPreview(URL.createObjectURL(file)); }
  };

  const handleSave = async () => {
    const validItems = items.filter(i => i.new_quantity > 0 || i.compensation_quantity > 0 || i.compensation_offers_quantity > 0);
    if (validItems.length === 0) { toast.error('أضف منتجات للاستلام'); return; }
    if (!branchId || !workerId) { toast.error('اختر الفرع أولاً'); return; }

    setIsSaving(true);
    try {
      let photoUrl: string | undefined;
      if (invoicePhoto) {
        const ext = invoicePhoto.name.split('.').pop();
        const fileName = `invoice_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, invoicePhoto);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }

      const status = isWarehouseManager && !isAdmin ? 'pending_approval' : 'confirmed';

      const dbValidItems = validItems.map((item) => {
        const ppb = getProduct(item.product_id)?.pieces_per_box || 1;
        return {
          ...item,
          new_quantity: toDbQuantity(item.new_quantity, ppb),
          compensation_quantity: toDbQuantity(item.compensation_quantity, ppb),
          compensation_offers_quantity: toDbQuantity(item.compensation_offers_quantity, ppb),
        };
      });

      let receiptId: string;

      if (editReceiptId) {
        // UPDATE existing receipt header
        const updatePayload: any = {
          invoice_number: invoiceNumber || null,
          notes: stringifyReceiptMeta({
            text: notes,
            source: receiptSource,
            driver_name: driverName || null,
            driver_phone: driverPhone || null,
            license_plate: licensePlate || null,
          }),
          total_items: validItems.length,
          pallet_count: palletCount || 0,
          receipt_expenses: totalExpenses || 0,
          expenses_description: expensesDescription || null,
          expenses_breakdown: expenseLines.filter(l => l.description || l.amount) as any,
        };
        if (photoUrl) updatePayload.invoice_photo_url = photoUrl;
        const { error: upErr } = await supabase.from('stock_receipts').update(updatePayload).eq('id', editReceiptId);
        if (upErr) throw upErr;
        // Replace items
        await supabase.from('stock_receipt_items').delete().eq('receipt_id', editReceiptId);
        receiptId = editReceiptId;
      } else {
        const { data: receipt, error: receiptError } = await supabase
          .from('stock_receipts')
          .insert({
            branch_id: branchId,
            created_by: workerId,
            invoice_number: invoiceNumber || null,
            invoice_photo_url: photoUrl || null,
            notes: stringifyReceiptMeta({
              text: notes,
              source: receiptSource,
              driver_name: driverName || null,
              driver_phone: driverPhone || null,
              license_plate: licensePlate || null,
            }),
            total_items: validItems.length,
            pallet_count: palletCount || 0,
            receipt_expenses: totalExpenses || 0,
            expenses_description: expensesDescription || null,
            expenses_breakdown: expenseLines.filter(l => l.description || l.amount) as any,
            status,
          })
          .select()
          .single();
        if (receiptError) throw receiptError;
        receiptId = receipt.id;
      }

      const receiptItems = buildReceiptItemRows(receiptId, dbValidItems);
      const { error: itemsError } = await supabase.from('stock_receipt_items').insert(receiptItems);
      if (itemsError) throw itemsError;

      if (editReceiptId) {
        toast.success('تم حفظ التعديلات');
      } else if (status === 'confirmed') {
        for (const item of validItems) {
          const ppb = getProduct(item.product_id)?.pieces_per_box || 1;
          const totalQty = item.new_quantity + item.compensation_quantity + item.compensation_offers_quantity;
          const totalQtyDb = toDbQuantity(totalQty, ppb);
          await supabase.from('stock_movements').insert({
            product_id: item.product_id, branch_id: branchId, quantity: totalQtyDb,
            movement_type: 'receipt', status: 'approved', created_by: workerId,
            receipt_id: receiptId,
            notes: `استلام من ${receiptSource === 'factory' ? 'المصنع' : 'فرع'} - جديد: ${boxesToBP(item.new_quantity, ppb)} تعويض تلف: ${boxesToBP(item.compensation_quantity, ppb)} تعويض عروض: ${boxesToBP(item.compensation_offers_quantity, ppb)}`,
          });

          const { data: existing } = await supabase.from('warehouse_stock')
            .select('id, quantity, compensation_quantity').eq('branch_id', branchId).eq('product_id', item.product_id).maybeSingle();
          const existingQuantity = fromDbQuantity(Number(existing?.quantity) || 0, ppb);
          const existingCompensationQuantity = fromDbQuantity(Number((existing as any)?.compensation_quantity) || 0, ppb);
          if (existing) {
            await supabase.from('warehouse_stock').update({
              quantity: toDbQuantity(existingQuantity + totalQty, ppb),
              compensation_quantity: toDbQuantity(existingCompensationQuantity + item.compensation_quantity, ppb),
            }).eq('id', existing.id);
          } else {
            await supabase.from('warehouse_stock').insert({
              branch_id: branchId,
              product_id: item.product_id,
              quantity: totalQtyDb,
              compensation_quantity: toDbQuantity(item.compensation_quantity, ppb),
            });
          }

          // If compensation, reduce factory_return tracking
          if (item.compensation_quantity > 0) {
            const { data: stock } = await supabase.from('warehouse_stock')
              .select('id, factory_return_quantity').eq('branch_id', branchId).eq('product_id', item.product_id).maybeSingle();
            if (stock) {
              const currentReturn = fromDbQuantity(Number(stock.factory_return_quantity) || 0, ppb);
              await supabase.from('warehouse_stock').update({
                factory_return_quantity: toDbQuantity(Math.max(0, currentReturn - item.compensation_quantity), ppb),
              }).eq('id', stock.id);
            }
          }
        }

        if (palletCount > 0) {
          const { data: bp } = await supabase.from('branch_pallets').select('id, quantity').eq('branch_id', branchId).maybeSingle();
          if (bp) { await supabase.from('branch_pallets').update({ quantity: bp.quantity + palletCount }).eq('id', bp.id); }
          else { await supabase.from('branch_pallets').insert({ branch_id: branchId, quantity: palletCount }); }
          await supabase.from('pallet_movements').insert({ branch_id: branchId, quantity: palletCount, movement_type: 'receipt', reference_id: receiptId, notes: `استلام باليطات`, created_by: workerId });
        }

        // Coupled factory delivery (when enabled) — uses same shipment metadata
        if (enableDelivery && receiptSource === 'factory') {
          const validDelivery = deliveryItems.filter(d => d.product_id && d.quantity > 0);
          if (validDelivery.length > 0 || deliveryPalletCount > 0) {
            try {
              const deliveryNotes = stringifyReceiptMeta({
                text: `تسليم مرتبط بالاستلام${invoiceNumber ? ` - فاتورة ${invoiceNumber}` : ''}${notes ? ` - ${notes}` : ''}`,
                source: 'factory',
                driver_name: driverName || null,
                driver_phone: driverPhone || null,
                license_plate: licensePlate || null,
              });
              const { data: foRow, error: foErr } = await supabase.from('factory_orders').insert({
                order_type: 'sending',
                branch_id: branchId,
                status: 'confirmed',
                notes: deliveryNotes,
                created_by: workerId,
                confirmed_at: new Date().toISOString(),
                pallet_count: deliveryPalletCount,
              } as any).select().single();
              if (foErr) throw foErr;

              if (validDelivery.length > 0) {
                const dItems = validDelivery.map(d => {
                  const ppb = getProduct(d.product_id)?.pieces_per_box || 1;
                  return {
                    factory_order_id: foRow.id,
                    product_id: d.product_id,
                    product_quantity: toDbQuantity(d.quantity, ppb),
                    pallet_quantity: 0,
                    lot_number: d.lot_number || null,
                    manufacturing_date: d.manufacturing_date || null,
                    manufacturing_time: d.manufacturing_time || null,
                    delivery_date: d.delivery_date || null,
                  };
                });
                await supabase.from('factory_order_items').insert(dItems);

                // Apply stock effects
                for (const d of validDelivery) {
                  const { data: stock } = await supabase.from('warehouse_stock')
                    .select('id, quantity, damaged_quantity, factory_return_quantity')
                    .eq('branch_id', branchId).eq('product_id', d.product_id).maybeSingle();
                  if (stock) {
                    const ppb = getProduct(d.product_id)?.pieces_per_box || 1;
                    const currentQty = fromDbQuantity(Number(stock.quantity) || 0, ppb);
                    const currentDamaged = fromDbQuantity(Number((stock as any).damaged_quantity) || 0, ppb);
                    const currentReturn = fromDbQuantity(Number((stock as any).factory_return_quantity) || 0, ppb);
                    await supabase.from('warehouse_stock').update({
                      quantity: toDbQuantity(Math.max(0, currentQty - d.quantity), ppb),
                      damaged_quantity: toDbQuantity(Math.max(0, currentDamaged - d.quantity), ppb),
                      factory_return_quantity: toDbQuantity(currentReturn + d.quantity, ppb),
                    }).eq('id', stock.id);
                  }
                }
              }

              if (deliveryPalletCount > 0) {
                const { data: bp } = await supabase.from('branch_pallets').select('id, quantity').eq('branch_id', branchId).maybeSingle();
                if (bp) await supabase.from('branch_pallets').update({ quantity: Math.max(0, bp.quantity - deliveryPalletCount) }).eq('id', bp.id);
                await supabase.from('pallet_movements').insert({
                  branch_id: branchId, quantity: -deliveryPalletCount, movement_type: 'delivery',
                  reference_id: foRow.id, notes: 'تسليم باليطات للمصنع (مرتبط بالاستلام)', created_by: workerId,
                });
              }
            } catch (de: any) {
              console.error('Coupled delivery failed', de);
              toast.error('تم الاستلام لكن فشل تسجيل التسليم: ' + (de.message || ''));
            }
          }
        }

        toast.success('تم تأكيد الاستلام');
      } else {
        toast.success('تم إرسال طلب الاستلام للموافقة');
      }

      resetForm();
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (receiptId: string) => {
    if (!workerId || !branchId) return;
    setProcessingId(receiptId);
    try {
      const { data: receiptData } = await supabase.from('stock_receipts').select('*').eq('id', receiptId).single();
      if (!receiptData || receiptData.status !== 'pending_approval') { toast.error('هذا الوصل تمت معالجته'); return; }
      const { data: rItems } = await supabase.from('stock_receipt_items').select('*, product:products(pieces_per_box)').eq('receipt_id', receiptId);
      await supabase.from('stock_receipts').update({
        status: 'confirmed',
        approved_by: workerId,
        approved_at: new Date().toISOString(),
      }).eq('id', receiptId);
      for (const item of (rItems || [])) {
        const ppb = item.product?.pieces_per_box || 1;
        const breakdown = parseReceiptItemBreakdown(item);
        const itemQuantity = fromDbQuantity(Number(item.quantity) || 0, ppb);
        const compensationQuantity = fromDbQuantity(Number(breakdown.comp_qty) || 0, ppb);
        const { error: movementError } = await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          branch_id: receiptData.branch_id,
          quantity: item.quantity,
          movement_type: 'receipt',
          status: 'approved',
          created_by: workerId,
          approved_by: workerId,
          approved_at: new Date().toISOString(),
          receipt_id: receiptId,
          reference_id: receiptId,
          reference_type: 'stock_receipt',
          from_location_type: 'external',
          to_location_type: 'warehouse',
          reason: 'manual',
          notes: `موافقة على استلام`,
        });
        if (movementError) throw movementError;
        const { data: existing } = await supabase.from('warehouse_stock')
          .select('id, quantity, compensation_quantity, factory_return_quantity').eq('branch_id', receiptData.branch_id).eq('product_id', item.product_id).maybeSingle();
        const existingQuantity = fromDbQuantity(Number(existing?.quantity) || 0, ppb);
        const existingCompensationQuantity = fromDbQuantity(Number((existing as any)?.compensation_quantity) || 0, ppb);
        const currentFactoryReturn = fromDbQuantity(Number((existing as any)?.factory_return_quantity) || 0, ppb);
        if (existing) {
          await supabase.from('warehouse_stock').update({
            quantity: toDbQuantity(existingQuantity + itemQuantity, ppb),
            compensation_quantity: toDbQuantity(existingCompensationQuantity + compensationQuantity, ppb),
            factory_return_quantity: toDbQuantity(Math.max(0, currentFactoryReturn - compensationQuantity), ppb),
          }).eq('id', existing.id);
        }
        else {
          await supabase.from('warehouse_stock').insert({
            branch_id: receiptData.branch_id,
            product_id: item.product_id,
            quantity: item.quantity,
            compensation_quantity: toDbQuantity(compensationQuantity, ppb),
          });
        }
      }
      toast.success('تمت الموافقة على الاستلام');
      fetchPendingReceipts();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (receiptId: string) => {
    if (!workerId) return;
    setProcessingId(receiptId);
    try {
      await supabase.from('stock_receipts').update({ status: 'rejected', approved_by: workerId, approved_at: new Date().toISOString() }).eq('id', receiptId);
      toast.success('تم رفض الاستلام');
      fetchPendingReceipts();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally {
      setProcessingId(null);
    }
  };

  const viewReceiptItems = async (receiptId: string) => {
    if (viewingReceiptId === receiptId) { setViewingReceiptId(null); return; }
    setViewingReceiptId(receiptId);
    const { data } = await supabase.from('stock_receipt_items').select('quantity, product:products(name, app_name, image_url, pieces_per_box)').eq('receipt_id', receiptId);
    setPendingItems((data || []).map((i: any) => ({ product_name: getProductDisplayName(i.product), quantity: i.quantity, image_url: i.product?.image_url, pieces_per_box: i.product?.pieces_per_box })));
  };

  const resetForm = () => {
    setItems([]);
    setInvoiceNumber('');
    setNotes('');
    setInvoicePhoto(null);
    setPhotoPreview(null);
    setPalletCount(0);
    setExpenseLines([]);
    setReceiptSource('factory');
    setDriverName('');
    setDriverPhone('');
    setLicensePlate('');
    setEnableDelivery(false);
    setDeliveryItems([]);
    setDeliveryPalletCount(0);
    setStep(1);
  };

  const getProduct = (id: string) => products.find(p => p.id === id);

  // Product picker handlers
  const handlePointerDown = useCallback((productId: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setMultiSelected(prev => { const next = new Set(prev); next.add(productId); return next; });
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleProductTap = (p: ProductOption) => {
    if (longPressTriggered.current) return;
    if (multiSelected.size > 0) {
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
        return next;
      });
      return;
    }
    setSingleProductId(p.id);
    // Pre-fill with existing quantities if already added
    const existing = items.find(i => i.product_id === p.id);
    if (existing) {
      const ppb = p.pieces_per_box || 1;
      setNewQtyFields(quantityToFields(existing.new_quantity, ppb));
      setCompQtyFields(quantityToFields(existing.compensation_quantity, ppb));
      setCompOffersQtyFields(quantityToFields(existing.compensation_offers_quantity, ppb));
      setLotNumber(existing.lot_number || '');
      setManufacturingDate(existing.manufacturing_date || '');
      setManufacturingTime(existing.manufacturing_time || '');
      setDeliveryDate(existing.delivery_date || '');
    } else {
      setNewQtyFields({ boxes: '1', pieces: '' });
      setCompQtyFields({ boxes: '0', pieces: '' });
      setCompOffersQtyFields({ boxes: '0', pieces: '' });
      setLotNumber('');
      setManufacturingDate('');
      setManufacturingTime('');
      setDeliveryDate('');
    }
  };

  const singleProduct = singleProductId ? products.find(p => p.id === singleProductId) : null;
  const singlePPB = singleProduct?.pieces_per_box || 1;
  const parsedNew = fieldsToQuantity(newQtyFields, singlePPB);
  const parsedComp = fieldsToQuantity(compQtyFields, singlePPB);
  const parsedCompOffers = fieldsToQuantity(compOffersQtyFields, singlePPB);

  const handleConfirmSingleProduct = () => {
    if (!singleProductId) return;
    const nq = parsedNew;
    const cq = parsedComp;
    const coq = parsedCompOffers;
    if (nq <= 0 && cq <= 0 && coq <= 0) return;
    const showFactoryDetails = receiptSource === 'factory' && (cq > 0 || coq > 0);
    const factoryFields = showFactoryDetails ? {
      lot_number: lotNumber || null,
      manufacturing_date: manufacturingDate || null,
      manufacturing_time: manufacturingTime || null,
      delivery_date: deliveryDate || null,
    } : { lot_number: null, manufacturing_date: null, manufacturing_time: null, delivery_date: null };
    // Replace existing quantities instead of adding
    setItems(prev => {
      const existing = prev.findIndex(i => i.product_id === singleProductId);
      if (existing >= 0) {
        return prev.map((item, idx) => idx === existing
          ? { ...item, new_quantity: nq, compensation_quantity: cq, compensation_offers_quantity: coq, ...factoryFields }
          : item
        );
      }
      return [...prev, { product_id: singleProductId, new_quantity: nq, compensation_quantity: cq, compensation_offers_quantity: coq, ...factoryFields }];
    });
    setSingleProductId(null);
  };

  // Edit item from the main list
  const handleEditItem = (item: ReceiptItem) => {
    const prod = getProduct(item.product_id);
    const ppb = prod?.pieces_per_box || 1;
    setSingleProductId(item.product_id);
    setNewQtyFields(quantityToFields(item.new_quantity, ppb));
    setCompQtyFields(quantityToFields(item.compensation_quantity, ppb));
    setCompOffersQtyFields(quantityToFields(item.compensation_offers_quantity, ppb));
    setLotNumber(item.lot_number || '');
    setManufacturingDate(item.manufacturing_date || '');
    setManufacturingTime(item.manufacturing_time || '');
    setDeliveryDate(item.delivery_date || '');
  };

  const handleConfirmMulti = () => {
    multiSelected.forEach(id => {
      addItemFromPicker(id, 1, 0);
    });
    setMultiSelected(new Set());
  };

  const filteredProducts = products;
  const alreadyAddedMap = new Map(items.map(i => [i.product_id, i]));
  const alreadyAddedIds = new Set(items.map(i => i.product_id));

  const printDetailedReport = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const dateStr = new Date().toLocaleString('fr');
    const newItems = items.filter(i => i.new_quantity > 0);
    const compItems = items.filter(i => i.compensation_quantity > 0);
    const offersItems = items.filter(i => i.compensation_offers_quantity > 0);

    const buildTable = (
      title: string,
      color: string,
      rows: ReceiptItem[],
      qtyFn: (it: ReceiptItem) => number,
      extra: boolean = false,
    ) => {
      if (rows.length === 0) return '';
      const total = rows.reduce((s, i) => s + qtyFn(i), 0);
      return `
        <div class="section">
          <div class="section-title" style="background:${color}">${title} <span style="float:left;font-weight:normal">إجمالي: ${total.toFixed(2)}</span></div>
          <table>
            <thead><tr>
              <th>#</th><th>المنتج</th><th>الكمية (B.P)</th>
              ${extra ? '<th>LOT</th><th>تاريخ التصنيع</th>' : ''}
            </tr></thead>
            <tbody>
              ${rows.map((it, i) => {
                const p = getProduct(it.product_id);
                const ppb = p?.pieces_per_box || 1;
                return `<tr>
                  <td>${i + 1}</td>
                  <td>${p ? getProductDisplayName(p) : '—'}</td>
                  <td style="text-align:center;font-weight:bold">${boxesToBPAlways(qtyFn(it), ppb)}</td>
                  ${extra ? `<td>${it.lot_number || '-'}</td><td>${it.manufacturing_date || '-'}</td>` : ''}
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    };

    const deliverySection = (enableDelivery && receiptSource === 'factory' && deliveryItems.length > 0) ? `
      <div class="big-section" style="border-color:#ea580c">
        <div class="big-title" style="background:#ea580c">🚚 التسليم للمصنع (مرتبط بالاستلام)</div>
        <table>
          <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>LOT</th><th>تاريخ التصنيع</th><th>وقت التصنيع</th></tr></thead>
          <tbody>
            ${deliveryItems.map((d, i) => {
              const p = getProduct(d.product_id);
              const ppb = p?.pieces_per_box || 1;
              return `<tr>
                <td>${i + 1}</td>
                <td>${p ? getProductDisplayName(p) : '—'}</td>
                <td style="text-align:center;font-weight:bold">${boxesToBPAlways(d.quantity, ppb)}</td>
                <td>${d.lot_number || '-'}</td>
                <td>${d.manufacturing_date || '-'}</td>
                <td>${d.manufacturing_time || '-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="meta">باليطات مرجعة: <strong>${deliveryPalletCount || 0}</strong></div>
      </div>` : '';

    const expensesSection = (expenseLines.length > 0 && totalExpenses > 0) ? `
      <div class="section">
        <div class="section-title" style="background:#475569">💰 المصاريف</div>
        <table>
          <thead><tr><th>#</th><th>الوصف</th><th>المبلغ (دج)</th></tr></thead>
          <tbody>
            ${expenseLines.filter(l => l.description || l.amount).map((l, i) => `
              <tr><td>${i + 1}</td><td>${l.description || '-'}</td><td style="text-align:center">${Number(l.amount || 0).toLocaleString()}</td></tr>
            `).join('')}
            <tr><td colspan="2" style="text-align:left;font-weight:bold">الإجمالي</td><td style="text-align:center;font-weight:bold">${totalExpenses.toLocaleString()} دج</td></tr>
          </tbody>
        </table>
      </div>` : '';

    w.document.write(`<html dir="rtl"><head><title>تقرير مفصل - وصل الاستلام</title><style>
      * { box-sizing: border-box; }
      body { font-family: 'Tahoma', Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
      h1 { text-align:center; font-size:22px; margin:0 0 4px; color:#1e293b; }
      .subtitle { text-align:center; color:#64748b; font-size:12px; margin-bottom:16px; }
      .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:12px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:16px; background:#f8fafc; font-size:13px; }
      .info-grid div { padding:4px 0; }
      .info-grid strong { color:#1e293b; }
      .big-section { border:2px solid #65a30d; border-radius:8px; overflow:hidden; margin-bottom:16px; }
      .big-title { background:#65a30d; color:#fff; padding:8px 12px; font-weight:bold; font-size:14px; }
      .section { border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; margin:8px; }
      .section-title { color:#fff; padding:6px 10px; font-weight:bold; font-size:12px; }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      th, td { border:1px solid #cbd5e1; padding:6px 8px; text-align:right; }
      th { background:#f1f5f9; font-weight:bold; }
      .meta { padding:8px 12px; background:#fff7ed; font-size:12px; }
      .signatures { display:flex; justify-content:space-between; margin-top:30px; }
      .signatures div { width:40%; text-align:center; border-top:1px solid #000; padding-top:6px; font-size:12px; }
      @media print { body { padding:10px; } }
    </style></head><body>
      <h1>تقرير مفصل — وصل الاستلام</h1>
      <div class="subtitle">${dateStr}</div>
      <div class="info-grid">
        <div>رقم الفاتورة: <strong>${invoiceNumber || '—'}</strong></div>
        <div>المصدر: <strong>${receiptSource === 'factory' ? 'المصنع' : 'فرع آخر'}</strong></div>
        <div>السائق: <strong>${driverName || '—'}</strong></div>
        <div>الهاتف: <strong>${driverPhone || '—'}</strong></div>
        <div>رقم اللوحة: <strong>${licensePlate || '—'}</strong></div>
        <div>عدد الباليطات: <strong>${palletCount || 0}</strong></div>
      </div>

      <div class="big-section">
        <div class="big-title">📥 الاستلام من ${receiptSource === 'factory' ? 'المصنع' : 'فرع آخر'}</div>
        ${buildTable('🆕 كمية جديدة', '#65a30d', newItems, (i) => i.new_quantity)}
        ${buildTable('🛠️ تعويض تلف', '#ea580c', compItems, (i) => i.compensation_quantity, true)}
        ${buildTable('🎁 تعويض عروض', '#2563eb', offersItems, (i) => i.compensation_offers_quantity, true)}
      </div>

      ${deliverySection}
      ${expensesSection}

      ${notes ? `<div style="padding:10px;border:1px dashed #94a3b8;border-radius:6px;margin-top:12px;font-size:12px"><strong>ملاحظات:</strong> ${notes}</div>` : ''}

      <div class="signatures">
        <div>توقيع المُستلم</div>
        <div>توقيع المُسلِّم</div>
      </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md w-[95vw] h-[90dvh] max-h-[90dvh] flex flex-col p-0 overflow-hidden top-[5dvh] translate-y-0" dir="rtl">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-lime-600" />
              {editReceiptId ? 'تعديل وصل الاستلام' : 'استلام مخزون'}
            </DialogTitle>
            {tab === 'create' && !editReceiptId && (
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2, 3].map((s) => {
                  const showStep3 = receiptSource === 'factory';
                  if (s === 3 && !showStep3) return null;
                  const labels: Record<number, string> = { 1: 'البيانات', 2: 'المنتجات', 3: 'تسليم للمصنع' };
                  return (
                    <div key={s} className="flex-1 flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-lime-600 text-white' : step > s ? 'bg-lime-200 text-lime-800' : 'bg-muted text-muted-foreground'}`}>{s}</div>
                      <span className={`text-[9px] mt-0.5 ${step === s ? 'font-bold text-lime-700' : 'text-muted-foreground'}`}>{labels[s]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogHeader>

          {isAdmin && !editReceiptId && (
            <div className="flex gap-2 px-4 pt-2 shrink-0">
              <Button variant={tab === 'create' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setTab('create')}>
                <Plus className="w-4 h-4 ml-1" /> إنشاء وصل
              </Button>
              <Button variant={tab === 'pending' ? 'default' : 'outline'} size="sm" className="flex-1 relative" onClick={() => { setTab('pending'); fetchPendingReceipts(); }}>
                طلبات معلقة
                {pendingReceipts.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -left-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                    {pendingReceipts.length}
                  </Badge>
                )}
              </Button>
            </div>
          )}

          {tab === 'create' ? (
            <>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
              {isWarehouseManager && !isAdmin && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-200">
                  ⚠️ سيتم إرسال الطلب لمدير الفرع للموافقة قبل تحديث المخزون
                </div>
              )}

              {/* STEP 1: Info */}
              {(step === 1 || editReceiptId) && (
                <>
              <div>
                <Label className="text-xs font-semibold">مصدر الاستلام</Label>
                <div className="flex gap-2 mt-1">
                  <Button type="button" variant={receiptSource === 'factory' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setReceiptSource('factory')}>
                    🏭 المصنع
                  </Button>
                  <Button type="button" variant={receiptSource === 'branch' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setReceiptSource('branch')}>
                    🏢 فرع آخر
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">رقم الفاتورة</Label>
                  <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="text-right h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">🪵 باليطات</Label>
                  <Input type="number" min={0} value={palletCount} onChange={e => setPalletCount(parseInt(e.target.value) || 0)} className="text-center h-8 text-sm" />
                </div>
              </div>

              <div className="border rounded-lg p-2.5 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">💰 مصاريف الاستلام</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setExpenseLines(prev => [...prev, { description: '', amount: 0 }])}>
                    <Plus className="w-3 h-3 ml-1" /> إضافة مصروف
                  </Button>
                </div>
                {expenseLines.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-1">لا توجد مصاريف</p>
                ) : (
                  <div className="space-y-1.5">
                    {expenseLines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Input value={line.description} onChange={e => setExpenseLines(prev => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))} className="h-8 text-xs flex-1" placeholder="الوصف" />
                        <Input type="number" min={0} value={line.amount || ''} onChange={e => setExpenseLines(prev => prev.map((l, i) => i === idx ? { ...l, amount: parseFloat(e.target.value) || 0 } : l))} className="h-8 text-xs w-24 text-center" placeholder="المبلغ" />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setExpenseLines(prev => prev.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <div className="text-[11px] font-bold text-amber-700 text-end pt-1 border-t">الإجمالي: {totalExpenses.toLocaleString()} دج</div>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-2.5 bg-muted/30 space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> بيانات السائق / الشاحنة</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> اسم السائق</Label>
                    <Input value={driverName} onChange={e => setDriverName(e.target.value)} className="h-7 text-xs" placeholder="الاسم الكامل" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> الهاتف</Label>
                    <Input value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="h-7 text-xs" placeholder="رقم الهاتف" type="tel" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="w-3 h-3" /> لوحة الترقيم</Label>
                  <Input value={licensePlate} onChange={e => setLicensePlate(e.target.value)} className="h-7 text-xs" placeholder="رقم اللوحة" />
                </div>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1"><Camera className="w-3 h-3" /> صورة الفاتورة</Label>
                <Input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="text-xs h-8" />
                {photoPreview && <img src={photoPreview} className="mt-1 w-full h-24 object-cover rounded-lg" alt="preview" />}
              </div>

              <div>
                <Label className="text-xs">ملاحظات</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} className="text-right h-8 text-sm" />
              </div>
                </>
              )}

              {/* STEP 2: Receipt products */}
              {(step === 2 || editReceiptId) && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold">المنتجات ({items.length})</Label>
                    <Button variant="default" size="sm" className="h-7 text-xs" onClick={() => setShowPicker(true)}>
                      <Plus className="w-3.5 h-3.5 ml-1" /> إضافة منتجات
                    </Button>
                  </div>
                  {items.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
                      اضغط "إضافة منتجات" لاختيار المنتجات
                    </div>
                  ) : (
                    <>
                    <div className="space-y-1.5">
                      {items.map((item, index) => {
                        const prod = getProduct(item.product_id);
                        const ppb = prod?.pieces_per_box || 1;
                        return (
                          <div key={item.product_id} className="flex items-center gap-2 p-2 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleEditItem(item)}>
                            {prod?.image_url ? (
                              <img src={prod.image_url} alt={prod?.name} className="w-9 h-9 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-muted-foreground/40" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-semibold truncate">{getProductDisplayName(prod as any) || 'منتج'}</div>
                              <div className="flex gap-1.5 text-[9px] flex-wrap">
                                {item.new_quantity > 0 && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 font-bold text-white">جديد {boxesToBP(item.new_quantity, ppb)}</span>}
                                {item.compensation_quantity > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 font-bold text-white">تعويض {boxesToBP(item.compensation_quantity, ppb)}</span>}
                                {item.compensation_offers_quantity > 0 && <span className="rounded-full bg-amber-600 px-1.5 py-0.5 font-bold text-white">عروض {boxesToBP(item.compensation_offers_quantity, ppb)}</span>}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); removeItem(index); }}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    {!editReceiptId && (
                      <Button
                        type="button"
                        className={`w-full mt-2 ${itemsConfirmed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-lime-600 hover:bg-lime-700'}`}
                        onClick={() => setItemsConfirmed(true)}
                        disabled={itemsConfirmed}
                      >
                        {itemsConfirmed ? (
                          <><CheckCircle className="w-4 h-4 ml-1" /> تم تأكيد قائمة الاستلام</>
                        ) : (
                          <><Check className="w-4 h-4 ml-1" /> تأكيد قائمة الاستلام ({items.length})</>
                        )}
                      </Button>
                    )}
                    </>
                  )}
                </div>
              )}

              {/* STEP 3: Coupled Factory Delivery */}
              {step === 3 && receiptSource === 'factory' && !editReceiptId && (
                <div className="border rounded-lg p-2.5 bg-orange-50/40 dark:bg-orange-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-orange-600" />
                      تسليم مرتبط للمصنع (تالف/إرجاع)
                    </Label>
                    <Switch checked={enableDelivery} onCheckedChange={setEnableDelivery} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">يستخدم نفس بيانات السائق/الشاحنة. لا حاجة لإدخالها مرتين.</p>

                  {enableDelivery && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <Label className="text-[11px]">🪵 باليطات للتسليم</Label>
                        <Input type="number" min={0} value={deliveryPalletCount} onChange={e => setDeliveryPalletCount(parseInt(e.target.value) || 0)} className="h-8 text-sm text-center" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-semibold">المنتجات التالفة ({deliveryItems.length})</Label>
                          <Button type="button" variant="default" size="sm" className="h-7 text-xs" onClick={() => setShowDeliveryPicker(true)}>
                            <Plus className="w-3 h-3 ml-1" /> إضافة منتجات
                          </Button>
                        </div>
                        {deliveryItems.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground text-center py-2">اضغط "إضافة منتجات" لاختيار التالف</p>
                        ) : (
                          <>
                          {deliveryItems.map((d, idx) => {
                            const prod = getProduct(d.product_id);
                            const ppb = prod?.pieces_per_box || 1;
                            return (
                              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-card cursor-pointer hover:bg-accent/50" onClick={() => {
                                setDeliverySingleProductId(d.product_id);
                                setDelivQtyFields(quantityToFields(d.quantity, ppb));
                                setDelivLotNumber(d.lot_number || '');
                                setDelivManufacturingDate(d.manufacturing_date || '');
                                setDelivManufacturingTime(d.manufacturing_time || '');
                                setDelivDeliveryDate(d.delivery_date || '');
                              }}>
                                {prod?.image_url ? (
                                  <img src={prod.image_url} alt={prod?.name} className="w-9 h-9 rounded object-cover shrink-0" />
                                ) : (
                                  <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-muted-foreground/40" /></div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-semibold truncate">{getProductDisplayName(prod as any) || 'منتج'}</div>
                                  <div className="flex gap-1.5 text-[9px] flex-wrap">
                                    <span className="rounded-full bg-orange-600 px-1.5 py-0.5 font-bold text-white">تالف {boxesToBP(d.quantity, ppb)}</span>
                                    {d.lot_number && <span className="rounded-full bg-purple-600 px-1.5 py-0.5 font-bold text-white">LOT {d.lot_number}</span>}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); setDeliveryItems(prev => prev.filter((_, i) => i !== idx)); }}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                            );
                          })}
                          <Button
                            type="button"
                            className={`w-full mt-1 ${deliveryItemsConfirmed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                            onClick={() => setDeliveryItemsConfirmed(true)}
                            disabled={deliveryItemsConfirmed}
                          >
                            {deliveryItemsConfirmed ? (
                              <><CheckCircle className="w-4 h-4 ml-1" /> تم تأكيد قائمة التسليم</>
                            ) : (
                              <><Check className="w-4 h-4 ml-1" /> تأكيد قائمة التسليم ({deliveryItems.length})</>
                            )}
                          </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky footer with prev/next/save */}
            <DialogFooter className="px-4 py-3 border-t shrink-0 flex-row gap-2 sm:flex-row">
              {editReceiptId ? (
                <Button onClick={handleSave} disabled={isSaving} className="w-full bg-lime-600 hover:bg-lime-700">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ التعديلات
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" disabled={step === 1} onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}>
                    <ChevronRight className="w-4 h-4 ml-1" /> السابق
                  </Button>
                  {((step === 2 && receiptSource !== 'factory') || step === 3) ? (
                    <Button onClick={() => {
                      const validItems = items.filter(i => i.new_quantity > 0 || i.compensation_quantity > 0 || i.compensation_offers_quantity > 0);
                      if (validItems.length === 0) { toast.error('أضف منتجات للاستلام'); return; }
                      if (!itemsConfirmed) { toast.error('اضغط "تأكيد قائمة الاستلام" أولاً'); return; }
                      if (step === 3 && enableDelivery && deliveryItems.length > 0 && !deliveryItemsConfirmed) {
                        toast.error('اضغط "تأكيد قائمة التسليم" أولاً'); return;
                      }
                      setShowReview(true);
                    }} disabled={isSaving} className="flex-1 bg-lime-600 hover:bg-lime-700">
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                      <FileCheck2 className="w-4 h-4 ml-1" />
                      مراجعة قبل الإرسال
                    </Button>
                  ) : (
                    <Button className="flex-1 bg-lime-600 hover:bg-lime-700" onClick={() => {
                      if (step === 2 && items.length > 0 && !itemsConfirmed) {
                        toast.error('اضغط "تأكيد قائمة الاستلام" أولاً'); return;
                      }
                      setStep(s => (s + 1) as 1 | 2 | 3);
                    }}>
                      التالي <ChevronLeft className="w-4 h-4 mr-1" />
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
            </>
          ) : (
            /* Pending tab */
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
              {isLoadingPending ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : pendingReceipts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد طلبات معلقة</div>
              ) : (
                pendingReceipts.map(receipt => (
                  <div key={receipt.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {receipt.invoice_number ? `فاتورة: ${receipt.invoice_number}` : 'استلام بدون فاتورة'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {receipt.creator_name} • {formatDate(receipt.created_at, 'dd/MM HH:mm', 'ar')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">بانتظار الموافقة</Badge>
                    </div>
                    {receipt.notes && <p className="text-xs text-muted-foreground">{receipt.notes}</p>}
                    <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => viewReceiptItems(receipt.id)}>
                      عرض المنتجات ({receipt.total_items} عنصر)
                    </Button>
                    {viewingReceiptId === receipt.id && pendingItems.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-2 space-y-1.5">
                        {pendingItems.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.product_name} className="w-8 h-8 rounded object-cover shrink-0 border" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 border">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <span className="flex-1 truncate">{item.product_name}</span>
                            <Badge variant="secondary" className="text-xs font-bold">{formatDbQuantity(Number(item.quantity), item.pieces_per_box || 1)}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={processingId === receipt.id} onClick={() => handleApprove(receipt.id)}>
                        {processingId === receipt.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 ml-1" />}
                        موافقة
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1" disabled={processingId === receipt.id} onClick={() => handleReject(receipt.id)}>
                        <XCircle className="w-3.5 h-3.5 ml-1" /> رفض
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Picker Grid Dialog */}
      <Dialog open={showPicker} onOpenChange={(v) => { if (!v) { setShowPicker(false); setMultiSelected(new Set()); } }}>
        <DialogContent className="w-[95vw] max-w-md h-[85dvh] max-h-[85dvh] flex flex-col p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="px-3 pt-3 pb-1 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Package className="w-5 h-5 text-lime-600" />
              منتجات الاستلام
              {multiSelected.size > 0 && <Badge className="text-[10px]">{multiSelected.size} محدد</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="px-3 pb-1 shrink-0">
            <div className="text-[9px] text-muted-foreground text-center">اضغط مطولاً لتحديد عدة منتجات</div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-1 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="grid grid-cols-4 gap-1.5">
              {filteredProducts.map(p => {
                const isAdded = alreadyAddedIds.has(p.id);
                const isMultiSel = multiSelected.has(p.id);
                const addedItem = alreadyAddedMap.get(p.id);
                const ppb = p.pieces_per_box || 1;
                return (
                  <button
                    key={p.id}
                    className={`flex flex-col rounded-xl overflow-hidden text-center transition-all relative bg-card shadow-sm border cursor-pointer active:scale-95
                      ${isAdded ? 'border-lime-500 ring-2 ring-lime-500/40' : ''}
                      ${isMultiSel ? 'border-primary ring-2 ring-primary/50' : ''}
                      ${!isAdded && !isMultiSel ? 'border-border/50' : ''}
                    `}
                    onClick={() => handleProductTap(p)}
                    onPointerDown={() => handlePointerDown(p.id)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onContextMenu={e => e.preventDefault()}
                  >
                    {isMultiSel && (
                      <div className="absolute top-1 start-1 z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    {isAdded && !isMultiSel && (
                      <div className="absolute top-1 start-1 z-10 w-5 h-5 rounded-full bg-lime-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {/* Quantity badges */}
                    {isAdded && addedItem && (
                      <div className="absolute bottom-0 inset-x-0 z-10 flex justify-center gap-0.5 pb-0.5">
                        {addedItem.new_quantity > 0 && (
                          <span className="bg-lime-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm leading-none">
                            جديد {boxesToBP(addedItem.new_quantity, ppb)}
                          </span>
                        )}
                        {addedItem.compensation_quantity > 0 && (
                          <span className="bg-red-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm leading-none">
                            تعويض {boxesToBP(addedItem.compensation_quantity, ppb)}
                          </span>
                        )}
                        {addedItem.compensation_offers_quantity > 0 && (
                          <span className="bg-amber-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm leading-none">
                            عروض {boxesToBP(addedItem.compensation_offers_quantity, ppb)}
                          </span>
                        )}
                      </div>
                    )}
                    <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full
                      ${isAdded ? 'bg-lime-500/10 text-lime-700' : 'bg-muted/30 text-foreground'}
                    `}>
                      {getProductDisplayName(p)}
                    </div>
                    {p.image_url ? (
                      <img src={p.image_url} alt={getProductDisplayName(p)} className="w-full aspect-square object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted/20">
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {multiSelected.size > 0 && (
            <div className="px-3 py-2 border-t shrink-0 flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setMultiSelected(new Set())}>
                <X className="w-3.5 h-3.5 me-1" /> إلغاء
              </Button>
              <Button className="flex-1 h-9 text-xs bg-lime-600 hover:bg-lime-700" onClick={handleConfirmMulti}>
                <Plus className="w-3.5 h-3.5 me-1" /> إضافة {multiSelected.size} منتج
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Product Quantity Dialog */}
      <Dialog open={!!singleProduct} onOpenChange={(v) => { if (!v) setSingleProductId(null); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4 text-lime-600" />
              إضافة للاستلام
            </DialogTitle>
          </DialogHeader>

          {singleProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-2">
                {singleProduct.image_url ? (
                  <img src={singleProduct.image_url} alt={singleProduct.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-base text-primary truncate">{getProductDisplayName(singleProduct)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">الصندوق = {singlePPB} قطعة</p>
                </div>
              </div>

              {/* New Quantity */}
              <div className="space-y-1 border rounded-lg p-2.5 bg-blue-50/60 dark:bg-blue-950/20">
                <Label className="text-center block text-xs font-semibold text-blue-700">الكمية الجديدة (صندوق.قطع)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-blue-700">الصندوق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={newQtyFields.boxes}
                      onChange={e => setNewQtyFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                      onBlur={() => setNewQtyFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="00000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-blue-700">القطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={newQtyFields.pieces}
                      onChange={e => setNewQtyFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                      onBlur={() => setNewQtyFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="000"
                    />
                  </div>
                </div>
                <div className="text-center text-[11px] text-muted-foreground">سيُحفظ: {boxesToBP(parsedNew, singlePPB)}</div>
              </div>

              {/* Compensation Quantity */}
              <div className="space-y-1 border rounded-lg p-2.5 bg-red-50/60 dark:bg-red-950/20">
                <Label className="text-center block text-xs font-semibold text-red-700">تعويض التلف (صندوق.قطع)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-red-700">الصندوق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={compQtyFields.boxes}
                      onChange={e => setCompQtyFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                      onBlur={() => setCompQtyFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="00000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-red-700">القطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={compQtyFields.pieces}
                      onChange={e => setCompQtyFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                      onBlur={() => setCompQtyFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="000"
                    />
                  </div>
                </div>
                <div className="text-center text-[11px] text-muted-foreground">سيُحفظ: {boxesToBP(parsedComp, singlePPB)}</div>
              </div>

              {/* Compensation Offers Quantity */}
              <div className="space-y-1 border rounded-lg p-2.5 bg-amber-50/60 dark:bg-amber-950/20">
                <Label className="text-center block text-xs font-semibold text-amber-700">تعويض العروض (صندوق.قطع)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-amber-700">الصندوق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={compOffersQtyFields.boxes}
                      onChange={e => setCompOffersQtyFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                      onBlur={() => setCompOffersQtyFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="00000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-amber-700">القطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={compOffersQtyFields.pieces}
                      onChange={e => setCompOffersQtyFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                      onBlur={() => setCompOffersQtyFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="000"
                    />
                  </div>
                </div>
                <div className="text-center text-[11px] text-muted-foreground">سيُحفظ: {boxesToBP(parsedCompOffers, singlePPB)}</div>
              </div>

              {receiptSource === 'factory' && (parsedComp > 0 || parsedCompOffers > 0) && (
                <div className="space-y-2 border rounded-lg p-2.5 bg-purple-50/60 dark:bg-purple-950/20">
                  <Label className="text-center block text-xs font-semibold text-purple-700">📋 تفاصيل التسليم للمصنع</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-purple-700">N° de LOT</Label>
                      <Input value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="h-8 text-xs" placeholder="LOT 18" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-purple-700">Heure de fabrication</Label>
                      <Input value={manufacturingTime} onChange={e => setManufacturingTime(e.target.value)} className="h-8 text-xs" placeholder="12H33" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-purple-700">Date de fabrication</Label>
                      <Input type="date" value={manufacturingDate} onChange={e => setManufacturingDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-purple-700">Date de livraison</Label>
                      <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                </div>
              )}

              <Button className="w-full bg-lime-600 hover:bg-lime-700" onClick={handleConfirmSingleProduct}>
                <Plus className="w-4 h-4 ml-1" /> إضافة للاستلام
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setSingleProductId(null)}>
                إلغاء
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delivery Product Picker Grid */}
      <Dialog open={showDeliveryPicker} onOpenChange={(v) => { if (!v) setShowDeliveryPicker(false); }}>
        <DialogContent className="w-[95vw] max-w-md h-[85dvh] max-h-[85dvh] flex flex-col p-0 overflow-hidden top-[5dvh] translate-y-0" dir="rtl">
          <DialogHeader className="px-3 pt-3 pb-1 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Truck className="w-5 h-5 text-orange-600" />
              منتجات التسليم للمصنع (تالف)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
            <div className="grid grid-cols-4 gap-1.5">
              {products.map(p => {
                const added = deliveryItems.find(d => d.product_id === p.id);
                const ppb = p.pieces_per_box || 1;
                return (
                  <button
                    key={p.id}
                    className={`flex flex-col rounded-xl overflow-hidden text-center transition-all relative bg-card shadow-sm border cursor-pointer active:scale-95 ${added ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-border/50'}`}
                    onClick={() => {
                      setShowDeliveryPicker(false);
                      setDeliverySingleProductId(p.id);
                      setDelivQtyFields(added ? quantityToFields(added.quantity, ppb) : { boxes: '1', pieces: '' });
                      setDelivLotNumber(added?.lot_number || '');
                      setDelivManufacturingDate(added?.manufacturing_date || '');
                      setDelivManufacturingTime(added?.manufacturing_time || '');
                      setDelivDeliveryDate(added?.delivery_date || '');
                    }}
                  >
                    {added && (
                      <div className="absolute top-1 start-1 z-10 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {added && (
                      <div className="absolute bottom-0 inset-x-0 z-10 flex justify-center pb-0.5">
                        <span className="bg-orange-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm">تالف {boxesToBP(added.quantity, ppb)}</span>
                      </div>
                    )}
                    <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full ${added ? 'bg-orange-500/10 text-orange-700' : 'bg-muted/30'}`}>
                      {getProductDisplayName(p)}
                    </div>
                    {p.image_url ? (
                      <img src={p.image_url} alt={getProductDisplayName(p)} className="w-full aspect-square object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted/20"><Package className="w-6 h-6 text-muted-foreground/30" /></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery single product detail dialog */}
      <Dialog open={!!deliverySingleProductId} onOpenChange={(v) => { if (!v) setDeliverySingleProductId(null); }}>
        <DialogContent className="max-w-sm top-[5dvh] translate-y-0" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="w-4 h-4 text-orange-600" />
              تفاصيل المنتج التالف
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const dp = products.find(p => p.id === deliverySingleProductId);
            if (!dp) return null;
            const ppb = dp.pieces_per_box || 1;
            const qty = fieldsToQuantity(delivQtyFields, ppb);
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-2">
                  {dp.image_url ? (
                    <img src={dp.image_url} alt={dp.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0"><Package className="w-6 h-6 text-muted-foreground/40" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-base text-primary truncate">{getProductDisplayName(dp)}</h3>
                    <p className="text-xs text-muted-foreground mt-1">الصندوق = {ppb} قطعة</p>
                  </div>
                </div>

                <div className="space-y-1 border rounded-lg p-2.5 bg-orange-50/60 dark:bg-orange-950/20">
                  <Label className="text-center block text-xs font-semibold text-orange-700">كمية التالف (صندوق.قطع)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-orange-700">الصندوق</Label>
                      <Input type="text" inputMode="numeric" value={delivQtyFields.boxes}
                        onChange={e => setDelivQtyFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                        onBlur={() => setDelivQtyFields(prev => normalizeFields(prev, ppb))}
                        className="h-11 text-center text-lg font-bold" placeholder="00000" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-orange-700">القطع</Label>
                      <Input type="text" inputMode="numeric" value={delivQtyFields.pieces}
                        onChange={e => setDelivQtyFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                        onBlur={() => setDelivQtyFields(prev => normalizeFields(prev, ppb))}
                        className="h-11 text-center text-lg font-bold" placeholder="000" />
                    </div>
                  </div>
                  <div className="text-center text-[11px] text-muted-foreground">سيُحفظ: {boxesToBP(qty, ppb)}</div>
                </div>

                <div className="space-y-2 border rounded-lg p-2.5 bg-purple-50/60 dark:bg-purple-950/20">
                  <Label className="text-center block text-xs font-semibold text-purple-700">📋 تفاصيل التسليم للمصنع</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-purple-700">N° de LOT</Label>
                      <Input value={delivLotNumber} onChange={e => setDelivLotNumber(e.target.value)} className="h-8 text-xs" placeholder="LOT 18" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-purple-700">Heure de fabrication</Label>
                      <Input value={delivManufacturingTime} onChange={e => setDelivManufacturingTime(e.target.value)} className="h-8 text-xs" placeholder="12H33" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-purple-700">Date de fabrication</Label>
                      <Input type="date" value={delivManufacturingDate} onChange={e => setDelivManufacturingDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-purple-700">Date de livraison</Label>
                      <Input type="date" value={delivDeliveryDate} onChange={e => setDelivDeliveryDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => {
                  if (qty <= 0) { toast.error('أدخل كمية صحيحة'); return; }
                  const payload = {
                    product_id: deliverySingleProductId!,
                    quantity: qty,
                    lot_number: delivLotNumber || null,
                    manufacturing_date: delivManufacturingDate || null,
                    manufacturing_time: delivManufacturingTime || null,
                    delivery_date: delivDeliveryDate || null,
                  };
                  setDeliveryItems(prev => {
                    const idx = prev.findIndex(d => d.product_id === deliverySingleProductId);
                    if (idx >= 0) return prev.map((d, i) => i === idx ? payload : d);
                    return [...prev, payload];
                  });
                  setDeliverySingleProductId(null);
                }}>
                  <Plus className="w-4 h-4 ml-1" /> حفظ المنتج التالف
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setDeliverySingleProductId(null)}>إلغاء</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* نافذة المراجعة قبل الإرسال للموافقة */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90dvh] overflow-y-auto overflow-x-hidden p-3 sm:p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-lime-600" />
              مراجعة وصل الاستلام
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {/* ====== قسم الاستلام ====== */}
            <div className="rounded-lg border-2 border-lime-300 bg-lime-50/40 overflow-hidden">
              <div className="bg-lime-600 text-white px-3 py-2 flex items-center gap-2 font-bold text-sm">
                <ArrowDownToLine className="w-4 h-4" />
                الاستلام من {receiptSource === 'factory' ? 'المصنع' : 'فرع آخر'}
              </div>
              <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-white border">
              <div><span className="text-muted-foreground">رقم الفاتورة:</span> <strong>{invoiceNumber || '—'}</strong></div>
              <div><span className="text-muted-foreground">المصدر:</span> <strong>{receiptSource === 'factory' ? 'المصنع' : 'فرع آخر'}</strong></div>
              {driverName && <div><span className="text-muted-foreground">السائق:</span> <strong>{driverName}</strong></div>}
              {driverPhone && <div><span className="text-muted-foreground">الهاتف:</span> <strong>{driverPhone}</strong></div>}
              {licensePlate && <div className="col-span-2"><span className="text-muted-foreground">رقم اللوحة:</span> <strong>{licensePlate}</strong></div>}
            </div>

            {(() => {
              const newItems = items.filter(i => i.new_quantity > 0);
              const compItems = items.filter(i => i.compensation_quantity > 0);
              const offersItems = items.filter(i => i.compensation_offers_quantity > 0);
              const sections = [
                { key: 'new', title: 'كمية جديدة', items: newItems, qty: (i: ReceiptItem) => i.new_quantity, color: 'lime', border: 'border-lime-300', headerBg: 'bg-lime-100', headerText: 'text-lime-800', badge: 'bg-lime-600 text-white' },
                { key: 'comp', title: 'تعويض تلف', items: compItems, qty: (i: ReceiptItem) => i.compensation_quantity, color: 'orange', border: 'border-orange-300', headerBg: 'bg-orange-100', headerText: 'text-orange-800', badge: 'bg-orange-600 text-white' },
                { key: 'offers', title: 'تعويض عروض', items: offersItems, qty: (i: ReceiptItem) => i.compensation_offers_quantity, color: 'blue', border: 'border-blue-300', headerBg: 'bg-blue-100', headerText: 'text-blue-800', badge: 'bg-blue-600 text-white' },
              ];
              return sections.filter(s => s.items.length > 0).map(s => {
                const totalBoxes = s.items.reduce((sum, i) => sum + s.qty(i), 0);
                return (
                  <div key={s.key} className={`border-2 ${s.border} rounded-lg overflow-hidden`}>
                    <div className={`${s.headerBg} ${s.headerText} px-3 py-1.5 text-xs font-bold flex items-center justify-between`}>
                      <span>{s.title} ({s.items.length})</span>
                      <span>إجمالي: {totalBoxes.toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 bg-white">
                      {s.items.map((it, idx) => {
                        const p = getProduct(it.product_id);
                        const ppb = p?.pieces_per_box || 1;
                        return (
                          <div key={idx} className="border rounded-lg p-1.5 flex flex-col items-center text-center bg-white">
                            {p?.image_url ? (
                              <img src={p.image_url} alt="" className="w-14 h-14 rounded object-cover mb-1" />
                            ) : (
                              <div className="w-14 h-14 rounded bg-muted flex items-center justify-center mb-1"><Package className="w-6 h-6 text-muted-foreground" /></div>
                            )}
                            <div className="text-[10px] font-semibold leading-tight line-clamp-2 min-h-[24px]">{p ? getProductDisplayName(p) : '—'}</div>
                            <span className={`mt-1 w-full text-[11px] ${s.badge} rounded px-1 py-0.5 font-bold`}>{boxesToBPAlways(s.qty(it), ppb)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}

            <div className="grid grid-cols-2 gap-2">
              <div className="border rounded-lg p-2 text-center bg-white">
                <div className="text-[10px] text-muted-foreground">عدد الباليطات</div>
                <div className="text-lg font-bold">{palletCount || 0}</div>
              </div>
              <div className="border rounded-lg p-2 text-center bg-white">
                <div className="text-[10px] text-muted-foreground">إجمالي المصاريف</div>
                <div className="text-lg font-bold">{totalExpenses.toLocaleString()} دج</div>
              </div>
            </div>

            {notes && (
              <div className="text-xs p-2 rounded bg-white border">
                <span className="text-muted-foreground">ملاحظات: </span>{notes}
              </div>
            )}
              </div>
            </div>

            {/* ====== قسم التسليم للمصنع (إن وُجد) ====== */}
            {enableDelivery && receiptSource === 'factory' && (deliveryItems.length > 0 || deliveryPalletCount > 0) && (
              <div className="rounded-lg border-2 border-orange-300 bg-orange-50/40 overflow-hidden">
                <div className="bg-orange-600 text-white px-3 py-2 flex items-center gap-2 font-bold text-sm">
                  <Truck className="w-4 h-4" />
                  التسليم للمصنع (مرتبط بالاستلام)
                </div>
                <div className="p-3 space-y-3">
                  {deliveryItems.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-orange-100 px-3 py-2 text-xs font-bold text-orange-800 flex items-center justify-between">
                        <span>المنتجات التالفة المرجعة ({deliveryItems.length})</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 bg-white">
                        {deliveryItems.map((d, idx) => {
                          const p = getProduct(d.product_id);
                          const ppb = p?.pieces_per_box || 1;
                          return (
                            <div key={idx} className="relative border rounded-lg p-1.5 flex flex-col items-center text-center bg-white">
                              {p?.image_url ? (
                                <img src={p.image_url} alt="" className="w-14 h-14 rounded object-cover mb-1" />
                              ) : (
                                <div className="w-14 h-14 rounded bg-muted flex items-center justify-center mb-1"><Package className="w-6 h-6 text-muted-foreground" /></div>
                              )}
                              <div className="text-[10px] font-semibold leading-tight line-clamp-2 min-h-[24px]">{p ? getProductDisplayName(p) : '—'}</div>
                              <div className="mt-1 flex flex-col gap-0.5 w-full">
                                <span className="text-[10px] bg-orange-100 text-orange-800 rounded px-1 font-bold">{boxesToBPAlways(d.quantity, ppb)}</span>
                                {d.lot_number && <span className="text-[9px] text-muted-foreground truncate">LOT {d.lot_number}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="border rounded-lg p-2 text-center bg-white">
                    <div className="text-[10px] text-muted-foreground">باليطات مرجعة</div>
                    <div className="text-lg font-bold">{deliveryPalletCount || 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setShowPrintPreview(true)}>
              <Printer className="w-4 h-4 ml-1" /> طباعة
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-purple-400 text-purple-700 hover:bg-purple-50"
              onClick={() => printDetailedReport()}>
              <FileText className="w-4 h-4 ml-1" /> طباعة التفاصيل
            </Button>
            <Button variant="ghost" onClick={() => setShowReview(false)}>
              <X className="w-4 h-4 ml-1" /> رجوع
            </Button>
            <Button
              className="flex-1 bg-lime-600 hover:bg-lime-700"
              disabled={isSaving}
              onClick={async () => { await handleSave(); setShowReview(false); }}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Send className="w-4 h-4 ml-1" />}
              {isWarehouseManager && !isAdmin ? 'إرسال للموافقة' : 'تأكيد الاستلام'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* معاينة الطباعة */}
      {showPrintPreview && (
        <ReceiptPrintView
          open={showPrintPreview}
          onOpenChange={setShowPrintPreview}
          type="reception"
          invoiceNumber={invoiceNumber || null}
          date={new Date().toISOString()}
          items={items.map((it) => {
            const p = getProduct(it.product_id);
            const ppb = p?.pieces_per_box || 1;
            return {
              product_name: p ? getProductDisplayName(p) : it.product_id,
              new_qty: toDbQuantity(it.new_quantity, ppb),
              comp_qty: toDbQuantity(it.compensation_quantity, ppb),
              comp_offers_qty: toDbQuantity(it.compensation_offers_quantity, ppb),
              pieces_per_box: ppb,
              image_url: p?.image_url,
            };
          })}
          driverInfo={{ driver_name: driverName, driver_phone: driverPhone, license_plate: licensePlate }}
          notes={notes}
          palletCount={palletCount}
          receiptExpenses={totalExpenses}
          expensesDescription={expensesDescription}
          expensesBreakdown={expenseLines.filter(l => l.description || l.amount)}
        />
      )}
    </>
  );
};

export default FactoryReceiptQuickDialog;
