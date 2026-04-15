import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Package, Loader2, Truck, Check, Plus, Warehouse } from 'lucide-react';
import { WorkerLoadSuggestion } from '@/hooks/useStockAlerts';
import { parseBP, boxesToBP } from '@/utils/boxPieceInput';
import { getProductDisplayName } from '@/utils/productDisplayName';

interface BulkLoadNeedsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: WorkerLoadSuggestion[];
  products: { id: string; name: string; image_url?: string | null; pieces_per_box?: number }[];
  warehouseStock: { product_id: string; quantity: number }[];
  isLoading: boolean;
  onConfirm: (items: { productId: string; productName: string; quantity: number; piecesPerBox: number }[]) => Promise<void>;
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

const fmtQty = (n: number): string => {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const BulkLoadNeedsDialog: React.FC<BulkLoadNeedsDialogProps> = ({
  open, onOpenChange, suggestions, products, warehouseStock, isLoading, onConfirm,
}) => {
  const deficitSuggestions = useMemo(
    () => suggestions.filter(s => s.suggested_load > 0),
    [suggestions]
  );

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Single product qty entry state
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [qtyFields, setQtyFields] = useState<QuantityFields>({ boxes: '', pieces: '' });

  React.useEffect(() => {
    if (open) {
      const initial: Record<string, number> = {};
      deficitSuggestions.forEach(s => {
        initial[s.product_id] = s.suggested_load;
      });
      setQuantities(initial);
      setActiveProductId(null);
    }
  }, [open, deficitSuggestions]);

  const handleProductTap = (productId: string) => {
    const product = products.find(p => p.id === productId);
    const ppb = product?.pieces_per_box || 1;
    const currentQty = quantities[productId] || 0;
    setActiveProductId(productId);
    setQtyFields(currentQty > 0 ? quantityToFields(currentQty, ppb) : { boxes: '', pieces: '' });
  };

  const activeProduct = activeProductId ? products.find(p => p.id === activeProductId) : null;
  const activeSuggestion = activeProductId ? deficitSuggestions.find(s => s.product_id === activeProductId) : null;
  const activePPB = activeProduct?.pieces_per_box || 1;
  const activeParsed = parseBP(`${qtyFields.boxes || '0'}.${qtyFields.pieces || '0'}`, activePPB);
  const activeDisplayBP = activeParsed.pieces > 0
    ? `${activeParsed.boxes}.${String(activeParsed.pieces).padStart(2, '0')}`
    : `${activeParsed.boxes}`;
  const activeAvailable = activeProductId
    ? warehouseStock.find(ws => ws.product_id === activeProductId)?.quantity || 0
    : 0;

  const handleConfirmQty = () => {
    if (!activeProductId) return;
    const ppb = activeProduct?.pieces_per_box || 1;
    const totalQty = fieldsToQuantity(qtyFields, ppb);
    setQuantities(prev => ({ ...prev, [activeProductId]: totalQty }));
    setActiveProductId(null);
    setQtyFields({ boxes: '', pieces: '' });
  };

  const handleConfirm = async () => {
    const items = deficitSuggestions
      .filter(s => (quantities[s.product_id] || 0) > 0)
      .map(s => {
        const product = products.find(p => p.id === s.product_id);
        return {
          productId: s.product_id,
          productName: s.product_name,
          quantity: quantities[s.product_id] || 0,
          piecesPerBox: product?.pieces_per_box || 20,
        };
      });

    if (items.length === 0) return;
    setIsSaving(true);
    try {
      await onConfirm(items);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const totalItems = deficitSuggestions.filter(s => (quantities[s.product_id] || 0) > 0).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-md h-[90dvh] max-h-[90dvh] gap-0 flex flex-col overflow-hidden p-0 [&>button:last-child]:hidden" dir="rtl">
          <DialogHeader className="px-3 pt-3 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="w-5 h-5 text-destructive" />
              الشحنة المطلوبة
              <Badge variant="destructive" className="text-[10px] rounded-full">{deficitSuggestions.length} منتج</Badge>
            </DialogTitle>
          </DialogHeader>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-1 touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="grid grid-cols-4 gap-1.5">
              {deficitSuggestions.map(s => {
                const product = products.find(p => p.id === s.product_id);
                const imageUrl = product?.image_url;
                const available = warehouseStock.find(ws => ws.product_id === s.product_id)?.quantity || 0;
                const qty = quantities[s.product_id] || 0;
                const hasQty = qty > 0;

                return (
                  <button
                    key={s.product_id}
                    className={`flex flex-col rounded-xl overflow-hidden text-center transition-all relative bg-card shadow-sm border cursor-pointer active:scale-95
                      ${hasQty ? 'border-green-500 ring-2 ring-green-500/40' : 'border-destructive/50'}
                    `}
                    onClick={() => handleProductTap(s.product_id)}
                  >
                    {/* Product name */}
                    <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full
                      ${hasQty ? 'bg-green-500/10 text-green-700' : 'bg-destructive/10 text-destructive'}
                    `}>
                      {product ? getProductDisplayName(product) : s.product_name}
                    </div>

                    {/* Image */}
                    {imageUrl ? (
                      <img src={imageUrl} alt={s.product_name} className="w-full aspect-square object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted/20">
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex items-center justify-center gap-0.5 p-0.5 flex-wrap min-h-[22px]">
                      {hasQty ? (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 flex items-center gap-0.5">
                          <Truck className="w-2.5 h-2.5" />
                          {fmtQty(qty)}
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4">
                            {fmtQty(s.suggested_load)}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 flex items-center gap-0.5">
                            <Warehouse className="w-2.5 h-2.5" />
                            {fmtQty(available)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="px-3 pb-3 pt-2 border-t shrink-0 flex gap-2">
            <Button variant="outline" className="h-10 px-4 text-xs font-semibold" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSaving || totalItems === 0}
              className="flex-1 h-10 rounded-xl text-[13px] shadow-sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              <Truck className="w-4 h-4 me-1" />
              شحن {totalItems} منتج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single product quantity dialog */}
      <Dialog
        open={!!activeProduct}
        onOpenChange={(v) => {
          if (!v) {
            setActiveProductId(null);
            setQtyFields({ boxes: '', pieces: '' });
          }
        }}
      >
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4 text-primary" />
              تحديد كمية الشحن
            </DialogTitle>
          </DialogHeader>

          {activeProduct && activeSuggestion && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-2">
                {activeProduct.image_url ? (
                  <img src={activeProduct.image_url} alt={getProductDisplayName(activeProduct)} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-base text-primary truncate">{getProductDisplayName(activeProduct)}</h3>
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground mt-0.5">
                    <span>يحتاج: <strong className="text-destructive">{fmtQty(activeSuggestion.suggested_load)}</strong></span>
                    <span>المتاح: <strong className="text-foreground">{fmtQty(activeAvailable)}</strong></span>
                  </div>
                  {activePPB > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">الصندوق = {activePPB} قطعة</p>
                  )}
                </div>
              </div>

              <div className="space-y-1 border rounded-lg p-2.5 bg-muted/40">
                <Label className="text-xs font-semibold">الكمية (صندوق.قطع)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">الصندوق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={qtyFields.boxes}
                      onChange={e => setQtyFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                      onBlur={() => setQtyFields(prev => normalizeFields(prev, activePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="00000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">القطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={qtyFields.pieces}
                      onChange={e => setQtyFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                      onBlur={() => setQtyFields(prev => normalizeFields(prev, activePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="000"
                    />
                  </div>
                </div>
                <div className="text-center text-[11px] text-muted-foreground">سيُحفظ: {activeDisplayBP}</div>
              </div>

              <div className="space-y-2">
                <Button onClick={handleConfirmQty} disabled={activeParsed.totalBoxes <= 0} className="w-full h-11 text-sm font-bold">
                  <Check className="w-4 h-4 me-2" />
                  تأكيد الكمية
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => {
                    setActiveProductId(null);
                    setQtyFields({ boxes: '', pieces: '' });
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BulkLoadNeedsDialog;
