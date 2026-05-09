import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Package, Check, Plus, X, Gift, Truck, Trash2, Warehouse, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseBP } from '@/utils/boxPieceInput';
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
  tiers: { minQty: number; maxQty: number | null; giftQty: number; giftUnit: string; minUnit?: string }[];
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
  const parsed = parseBP(Number(quantity || 0).toFixed(2), piecesPerBox);
  return {
    boxes: String(parsed.boxes),
    pieces: parsed.pieces > 0 ? String(parsed.pieces) : '',
  };
};

const normalizeFields = (fields: QuantityFields, piecesPerBox: number): QuantityFields => {
  const parsed = parseBP(`${fields.boxes || '0'}.${fields.pieces || '0'}`, piecesPerBox);
  return {
    boxes: String(parsed.boxes),
    pieces: parsed.pieces > 0 ? String(parsed.pieces) : '',
  };
};

const toCustomFormat = (p: { boxes: number; pieces: number }) => p.boxes + p.pieces / 100;

const piecesToFields = (totalPieces: number, piecesPerBox: number): QuantityFields => {
  const ppb = Math.max(1, Math.round(piecesPerBox || 1));
  const safePieces = Math.max(0, Math.round(totalPieces || 0));
  const boxes = Math.floor(safePieces / ppb);
  const pieces = safePieces % ppb;
  return {
    boxes: String(boxes),
    pieces: pieces > 0 ? String(pieces) : '0',
  };
};

const giftToPieces = (giftQty: number, giftUnit: string, piecesPerBox: number): number => {
  const ppb = Math.max(1, Math.round(piecesPerBox || 1));
  return giftUnit === 'box' ? Math.round(giftQty * ppb) : Math.round(giftQty || 0);
};

const createDefaultSingleFields = (): QuantityFields => ({ boxes: '', pieces: '' });
const createDefaultMultiFields = (): QuantityFields => ({ boxes: '1', pieces: '' });

