import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Package, Trash2, Plus, Minus, Truck, User, Phone, Car } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseBP, boxesToBP } from '@/utils/boxPieceInput';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { useAuth } from '@/contexts/AuthContext';
import { StockReceipt, StockReceiptItem } from '@/hooks/useWarehouseStock';
import { aggregateReceiptItemsForEditing, buildReceiptItemRows, parseReceiptMeta, stringifyReceiptMeta } from '@/utils/stockReceipt';

interface EditItem {
  product_id: string;
  new_quantity: number;
  compensation_quantity: number;
  compensation_offers_quantity: number;
}

interface BoxPieceFields {
  boxes: string;
  pieces: string;
}

interface Product {
  id: string;
  name: string;
  app_name?: string | null;
  pieces_per_box: number;
  image_url?: string | null;
}

interface Props {
  receipt: StockReceipt;
  initialItems: StockReceiptItem[];
  products: Product[];
  branchId: string;
  onSaved: (options?: { shouldPrint?: boolean; receipt?: StockReceipt }) => void | Promise<void>;
}

const EditReceiptForm: React.FC<Props> = ({ receipt, initialItems, products, branchId, onSaved }) => {
  const { workerId } = useAuth();
  const receiptMeta = useMemo(() => parseReceiptMeta(receipt.notes), [receipt.notes]);
  const [editItems, setEditItems] = useState<EditItem[]>(aggregateReceiptItemsForEditing(initialItems));
  const [receiptSource, setReceiptSource] = useState<'factory' | 'branch'>(receiptMeta.source || 'factory');
  const [driverName, setDriverName] = useState(receiptMeta.driver_name || '');
  const [driverPhone, setDriverPhone] = useState(receiptMeta.driver_phone || '');
  const [licensePlate, setLicensePlate] = useState(receiptMeta.license_plate || '');
  const [notesText, setNotesText] = useState(receiptMeta.text || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [singleProductId, setSingleProductId] = useState<string | null>(null);
  const [newQtyFields, setNewQtyFields] = useState<BoxPieceFields>({ boxes: '0', pieces: '000' });
  const [compQtyFields, setCompQtyFields] = useState<BoxPieceFields>({ boxes: '0', pieces: '000' });
  const [compOffersQtyFields, setCompOffersQtyFields] = useState<BoxPieceFields>({ boxes: '0', pieces: '000' });

  const getProduct = (id: string) => products.find((product) => product.id === id);
  const currentProduct = singleProductId ? getProduct(singleProductId) : null;
  const currentPPB = currentProduct?.pieces_per_box || 1;

  const fieldsToCustomFormat = (fields: BoxPieceFields, ppb: number): number => {
    const boxes = parseInt(fields.boxes || '0', 10) || 0;
    const pieces = parseInt(fields.pieces || '0', 10) || 0;
    const parsed = parseBP(`${boxes}.${pieces}`, ppb);
    return parsed.boxes + parsed.pieces / 100;
  };

  const quantityToFields = (qty: number, ppb: number): BoxPieceFields => {
    const parsed = parseBP(boxesToBP(qty, ppb), ppb);
    return { boxes: String(parsed.boxes), pieces: String(parsed.pieces).padStart(3, '0') };
  };

  const sanitizeDigits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

  const handleFieldChange = (
    setter: React.Dispatch<React.SetStateAction<BoxPieceFields>>,
    field: 'boxes' | 'pieces',
    value: string
  ) => {
    setter(prev => ({ ...prev, [field]: sanitizeDigits(value, field === 'boxes' ? 5 : 3) }));
  };

  const normalizeFields = (fields: BoxPieceFields, ppb: number): BoxPieceFields => {
    return quantityToFields(fieldsToCustomFormat(fields, ppb), ppb);
  };

  const handleBlur = (setter: React.Dispatch<React.SetStateAction<BoxPieceFields>>, ppb: number) => {
    setter(prev => normalizeFields(prev, ppb));
  };

  const openProductEditor = (productId: string) => {
    const existing = editItems.find((item) => item.product_id === productId);
    const product = getProduct(productId);
    const ppb = product?.pieces_per_box || 1;

    setSingleProductId(productId);
    const ppb = product?.pieces_per_box || 1;
    if (existing) {
      setNewQtyFields(quantityToFields(existing.new_quantity, ppb));
      setCompQtyFields(quantityToFields(existing.compensation_quantity, ppb));
      setCompOffersQtyFields(quantityToFields(existing.compensation_offers_quantity, ppb));
    } else {
      setNewQtyFields({ boxes: '1', pieces: '000' });
      setCompQtyFields({ boxes: '0', pieces: '000' });
      setCompOffersQtyFields({ boxes: '0', pieces: '000' });
    }
  };

  const removeItem = (productId: string) => {
    setEditItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const confirmProductQuantities = () => {
    if (!singleProductId) return;

    const newQuantity = toCustomFormat(parsedNew);
    const compensationQuantity = toCustomFormat(parsedComp);
    const compensationOffersQuantity = toCustomFormat(parsedCompOffers);

    if (newQuantity <= 0 && compensationQuantity <= 0 && compensationOffersQuantity <= 0) {
      removeItem(singleProductId);
      setSingleProductId(null);
      return;
    }

    setEditItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === singleProductId);
      if (existingIndex >= 0) {
        return prev.map((item, index) => index === existingIndex ? {
          ...item,
          new_quantity: newQuantity,
          compensation_quantity: compensationQuantity,
          compensation_offers_quantity: compensationOffersQuantity,
        } : item);
      }

      return [...prev, {
        product_id: singleProductId,
        new_quantity: newQuantity,
        compensation_quantity: compensationQuantity,
        compensation_offers_quantity: compensationOffersQuantity,
      }];
    });

    setSingleProductId(null);
  };

  const handleSave = async () => {
    const validItems = editItems.filter((item) => item.new_quantity > 0 || item.compensation_quantity > 0 || item.compensation_offers_quantity > 0);
    if (validItems.length === 0) {
      toast.error('أضف منتجاً واحداً على الأقل');
      return;
    }

    setIsSaving(true);
    try {
      const previousItems = aggregateReceiptItemsForEditing(initialItems);
      const previousMap = new Map(previousItems.map((item) => [item.product_id, item]));
      const nextMap = new Map(validItems.map((item) => [item.product_id, item]));
      const affectedProductIds = Array.from(new Set([...previousMap.keys(), ...nextMap.keys()]));
      const metaString = stringifyReceiptMeta({
        text: notesText,
        source: receiptSource,
        driver_name: driverName || null,
        driver_phone: driverPhone || null,
        license_plate: licensePlate || null,
      });

      const { error: receiptError } = await supabase
        .from('stock_receipts')
        .update({
          notes: metaString,
          total_items: validItems.length,
        })
        .eq('id', receipt.id);
      if (receiptError) throw receiptError;

      const { error: deleteItemsError } = await supabase.from('stock_receipt_items').delete().eq('receipt_id', receipt.id);
      if (deleteItemsError) throw deleteItemsError;

      const receiptRows = buildReceiptItemRows(receipt.id, validItems);
      const { error: insertItemsError } = await supabase.from('stock_receipt_items').insert(receiptRows);
      if (insertItemsError) throw insertItemsError;

      if (receipt.status === 'confirmed') {
        await supabase.from('stock_movements').delete().eq('receipt_id', receipt.id);

        for (const productId of affectedProductIds) {
          const before = previousMap.get(productId) || { product_id: productId, new_quantity: 0, compensation_quantity: 0, compensation_offers_quantity: 0 };
          const after = nextMap.get(productId) || { product_id: productId, new_quantity: 0, compensation_quantity: 0, compensation_offers_quantity: 0 };
          const totalDelta = (after.new_quantity + after.compensation_quantity + after.compensation_offers_quantity) - (before.new_quantity + before.compensation_quantity + before.compensation_offers_quantity);
          const compensationDelta = after.compensation_quantity - before.compensation_quantity;

          if (totalDelta === 0 && compensationDelta === 0) continue;

          const { data: stock } = await supabase
            .from('warehouse_stock')
            .select('id, quantity, compensation_quantity, factory_return_quantity')
            .eq('branch_id', branchId)
            .eq('product_id', productId)
            .maybeSingle();

          if (stock) {
            const nextQuantity = Math.max(0, (Number((stock as any).quantity) || 0) + totalDelta);
            const nextCompensation = Math.max(0, (Number((stock as any).compensation_quantity) || 0) + compensationDelta);
            const nextFactoryReturn = Math.max(0, (Number((stock as any).factory_return_quantity) || 0) - compensationDelta);

            await supabase.from('warehouse_stock').update({
              quantity: nextQuantity,
              compensation_quantity: nextCompensation,
              factory_return_quantity: nextFactoryReturn,
            }).eq('id', stock.id);
          } else if (after.new_quantity + after.compensation_quantity + after.compensation_offers_quantity > 0) {
            await supabase.from('warehouse_stock').insert({
              branch_id: branchId,
              product_id: productId,
            quantity: after.new_quantity + after.compensation_quantity + after.compensation_offers_quantity,
              compensation_quantity: after.compensation_quantity,
            });
          }
        }

        for (const item of validItems) {
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            branch_id: branchId,
            quantity: item.new_quantity + item.compensation_quantity + item.compensation_offers_quantity,
            movement_type: 'receipt',
            status: 'approved',
            created_by: workerId || receipt.created_by,
            receipt_id: receipt.id,
            notes: `تعديل استلام - جديد: ${item.new_quantity} تعويض تلف: ${item.compensation_quantity} تعويض عروض: ${item.compensation_offers_quantity}`,
          });
        }
      }

      toast.success('تم تعديل الاستلام بنجاح');
      const shouldPrint = window.confirm('تم حفظ التعديلات بنجاح. هل تريد طباعة وصل الاستلام الآن؟');
      await onSaved({
        shouldPrint,
        receipt: {
          ...receipt,
          notes: metaString,
          total_items: validItems.length,
        },
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <Label className="text-xs font-semibold">مصدر الاستلام</Label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Button type="button" variant={receiptSource === 'factory' ? 'default' : 'outline'} onClick={() => setReceiptSource('factory')}>🏭 المصنع</Button>
          <Button type="button" variant={receiptSource === 'branch' ? 'default' : 'outline'} onClick={() => setReceiptSource('branch')}>🏢 فرع آخر</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> بيانات السائق / الشاحنة</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> اسم السائق</Label>
            <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> الهاتف</Label>
            <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} className="h-8 text-xs" type="tel" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="w-3 h-3" /> لوحة الترقيم</Label>
          <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">المنتجات ({editItems.length})</Label>
          <Button type="button" size="sm" onClick={() => setShowPicker(true)}>
            <Plus className="w-4 h-4 ml-1" /> إضافة منتج
          </Button>
        </div>

        {editItems.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground">اضغط "إضافة منتج" لاختيار المنتجات</div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {editItems.map((item) => {
              const product = getProduct(item.product_id);
              const ppb = product?.pieces_per_box || 1;
              const displayName = getProductDisplayName(product as any) || product?.name || item.product_id;

              return (
                <div key={item.product_id} className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-accent/40" onClick={() => openProductEditor(item.product_id)}>
                  {product?.image_url ? (
                    <img src={product.image_url} alt={displayName} className="w-10 h-10 rounded object-cover shrink-0 border" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 border">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{displayName}</div>
                    <div className="mt-1 flex gap-1.5 flex-wrap text-[10px]">
                      {item.new_quantity > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 font-bold text-white">جديد {boxesToBP(item.new_quantity, ppb)}</span>}
                      {item.compensation_quantity > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 font-bold text-white">تعويض تلف {boxesToBP(item.compensation_quantity, ppb)}</span>}
                      {item.compensation_offers_quantity > 0 && <span className="rounded-full bg-amber-600 px-2 py-0.5 font-bold text-white">عروض {boxesToBP(item.compensation_offers_quantity, ppb)}</span>}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={(e) => { e.stopPropagation(); removeItem(item.product_id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs">ملاحظات</Label>
        <Input value={notesText} onChange={(e) => setNotesText(e.target.value)} className="text-sm" />
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
        حفظ التعديلات
      </Button>

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="w-[95vw] max-w-md h-[85dvh] max-h-[85dvh] flex flex-col p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="px-3 pt-3 pb-1 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Package className="w-5 h-5 text-primary" /> منتجات الاستلام
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
            <div className="grid grid-cols-4 gap-1.5">
              {products.map((product) => {
                const addedItem = editItems.find((item) => item.product_id === product.id);
                const displayName = getProductDisplayName(product as any) || product.name;
                const ppb = product.pieces_per_box || 1;

                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`relative overflow-hidden rounded-xl border bg-card text-center shadow-sm ${addedItem ? 'border-primary ring-2 ring-primary/30' : 'border-border/50'}`}
                    onClick={() => openProductEditor(product.id)}
                  >
                    {addedItem && (
                      <div className="absolute bottom-0 inset-x-0 z-10 flex justify-center gap-0.5 pb-0.5 px-1 flex-wrap">
                        {addedItem.new_quantity > 0 && <span className="rounded-sm bg-blue-600 px-1 py-0.5 text-[8px] font-bold text-white leading-none">جديد {boxesToBP(addedItem.new_quantity, ppb)}</span>}
                        {addedItem.compensation_quantity > 0 && <span className="rounded-sm bg-red-600 px-1 py-0.5 text-[8px] font-bold text-white leading-none">تلف {boxesToBP(addedItem.compensation_quantity, ppb)}</span>}
                        {addedItem.compensation_offers_quantity > 0 && <span className="rounded-sm bg-amber-600 px-1 py-0.5 text-[8px] font-bold text-white leading-none">عروض {boxesToBP(addedItem.compensation_offers_quantity, ppb)}</span>}
                      </div>
                    )}
                    <div className="truncate border-b bg-muted/30 px-1 py-1 text-[10px] font-bold">{displayName}</div>
                    {product.image_url ? (
                      <img src={product.image_url} alt={displayName} className="aspect-square w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="aspect-square w-full flex items-center justify-center bg-muted/20">
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!currentProduct} onOpenChange={(open) => { if (!open) setSingleProductId(null); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Package className="w-4 h-4 text-primary" /> تعديل الاستلام</DialogTitle>
          </DialogHeader>

          {currentProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2">
                {currentProduct.image_url ? (
                  <img src={currentProduct.image_url} alt={getProductDisplayName(currentProduct)} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0"><Package className="w-6 h-6 text-muted-foreground/40" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-base font-extrabold text-primary">{getProductDisplayName(currentProduct)}</h3>
                </div>
              </div>

              <div className="space-y-1 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 dark:border-blue-900 dark:bg-blue-950/20">
                <Label className="block text-center text-xs font-semibold text-blue-700">الكمية الجديدة (صندوق.قطع)</Label>
                <div className="flex items-center justify-center gap-3">
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => {
                    const nextBoxes = Math.max(0, parsedNew.boxes - 1);
                    setNewQtyInput(boxesToBP(nextBoxes + parsedNew.pieces / currentPPB, currentPPB));
                  }}><Minus className="w-4 h-4" /></Button>
                  <Input type="text" inputMode="decimal" value={newQtyInput} onChange={(e) => setNewQtyInput(e.target.value.replace(/[^0-9.]/g, ''))} className="w-20 h-10 text-center text-lg font-bold" />
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => {
                    const nextBoxes = parsedNew.boxes + 1;
                    setNewQtyInput(boxesToBP(nextBoxes + parsedNew.pieces / currentPPB, currentPPB));
                  }}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="space-y-1 rounded-lg border border-red-200 bg-red-50/60 p-2.5 dark:border-red-900 dark:bg-red-950/20">
                <Label className="block text-center text-xs font-semibold text-red-700">تعويض التلف (صندوق.قطع)</Label>
                <div className="flex items-center justify-center gap-3">
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => {
                    const nextBoxes = Math.max(0, parsedComp.boxes - 1);
                    setCompQtyInput(boxesToBP(nextBoxes + parsedComp.pieces / currentPPB, currentPPB));
                  }}><Minus className="w-4 h-4" /></Button>
                  <Input type="text" inputMode="decimal" value={compQtyInput} onChange={(e) => setCompQtyInput(e.target.value.replace(/[^0-9.]/g, ''))} className="w-20 h-10 text-center text-lg font-bold" />
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => {
                    const nextBoxes = parsedComp.boxes + 1;
                    setCompQtyInput(boxesToBP(nextBoxes + parsedComp.pieces / currentPPB, currentPPB));
                  }}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-900 dark:bg-amber-950/20">
                <Label className="block text-center text-xs font-semibold text-amber-700">تعويض العروض (صندوق.قطع)</Label>
                <div className="flex items-center justify-center gap-3">
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => {
                    const nextBoxes = Math.max(0, parsedCompOffers.boxes - 1);
                    setCompOffersQtyInput(boxesToBP(nextBoxes + parsedCompOffers.pieces / currentPPB, currentPPB));
                  }}><Minus className="w-4 h-4" /></Button>
                  <Input type="text" inputMode="decimal" value={compOffersQtyInput} onChange={(e) => setCompOffersQtyInput(e.target.value.replace(/[^0-9.]/g, ''))} className="w-20 h-10 text-center text-lg font-bold" />
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => {
                    const nextBoxes = parsedCompOffers.boxes + 1;
                    setCompOffersQtyInput(boxesToBP(nextBoxes + parsedCompOffers.pieces / currentPPB, currentPPB));
                  }}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              <Button className="w-full" onClick={confirmProductQuantities}><Plus className="w-4 h-4 ml-1" /> حفظ الكمية</Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setSingleProductId(null)}>إلغاء</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditReceiptForm;
