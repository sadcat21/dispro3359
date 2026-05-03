import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Package, Check, Plus, X, Gift, Truck, Trash2, Warehouse } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseBP, boxesToBP } from '@/utils/boxPieceInput';
import { getProductDisplayName } from '@/utils/productDisplayName';

interface ProductOption {
  id: string;
  name: string;
  warehouseQty: number;
  groupName?: string;
  image_url?: string | null;
  pieces_per_box?: number;
}

interface QuantityFields {
  boxes: string;
  pieces: string;
}

export interface OfferInfo {
  offerName: string;
  giftQty: number;
  giftUnit: string;
  minQty: number;
  minUnit: string;
  tiers: { minQty: number; maxQty: number | null; giftQty: number; giftUnit: string }[];
}

interface ProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  selectedProductIds: string[];
  onAddProducts: (items: { productId: string; quantity: number; giftQuantity?: number; giftUnit?: string }[]) => void;
  /** Called when user edits an already-added product's quantity */
  onEditProduct?: (item: { productId: string; quantity: number; giftQuantity?: number; giftUnit?: string }) => void;
  /** Called to remove a product from loading */
  onRemoveProduct?: (productId: string) => void;
  /** Called to confirm/finalize the loading session */
  onConfirmLoading?: () => void;
  onSelect?: (productId: string) => void;
  needsMap?: Record<string, number>;
  /** Map of product_id → quantity already loaded in session */
  loadedQtyMap?: Record<string, number>;
  /** Map of product_id → gift quantity in session */
  giftQtyMap?: Record<string, number>;
  /** Map of product_id → offer info for gift suggestions */
  offersMap?: Record<string, OfferInfo>;
  hideHeader?: boolean;
  showCloseButton?: boolean;
  workerName?: string;
}

type PickerMode = 'browse' | 'single-qty' | 'multi-qty';

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

const toCustomFormat = (p: { boxes: number; pieces: number }) => p.boxes + p.pieces / 100;

const createDefaultSingleFields = (): QuantityFields => ({ boxes: '', pieces: '' });

