import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Minus, Trash2, Loader2, ArrowDownToLine, Camera, CheckCircle, XCircle, Check, User, Phone, Car, X, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole } from '@/lib/utils';
import { formatDate } from '@/utils/formatters';
import { parseBP, boxesToBP, dbBPDisplay, dbBPToBoxes } from '@/utils/boxPieceInput';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { buildReceiptItemRows, parseReceiptItemBreakdown, parseReceiptMeta, stringifyReceiptMeta, ReceiptSource } from '@/utils/stockReceipt';

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

  // Product picker state
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

  // Multi-select
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

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
      await supabase.from('stock_receipts').update({ status: 'confirmed', approved_by: workerId, approved_at: new Date().toISOString() }).eq('id', receiptId);
      for (const item of (rItems || [])) {
        const ppb = item.product?.pieces_per_box || 1;
        const breakdown = parseReceiptItemBreakdown(item);
        const itemQuantity = fromDbQuantity(Number(item.quantity) || 0, ppb);
        const compensationQuantity = fromDbQuantity(Number(breakdown.comp_qty) || 0, ppb);
        await supabase.from('stock_movements').insert({
          product_id: item.product_id, branch_id: receiptData.branch_id, quantity: item.quantity,
          movement_type: 'receipt', status: 'approved', created_by: workerId,
          receipt_id: receiptId, notes: `موافقة على استلام`,
        });
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-lime-600" />
              استلام مخزون
            </DialogTitle>
          </DialogHeader>

          {isAdmin && (
            <div className="flex gap-2 mb-2">
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
            <div className="space-y-3">
              {isWarehouseManager && !isAdmin && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-200">
                  ⚠️ سيتم إرسال الطلب لمدير الفرع للموافقة قبل تحديث المخزون
                </div>
              )}

              {/* Source Selection */}
              <div>
                <Label className="text-xs font-semibold">مصدر الاستلام</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={receiptSource === 'factory' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setReceiptSource('factory')}
                  >
                    🏭 المصنع
                  </Button>
                  <Button
                    type="button"
                    variant={receiptSource === 'branch' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setReceiptSource('branch')}
                  >
                    🏢 فرع آخر
                  </Button>
                </div>
              </div>

              {/* Invoice & Pallets */}
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

              {/* Receipt Expenses (multi) */}
              <div className="border rounded-lg p-2.5 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">💰 مصاريف الاستلام</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => setExpenseLines(prev => [...prev, { description: '', amount: 0 }])}>
                    <Plus className="w-3 h-3 ml-1" /> إضافة مصروف
                  </Button>
                </div>
                {expenseLines.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-1">لا توجد مصاريف</p>
                ) : (
                  <div className="space-y-1.5">
                    {expenseLines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Input value={line.description}
                          onChange={e => setExpenseLines(prev => prev.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))}
                          className="h-8 text-xs flex-1" placeholder="الوصف (مثال: عامل خارجي)" />
                        <Input type="number" min={0} value={line.amount || ''}
                          onChange={e => setExpenseLines(prev => prev.map((l, i) => i === idx ? { ...l, amount: parseFloat(e.target.value) || 0 } : l))}
                          className="h-8 text-xs w-24 text-center" placeholder="المبلغ" />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                          onClick={() => setExpenseLines(prev => prev.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <div className="text-[11px] font-bold text-amber-700 text-end pt-1 border-t">
                      الإجمالي: {totalExpenses.toLocaleString()} دج
                    </div>
                  </div>
                )}
              </div>

              {/* Driver Info */}
              <div className="border rounded-lg p-2.5 bg-muted/30 space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> بيانات السائق / الشاحنة
                </Label>
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

              {/* Photo */}
              <div>
                <Label className="text-xs flex items-center gap-1"><Camera className="w-3 h-3" /> صورة الفاتورة</Label>
                <Input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="text-xs h-8" />
                {photoPreview && <img src={photoPreview} className="mt-1 w-full h-24 object-cover rounded-lg" alt="preview" />}
              </div>

              {/* Added Products List */}
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
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {items.map((item, index) => {
                      const prod = getProduct(item.product_id);
                      const ppb = prod?.pieces_per_box || 1;
                      return (
                        <div key={item.product_id} className="flex items-center gap-2 p-2 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleEditItem(item)}>
                          {prod?.image_url ? (
                            <img src={prod.image_url} alt={prod?.name} className="w-9 h-9 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-muted-foreground/40" />
                            </div>
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
                )}
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs">ملاحظات</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} className="text-right h-8 text-sm" />
              </div>

              <Button onClick={handleSave} disabled={isSaving} className="w-full bg-lime-600 hover:bg-lime-700">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {isWarehouseManager && !isAdmin ? 'إرسال للموافقة' : 'تأكيد الاستلام'}
              </Button>
            </div>
          ) : (
            /* Pending tab */
            <div className="space-y-3">
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
    </>
  );
};

export default FactoryReceiptQuickDialog;
