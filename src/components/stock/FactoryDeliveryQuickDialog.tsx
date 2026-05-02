import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Trash2, Loader2, Truck, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole } from '@/lib/utils';
import SimpleProductPickerDialog from './SimpleProductPickerDialog';
import { formatDate } from '@/utils/formatters';

interface DeliveryItem {
  product_id: string;
  quantity: number;
  lot_number?: string;
  manufacturing_date?: string;
  manufacturing_time?: string;
  delivery_date?: string;
}

interface PendingDelivery {
  id: string;
  notes: string | null;
  status: string;
  created_at: string;
  created_by: string;
  creator_name?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDeliveryId?: string | null;
  onSaved?: () => void;
}

const FactoryDeliveryQuickDialog: React.FC<Props> = ({ open, onOpenChange, editDeliveryId, onSaved }) => {
  const { workerId, role, activeRole, activeBranch } = useAuth();
  const [items, setItems] = useState<DeliveryItem[]>([{ product_id: '', quantity: 0 }]);
  const [palletCount, setPalletCount] = useState(0);
  const [currentPallets, setCurrentPallets] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; image_url?: string | null; pieces_per_box?: number }[]>([]);
  const [tab, setTab] = useState<'create' | 'pending'>('create');
  const [pendingDeliveries, setPendingDeliveries] = useState<PendingDelivery[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<{ product_name: string; quantity: number; image_url?: string | null }[]>([]);
  const [pendingPallets, setPendingPallets] = useState(0);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);

  // Step management for the create flow: 1 = products, 2 = optional NC sheet metadata
  const [step, setStep] = useState<1 | 2>(1);
  const [ncConstatBy, setNcConstatBy] = useState('');
  const [ncAffectation, setNcAffectation] = useState('');
  const [ncType, setNcType] = useState<'interne' | 'externe' | 'reclamation'>('interne');
  const [ncClientName, setNcClientName] = useState('');
  const [ncClientContact, setNcClientContact] = useState('');
  const [ncDescription, setNcDescription] = useState('');
  const [ncActions, setNcActions] = useState('');

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
    supabase.from('products').select('id, name, image_url, pieces_per_box').eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []));

    // Fetch pallet balance
    supabase.from('branch_pallets').select('quantity').eq('branch_id', branchId).maybeSingle()
      .then(({ data }) => {
        const qty = data?.quantity || 0;
        setCurrentPallets(qty);
        if (!editDeliveryId) setPalletCount(qty);
      });

    if (editDeliveryId) {
      // Load existing delivery for editing
      (async () => {
        const { data: order } = await supabase.from('factory_orders').select('*').eq('id', editDeliveryId).maybeSingle();
        if (!order) return;
        setPalletCount(Number((order as any).pallet_count) || 0);

        // Parse NC metadata if present
        let descNotes = order.notes || '';
        try {
          if (order.notes && order.notes.trim().startsWith('{')) {
            const parsed = JSON.parse(order.notes);
            if (parsed && parsed.__nc) {
              setNcConstatBy(parsed.constat_by || '');
              setNcAffectation(parsed.affectation || '');
              setNcType(parsed.nc_type || 'interne');
              setNcClientName(parsed.client_name || '');
              setNcClientContact(parsed.client_contact || '');
              setNcDescription(parsed.description || '');
              setNcActions(parsed.actions || '');
              descNotes = parsed.description || '';
            }
          }
        } catch { /* ignore */ }
        setNotes(descNotes);

        const { data: oItems } = await supabase.from('factory_order_items')
          .select('*, product:products(pieces_per_box)').eq('factory_order_id', editDeliveryId);
        const loaded = (oItems || []).map((it: any) => {
          const ppb = it.product?.pieces_per_box || 1;
          const dbQty = Number(it.product_quantity) || 0;
          // Convert box.piece DB format -> total pieces
          const boxes = Math.floor(dbQty);
          const pieces = Math.round((dbQty - boxes) * 100);
          const totalPieces = boxes * ppb + pieces;
          return {
            product_id: it.product_id,
            quantity: totalPieces,
            lot_number: it.lot_number || '',
            manufacturing_date: it.manufacturing_date || '',
            manufacturing_time: it.manufacturing_time || '',
            delivery_date: it.delivery_date || '',
          };
        });
        setItems(loaded.length > 0 ? loaded : [{ product_id: '', quantity: 0 }]);
      })();
      return;
    }

    // Auto-suggest damaged products
    supabase.from('warehouse_stock')
      .select('product_id, damaged_quantity, factory_return_quantity')
      .eq('branch_id', branchId)
      .gt('damaged_quantity', 0)
      .then(({ data }) => {
        const suggestions: DeliveryItem[] = [];
        for (const row of (data || [])) {
          const remaining = Number(row.damaged_quantity || 0) - Number(row.factory_return_quantity || 0);
          if (remaining > 0) {
            suggestions.push({ product_id: row.product_id, quantity: Math.round(remaining * 100) / 100 });
          }
        }
        setItems(suggestions.length > 0 ? suggestions : [{ product_id: '', quantity: 0 }]);
      });

    fetchPendingDeliveries();
  }, [open, branchId, editDeliveryId]);

  const fetchPendingDeliveries = async () => {
    if (!branchId) return;
    setIsLoadingPending(true);
    const { data } = await supabase
      .from('factory_orders')
      .select('id, notes, status, created_at, created_by')
      .eq('branch_id', branchId)
      .eq('order_type', 'sending')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    const deliveries = data || [];
    if (deliveries.length > 0) {
      const creatorIds = [...new Set(deliveries.map(d => d.created_by))];
      const { data: workers } = await supabase.from('workers').select('id, full_name').in('id', creatorIds);
      const workerMap = new Map((workers || []).map(w => [w.id, w.full_name]));
      deliveries.forEach(d => { (d as any).creator_name = workerMap.get(d.created_by) || ''; });
    }

    setPendingDeliveries(deliveries as PendingDelivery[]);
    setIsLoadingPending(false);
  };

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: 0 }]);
  const removeItem = (i: number) => { if (items.length > 1) setItems(prev => prev.filter((_, idx) => idx !== i)); };
  const updateItem = (i: number, field: keyof DeliveryItem, value: any) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const handleSave = async () => {
    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0 && palletCount === 0) { toast.error('أضف منتجات تالفة أو باليطات'); return; }
    if (!branchId || !workerId) { toast.error('اختر الفرع أولاً'); return; }

    setIsSaving(true);
    try {
      const status = isWarehouseManager && !isAdmin ? 'pending_approval' : 'confirmed';

      // If user filled any NC field, embed metadata as JSON in notes for the print dialog to consume
      const ncFilled = !!(ncConstatBy || ncAffectation || ncClientName || ncClientContact || ncDescription || ncActions || ncType !== 'interne');
      const finalNotes = ncFilled
        ? JSON.stringify({
            __nc: true,
            constat_by: ncConstatBy || null,
            affectation: ncAffectation || null,
            nc_type: ncType,
            client_name: ncClientName || null,
            client_contact: ncClientContact || null,
            description: notes || ncDescription || '',
            actions: ncActions || '',
          })
        : (notes || null);

      const { data: order, error: orderError } = await supabase
        .from('factory_orders')
        .insert({
          order_type: 'sending',
          branch_id: branchId,
          status,
          notes: finalNotes,
          created_by: workerId,
          confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
          pallet_count: palletCount,
        } as any)
        .select()
        .single();
      if (orderError) throw orderError;

      // Insert items - convert pieces to box.piece format
      if (validItems.length > 0) {
        const orderItems = validItems.map(i => {
          const ppb = getPiecesPerBox(i.product_id);
          const boxQty = piecesToBoxFormat(i.quantity, ppb);
          return {
            factory_order_id: order.id,
            product_id: i.product_id,
            product_quantity: boxQty,
            pallet_quantity: 0,
            lot_number: i.lot_number || null,
            manufacturing_date: i.manufacturing_date || null,
            manufacturing_time: i.manufacturing_time || null,
            delivery_date: i.delivery_date || null,
          };
        });
        const { error: itemsError } = await supabase.from('factory_order_items').insert(orderItems);
        if (itemsError) throw itemsError;
      }

      if (status === 'confirmed') {
        // Convert items to box format for stock operations
        const convertedItems = validItems.map(i => ({
          product_id: i.product_id,
          quantity: piecesToBoxFormat(i.quantity, getPiecesPerBox(i.product_id)),
        }));
        await applyDeliveryStock(order.id, convertedItems, palletCount, branchId);
        toast.success('تم تأكيد التسليم للمصنع');
      } else {
        toast.success('تم إرسال طلب التسليم للموافقة');
      }

      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally {
      setIsSaving(false);
    }
  };

  const applyDeliveryStock = async (orderId: string, validItems: DeliveryItem[], pallets: number, bId: string) => {
    // Update warehouse_stock: deduct from quantity, update damaged/factory_return tracking
    for (const item of validItems) {
      if (item.quantity > 0) {
        const { data: stock } = await supabase
          .from('warehouse_stock')
          .select('id, quantity, damaged_quantity, factory_return_quantity')
          .eq('branch_id', bId)
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (stock) {
          const currentQty = Number(stock.quantity) || 0;
          const currentDamaged = Number(stock.damaged_quantity) || 0;
          const currentReturn = Number(stock.factory_return_quantity) || 0;
          await supabase.from('warehouse_stock').update({
            quantity: Math.max(0, currentQty - item.quantity),
            damaged_quantity: Math.max(0, currentDamaged - item.quantity),
            factory_return_quantity: currentReturn + item.quantity,
          }).eq('id', stock.id);
        }
      }
    }

    // Deduct pallets
    if (pallets > 0) {
      const { data: bp } = await supabase.from('branch_pallets').select('id, quantity').eq('branch_id', bId).maybeSingle();
      if (bp) {
        await supabase.from('branch_pallets').update({ quantity: Math.max(0, bp.quantity - pallets) }).eq('id', bp.id);
      }
      await supabase.from('pallet_movements').insert({
        branch_id: bId, quantity: -pallets, movement_type: 'delivery',
        reference_id: orderId, notes: 'تسليم باليطات للمصنع', created_by: workerId,
      });
    }
  };

  const handleApprove = async (deliveryId: string) => {
    if (!workerId || !branchId) return;
    setProcessingId(deliveryId);
    try {
      const { data: orderData } = await supabase.from('factory_orders').select('*').eq('id', deliveryId).single();
      if (!orderData || orderData.status !== 'pending_approval') { toast.error('هذا الطلب تمت معالجته'); return; }

      const { data: oItems } = await supabase.from('factory_order_items').select('*').eq('factory_order_id', deliveryId);

      await supabase.from('factory_orders').update({
        status: 'confirmed', confirmed_at: new Date().toISOString(),
      }).eq('id', deliveryId);

      const validItems = (oItems || []).filter((i: any) => i.product_quantity > 0).map((i: any) => ({
        product_id: i.product_id, quantity: i.product_quantity,
      }));

      const pallets = Number((orderData as any).pallet_count) || 0;
      await applyDeliveryStock(deliveryId, validItems, pallets, orderData.branch_id);

      toast.success('تمت الموافقة على التسليم');
      fetchPendingDeliveries();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (deliveryId: string) => {
    if (!workerId) return;
    setProcessingId(deliveryId);
    try {
      await supabase.from('factory_orders').update({ status: 'rejected' }).eq('id', deliveryId);
      toast.success('تم رفض التسليم');
      fetchPendingDeliveries();
    } catch (e: any) {
      toast.error(e.message || 'خطأ');
    } finally {
      setProcessingId(null);
    }
  };

  const viewDeliveryItems = async (deliveryId: string) => {
    if (viewingId === deliveryId) { setViewingId(null); return; }
    setViewingId(deliveryId);
    const { data: oItems } = await supabase.from('factory_order_items')
      .select('product_quantity, product:products(name, image_url)').eq('factory_order_id', deliveryId);
    setPendingItems((oItems || []).map((i: any) => ({
      product_name: i.product?.name || '', quantity: i.product_quantity, image_url: i.product?.image_url,
    })));
    const { data: orderData } = await supabase.from('factory_orders').select('*').eq('id', deliveryId).single();
    setPendingPallets(Number((orderData as any)?.pallet_count) || 0);
  };

  const resetForm = () => {
    setItems([{ product_id: '', quantity: 0 }]);
    setPalletCount(0);
    setNotes('');
    setStep(1);
    setNcConstatBy('');
    setNcAffectation('');
    setNcType('interne');
    setNcClientName('');
    setNcClientContact('');
    setNcDescription('');
    setNcActions('');
  };

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'اختر منتج';
  const getPiecesPerBox = (id: string) => products.find(p => p.id === id)?.pieces_per_box || 1;
  
  // Convert pieces to box.piece format
  const piecesToBoxFormat = (pieces: number, piecesPerBox: number): number => {
    if (piecesPerBox <= 0) return pieces;
    const boxes = Math.floor(pieces / piecesPerBox);
    const remainingPieces = pieces % piecesPerBox;
    return parseFloat((boxes + remainingPieces / 100).toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-destructive" />
            تسليم للمصنع
          </DialogTitle>
        </DialogHeader>

        {isAdmin && (
          <div className="flex gap-2 mb-2">
            <Button variant={tab === 'create' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setTab('create')}>
              <Plus className="w-4 h-4 ml-1" /> إنشاء تسليم
            </Button>
            <Button variant={tab === 'pending' ? 'default' : 'outline'} size="sm" className="flex-1 relative" onClick={() => { setTab('pending'); fetchPendingDeliveries(); }}>
              طلبات معلقة
              {pendingDeliveries.length > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -left-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {pendingDeliveries.length}
                </Badge>
              )}
            </Button>
          </div>
        )}

        {tab === 'create' ? (
          <div className="space-y-3">
            {/* Stepper indicator */}
            <div className="flex items-center justify-center gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded-full font-bold ${step === 1 ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'}`}>1. المنتجات</span>
              <span className="text-muted-foreground">←</span>
              <span className={`px-2 py-0.5 rounded-full font-bold ${step === 2 ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'}`}>2. ورقة المصنع (اختياري)</span>
            </div>

            {step === 1 && (<>
            {isWarehouseManager && !isAdmin && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-200">
                ⚠️ سيتم إرسال الطلب لمدير الفرع للموافقة قبل تطبيق التغييرات
              </div>
            )}

            {/* Pallet Field */}
            <div className="border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5">🪵 باليطات للتسليم</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={0} value={palletCount}
                  onChange={e => setPalletCount(parseInt(e.target.value) || 0)}
                  className="text-center text-sm h-9 w-28" />
                <span className="text-xs text-muted-foreground">
                  الرصيد: <span className="font-bold text-foreground">{currentPallets}</span>
                </span>
              </div>
            </div>

            <Label className="text-xs font-semibold text-muted-foreground">المنتجات التالفة</Label>
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <button type="button"
                    className="flex-1 flex items-center gap-1.5 text-sm border rounded px-2 py-1.5 hover:bg-accent transition-colors"
                    onClick={() => setPickerIndex(index)}>
                    <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className={item.product_id ? 'text-foreground truncate' : 'text-muted-foreground'}>
                      {item.product_id ? getProductName(item.product_id) : 'اختر منتج'}
                    </span>
                  </button>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeItem(index)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    عدد القطع التالفة
                    {item.product_id && (
                      <span className="text-primary mr-1">({getPiecesPerBox(item.product_id)} قطعة/صندوق)</span>
                    )}
                  </Label>
                  <Input type="number" min={0} step={1} value={item.quantity}
                    onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    className="text-center text-sm h-8" placeholder="عدد القطع" />
                  {item.product_id && item.quantity > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-center">
                      = <span className="font-bold text-foreground">{piecesToBoxFormat(item.quantity, getPiecesPerBox(item.product_id)).toFixed(2)}</span> صندوق.قطعة
                    </p>
                  )}
                </div>
                {item.product_id && item.quantity > 0 && (
                  <div className="border-t pt-2 mt-1 space-y-1.5 bg-purple-50/50 dark:bg-purple-950/20 rounded p-2">
                    <Label className="block text-center text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                      📋 تفاصيل التسليم للمصنع
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">N° de LOT</Label>
                        <Input value={item.lot_number || ''}
                          onChange={e => updateItem(index, 'lot_number', e.target.value)}
                          className="text-center text-xs h-7" placeholder="LOT" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Heure de fabrication</Label>
                        <Input value={item.manufacturing_time || ''}
                          onChange={e => updateItem(index, 'manufacturing_time', e.target.value)}
                          className="text-center text-xs h-7" placeholder="12H33" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Date de fabrication</Label>
                        <Input type="date" value={item.manufacturing_date || ''}
                          onChange={e => updateItem(index, 'manufacturing_date', e.target.value)}
                          className="text-center text-xs h-7" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Date de livraison</Label>
                        <Input type="date" value={item.delivery_date || ''}
                          onChange={e => updateItem(index, 'delivery_date', e.target.value)}
                          className="text-center text-xs h-7" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
              <Plus className="w-4 h-4 ml-1" /> إضافة منتج تالف
            </Button>

            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="text-right h-8 text-sm" />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} variant="outline" className="flex-1">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                تخطّي وحفظ
              </Button>
              <Button
                onClick={() => {
                  setNcConstatBy(prev => prev || ''); // keep
                  setNcAffectation(prev => prev || (activeBranch?.name || ''));
                  setStep(2);
                }}
                disabled={isSaving}
                variant="destructive"
                className="flex-1">
                التالي: ورقة المصنع ←
              </Button>
            </div>
            </>)}

            {step === 2 && (
              <div className="space-y-3">
                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 rounded-lg p-2.5 text-xs text-purple-800 dark:text-purple-200">
                  📝 تعبئة بيانات ورقة <b>FICHE DE NON CONFORMITÉ</b> اختيارية — تظهر مباشرة عند الطباعة للمصنع.
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <Label className="text-xs">CONSTAT ETABLI PAR (اسم محرر التقرير)</Label>
                    <Input value={ncConstatBy} onChange={e => setNcConstatBy(e.target.value)}
                      className="text-right h-8 text-sm" placeholder="مثال: Ouak Mohamed" />
                  </div>
                  <div>
                    <Label className="text-xs">AFFECTATION (الجهة)</Label>
                    <Input value={ncAffectation} onChange={e => setNcAffectation(e.target.value)}
                      className="text-right h-8 text-sm" placeholder="مثال: فرع مستغانم" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">1. Détection de la non-conformité</Label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[
                      { v: 'interne', label: 'NC Interne' },
                      { v: 'externe', label: 'NC Externe' },
                      { v: 'reclamation', label: 'Réclamation Client' },
                    ].map(o => (
                      <Button
                        key={o.v}
                        type="button"
                        size="sm"
                        variant={ncType === o.v ? 'default' : 'outline'}
                        className="text-[11px] h-8"
                        onClick={() => setNcType(o.v as any)}>
                        {ncType === o.v ? '✗ ' : ''}{o.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Coordonnés du client</Label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    <Input value={ncClientName} onChange={e => setNcClientName(e.target.value)}
                      className="text-right h-8 text-sm" placeholder="اسم العميل" />
                    <Input value={ncClientContact} onChange={e => setNcClientContact(e.target.value)}
                      className="text-right h-8 text-sm" placeholder="هاتف / عنوان" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Description de la non-conformité / réclamation client</Label>
                  <textarea value={ncDescription} onChange={e => setNcDescription(e.target.value)}
                    className="w-full text-right text-sm border rounded p-2 mt-1 min-h-[60px]"
                    placeholder="وصف مفصّل لحالة عدم المطابقة..." />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Actions correctives</Label>
                  <textarea value={ncActions} onChange={e => setNcActions(e.target.value)}
                    className="w-full text-right text-sm border rounded p-2 mt-1 min-h-[60px]"
                    placeholder="الإجراءات التصحيحية المتخذة..." />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={isSaving}>
                    → رجوع
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving} variant="destructive" className="flex-1">
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                    {isWarehouseManager && !isAdmin ? 'إرسال للموافقة' : 'تأكيد التسليم'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isLoadingPending ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : pendingDeliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">لا توجد طلبات معلقة</div>
            ) : (
              pendingDeliveries.map(delivery => (
                <div key={delivery.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">تسليم تالف للمصنع</p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.creator_name} • {formatDate(delivery.created_at, 'dd/MM HH:mm', 'ar')}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">بانتظار الموافقة</Badge>
                  </div>

                  {delivery.notes && <p className="text-xs text-muted-foreground">{delivery.notes}</p>}

                  <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => viewDeliveryItems(delivery.id)}>
                    عرض التفاصيل
                  </Button>

                  {viewingId === delivery.id && (
                    <div className="bg-muted/50 rounded-lg p-2 space-y-1.5">
                      {pendingPallets > 0 && (
                        <div className="flex items-center justify-between text-xs border-b pb-1 mb-1">
                          <span className="font-semibold">🪵 باليطات</span>
                          <Badge variant="secondary" className="text-xs font-bold">{pendingPallets}</Badge>
                        </div>
                      )}
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
                          <Badge variant="secondary" className="text-xs font-bold">{item.quantity}</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={processingId === delivery.id} onClick={() => handleApprove(delivery.id)}>
                      {processingId === delivery.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 ml-1" />}
                      موافقة
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1"
                      disabled={processingId === delivery.id} onClick={() => handleReject(delivery.id)}>
                      <XCircle className="w-3.5 h-3.5 ml-1" /> رفض
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>

      <SimpleProductPickerDialog
        open={pickerIndex !== null}
        onOpenChange={(open) => { if (!open) setPickerIndex(null); }}
        products={products}
        selectedProductId={pickerIndex !== null ? items[pickerIndex]?.product_id || '' : ''}
        onSelect={(productId) => { if (pickerIndex !== null) updateItem(pickerIndex, 'product_id', productId); }}
      />
    </Dialog>
  );
};

export default FactoryDeliveryQuickDialog;