const ProductPickerDialog: React.FC<ProductPickerDialogProps> = ({
  open,
  onOpenChange,
  products,
  selectedProductIds,
  onAddProducts,
  onEditProduct,
  onRemoveProduct,
  onConfirmLoading,
  onSelect,
  needsMap = {},
  loadedQtyMap = {},
  giftQtyMap = {},
  offersMap = {},
  hideHeader = false,
  showCloseButton = false,
  workerName,
}) => {
  const { t } = useLanguage();

  const resetPickerState = () => {
    setSingleProductId(null);
    setSingleQtyFields(createDefaultSingleFields());
    setSingleGiftFields(createDefaultSingleFields());
    setMultiSelected(new Set());
    setMode('browse');
    setUniformQty(true);
    setUnifiedQtyValue(1);
    setIndividualQtys({});
    setSingleGiftQty(0);
    setSingleGiftUnit('piece');
    setIsEditMode(false);
  };

  // Single product quantity entry
  const [singleProductId, setSingleProductId] = useState<string | null>(null);
  const [singleQtyFields, setSingleQtyFields] = useState<QuantityFields>(() => createDefaultSingleFields());
  const [singleGiftFields, setSingleGiftFields] = useState<QuantityFields>(() => createDefaultSingleFields());
  const [singleGiftQty, setSingleGiftQty] = useState(0);
  const [singleGiftUnit, setSingleGiftUnit] = useState('piece');
  const [isEditMode, setIsEditMode] = useState(false);

  // Multi-select state
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<PickerMode>('browse');
  const [uniformQty, setUniformQty] = useState(true);
  const [unifiedQtyValue, setUnifiedQtyValue] = useState(1);
  const [individualQtys, setIndividualQtys] = useState<Record<string, number>>({});

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      resetPickerState();
    }
    onOpenChange(v);
  };

  const handleCancelAndClose = () => {
    resetPickerState();
    onOpenChange(false);
  };

  const fmtQty = (n: number): string => {
    const rounded = Math.round(n * 100) / 100;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  };

  // Long press handlers
  const handlePointerDown = useCallback((productId: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setMode('browse');
      setSingleProductId(null);
      setMultiSelected(prev => {
        const next = new Set(prev);
        next.add(productId);
        return next;
      });
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  // Product tap
  const handleProductTap = (p: ProductOption) => {
    if (longPressTriggered.current) return;

    if (multiSelected.size > 0) {
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(p.id)) next.delete(p.id);
        else next.add(p.id);
        return next;
      });
      return;
    }

    const ppb = p.pieces_per_box || 1;
    const isAlreadyAdded = selectedProductIds.includes(p.id);
    
    if (isAlreadyAdded) {
      // Edit mode: pre-fill with current loaded quantity (excluding existing gift)
      const currentQty = loadedQtyMap[p.id] || 0;
      const currentGift = giftQtyMap[p.id] || 0;
      const ppbVal = p.pieces_per_box || 1;
      const regularQty = Math.max(0, currentQty - currentGift);
      setSingleProductId(p.id);
      setSingleQtyFields(regularQty > 0 ? quantityToFields(regularQty, ppbVal) : createDefaultSingleFields());
      setSingleGiftFields(currentGift > 0 ? quantityToFields(currentGift, ppbVal) : createDefaultSingleFields());
      setSingleGiftQty(0);
      setSingleGiftUnit('piece');
      setIsEditMode(true);
      setMode('single-qty');
    } else {
      // Add mode: always start with empty fields
      setSingleProductId(p.id);
      setSingleQtyFields(createDefaultSingleFields());
      setSingleGiftFields(createDefaultSingleFields());
      setSingleGiftQty(0);
      setSingleGiftUnit('piece');
      setIsEditMode(false);
      setMode('single-qty');
    }
  };

  // Quantity dialog helpers
  const singleProduct = singleProductId ? products.find(pr => pr.id === singleProductId) : null;
  const singlePPB = singleProduct?.pieces_per_box || 1;
  const parsed = parseBP(`${singleQtyFields.boxes || '0'}.${singleQtyFields.pieces || '0'}`, singlePPB);
  const parsedGift = parseBP(`${singleGiftFields.boxes || '0'}.${singleGiftFields.pieces || '0'}`, singlePPB);
  const displayBP = parsed.pieces > 0
    ? `${parsed.boxes}.${String(parsed.pieces).padStart(2, '0')}`
    : `${parsed.boxes}`;
  const displayGiftBP = parsedGift.pieces > 0
    ? `${parsedGift.boxes}.${String(parsedGift.pieces).padStart(2, '0')}`
    : `${parsedGift.boxes}`;
  const singleOffer = singleProductId ? offersMap[singleProductId] : undefined;

  // Calculate suggested gift based on quantity and offer tiers
  const suggestedGift = React.useMemo(() => {
    if (!singleOffer || toCustomFormat(parsed) <= 0) return { qty: 0, unit: 'piece' };
    const qty = toCustomFormat(parsed);
    const sortedTiers = [...singleOffer.tiers].sort((a, b) => b.minQty - a.minQty);
    for (const tier of sortedTiers) {
      if (qty >= tier.minQty) {
        return { qty: Math.floor(qty / tier.minQty) * tier.giftQty, unit: tier.giftUnit };
      }
    }
    return { qty: 0, unit: 'piece' };
  }, [singleOffer, parsed.boxes, parsed.pieces]);

  const handleConfirmSingle = () => {
    if (!singleProductId || (parsed.boxes === 0 && parsed.pieces === 0 && parsedGift.boxes === 0 && parsedGift.pieces === 0)) return;
    const regularQty = toCustomFormat(parsed);
    const giftQty = toCustomFormat(parsedGift);
    const item = {
      productId: singleProductId,
      quantity: regularQty + giftQty,
      giftQuantity: giftQty,
      giftUnit: parsedGift.boxes > 0 && parsedGift.pieces === 0 ? 'box' : 'piece',
    };
    if (isEditMode && onEditProduct) {
      onEditProduct(item);
    } else {
      onAddProducts([item]);
    }
    setSingleProductId(null);
    setSingleQtyFields(createDefaultSingleFields());
    setSingleGiftFields(createDefaultSingleFields());
    setMode('browse');
    setSingleGiftQty(0);
    setSingleGiftUnit('piece');
    setIsEditMode(false);
  };

  // Multi-select
  const handleOpenMultiQty = () => {
    if (multiSelected.size === 0) return;
    const initQtys: Record<string, number> = {};
    multiSelected.forEach(id => { initQtys[id] = needsMap[id] || 1; });
    setIndividualQtys(initQtys);
    setUnifiedQtyValue(1);
    setMode('multi-qty');
  };

  const handleConfirmMulti = () => {
    const items = Array.from(multiSelected).map(id => ({
      productId: id,
      quantity: uniformQty ? unifiedQtyValue : (individualQtys[id] || 1),
    })).filter(i => i.quantity > 0);
    if (items.length === 0) return;
    onAddProducts(items);
    setMultiSelected(new Set());
    setMode('browse');
    setIndividualQtys({});
  };

  const handleCancelMulti = () => {
    setMultiSelected(new Set());
    setMode('browse');
    setIndividualQtys({});
  };

  const renderProductButton = (p: ProductOption) => {
    const isAlreadyAdded = selectedProductIds.includes(p.id);
    const isOutOfStock = p.warehouseQty === 0;
    const neededQty = needsMap[p.id] || 0;
    const loadedQty = loadedQtyMap[p.id] || 0;
    const giftQty = giftQtyMap[p.id] || 0;
    const isMultiSelected = multiSelected.has(p.id);

    return (
      <button
        key={p.id}
        className={`flex flex-col rounded-xl overflow-hidden text-center transition-all relative bg-card shadow-sm border cursor-pointer active:scale-95
          ${isAlreadyAdded ? 'border-green-500 ring-2 ring-green-500/40' : ''}
          ${isMultiSelected ? 'border-primary ring-2 ring-primary/50' : ''}
          ${!isAlreadyAdded && !isMultiSelected ? (neededQty > 0 ? 'border-destructive/50' : 'border-border/50') : ''}
        `}
        onClick={() => handleProductTap(p)}
        onPointerDown={() => handlePointerDown(p.id)}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={e => e.preventDefault()}
      >
        {isMultiSelected && (
          <div className="absolute top-1 start-1 z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        )}

        <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full
          ${isAlreadyAdded ? 'bg-green-500/10 text-green-700' : neededQty > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted/30 text-foreground'}
        `}>
          {getProductDisplayName(p)}
        </div>

        {p.image_url ? (
          <img src={p.image_url} alt={getProductDisplayName(p)} className="w-full aspect-square object-cover" loading="lazy" />
        ) : (
          <div className={`w-full aspect-square flex items-center justify-center ${isOutOfStock ? 'bg-destructive/5' : 'bg-muted/20'}`}>
            <Package className={`w-6 h-6 ${isOutOfStock ? 'text-destructive/40' : 'text-muted-foreground/30'}`} />
          </div>
        )}

        <div className="flex items-center justify-center gap-0.5 p-0.5 flex-wrap min-h-[22px]">
          {isAlreadyAdded && onRemoveProduct ? (
            <div className="flex items-center gap-0.5 w-full">
              {/* Shipped qty badge */}
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 flex items-center gap-0.5 flex-1 justify-center">
                <Truck className="w-2.5 h-2.5" />
                {fmtQty(loadedQty - giftQty)}
              </Badge>
              {/* Gift qty badge */}
              {giftQty > 0 && (
                <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0 h-4 flex items-center gap-0.5 flex-1 justify-center">
                  <Gift className="w-2.5 h-2.5" />
                  {fmtQty(giftQty)}
                </Badge>
              )}
              {/* Delete button */}
              <div
                className="flex items-center justify-center bg-destructive text-destructive-foreground rounded h-4 w-5 cursor-pointer shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveProduct(p.id);
                }}
              >
                <Trash2 className="w-2.5 h-2.5" />
              </div>
            </div>
          ) : (
            <>
              <Badge variant={isOutOfStock ? 'destructive' : 'secondary'} className="text-[9px] px-1 py-0 h-4 flex items-center gap-0.5">
                <Warehouse className="w-2.5 h-2.5" />
                {fmtQty(p.warehouseQty)}
              </Badge>
              {neededQty > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-[8px] px-1 py-0 h-4">
                  {fmtQty(neededQty)}
                </Badge>
              )}
            </>
          )}
        </div>
      </button>
    );
  };

  const renderMultiQtyPanel = () => {
    if (mode !== 'multi-qty') return null;
    const selectedProducts = Array.from(multiSelected).map(id => products.find(p => p.id === id)).filter(Boolean) as ProductOption[];
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
          <span className="text-sm font-bold">{selectedProducts.length} منتج محدد</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{uniformQty ? 'كمية موحدة' : 'كميات مختلفة'}</span>
            <Switch checked={!uniformQty} onCheckedChange={v => setUniformQty(!v)} />
          </div>
        </div>

        {uniformQty && (
          <div className="px-3 py-2 border-b shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">الكمية لكل منتج:</span>
              <Input
                type="number" min={0.01} step="any"
                value={unifiedQtyValue}
                onFocus={e => e.target.select()}
                onChange={e => setUnifiedQtyValue(parseFloat(e.target.value) || 0)}
                className="w-24 h-8 text-center font-bold"
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-1.5">
            {selectedProducts.map(p => (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg ring-1 ring-border/40 bg-card">
                {p.image_url ? (
                  <img src={p.image_url} alt={getProductDisplayName(p)} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate">{getProductDisplayName(p)}</div>
                  <div className="text-[9px] text-muted-foreground">المتاح: {fmtQty(p.warehouseQty)}</div>
                </div>
                {!uniformQty && (
                  <Input
                    type="number" min={0} step="any"
                    value={individualQtys[p.id] || 1}
                    onFocus={e => e.target.select()}
                    onChange={e => setIndividualQtys(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                    className="w-16 h-8 text-center text-sm font-bold"
                  />
                )}
                {uniformQty && (
                  <Badge variant="secondary" className="text-xs">{fmtQty(unifiedQtyValue)}</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const isMultiMode = multiSelected.size > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[95vw] max-w-md h-[90dvh] max-h-[90dvh] gap-0 flex flex-col overflow-hidden p-0 [&>button:last-child]:hidden" dir="rtl">
          {showCloseButton && (
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              aria-label="إغلاق"
              className="absolute start-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {!hideHeader && (
            <DialogHeader className="px-3 pt-3 pb-1 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Package className="w-5 h-5 text-primary" />
                منتجات الشحن
                {isMultiMode && (
                  <Badge className="text-[10px]">{multiSelected.size} محدد</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
          )}

          {mode !== 'multi-qty' && (
            <>
              {!isMultiMode && mode === 'browse' && (
                <div className="px-3 shrink-0 pt-2">
                  {workerName ? (
                    <div className="text-sm font-bold text-center text-primary truncate">{workerName}</div>
                  ) : (
                    <div className="text-[9px] text-muted-foreground text-center">اضغط مطولاً لتحديد عدة منتجات</div>
                  )}
                </div>
              )}

              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-1 touch-pan-y"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="grid grid-cols-4 gap-1.5">
                  {products.map(renderProductButton)}
                </div>
                {products.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    {t('common.no_results')}
                  </div>
                )}
              </div>

              {isMultiMode && mode === 'browse' && (
                <div className="px-3 py-2 border-t shrink-0 flex gap-2">
                  <Button variant="outline" className="flex-1 h-9 text-xs" onClick={handleCancelMulti}>
                    <X className="w-3.5 h-3.5 me-1" />
                    إلغاء التحديد
                  </Button>
                  <Button className="flex-1 h-9 text-xs" onClick={handleOpenMultiQty}>
                    <Plus className="w-3.5 h-3.5 me-1" />
                    تحديد الكميات ({multiSelected.size})
                  </Button>
                </div>
              )}

              {!isMultiMode && mode === 'browse' && onConfirmLoading && (
                <div className="px-3 py-2 border-t shrink-0 flex gap-2">
                  <Button variant="outline" className="h-10 px-4 text-xs font-semibold" onClick={handleCancelAndClose}>
                    إلغاء
                  </Button>
                  <Button className="flex-1 h-10 text-sm font-bold" onClick={onConfirmLoading}>
                    <Check className="w-4 h-4 me-2" />
                    {selectedProductIds.length > 0 ? `تأكيد الشحن (${selectedProductIds.length} منتج)` : 'تأكيد الشحن'}
                  </Button>
                </div>
              )}
            </>
          )}

          {mode === 'multi-qty' && (
            <>
              {renderMultiQtyPanel()}
              <DialogFooter className="px-3 pb-3 pt-2 border-t shrink-0 flex gap-2">
                <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => setMode('browse')}>
                  رجوع
                </Button>
                <Button className="flex-1 h-9 text-xs" onClick={handleConfirmMulti}>
                  <Plus className="w-3.5 h-3.5 me-1" />
                  إضافة {multiSelected.size} منتج
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={mode === 'single-qty' && !!singleProduct}
        onOpenChange={(v) => {
          if (!v) {
            setSingleProductId(null);
            setSingleQtyFields(createDefaultSingleFields());
            setSingleGiftQty(0);
            setSingleGiftUnit('piece');
            setMode('browse');
          }
        }}
      >
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4 text-primary" />
              {isEditMode ? 'تعديل كمية المنتج' : 'إضافة منتج للشاحنة'}
            </DialogTitle>
          </DialogHeader>

          {singleProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-2">
                {singleProduct.image_url ? (
                  <img src={singleProduct.image_url} alt={getProductDisplayName(singleProduct)} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-base text-primary truncate">{getProductDisplayName(singleProduct)}</h3>
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground mt-0.5">
                    <span>المتاح: <strong className="text-foreground">{fmtQty(singleProduct.warehouseQty)}</strong></span>
                    {(loadedQtyMap[singleProduct.id] || 0) > 0 && (
                      <span>في الشاحنة: <strong className="text-green-600">{fmtQty(loadedQtyMap[singleProduct.id])}</strong></span>
                    )}
                    {(needsMap[singleProduct.id] || 0) > 0 && (
                      <span>يحتاج: <strong className="text-destructive">{fmtQty(needsMap[singleProduct.id])}</strong></span>
                    )}
                  </div>
                  {singlePPB > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">الصندوق = {singlePPB} قطعة</p>
                  )}
                </div>
              </div>

              <div className="space-y-1 border rounded-lg p-2.5 bg-muted/40">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">الكمية (صندوق.قطع)</Label>
                  {isEditMode && onRemoveProduct && singleProductId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        onRemoveProduct(singleProductId);
                        setSingleProductId(null);
                        setSingleQtyFields(createDefaultSingleFields());
                        setSingleGiftQty(0);
                        setSingleGiftUnit('piece');
                        setMode('browse');
                        setIsEditMode(false);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">الصندوق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={singleQtyFields.boxes}
                      onChange={e => setSingleQtyFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                      onBlur={() => setSingleQtyFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="00000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">القطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={singleQtyFields.pieces}
                      onChange={e => setSingleQtyFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                      onBlur={() => setSingleQtyFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="000"
                    />
                  </div>
                </div>
                <div className="text-center text-[11px] text-muted-foreground">سيُحفظ: {displayBP}</div>
              </div>

              <div className="space-y-1 border rounded-lg p-2.5 bg-green-500/5 border-green-500/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1 text-green-700">
                    <Gift className="w-3.5 h-3.5" />
                    الهدية (صندوق.قطع)
                  </Label>
                  {singleOffer && suggestedGift.qty > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px] text-green-700 hover:bg-green-500/10"
                      onClick={() => {
                        if (suggestedGift.unit === 'piece') {
                          setSingleGiftFields({ boxes: '', pieces: String(suggestedGift.qty) });
                        } else {
                          setSingleGiftFields({ boxes: String(suggestedGift.qty), pieces: '' });
                        }
                      }}
                    >
                      اقتراح: {suggestedGift.qty} {suggestedGift.unit === 'piece' ? 'قطعة' : 'صندوق'}
                    </Button>
                  )}
                </div>
                {singleOffer && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    عرض: {singleOffer.giftQty} {singleOffer.giftUnit === 'piece' ? 'قطعة' : 'صندوق'} لكل {singleOffer.minQty}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">الصندوق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={singleGiftFields.boxes}
                      onChange={e => setSingleGiftFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                      onBlur={() => setSingleGiftFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">القطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={singleGiftFields.pieces}
                      onChange={e => setSingleGiftFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                      onBlur={() => setSingleGiftFields(prev => normalizeFields(prev, singlePPB))}
                      className="h-11 text-center text-lg font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="0"
                    />
                  </div>
                </div>
                {(parsedGift.boxes > 0 || parsedGift.pieces > 0) && (
                  <div className="text-center text-[11px] text-green-700">هدية: {displayGiftBP}</div>
                )}
              </div>

              <div className="space-y-2">
                <Button onClick={handleConfirmSingle} disabled={parsed.totalBoxes <= 0} className="w-full h-11 text-sm font-bold">
                  <Plus className="w-4 h-4 me-2" />
                  {isEditMode ? 'تعديل الكمية' : 'إضافة للشاحنة'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => {
                    setSingleProductId(null);
                    setSingleQtyFields(createDefaultSingleFields());
                    setSingleGiftQty(0);
                    setSingleGiftUnit('piece');
                    setMode('browse');
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

export default ProductPickerDialog;
