import React, { useRef, useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2, Package, User, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import SimpleProductPickerDialog from '@/components/stock/SimpleProductPickerDialog';
import WorkerPickerDialog from '@/components/stock/WorkerPickerDialog';
import { parseBP, boxesToBP } from '@/utils/boxPieceInput';
import { toast } from 'sonner';
import { Product } from '@/types/database';
import { WarehouseStockItem } from '@/hooks/useWarehouseStock';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface QuantityFields {
  boxes: string;
  pieces: string;
}

interface LoadItem {
  product_id: string;
  quantity: number;
  fields: QuantityFields;
}

interface QuickLoadWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  workers: { id: string; full_name: string; username: string }[];
  warehouseStock: WarehouseStockItem[];
  /** Computed remaining per product (fallback when warehouse_stock table is empty). */
  availableQuantities?: Record<string, number>;
  loadToWorker: (
    targetWorkerId: string,
    items: { product_id: string; quantity: number; notes?: string }[]
  ) => Promise<void>;
}

const sanitizeDigits = (value: string, maxDigits: number) => value.replace(/\D/g, '').slice(0, maxDigits);

const fieldsToQuantity = (fields: QuantityFields, ppb: number): number => {
  const boxes = sanitizeDigits(fields.boxes, 5) || '0';
  const pieces = sanitizeDigits(fields.pieces, 3) || '0';
  return parseBP(`${boxes}.${pieces}`, ppb).totalBoxes;
};

const quantityToFields = (quantity: number, ppb: number): QuantityFields => {
  const parsed = parseBP(boxesToBP(quantity, ppb), ppb);
  return {
    boxes: String(parsed.boxes),
    pieces: parsed.pieces > 0 ? String(parsed.pieces) : '',
  };
};