const fieldsToCustomQuantity = (fields: QuantityFields, piecesPerBox: number): number => {
  const parsedFields = parseBP(`${fields.boxes || '0'}.${fields.pieces || '0'}`, piecesPerBox);
  return toCustomFormat(parsedFields);
};

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
    setSingleQtyFields(createDefaultSingleFields()); setSingleGiftFields(createDefaultSingleFields());
    setMultiSelected(new Set());
    setMode('browse');
    setUniformQty(true);
    setUnifiedQtyFields(createDefaultMultiFields());
    setIndividualQtyFields({});
    setSingleGiftQty(0);
    setSingleGiftUnit('piece');
    setIsEditMode(false);
    setOfferActivated({});
  };

  // Single product quantity entry
  const [singleProductId, setSingleProductId] = useState<string | null>(null);
  const [singleQtyFields, setSingleQtyFields] = useState<QuantityFields>(() => createDefaultSingleFields());
  const [singleGiftFields, setSingleGiftFields] = useState<QuantityFields>(() => createDefaultSingleFields());
  const [singleGiftQty, setSingleGiftQty] = useState(0);
  const [singleGiftUnit, setSingleGiftUnit] = useState('piece');
  const [isEditMode, setIsEditMode] = useState(false);

  // Offer activation per product (persists in this dialog session)
  const [offerActivated, setOfferActivated] = useState<Record<string, boolean>>({});

  // Multi-select state
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<PickerMode>('browse');
  const [uniformQty, setUniformQty] = useState(true);
  const [unifiedQtyFields, setUnifiedQtyFields] = useState<QuantityFields>(() => createDefaultMultiFields());
  const [individualQtyFields, setIndividualQtyFields] = useState<Record<string, QuantityFields>>({});

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Track virtual keyboard height to keep dialog content visible above it
  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 0
  );
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setViewportHeight(vv.height);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  // Top offset of the single-qty dialog (matches top-6 / sm:top-8 classes)
  const dialogTopOffset = typeof window !== 'undefined' && window.innerWidth >= 640 ? 32 : 24;
  const singleQtyMaxHeight = Math.max(240, viewportHeight - dialogTopOffset - 8);

  // Auto-scroll focused input into view when keyboard opens
  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

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

  // Display gift amount converting pieces → boxes when divisible by ppb
  const formatGiftDisplay = (giftQty: number, giftUnit: string, ppb: number): string => {
    if (giftUnit === 'box') return `${fmtQty(giftQty)} صندوق`;
    if (ppb > 1) {
      const boxes = Math.floor(giftQty / ppb);
      const pieces = giftQty % ppb;
      if (boxes > 0 && pieces === 0) return `${boxes} صندوق`;
      if (boxes > 0) return `${boxes} صندوق + ${pieces} قطعة`;
    }
    return `${fmtQty(giftQty)} قطعة`;
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
      if (currentGift > 0) setOfferActivated(prev => ({ ...prev, [p.id]: true }));
      setSingleGiftQty(0);
      setSingleGiftUnit('piece');
      setIsEditMode(true);
      setMode('single-qty');
    } else {
      // Add mode: always start with empty fields
      setSingleProductId(p.id);
      setSingleQtyFields(createDefaultSingleFields()); setSingleGiftFields(createDefaultSingleFields());
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
  const parsedBoxes = parsed.boxes;
  const parsedPieces = parsed.pieces;
  const parsedTotalPieces = parsed.totalPieces;
  const displayBP = `${parsed.boxes}.${String(parsed.pieces).padStart(2, '0')}`;
  const displayGiftBP = `${parsedGift.boxes}.${String(parsedGift.pieces).padStart(2, '0')}`;
  const singleOffer = singleProductId ? offersMap[singleProductId] : undefined;

  // Calculate suggested gift based on regular quantity and offer tiers
  const suggestedGift = React.useMemo(() => {
    const qtyCustom = toCustomFormat({ boxes: parsedBoxes, pieces: parsedPieces });
    if (!singleOffer || qtyCustom <= 0) return { qty: 0, unit: 'piece', totalPieces: 0 };
    const qtyPieces = parsedTotalPieces;
    const sortedTiers = [...singleOffer.tiers].sort((a, b) => b.minQty - a.minQty);
    for (const tier of sortedTiers) {
      const minPieces = (tier.minUnit || singleOffer.minUnit) === 'piece'
        ? tier.minQty
        : Math.round(tier.minQty * singlePPB);
      const eligibleQty = (tier.minUnit || singleOffer.minUnit) === 'piece' ? qtyPieces : qtyCustom;
      const threshold = (tier.minUnit || singleOffer.minUnit) === 'piece' ? minPieces : tier.minQty;
      if (eligibleQty >= threshold) {
        const gQty = Math.floor(eligibleQty / threshold) * tier.giftQty;
        const totalPieces = giftToPieces(gQty, tier.giftUnit, singlePPB);
        return { qty: gQty, unit: tier.giftUnit, totalPieces };
      }
    }
    return { qty: 0, unit: 'piece', totalPieces: 0 };
  }, [singleOffer, parsedBoxes, parsedPieces, parsedTotalPieces, singlePPB]);

  const suggestedSplit = React.useMemo(() => {
    const fields = piecesToFields(suggestedGift.totalPieces, singlePPB);
    return { boxes: Number(fields.boxes), pieces: Number(fields.pieces) };
  }, [suggestedGift.totalPieces, singlePPB]);

  // Total = regular + gift (in pieces, then formatted as B.P)
  const totalPiecesCombined = parsed.totalPieces + parsedGift.totalPieces;
  const totalDisplayBP = (() => {
    const b = Math.floor(totalPiecesCombined / singlePPB);
    const p = totalPiecesCombined % singlePPB;
    return `${b}.${String(p).padStart(2, '0')}`;
  })();

  const isOfferActivated = singleProductId ? !!offerActivated[singleProductId] : false;

  // Keep gift fields in sync with suggested split whenever offer is activated
  // and the regular quantity changes — confirm total stays dynamic.
  React.useEffect(() => {
    if (!singleProductId || !isOfferActivated) return;
    setSingleGiftFields({
      boxes: suggestedSplit.boxes > 0 ? String(suggestedSplit.boxes) : '0',
      pieces: suggestedSplit.pieces > 0 ? String(suggestedSplit.pieces) : '0',
    });
  }, [isOfferActivated, singleProductId, suggestedSplit.boxes, suggestedSplit.pieces]);

  const handleConfirmSingle = () => {
    if (!singleProductId || (parsed.boxes === 0 && parsed.pieces === 0 && parsedGift.boxes === 0 && parsedGift.pieces === 0)) return;
    const regularQty = toCustomFormat(parsed);
    const giftQty = toCustomFormat(parsedGift);
    const item = {
      productId: singleProductId,
      quantity: regularQty,
      giftQuantity: parsedGift.boxes > 0 && parsedGift.pieces === 0 ? parsedGift.boxes : parsedGift.totalPieces,
      giftUnit: parsedGift.boxes > 0 && parsedGift.pieces === 0 ? 'box' : 'piece',
    };
    if (isEditMode && onEditProduct) {
      onEditProduct(item);
    } else {
      onAddProducts([item]);
    }
    setSingleProductId(null);
    setSingleQtyFields(createDefaultSingleFields()); setSingleGiftFields(createDefaultSingleFields());
    setMode('browse');
    setSingleGiftQty(0);
    setSingleGiftUnit('piece');
    setIsEditMode(false);
  };

  // Multi-select
  const handleOpenMultiQty = () => {
    if (multiSelected.size === 0) return;
    const initQtys: Record<string, QuantityFields> = {};
    multiSelected.forEach(id => {
      const product = products.find(p => p.id === id);
      const ppb = product?.pieces_per_box || 1;
      initQtys[id] = needsMap[id] > 0 ? quantityToFields(needsMap[id], ppb) : createDefaultMultiFields();
    });
    setIndividualQtyFields(initQtys);
    setUnifiedQtyFields(createDefaultMultiFields());
    setMode('multi-qty');
  };

  // Compute gift for a given product & paid quantity using its offer tiers
  const computeGiftForProduct = (productId: string, qty: number): { giftQty: number; giftUnit: string } => {
    const offer = offersMap[productId];
    if (!offer || qty <= 0) return { giftQty: 0, giftUnit: 'piece' };
    const product = products.find(p => p.id === productId);
    const ppb = product?.pieces_per_box || 1;
    const parsedQty = parseBP(Number(qty || 0).toFixed(2), ppb);
    const sortedTiers = [...offer.tiers].sort((a, b) => b.minQty - a.minQty);
    for (const tier of sortedTiers) {
      const minUnit = tier.minUnit || offer.minUnit;
      const threshold = minUnit === 'piece' ? tier.minQty : tier.minQty;
      const eligibleQty = minUnit === 'piece' ? parsedQty.totalPieces : qty;
      if (eligibleQty >= threshold) {
        const rawGiftQty = Math.floor(eligibleQty / threshold) * tier.giftQty;
        if (tier.giftUnit === 'piece') {
          const normalized = piecesToFields(rawGiftQty, ppb);
          const boxes = Number(normalized.boxes);
          const pieces = Number(normalized.pieces);
          return pieces === 0 && boxes > 0
            ? { giftQty: boxes, giftUnit: 'box' }
            : { giftQty: rawGiftQty, giftUnit: 'piece' };
        }
        return { giftQty: rawGiftQty, giftUnit: tier.giftUnit };
      }
    }
    return { giftQty: 0, giftUnit: 'piece' };
  };

  const handleConfirmMulti = () => {
    const items = Array.from(multiSelected).map(id => {
      const product = products.find(p => p.id === id);
      const ppb = product?.pieces_per_box || 1;
      const qtyFields = uniformQty ? unifiedQtyFields : (individualQtyFields[id] || createDefaultMultiFields());
      const qty = fieldsToCustomQuantity(qtyFields, ppb);
      const activated = !!offerActivated[id];
      const { giftQty, giftUnit } = activated
        ? computeGiftForProduct(id, qty)
        : { giftQty: 0, giftUnit: 'piece' };
      return {
        productId: id,
        quantity: qty,
        giftQuantity: giftQty,
        giftUnit,
      };
    }).filter(i => i.quantity > 0);
    if (items.length === 0) return;
    onAddProducts(items);
    setMultiSelected(new Set());
    setMode('browse');
    setIndividualQtyFields({});
  };

  const handleCancelMulti = () => {
    setMultiSelected(new Set());
    setMode('browse');
    setIndividualQtyFields({});
  };

  const renderProductButton = (p: ProductOption) => {
    const isAlreadyAdded = selectedProductIds.includes(p.id);
    const isOutOfStock = p.warehouseQty === 0;
    const neededQty = needsMap[p.id] || 0;
    const loadedQty = loadedQtyMap[p.id] || 0;
    const giftQty = giftQtyMap[p.id] || 0;
    const isMultiSelected = multiSelected.has(p.id);

    return (
      <div
        key={p.id}
        className={`flex flex-col rounded-xl overflow-hidden text-center transition-all relative bg-card shadow-sm border
          ${isAlreadyAdded ? 'border-green-500 ring-2 ring-green-500/40' : ''}
          ${isMultiSelected ? 'border-primary ring-2 ring-primary/50' : ''}
          ${!isAlreadyAdded && !isMultiSelected ? (neededQty > 0 ? 'border-destructive/50' : 'border-border/50') : ''}
        `}
      >
        <button
          type="button"
          className="flex items-center gap-2 text-start cursor-pointer active:scale-[0.99] transition-transform"
          onClick={() => handleProductTap(p)}
          onPointerDown={() => handlePointerDown(p.id)}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={e => e.preventDefault()}
        >
          {isMultiSelected && (
            <div className="absolute top-1 start-1 z-10 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          )}

          {p.image_url ? (
            <img src={p.image_url} alt={getProductDisplayName(p)} className="w-12 h-12 object-cover shrink-0" loading="lazy" />
          ) : (
            <div className={`w-12 h-12 flex items-center justify-center shrink-0 ${isOutOfStock ? 'bg-destructive/5' : 'bg-muted/20'}`}>
              <Package className={`w-5 h-5 ${isOutOfStock ? 'text-destructive/40' : 'text-muted-foreground/30'}`} />
            </div>
          )}

          <div className={`flex-1 px-2 py-1 text-[11px] font-bold leading-tight truncate
            ${isAlreadyAdded ? 'text-green-700' : neededQty > 0 ? 'text-destructive' : 'text-foreground'}
          `}>
            {getProductDisplayName(p)}
          </div>
        </button>

        {/* Integrated bottom action bar */}
        <div className="flex items-stretch border-t bg-muted/40 divide-x rtl:divide-x-reverse divide-border h-7">
          {isAlreadyAdded && onRemoveProduct ? (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemoveProduct(p.id); }}
                className="flex items-center justify-center w-8 text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                aria-label="حذف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleProductTap(p)}
                className="flex items-center justify-center gap-1 flex-1 text-[10px] font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Truck className="w-3 h-3" />
                {fmtQty(loadedQty - giftQty)}
              </button>
              {giftQty > 0 && (
                <button
                  type="button"
                  onClick={() => handleProductTap(p)}
                  className="flex items-center justify-center gap-1 flex-1 text-[10px] font-semibold text-purple-700 hover:bg-purple-500/10 transition-colors"
                >
                  <Gift className="w-3 h-3" />
                  {fmtQty(giftQty)}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleProductTap(p)}
                className={`flex items-center justify-center gap-1 flex-1 text-[10px] font-semibold hover:bg-accent transition-colors ${isOutOfStock ? 'text-destructive' : 'text-foreground'}`}
              >
                <Warehouse className="w-3 h-3" />
                {fmtQty(p.warehouseQty)}
              </button>
              {neededQty > 0 && (
                <button
                  type="button"
                  onClick={() => handleProductTap(p)}
                  className="flex items-center justify-center flex-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  {fmtQty(neededQty)}
                </button>
              )}
            </>
          )}
        </div>
      </div>
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
            {(() => {
              const offerProducts = selectedProducts.filter(p => !!offersMap[p.id]);
              if (offerProducts.length === 0) return null;
              const allActivated = offerProducts.every(p => !!offerActivated[p.id]);
              return (
                <Button
                  type="button"
                  variant={allActivated ? 'default' : 'outline'}
                  size="sm"
                  className={`h-8 px-2 text-[11px] font-bold ${allActivated ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                  onClick={() => {
                    setOfferActivated(prev => {
                      const next = { ...prev };
                      offerProducts.forEach(p => { next[p.id] = !allActivated; });
                      return next;
                    });
                  }}
                  title={allActivated ? 'إلغاء تفعيل الهدية للكل' : 'تفعيل الهدية للكل'}
                >
                  <Gift className="w-3.5 h-3.5 me-1" />
                  {allActivated ? 'إلغاء الهدية' : 'تفعيل الهدية'}
                </Button>
              );
            })()}
            <Button
              type="button"
              variant={uniformQty ? 'outline' : 'default'}
              size="sm"
              className="h-8 px-2 text-[11px] font-bold"
              onClick={() => setUniformQty(prev => !prev)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 me-1" />
              {uniformQty ? 'تفعيل لكل منتج' : 'كمية موحدة'}
            </Button>
          </div>
        </div>

        {uniformQty && (
          <div className="px-3 py-2 border-b shrink-0">
            <div className="flex items-end gap-2">
              <span className="text-xs text-muted-foreground pb-2">الكمية لكل منتج:</span>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <div>
                  <Label className="text-[10px] text-muted-foreground">الصندوق</Label>
                  <Input
                    type="text" inputMode="numeric"
                    value={unifiedQtyFields.boxes}
                    onFocus={e => e.target.select()}
                    onChange={e => setUnifiedQtyFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                    className="h-8 text-center text-sm font-bold [font-variant-numeric:tabular-nums]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">القطع</Label>
                  <Input
                    type="text" inputMode="numeric"
                    value={unifiedQtyFields.pieces}
                    onFocus={e => e.target.select()}
                    onChange={e => setUnifiedQtyFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                    className="h-8 text-center text-sm font-bold [font-variant-numeric:tabular-nums]"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-1.5">
            {selectedProducts.map(p => {
              const ppb = p.pieces_per_box || 1;
              const qtyFields = uniformQty ? unifiedQtyFields : (individualQtyFields[p.id] || createDefaultMultiFields());
              const qty = fieldsToCustomQuantity(qtyFields, ppb);
              const hasOffer = !!offersMap[p.id];
              const activated = !!offerActivated[p.id];
              const potentialGift = computeGiftForProduct(p.id, qty);
              const gift = activated ? potentialGift : { giftQty: 0, giftUnit: 'piece' };
              const paidPieces = parseBP(Number(qty || 0).toFixed(2), ppb).totalPieces;
              const giftPieces = giftToPieces(gift.giftQty, gift.giftUnit, ppb);
              const giftFields = piecesToFields(giftPieces, ppb);
              const displayedQtyFields = uniformQty && activated && giftPieces > 0
                ? piecesToFields(paidPieces + giftPieces, ppb)
                : qtyFields;
              return (
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
                  {hasOffer && potentialGift.giftQty > 0 && (
                    <div className={`mt-1 space-y-1 ${activated ? '' : 'opacity-50'}`}>
                      <div className={`text-[9px] font-bold flex items-center gap-1 ${activated ? 'text-green-600' : 'text-muted-foreground/70 line-through'}`}>
                        <Gift className="w-3 h-3" />
                        {activated ? 'الهدية مفعلة' : 'هدية متاحة'}
                      </div>
                      {activated && (
                        <div className="grid grid-cols-2 gap-1 max-w-24">
                          <Input readOnly tabIndex={-1} value={giftFields.boxes || '0'} aria-label="صناديق الهدية" className="h-6 text-center text-[10px] font-bold bg-green-500/10 border-green-500/30 text-green-700 px-1" />
                          <Input readOnly tabIndex={-1} value={giftFields.pieces || '0'} aria-label="قطع الهدية" className="h-6 text-center text-[10px] font-bold bg-green-500/10 border-green-500/30 text-green-700 px-1" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!uniformQty && (
                  <div className="grid grid-cols-2 gap-1 w-28 shrink-0">
                    <Input
                      type="text" inputMode="numeric"
                      value={qtyFields.boxes}
                      aria-label="الصندوق"
                      onFocus={e => e.target.select()}
                      onChange={e => setIndividualQtyFields(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || createDefaultMultiFields()), boxes: sanitizeDigits(e.target.value, 5) } }))}
                      className="h-8 text-center text-xs font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="ص"
                    />
                    <Input
                      type="text" inputMode="numeric"
                      value={qtyFields.pieces}
                      aria-label="القطع"
                      onFocus={e => e.target.select()}
                      onChange={e => setIndividualQtyFields(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || createDefaultMultiFields()), pieces: sanitizeDigits(e.target.value, 3) } }))}
                      className="h-8 text-center text-xs font-bold [font-variant-numeric:tabular-nums]"
                      placeholder="ق"
                    />
                  </div>
                )}
                {uniformQty && (
                  <div className="grid grid-cols-2 gap-1 w-24 shrink-0">
                    <Input
                      type="text" readOnly tabIndex={-1}
                      value={displayedQtyFields.boxes || '0'}
                      aria-label="الصندوق"
                      className="h-8 text-center text-xs font-bold bg-muted/40 [font-variant-numeric:tabular-nums]"
                    />
                    <Input
                      type="text" readOnly tabIndex={-1}
                      value={displayedQtyFields.pieces || '0'}
                      aria-label="القطع"
                      className="h-8 text-center text-xs font-bold bg-muted/40 [font-variant-numeric:tabular-nums]"
                    />
                  </div>
                )}
              </div>
              );
            })}
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
                <div className="flex flex-col gap-1.5">
                  {products.filter(p => p.warehouseQty > 0 || selectedProductIds.includes(p.id)).map(renderProductButton)}
                </div>
                {products.filter(p => p.warehouseQty > 0 || selectedProductIds.includes(p.id)).length === 0 && (
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
            setSingleQtyFields(createDefaultSingleFields()); setSingleGiftFields(createDefaultSingleFields());
            setSingleGiftQty(0);
            setSingleGiftUnit('piece');
            setMode('browse');
          }
        }}
      >
        <DialogContent
          className="top-6 sm:top-8 translate-y-0 max-w-sm w-[95vw] p-0 gap-0 flex flex-col overflow-hidden"
          style={{ maxHeight: `${singleQtyMaxHeight}px` }}
          dir="rtl"
        >
          <DialogHeader className="px-3 pt-3 pb-2 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-primary" />
              {isEditMode ? 'تعديل كمية المنتج' : 'إضافة منتج للشاحنة'}
            </DialogTitle>
          </DialogHeader>

          {singleProduct && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
                {/* Product header */}
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                  {singleProduct.image_url ? (
                    <img src={singleProduct.image_url} alt={getProductDisplayName(singleProduct)} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-sm text-primary truncate">{getProductDisplayName(singleProduct)}</h3>
                    <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mt-0.5">
                      <span>المتاح: <strong className="text-foreground">{fmtQty(singleProduct.warehouseQty)}</strong></span>
                      {(loadedQtyMap[singleProduct.id] || 0) > 0 && (
                        <span>الشاحنة: <strong className="text-green-600">{fmtQty(loadedQtyMap[singleProduct.id])}</strong></span>
                      )}
                      {(needsMap[singleProduct.id] || 0) > 0 && (
                        <span>يحتاج: <strong className="text-destructive">{fmtQty(needsMap[singleProduct.id])}</strong></span>
                      )}
                      {singlePPB > 1 && <span>الصندوق={singlePPB}</span>}
                    </div>
                  </div>
                </div>

                {(() => {
                  const hasQty = parsed.totalBoxes > 0 || parsed.pieces > 0 || parsed.boxes > 0;
                  const offerAvailable = !!singleOffer && suggestedGift.totalPieces > 0;
                  const promoMissing = hasQty && offerAvailable && !isOfferActivated;
                  return (
                <>
                {/* Regular qty */}
                <div className={`space-y-1.5 border rounded-lg p-2 ${promoMissing ? 'bg-destructive/5 border-destructive/40' : 'bg-muted/40'}`}>
                  <div className="flex items-center justify-between">
                    <Label className={`text-[11px] font-semibold ${promoMissing ? 'text-destructive' : ''}`}>الكمية (صندوق.قطع)</Label>
                    <div className="flex items-center gap-2">
                      {(parsed.boxes > 0 || parsed.pieces > 0) && (
                        <span className="text-[10px] text-muted-foreground">سيُحفظ: <strong className={promoMissing ? 'text-destructive' : 'text-foreground'}>{displayBP}</strong></span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">الصندوق</Label>
                      <Input
                        type="text" inputMode="numeric"
                        value={singleQtyFields.boxes}
                        onFocus={handleInputFocus}
                        onChange={e => setSingleQtyFields(prev => ({ ...prev, boxes: sanitizeDigits(e.target.value, 5) }))}
                        onBlur={() => setSingleQtyFields(prev => normalizeFields(prev, singlePPB))}
                        className={`h-10 text-center text-base font-bold [font-variant-numeric:tabular-nums] ${promoMissing ? 'border-destructive text-destructive' : ''}`}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">القطع</Label>
                      <Input
                        type="text" inputMode="numeric"
                        value={singleQtyFields.pieces}
                        onFocus={handleInputFocus}
                        onChange={e => setSingleQtyFields(prev => ({ ...prev, pieces: sanitizeDigits(e.target.value, 3) }))}
                        onBlur={() => setSingleQtyFields(prev => normalizeFields(prev, singlePPB))}
                        className={`h-10 text-center text-base font-bold [font-variant-numeric:tabular-nums] ${promoMissing ? 'border-destructive text-destructive' : ''}`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                </>
                  );
                })()}

                {/* Gift qty */}
                {singleOffer && (
                <div className="space-y-1.5 border-2 rounded-lg p-2 bg-green-500/5 border-green-500/40">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] font-bold flex items-center gap-1 text-green-700">
                      <Gift className="w-3.5 h-3.5" />
                      الهدية
                    </Label>
                  </div>
                  {singleOffer && (
                    <div className="rounded-md bg-green-500/10 px-2 py-1 text-[11px] font-semibold text-green-800 text-center">
                      <span className="text-green-700">العرض:</span> {singleOffer.giftQty} {singleOffer.giftUnit === 'piece' ? 'قطعة' : 'صندوق'} لكل {singleOffer.minQty}
                      {suggestedGift.totalPieces > 0 && (
                        <span className="block text-[10px] mt-0.5 text-green-700/80">
                          الاقتراح: {suggestedSplit.boxes > 0 ? `${suggestedSplit.boxes} صندوق` : ''}{suggestedSplit.boxes > 0 && suggestedSplit.pieces > 0 ? ' و ' : ''}{suggestedSplit.pieces > 0 ? `${suggestedSplit.pieces} قطعة` : ''}
                        </span>
                      )}
                    </div>
                  )}
                  {singleOffer && suggestedGift.totalPieces > 0 && singleProductId && (
                    <Button
                      type="button"
                      className={`w-full h-11 text-sm font-bold text-white shadow-md ${isOfferActivated ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700 animate-pulse'}`}
                      onClick={() => {
                        if (isOfferActivated) {
                          setOfferActivated(prev => ({ ...prev, [singleProductId]: false }));
                          setSingleGiftFields(createDefaultSingleFields());
                        } else {
                          setOfferActivated(prev => ({ ...prev, [singleProductId]: true }));
                          setSingleGiftFields({
                            boxes: suggestedSplit.boxes > 0 ? String(suggestedSplit.boxes) : '0',
                            pieces: suggestedSplit.pieces > 0 ? String(suggestedSplit.pieces) : '0',
                          });
                        }
                      }}
                    >
                      <Gift className="w-4 h-4 me-1.5" />
                      {isOfferActivated ? 'إلغاء التفعيل' : `تطبيق العرض (+${suggestedSplit.boxes > 0 ? `${suggestedSplit.boxes} صندوق` : ''}${suggestedSplit.boxes > 0 && suggestedSplit.pieces > 0 ? ' و ' : ''}${suggestedSplit.pieces > 0 ? `${suggestedSplit.pieces} قطعة` : ''})`}
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">الصندوق</Label>
                      <Input
                        type="text" inputMode="numeric"
                        value={singleGiftFields.boxes}
                        readOnly
                        tabIndex={-1}
                        className="h-10 text-center text-base font-bold [font-variant-numeric:tabular-nums] bg-muted/50 cursor-not-allowed"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">القطع</Label>
                      <Input
                        type="text" inputMode="numeric"
                        value={singleGiftFields.pieces}
                        readOnly
                        tabIndex={-1}
                        className="h-10 text-center text-base font-bold [font-variant-numeric:tabular-nums] bg-muted/50 cursor-not-allowed"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                )}

                {/* Total */}
                {totalPiecesCombined > 0 && (() => {
                  const hasQty = parsed.totalBoxes > 0 || parsed.pieces > 0 || parsed.boxes > 0;
                  const offerAvailable = !!singleOffer && suggestedGift.totalPieces > 0;
                  const promoMissing = hasQty && offerAvailable && !isOfferActivated;
                  return (
                  <div className={`rounded-lg border px-2 py-1.5 flex items-center justify-between ${promoMissing ? 'border-destructive/40 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
                    <span className="text-[11px] text-muted-foreground">المجموع (عادي + هدية)</span>
                    <span className={`text-base font-extrabold [font-variant-numeric:tabular-nums] ${promoMissing ? 'text-destructive' : 'text-primary'}`}>{totalDisplayBP}</span>
                  </div>
                  );
                })()}
              </div>

              {/* Sticky footer */}
              <div className="border-t bg-background p-2 shrink-0 flex gap-2">
                {isEditMode && onRemoveProduct && singleProductId && (
                  <Button
                    variant="destructive"
                    className="flex-1 h-11 text-sm font-semibold"
                    onClick={() => {
                      onRemoveProduct(singleProductId);
                      setSingleProductId(null);
                      setSingleQtyFields(createDefaultSingleFields()); setSingleGiftFields(createDefaultSingleFields());
                      setMode('browse');
                      setIsEditMode(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4 me-1.5" />
                    حذف من الشحن
                  </Button>
                )}
                {(() => {
                  const hasQty = parsed.totalBoxes > 0 || parsed.pieces > 0 || parsed.boxes > 0;
                  const offerAvailable = !!singleOffer && suggestedGift.totalPieces > 0;
                  const promoMissing = hasQty && offerAvailable && !isOfferActivated;
                  return (
                <Button
                  onClick={handleConfirmSingle}
                  disabled={(parsed.totalBoxes <= 0 && parsedGift.totalBoxes <= 0) || promoMissing}
                  className={`flex-[2] h-11 text-sm font-bold text-white ${promoMissing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  <Check className="w-4 h-4 me-1.5" />
                  {promoMissing ? 'فعّل العرض أولاً' : (totalPiecesCombined > 0 ? `تأكيد ${totalDisplayBP}` : (isEditMode ? 'تعديل الكمية' : 'تأكيد'))}
                </Button>
                  );
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </>
  );
};

export default ProductPickerDialog;