const QuickLoadWorkerDialog: React.FC<QuickLoadWorkerDialogProps> = ({
  open, onOpenChange, products, workers, warehouseStock, availableQuantities, loadToWorker
}) => {
  const { t } = useLanguage();
  const [selectedWorker, setSelectedWorker] = useState('');
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [items, setItems] = useState<LoadItem[]>([{ product_id: '', quantity: 0, fields: { boxes: '', pieces: '' } }]);
  const [isSaving, setIsSaving] = useState(false);
  const [productPickerIndex, setProductPickerIndex] = useState<number | null>(null);
  const [productsInfo, setProductsInfo] = useState<Record<string, number>>({});
  const saveLockRef = useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch pieces_per_box for all products
  useEffect(() => {
    if (!open || products.length === 0) return;
    const ids = products.map(p => p.id);
    supabase
      .from('products')
      .select('id, pieces_per_box')
      .in('id', ids)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data || []).forEach((p: any) => { map[p.id] = p.pieces_per_box || 1; });
        setProductsInfo(map);
      });
  }, [open, products]);

  // Fetch frozen worker IDs while dialog is open
  const { data: frozenWorkerIds = [] } = useQuery({
    queryKey: ['frozen-workers', open, workers.map(w => w.id).join(',')],
    queryFn: async () => {
      const ids: string[] = [];
      await Promise.all(
        workers.map(async (w) => {
          const { data } = await supabase.rpc('is_worker_frozen', { _worker_id: w.id });
          if (data === true) ids.push(w.id);
        })
      );
      return ids;
    },
    enabled: open && workers.length > 0,
    refetchInterval: open ? 5000 : false,
  });

  // If currently selected worker becomes frozen, clear and notify
  useEffect(() => {
    if (selectedWorker && frozenWorkerIds.includes(selectedWorker)) {
      setSelectedWorker('');
      setShowConfirm(false);
      window.alert('تم تجميد العامل — تم إلغاء عملية الشحن. أكمل حفظ جلسة المحاسبة لفك التجميد.');
    }
  }, [frozenWorkerIds, selectedWorker]);

  const getPPB = (productId: string) => productsInfo[productId] || 1;

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: 0, fields: { boxes: '', pieces: '' } }]);

  const removeItem = (index: number) => {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateProductId = (index: number, productId: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, product_id: productId } : item));
  };

  const updateFields = (index: number, field: 'boxes' | 'pieces', value: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newFields = { ...item.fields, [field]: sanitizeDigits(value, field === 'boxes' ? 5 : 3) };
      const ppb = getPPB(item.product_id);
      const newQty = fieldsToQuantity(newFields, ppb);
      return { ...item, fields: newFields, quantity: newQty };
    }));
  };

  const handleBlur = (index: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const ppb = getPPB(item.product_id);
      const qty = Math.max(0, fieldsToQuantity(item.fields, ppb));
      return { ...item, quantity: qty, fields: quantityToFields(qty, ppb) };
    }));
  };

  const resetForm = () => {
    setSelectedWorker('');
    setItems([{ product_id: '', quantity: 0, fields: { boxes: '', pieces: '' } }]);
  };

  const selectedWorkerName = workers.find(w => w.id === selectedWorker)?.full_name;

  const validItemsForConfirm = items.filter(i => i.product_id && i.quantity > 0);

  const requestSave = () => {
    if (saveLockRef.current || isSaving) return;
    if (!selectedWorker) {
      toast.error('اختر العامل أولاً');
      return;
    }
    if (frozenWorkerIds.includes(selectedWorker)) {
      window.alert('العامل مجمّد — لا يمكن الشحن حتى يتم فك التجميد عبر حفظ جلسة المحاسبة');
      toast.error('العامل مجمّد');
      setSelectedWorker('');
      return;
    }
    if (validItemsForConfirm.length === 0) {
      toast.error(t('stock.add_products'));
      return;
    }
    setShowConfirm(true);
  };

  const handleSave = async () => {
    if (saveLockRef.current || isSaving) return;
    const validItems = validItemsForConfirm;
    if (!selectedWorker || validItems.length === 0) return;

    saveLockRef.current = true;
    setIsSaving(true);
    try {
      await loadToWorker(selectedWorker, validItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        notes: 'شحن سريع من مخزون الفرع',
      })));
      toast.success('تم شحن العامل بنجاح');
      setShowConfirm(false);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  const availableProducts = products
    .map(p => {
      const ws = warehouseStock.find(s => s.product_id === p.id);
      const wsQty = ws?.quantity || 0;
      const fallbackQty = availableQuantities?.[p.id] || 0;
      const qty = wsQty > 0 ? wsQty : fallbackQty;
      return { id: p.id, name: `${p.name} (${qty})`, _qty: qty };
    })
    .filter(p => p._qty > 0)
    .map(({ _qty, ...rest }) => rest);

  const selectedShipmentProductIds = items.filter(item => item.product_id).map(item => item.product_id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>شحن عامل</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Worker selection */}
            <div className="space-y-2">
              <Label>العامل</Label>
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => setShowWorkerPicker(true)}
              >
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className={selectedWorker ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedWorkerName || 'اختر العامل'}
                </span>
              </button>
            </div>

            {/* Products */}
            <div className="space-y-3">
              <Label>{t('stock.add_products')}</Label>
              {items.map((item, index) => {
                const ppb = getPPB(item.product_id);
                const parsed = parseBP(`${item.fields.boxes || '0'}.${item.fields.pieces || '0'}`, ppb);
                const displayBP = parsed.pieces > 0
                  ? `${parsed.boxes}.${String(parsed.pieces).padStart(2, '0')}`
                  : `${parsed.boxes}`;

                return (
                  <div key={index} className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex gap-2 items-center">
                      <button
                        type="button"
                        className="flex-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => setProductPickerIndex(index)}
                      >
                        <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className={item.product_id ? 'text-foreground truncate' : 'text-muted-foreground'}>
                          {item.product_id ? products.find(p => p.id === item.product_id)?.name || t('stock.product') : t('stock.product')}
                        </span>
                      </button>
                      {items.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    {item.product_id && ppb > 1 && (
                      <Badge variant="outline" className="text-[10px]">
                        الصندوق = {ppb} قطعة
                      </Badge>
                    )}

                    {/* Box + Piece fields */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <span>الكمية (صندوق.قطع)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-center">
                          <label className="text-[10px] text-muted-foreground">الصندوق</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={item.fields.boxes}
                            onChange={e => updateFields(index, 'boxes', e.target.value)}
                            onBlur={() => handleBlur(index)}
                            onFocus={e => e.target.select()}
                            className="text-center h-10 text-base"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex-1 text-center">
                          <label className="text-[10px] text-muted-foreground">القطع</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={item.fields.pieces}
                            onChange={e => updateFields(index, 'pieces', e.target.value)}
                            onBlur={() => handleBlur(index)}
                            onFocus={e => e.target.select()}
                            className="text-center h-10 text-base"
                            placeholder="000"
                          />
                        </div>
                      </div>
                      {parsed.totalBoxes > 0 && (
                        <div className="text-center text-[11px] text-muted-foreground">
                          سيُحفظ: <strong>{displayBP}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={addItem} className="w-full">
                <Plus className="w-4 h-4 ml-1" />
                {t('stock.add_products')}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={requestSave} disabled={isSaving} className="w-full">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              شحن العامل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkerPickerDialog
        open={showWorkerPicker}
        onOpenChange={setShowWorkerPicker}
        workers={workers.map(w => ({ id: w.id, full_name: w.full_name, username: w.username }))}
        selectedWorkerId={selectedWorker}
        onSelect={setSelectedWorker}
        frozenWorkerIds={frozenWorkerIds}
      />

      <SimpleProductPickerDialog
        open={productPickerIndex !== null}
        onOpenChange={(o) => { if (!o) setProductPickerIndex(null); }}
        closeOnSelect={false}
        hideHeader
        showCloseButton
        products={availableProducts}
        selectedProductId={productPickerIndex !== null ? items[productPickerIndex]?.product_id || '' : ''}
        selectedProductIds={selectedShipmentProductIds}
        onSelect={(productId) => {
          if (productPickerIndex !== null) updateProductId(productPickerIndex, productId);
        }}
        onConfirmLoading={() => {
          setProductPickerIndex(null);
          requestSave();
        }}
        onRemoveProduct={() => {
          setItems(prev => {
            if (productPickerIndex === null) return prev;
            const nextItems = prev.filter((_, index) => index !== productPickerIndex);
            return nextItems.length > 0
              ? nextItems
              : [{ product_id: '', quantity: 0, fields: { boxes: '', pieces: '' } }];
          });
          setProductPickerIndex(null);
        }}
      />

      <AlertDialog open={showConfirm} onOpenChange={(o) => { if (!isSaving) setShowConfirm(o); }}>
        <AlertDialogContent dir="rtl" className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              تأكيد شحن العامل
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <div className="text-sm text-foreground">
                  العامل: <strong>{selectedWorkerName}</strong>
                </div>
                <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ تأكد من التفريق بين <strong>الصناديق</strong> و<strong>القطع</strong> قبل التأكيد. الكمية المحفوظة ستُحدّث رصيد العامل مباشرة.
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {validItemsForConfirm.map((it, idx) => {
                    const ppb = getPPB(it.product_id);
                    const parsed = parseBP(`${it.fields.boxes || '0'}.${it.fields.pieces || '0'}`, ppb);
                    const totalPieces = Math.round(parsed.totalBoxes * ppb);
                    const productName = products.find(p => p.id === it.product_id)?.name || '';
                    return (
                      <div key={idx} className="rounded-md border p-2 bg-card">
                        <div className="font-medium text-sm">{productName}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <Badge variant="secondary">{parsed.boxes} صندوق</Badge>
                          <span>+</span>
                          <Badge variant="secondary">{parsed.pieces} قطعة</Badge>
                          <span className="mr-auto text-muted-foreground">
                            = <strong className="text-foreground">{totalPieces}</strong> قطعة (الصندوق = {ppb})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>تعديل</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleSave(); }} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              تأكيد الشحن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default QuickLoadWorkerDialog;
