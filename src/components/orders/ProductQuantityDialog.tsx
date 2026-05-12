import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Minus, Package, Gift, Check, Settings2 } from 'lucide-react';
import { Product, PaymentType, PriceSubType } from '@/types/database';
import { InvoicePaymentMethod } from '@/types/stamp';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHasPermission } from '@/hooks/usePermissions';
import { getProductDisplayName } from '@/utils/productDisplayName';
import ProductOfferBadge, { preloadProductOffersForBadge } from '@/components/offers/ProductOfferBadge';
import InvoicePaymentMethodSelect from '@/components/orders/InvoicePaymentMethodSelect';
import { parseBP } from '@/utils/boxPieceInput';
import { ProductOfferWithDetails } from '@/types/productOffer';
import { getProductOfferLookupKey } from '@/utils/productOffers';

export interface GiftInfo {
  giftQuantity: number;
  giftPieces: number;
  offerId?: string;
}

export interface PerItemPricing {
  paymentType: PaymentType;
  invoicePaymentMethod: InvoicePaymentMethod | null;
  priceSubType: PriceSubType;
  customUnitPrice?: number;
}

interface QuantityFields {
  boxes: string;
  pieces: string;
}

const sanitizeDigits = (value: string, maxDigits: number) => value.replace(/\D/g, '').slice(0, maxDigits);

const getPieceDigits = (piecesPerBox: number) => Math.max(2, String(Math.max(0, piecesPerBox - 1)).length);

const quantityToFields = (quantity: number, piecesPerBox: number, allowEmpty = false): QuantityFields => {
  const ppb = Math.max(1, piecesPerBox);
  const totalPieces = Math.max(0, Math.round(quantity * ppb));
  const boxes = Math.floor(totalPieces / ppb);
  const pieces = totalPieces % ppb;
  const pieceDigits = getPieceDigits(ppb);

  if (allowEmpty && totalPieces === 0) {
    return { boxes: '', pieces: '' };
  }

  return {
    boxes: String(boxes),
    pieces: String(pieces).padStart(pieceDigits, '0'),
  };
};

const fieldsToParsedQuantity = (fields: QuantityFields, piecesPerBox: number) => {
  const boxes = fields.boxes || '0';
  const pieces = fields.pieces || '0';
  return parseBP(`${boxes}.${pieces}`, piecesPerBox);
};

const formatBPQuantity = (quantity: number, piecesPerBox: number) => {
  const { boxes, pieces } = quantityToFields(quantity, piecesPerBox);
  return `${boxes}.${pieces}`;
};

interface ProductQuantityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onConfirm: (productId: string, quantity: number, giftInfo?: GiftInfo, isUnitSale?: boolean, perItemPricing?: PerItemPricing) => void;
  unitPrice?: number;
  unitPiecePrice?: number;
  defaultPaymentType?: PaymentType;
  defaultPriceSubType?: PriceSubType;
  defaultInvoicePaymentMethod?: InvoicePaymentMethod | null;
  initialQuantity?: number;
  initialCustomUnitPrice?: number;
  mode?: 'add' | 'edit';
  initialIsUnitSale?: boolean;
  initialGiftPieces?: number;
  initialGiftOfferId?: string;
  initialOfferApplied?: boolean;
  hideInvoiceOption?: boolean;
  customerTypes?: string[] | null;
  offerStage?: 'worker_loading' | 'order_creation' | 'direct_sale' | 'warehouse_sale';
  onDelete?: (productId: string) => void;
}

const ProductQuantityDialog: React.FC<ProductQuantityDialogProps> = ({
  open,
  onOpenChange,
  product,
  onConfirm,
  unitPrice = 0,
  unitPiecePrice = 0,
  defaultPaymentType = 'with_invoice',
  defaultPriceSubType = 'gros',
  defaultInvoicePaymentMethod = null,
  initialQuantity = 0,
  initialCustomUnitPrice,
  mode = 'add',
  initialIsUnitSale = false,
  initialGiftPieces = 0,
  initialGiftOfferId,
  initialOfferApplied = false,
  hideInvoiceOption = false,
  customerTypes,
  offerStage = 'order_creation',
  onDelete,
}) => {
  const { t, dir } = useLanguage();
  const canCustomizePrices = useHasPermission('customize_prices');
  const invoiceSaleAllowed = product?.allow_invoice_sale !== false;
  const piecesPerBox = product?.pieces_per_box || 1;
  const pieceDigits = getPieceDigits(piecesPerBox);
  const [unitQuantityInput, setUnitQuantityInput] = useState(String(initialQuantity));
  const [paidQuantity, setPaidQuantity] = useState(initialIsUnitSale ? 0 : initialQuantity);
  const [quantityFields, setQuantityFields] = useState<QuantityFields>(() => quantityToFields(initialQuantity, piecesPerBox));
  const [giftPieces, setGiftPieces] = useState(initialGiftPieces || 0);
  const [giftOfferId, setGiftOfferId] = useState<string | undefined>(initialGiftOfferId);
  const [offerApplied, setOfferApplied] = useState(initialOfferApplied || initialGiftPieces > 0);
  const [isUnitSale, setIsUnitSale] = useState(initialIsUnitSale);
  const [showPricingOverride, setShowPricingOverride] = useState(false);
  const [itemPaymentType, setItemPaymentType] = useState<PaymentType>(
    defaultPaymentType === 'with_invoice' && !invoiceSaleAllowed ? 'without_invoice' : defaultPaymentType
  );
  const [itemPriceSubType, setItemPriceSubType] = useState<PriceSubType>(defaultPriceSubType);
  const [itemInvoicePaymentMethod, setItemInvoicePaymentMethod] = useState<InvoicePaymentMethod | null>(defaultInvoicePaymentMethod);
  const [customPriceOpen, setCustomPriceOpen] = useState(false);
  const [customUnitPriceInput, setCustomUnitPriceInput] = useState(initialCustomUnitPrice ? String(initialCustomUnitPrice) : '');
  const [prefetchedOffersByKey, setPrefetchedOffersByKey] = useState<Record<string, ProductOfferWithDetails[]>>({});
  const [offersLoading, setOffersLoading] = useState(false);
  const [mandatoryOfferUnactivated, setMandatoryOfferUnactivated] = useState(false);
  const [manualGiftMode, setManualGiftMode] = useState(false);
  const [giftFields, setGiftFields] = useState<QuantityFields>({ boxes: '', pieces: '' });
  const safeT = useCallback((key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  }, [t]);

  const quantity = isUnitSale ? (parseInt(unitQuantityInput) || 0) : Math.floor(Math.max(0, paidQuantity));
  const customUnitPriceValue = Number(customUnitPriceInput || 0);
  const hasCustomUnitPrice = customUnitPriceInput !== '' && Number.isFinite(customUnitPriceValue) && customUnitPriceValue >= 0;
  const pricingUnit = product?.pricing_unit || 'box';
  const safePiecesPerBox = product?.pieces_per_box || 1;
  const safeWeightPerBox = product?.weight_per_box || 1;
  const pricingUnitLabel = pricingUnit === 'kg'
    ? 'kg'
    : pricingUnit === 'unit'
      ? t('offers.unit_piece')
      : t('offers.unit_box');
  const defaultPricingUnitPrice = pricingUnit === 'kg'
    ? (safeWeightPerBox > 0 ? unitPrice / safeWeightPerBox : unitPrice)
    : pricingUnit === 'unit'
      ? (safePiecesPerBox > 0 ? unitPrice / safePiecesPerBox : unitPrice)
      : unitPrice;
  const resolveSaleUnitPrice = useCallback((basePrice: number, unitSale: boolean) => {
    if (pricingUnit === 'kg') {
      const boxPrice = basePrice * (safeWeightPerBox || 1);
      return unitSale ? boxPrice / (safePiecesPerBox || 1) : boxPrice;
    }
    if (pricingUnit === 'unit') {
      const piecePrice = basePrice;
      return unitSale ? piecePrice : piecePrice * (safePiecesPerBox || 1);
    }
    const boxPrice = basePrice;
    return unitSale ? boxPrice / (safePiecesPerBox || 1) : boxPrice;
  }, [pricingUnit, safeWeightPerBox, safePiecesPerBox]);

  const selectedPricingUnitPrice = useMemo(() => {
    if (!product) return defaultPricingUnitPrice;

    if (itemPaymentType === 'with_invoice' && invoiceSaleAllowed) {
      return Number(product.price_invoice || 0);
    }

    switch (itemPriceSubType) {
      case 'super_gros':
        return Number(product.price_super_gros || product.price_no_invoice || 0);
      case 'retail':
        return Number(product.price_retail || product.price_no_invoice || 0);
      default:
        return Number(product.price_gros || product.price_no_invoice || 0);
    }
  }, [defaultPricingUnitPrice, invoiceSaleAllowed, itemPaymentType, itemPriceSubType, product]);

  const selectedBoxPrice = useMemo(
    () => resolveSaleUnitPrice(selectedPricingUnitPrice, false),
    [resolveSaleUnitPrice, selectedPricingUnitPrice],
  );

  const selectedPiecePrice = useMemo(
    () => resolveSaleUnitPrice(selectedPricingUnitPrice, true),
    [resolveSaleUnitPrice, selectedPricingUnitPrice],
  );

  const hasPricingSelectionChanges = useMemo(() => {
    if (itemPaymentType !== defaultPaymentType) return true;

    if (itemPaymentType === 'with_invoice') {
      return (itemInvoicePaymentMethod || null) !== (defaultInvoicePaymentMethod || null);
    }

    return itemPriceSubType !== defaultPriceSubType;
  }, [
    defaultInvoicePaymentMethod,
    defaultPaymentType,
    defaultPriceSubType,
    itemInvoicePaymentMethod,
    itemPaymentType,
    itemPriceSubType,
  ]);

  // Sync quantity when initialQuantity changes (edit mode vs new)
  useEffect(() => {
    if (open) {
      setIsUnitSale(initialIsUnitSale);
      setUnitQuantityInput(initialQuantity > 0 ? String(initialQuantity) : '');
      setPaidQuantity(initialIsUnitSale ? 0 : initialQuantity);
      setQuantityFields(quantityToFields(initialQuantity, piecesPerBox, initialQuantity === 0));
    }
  }, [open, initialQuantity, piecesPerBox, initialIsUnitSale]);

  useEffect(() => {
    if (open) {
      setCustomUnitPriceInput(initialCustomUnitPrice ? String(initialCustomUnitPrice) : '');
    }
  }, [open, initialCustomUnitPrice]);

  useEffect(() => {
    if (open) {
      setItemPaymentType(defaultPaymentType === 'with_invoice' && !invoiceSaleAllowed ? 'without_invoice' : defaultPaymentType);
      setItemPriceSubType(defaultPriceSubType);
      setItemInvoicePaymentMethod(defaultPaymentType === 'with_invoice' && !invoiceSaleAllowed ? null : defaultInvoicePaymentMethod);
    }
  }, [defaultInvoicePaymentMethod, defaultPaymentType, defaultPriceSubType, invoiceSaleAllowed, open]);

  useEffect(() => {
    if (open) {
      setGiftPieces(initialGiftPieces || 0);
      setGiftOfferId(initialGiftOfferId);
      setOfferApplied((initialOfferApplied || initialGiftPieces > 0) && !initialIsUnitSale);
    }
  }, [open, initialGiftPieces, initialGiftOfferId, initialOfferApplied, initialIsUnitSale]);

  useEffect(() => {
    if (!invoiceSaleAllowed && itemPaymentType === 'with_invoice') {
      setItemPaymentType('without_invoice');
      setItemInvoicePaymentMethod(null);
    }
  }, [invoiceSaleAllowed, itemPaymentType]);

  // Offer must be applied before confirming (mandatory)
  const hasUnappliedOffer = !isUnitSale && giftPieces > 0 && !offerApplied;

  const handleConfirm = () => {
    const effectiveQty = isUnitSale ? quantity : Math.max(0, paidQuantity);
    if (product && effectiveQty > 0 && !hasUnappliedOffer) {
      const perItemPricing: PerItemPricing | undefined = (hasPricingSelectionChanges || hasCustomUnitPrice) ? {
        paymentType: itemPaymentType,
        invoicePaymentMethod: itemPaymentType === 'with_invoice' ? itemInvoicePaymentMethod : null,
        priceSubType: itemPriceSubType,
        customUnitPrice: hasCustomUnitPrice ? customUnitPriceValue : undefined,
      } : undefined;

      if (isUnitSale) {
        onConfirm(product.id, effectiveQty, undefined, true, perItemPricing);
      } else {
        const ppb = product.pieces_per_box || 1;
        const giftBoxes = ppb > 0 ? Math.floor(giftPieces / ppb) : 0;
        const giftRemainder = ppb > 0 ? giftPieces % ppb : giftPieces;
        const appliedGiftBoxes = offerApplied ? giftBoxes : 0;
        const appliedGiftRemainder = offerApplied ? giftRemainder : 0;
        const totalQuantity = effectiveQty + appliedGiftBoxes;

        if (appliedGiftBoxes > 0 || appliedGiftRemainder > 0) {
          onConfirm(product.id, totalQuantity, { giftQuantity: appliedGiftBoxes, giftPieces: appliedGiftRemainder, offerId: giftOfferId }, false, perItemPricing);
        } else {
          onConfirm(product.id, effectiveQty, undefined, false, perItemPricing);
        }
      }
      setUnitQuantityInput('');
      setPaidQuantity(0);
      setQuantityFields({ boxes: '', pieces: '' });
      setGiftPieces(0);
      setGiftOfferId(undefined);
      setOfferApplied(false);
      setIsUnitSale(false);
      setShowPricingOverride(false);
      setCustomUnitPriceInput('');
      onOpenChange(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    if (isUnitSale) {
      const current = parseInt(unitQuantityInput) || 0;
      const newQty = Math.max(1, current + delta);
      setUnitQuantityInput(String(newQty));
      return;
    }

    const currentPieces = Math.max(0, Math.round(paidQuantity * piecesPerBox));
    const newQtyPieces = Math.max(piecesPerBox, currentPieces + (delta * piecesPerBox));
    const nextPaidQuantity = newQtyPieces / piecesPerBox;
    setPaidQuantity(nextPaidQuantity);
    setQuantityFields(quantityToFields(nextPaidQuantity, piecesPerBox));
  };

  const handleGiftCalculated = useCallback((pieces: number, offerId?: string) => {
    if (manualGiftMode) return;
    setGiftPieces(pieces);
    setGiftOfferId(offerId);
  }, [manualGiftMode]);

  const handleOfferActivated = useCallback((info: { offerId: string; autoFill: boolean; suggestedGiftPieces: number } | null) => {
    if (!info) {
      setOfferApplied(false);
      setManualGiftMode(false);
      setGiftPieces(0);
      setGiftOfferId(undefined);
      setGiftFields({ boxes: '', pieces: '' });
      return;
    }
    setOfferApplied(true);
    setGiftOfferId(info.offerId);
    setManualGiftMode(!info.autoFill);
    if (info.autoFill) {
      setGiftPieces(info.suggestedGiftPieces);
      setGiftFields(quantityToFields(info.suggestedGiftPieces / piecesPerBox, piecesPerBox, info.suggestedGiftPieces === 0));
    } else {
      setGiftPieces(0);
      setGiftFields({ boxes: '', pieces: '' });
    }
  }, [piecesPerBox]);

  const handleGiftFieldChange = (field: keyof QuantityFields, value: string) => {
    const next = { ...giftFields, [field]: sanitizeDigits(value, 6) };
    setGiftFields(next);
    const parsed = fieldsToParsedQuantity(next, piecesPerBox);
    setGiftPieces(parsed.totalPieces);
  };

  const handleApplyOffer = () => {
    if (!product || giftPieces <= 0) return;
    setOfferApplied(true);
  };

  useEffect(() => {
    if (!offerApplied || isUnitSale) return;
    if (giftPieces <= 0) {
      setOfferApplied(false);
      setGiftOfferId(undefined);
    }
  }, [offerApplied, giftPieces, isUnitSale]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setGiftPieces(initialGiftPieces || 0);
      setGiftOfferId(initialGiftOfferId);
      setUnitQuantityInput(initialQuantity > 0 ? String(initialQuantity) : '');
      setPaidQuantity(initialIsUnitSale ? 0 : initialQuantity);
      setQuantityFields(quantityToFields(initialQuantity, piecesPerBox, initialQuantity === 0));
      setOfferApplied((initialOfferApplied || initialGiftPieces > 0) && !initialIsUnitSale);
      setIsUnitSale(initialIsUnitSale);
      setShowPricingOverride(false);
      setItemPaymentType(defaultPaymentType === 'with_invoice' && !invoiceSaleAllowed ? 'without_invoice' : defaultPaymentType);
      setItemPriceSubType(defaultPriceSubType);
      setItemInvoicePaymentMethod(defaultPaymentType === 'with_invoice' && !invoiceSaleAllowed ? null : defaultInvoicePaymentMethod);
      setCustomUnitPriceInput(initialCustomUnitPrice ? String(initialCustomUnitPrice) : '');
    }
    onOpenChange(isOpen);
  };

  const handleQuantityFieldChange = (field: keyof QuantityFields, value: string) => {
    const nextFields = {
      ...quantityFields,
      [field]: sanitizeDigits(value, 6),
    };

    setQuantityFields(nextFields);

    const parsedValue = fieldsToParsedQuantity(nextFields, piecesPerBox);
    // Quantity field reflects only the paid (sales) quantity; gift is shown in its own block
    setPaidQuantity(parsedValue.totalPieces / piecesPerBox);
  };

  const customerTypesKey = JSON.stringify([...(customerTypes || [])].filter(Boolean).sort());
  const currentOfferLookupKey = product ? getProductOfferLookupKey(product.id, customerTypes) : '';
  const currentPrefetchedOffers = currentOfferLookupKey ? prefetchedOffersByKey[currentOfferLookupKey] : undefined;
  const offerCheckPending = Boolean(open && product && !isUnitSale && !currentPrefetchedOffers) || offersLoading;

  const prefetchOffers = useCallback(async (productId: string, nextCustomerTypes?: string[] | null) => {
    const lookupKey = getProductOfferLookupKey(productId, nextCustomerTypes);
    setOffersLoading(true);
    try {
      const activeOffers = await preloadProductOffersForBadge(productId, nextCustomerTypes);
      setPrefetchedOffersByKey((prev) => ({ ...prev, [lookupKey]: activeOffers }));
      return activeOffers;
    } finally {
      setOffersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !product || isUnitSale) return;
    prefetchOffers(product.id, customerTypes);
  }, [open, product, isUnitSale, customerTypesKey, prefetchOffers]);

  if (!product) return null;

  const giftBoxes = product.pieces_per_box > 0 ? Math.floor(giftPieces / product.pieces_per_box) : 0;
  const giftRemainingPieces = product.pieces_per_box > 0 ? giftPieces % product.pieces_per_box : 0;
  const appliedGiftBoxes = offerApplied ? giftBoxes : 0;
  const appliedGiftPieces = offerApplied ? giftPieces : 0;
  const totalBpQuantity = paidQuantity + (appliedGiftPieces / piecesPerBox);
  const baseQuantityDisplay = formatBPQuantity(paidQuantity, piecesPerBox);
  const totalQuantityDisplay = formatBPQuantity(totalBpQuantity, piecesPerBox);
  const giftQuantityDisplay = formatBPQuantity(giftPieces / piecesPerBox, piecesPerBox);
  const baseUnitPrice = isUnitSale ? selectedPiecePrice : selectedBoxPrice;
  const displayPrice = hasCustomUnitPrice ? resolveSaleUnitPrice(customUnitPriceValue, isUnitSale) : baseUnitPrice;
  const displayTotal = isUnitSale ? (displayPrice * quantity) : (displayPrice * paidQuantity);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[96vw] max-w-[560px] sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden p-0" dir={dir}>
        <div className="px-2 pt-4 pb-2 border-b bg-gradient-to-l from-primary/5 to-transparent">
          <DialogHeader>
            <DialogTitle asChild>
              <div dir="ltr" className="flex items-stretch gap-3 text-start">
                <div className="flex-1 min-w-0 space-y-2">
                  <h3 className="font-extrabold text-base text-foreground tracking-tight leading-tight truncate uppercase text-center px-10">
                    {product.name || getProductDisplayName(product)}
                  </h3>
                  <div className="grid w-full rounded-lg overflow-hidden ring-1 ring-border bg-card shadow-sm text-center divide-x divide-border/40" style={{ gridTemplateColumns: '1.3fr 0.7fr 1.3fr 0.7fr 1.3fr' }}>
                    {/* Col 1: DA/PCS */}
                    <div className="@container px-1 py-1 overflow-hidden flex flex-col items-center justify-center gap-0.5">
                      <div className="font-extrabold text-foreground leading-tight whitespace-nowrap" style={{ fontSize: 'clamp(7px, 22cqw, 13px)' }}>
                        {selectedPiecePrice > 0 ? <>{selectedPiecePrice.toLocaleString()} <span className="opacity-60">{t('common.currency')}</span></> : '—'}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">PCS</div>
                    </div>
                    {/* Col 2: PCS/BOX */}
                    <div className="@container px-1 py-1 overflow-hidden flex flex-col items-center justify-center gap-0.5">
                      <div className="font-extrabold text-foreground leading-tight whitespace-nowrap" style={{ fontSize: 'clamp(7px, 22cqw, 13px)' }}>
                        {product.pieces_per_box > 0 ? <>{product.pieces_per_box} <span className="opacity-60">PCS</span></> : '—'}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">BOX</div>
                    </div>
                    {/* Col 3: DA/BOX */}
                    <div className="@container px-1.5 py-1 overflow-hidden flex flex-col items-center justify-center gap-0.5">
                      <div className="font-extrabold text-foreground leading-tight whitespace-nowrap" style={{ fontSize: 'clamp(8px, 22cqw, 15px)' }}>
                        {displayPrice > 0 ? <>{displayPrice.toLocaleString()} <span className="opacity-60">{t('common.currency')}</span></> : '—'}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">BOX</div>
                    </div>
                    {/* Col 4: KG/BOX */}
                    <div className="@container px-1 py-1 overflow-hidden flex flex-col items-center justify-center gap-0.5">
                      <div className="font-extrabold text-foreground leading-tight whitespace-nowrap" style={{ fontSize: 'clamp(7px, 22cqw, 13px)' }}>
                        {pricingUnit !== 'box' && (product.weight_per_box || 0) > 0
                          ? <>{(product.weight_per_box || 0).toLocaleString()} <span className="opacity-60">{pricingUnitLabel}</span></>
                          : '—'}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">BOX</div>
                    </div>
                    {/* Col 5: DA/KG */}
                    <div className="@container px-1 py-1 overflow-hidden flex flex-col items-center justify-center gap-0.5">
                      <div className="font-extrabold text-foreground leading-tight whitespace-nowrap" style={{ fontSize: 'clamp(7px, 22cqw, 13px)' }}>
                        {pricingUnit !== 'box' && selectedPricingUnitPrice > 0
                          ? <>{selectedPricingUnitPrice.toLocaleString()} <span className="opacity-60">{t('common.currency')}</span></>
                          : '—'}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{pricingUnitLabel}</div>
                    </div>
                  </div>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          {!isUnitSale && (
            <div className="mt-2">
              <ProductOfferBadge productId={product.id} quantity={quantity} piecesPerBox={product.pieces_per_box} customerTypes={customerTypes} stage={offerStage} onGiftCalculated={handleGiftCalculated} onOffersLoadingChange={setOffersLoading} onMandatoryUnactivatedChange={setMandatoryOfferUnactivated} onOfferActivated={handleOfferActivated} prefetchedOffers={currentPrefetchedOffers} onPrefetchOffers={prefetchOffers} />
            </div>
          )}
          {!isUnitSale && !offerApplied && !manualGiftMode && giftPieces > 0 && (
            <Button className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleApplyOffer}>
              <Gift className="w-4 h-4 ms-2" />
              {t('offers.apply_offer')} +{giftBoxes > 0 ? `${giftBoxes} ${t('offers.unit_box')}` : ''}{giftBoxes > 0 && giftRemainingPieces > 0 ? ' + ' : ''}{giftRemainingPieces > 0 ? `${giftRemainingPieces} ${t('offers.unit_piece')}` : ''}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-1 relative">
          {product.image_url && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-center bg-no-repeat bg-contain opacity-40"
              style={{ backgroundImage: `url(${product.image_url})` }}
            />
          )}
          <div className="space-y-2 py-1 relative">

            <div className="flex items-stretch gap-3">
              <div className="flex-1 min-w-0 space-y-2">

            {/* Direct pricing buttons F1 / SG / G / D + custom gear */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                {!hideInvoiceOption && (
                  <Button
                    type="button"
                    variant={itemPaymentType === 'with_invoice' ? 'default' : 'outline'}
                    size="sm"
                    className={`flex-1 h-9 text-xs font-bold ${itemPaymentType === 'with_invoice' ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-400' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}
                    onClick={() => {
                      setItemPaymentType('with_invoice');
                      if (!itemInvoicePaymentMethod) setItemInvoicePaymentMethod(defaultInvoicePaymentMethod || 'cash');
                    }}
                    disabled={!invoiceSaleAllowed}
                    title={t('orders.with_invoice')}
                  >
                    F1
                  </Button>
                )}
                <Button
                  type="button"
                  variant={itemPaymentType === 'without_invoice' && itemPriceSubType === 'super_gros' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 h-9 text-xs font-bold ${itemPaymentType === 'without_invoice' && itemPriceSubType === 'super_gros' ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-400' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'}`}
                  onClick={() => { setItemPaymentType('without_invoice'); setItemPriceSubType('super_gros'); }}
                  title={t('products.price_super_gros')}
                >
                  SG
                </Button>
                <Button
                  type="button"
                  variant={itemPaymentType === 'without_invoice' && itemPriceSubType === 'gros' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 h-9 text-xs font-bold ${itemPaymentType === 'without_invoice' && itemPriceSubType === 'gros' ? 'bg-cyan-600 hover:bg-cyan-700 text-white ring-2 ring-cyan-400' : 'border-cyan-300 text-cyan-700 hover:bg-cyan-50'}`}
                  onClick={() => { setItemPaymentType('without_invoice'); setItemPriceSubType('gros'); }}
                  title={t('products.price_gros')}
                >
                  G
                </Button>
                <Button
                  type="button"
                  variant={itemPaymentType === 'without_invoice' && itemPriceSubType === 'retail' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 h-9 text-xs font-bold ${itemPaymentType === 'without_invoice' && itemPriceSubType === 'retail' ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400' : 'border-rose-300 text-rose-700 hover:bg-rose-50'}`}
                  onClick={() => { setItemPaymentType('without_invoice'); setItemPriceSubType('retail'); }}
                  title={t('products.price_retail')}
                >
                  D
                </Button>
                {canCustomizePrices && (
                  <Button
                    type="button"
                    variant={hasCustomUnitPrice ? 'default' : 'outline'}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setCustomPriceOpen(true)}
                    title={safeT('orders.custom_unit_price', 'تخصيص سعر الوحدة')}
                  >
                    <Settings2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {itemPaymentType === 'with_invoice' && invoiceSaleAllowed && (
                <InvoicePaymentMethodSelect
                  value={itemInvoicePaymentMethod}
                  onChange={setItemInvoicePaymentMethod}
                />
              )}
              {hasCustomUnitPrice && (
                <div className="flex items-center justify-end">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {customUnitPriceValue.toLocaleString()} {t('common.currency')} / {pricingUnitLabel}
                  </Badge>
                </div>
              )}
              {!invoiceSaleAllowed && (
                <p className="text-[11px] text-amber-600 text-center">
                  {safeT('products.invoice1_disabled_hint', 'هذا المنتج غير مسموح ببيعه عبر Facture 1 من إدارة المنتجات.')}
                </p>
              )}
            </div>
              </div>
            </div>

            {/* Quantity Selector - compact */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-3">
                <Button size="icon" className="h-10 w-10 rounded-full bg-destructive hover:bg-destructive/90 text-white" onClick={() => handleQuantityChange(-1)} disabled={quantity <= (isUnitSale ? 1 : 0)}>
                  <Minus className="w-4 h-4" />
                </Button>
                {isUnitSale ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={unitQuantityInput}
                    onChange={(e) => setUnitQuantityInput(e.target.value.replace(/\D/g, ''))}
                    onFocus={(e) => e.target.select()}
                    className="w-24 h-11 text-center text-xl font-bold"
                    placeholder="0"
                  />
                ) : (() => {
                  const piecesNum = parseInt(quantityFields.pieces || '0', 10);
                  const boxesNum = parseInt(quantityFields.boxes || '0', 10);
                  const canConvert = piecesPerBox > 0 && piecesNum >= piecesPerBox;
                  const extraBoxes = canConvert ? Math.floor(piecesNum / piecesPerBox) : 0;
                  const remainPcs = canConvert ? piecesNum % piecesPerBox : 0;
                  const applyConvert = () => {
                    const next = {
                      ...quantityFields,
                      boxes: String(boxesNum + extraBoxes),
                      pieces: String(remainPcs).padStart(pieceDigits, '0'),
                    };
                    setQuantityFields(next);
                    const parsedValue = fieldsToParsedQuantity(next, piecesPerBox);
                    setPaidQuantity(parsedValue.totalPieces / piecesPerBox);
                  };
                  return (
                  <div dir="ltr" className="relative grid grid-cols-2 gap-2 w-[14rem]">
                    {canConvert && (
                      <button
                        type="button"
                        onClick={applyConvert}
                        title="تحويل إلى صناديق"
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold shadow-md hover:bg-primary/90 whitespace-nowrap"
                      >
                        {extraBoxes}.{String(remainPcs).padStart(2, '0')}
                      </button>
                    )}
                    <div className="flex items-stretch h-11 rounded-md border-2 border-destructive bg-background overflow-hidden focus-within:ring-2 focus-within:ring-destructive">
                      <span className="flex items-center justify-center px-2 text-[10px] font-bold bg-destructive text-destructive-foreground tracking-wide">BOX</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={quantityFields.boxes}
                        onChange={(e) => handleQuantityFieldChange('boxes', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 h-full border-0 rounded-none text-center text-xl font-bold focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-stretch h-11 rounded-md border-2 border-foreground bg-background overflow-hidden focus-within:ring-2 focus-within:ring-foreground">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={quantityFields.pieces}
                        onChange={(e) => handleQuantityFieldChange('pieces', e.target.value)}
                        
                        onFocus={(e) => e.target.select()}
                        className="flex-1 h-full border-0 rounded-none text-center text-xl font-bold focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                        placeholder={String(0).padStart(pieceDigits, '0')}
                      />
                      <span className="flex items-center justify-center px-2 text-[10px] font-bold bg-foreground text-background tracking-wide">PCS</span>
                    </div>
                  </div>
                  );
                })()}
                <Button size="icon" className="h-10 w-10 rounded-full bg-foreground hover:bg-foreground/90 text-background" onClick={() => handleQuantityChange(1)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Offer badge moved to header */}

            {!isUnitSale && offerApplied && (manualGiftMode || appliedGiftBoxes > 0 || appliedGiftPieces > 0) && (
              <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-xs font-bold">
                    <Gift className="w-4 h-4" />
                    <span>برومو {manualGiftMode ? '· إدخال يدوي' : ''}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => {
                      setOfferApplied(false);
                      setGiftPieces(0);
                      setManualGiftMode(false);
                      setGiftFields({ boxes: '', pieces: '' });
                    }}
                  >
                    إلغاء العرض
                  </Button>
                </div>
                <div dir="ltr" className="grid grid-cols-2 gap-3">
                  <div className="flex items-stretch h-10 rounded-md border-2 border-destructive bg-background overflow-hidden">
                    <span className="flex items-center justify-center px-2 text-[10px] font-bold bg-destructive text-destructive-foreground tracking-wide">BOX</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      readOnly={!manualGiftMode}
                      value={manualGiftMode ? giftFields.boxes : String(appliedGiftBoxes)}
                      onChange={(e) => handleGiftFieldChange('boxes', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 h-full border-0 rounded-none text-center text-base font-bold focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-stretch h-10 rounded-md border-2 border-foreground bg-background overflow-hidden">
                    <Input
                      type="text"
                      inputMode="numeric"
                      readOnly={!manualGiftMode}
                      value={manualGiftMode ? giftFields.pieces : String(giftRemainingPieces).padStart(pieceDigits, '0')}
                      onChange={(e) => handleGiftFieldChange('pieces', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 h-full border-0 rounded-none text-center text-base font-bold focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                      placeholder={String(0).padStart(pieceDigits, '0')}
                    />
                    <span className="flex items-center justify-center px-2 text-[10px] font-bold bg-foreground text-background tracking-wide">PCS</span>
                  </div>
                </div>
              </div>
            )}

            {/* Product Detail Summary - always visible */}
            {!isUnitSale && (
              <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border text-xs">
                <div className="flex justify-between items-center px-2.5 py-1.5">
                  <span className="text-muted-foreground">{t('orders.quantity_boxes') || 'الكمية'}</span>
                  <span className="font-bold">{baseQuantityDisplay}</span>
                </div>
                {displayPrice > 0 && (
                  <div className="flex justify-between items-center px-2.5 py-1.5">
                    <span className="text-muted-foreground">{t('orders.subtotal') || 'المجموع الفرعي'}</span>
                    <span className="font-bold">{displayTotal.toLocaleString()} {t('common.currency')}</span>
                  </div>
                )}
                {(giftPieces > 0 || appliedGiftPieces > 0) && (
                  <>
                    <div className="flex justify-between items-center px-2.5 py-1.5 text-green-700 dark:text-green-400">
                      <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5" />{t('common.free') || 'العرض'}</span>
                      <span className="font-bold">{giftQuantityDisplay}</span>
                    </div>
                    <div className="flex justify-between items-center px-2.5 py-1.5 text-green-700 dark:text-green-400">
                      <span className="text-muted-foreground">{t('orders.subtotal') || 'المجموع الفرعي (العرض)'}</span>
                      <span className="font-bold">0 {t('common.currency')}</span>
                    </div>
                    <div className="flex justify-between items-center px-2.5 py-1.5 font-bold">
                      <span>{t('orders.total_boxes') || 'إجمالي الصناديق'}</span>
                      <span className="text-primary">{totalQuantityDisplay}</span>
                    </div>
                  </>
                )}
                {displayPrice > 0 && (
                  <div className="flex justify-between items-center px-2.5 py-1.5 bg-primary/5 rounded-b-lg font-extrabold text-sm">
                    <span>{t('orders.grand_total') || 'الإجمالي'}</span>
                    <span className="text-primary">{displayTotal.toLocaleString()} {t('common.currency')}</span>
                  </div>
                )}
              </div>
            )}

            {isUnitSale && displayPrice > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 text-xs">
                <div className="flex justify-between items-center px-2.5 py-1.5 font-extrabold text-sm bg-primary/5 rounded-lg">
                  <span>{t('orders.grand_total') || 'الإجمالي'}</span>
                  <span className="text-primary">{displayTotal.toLocaleString()} {t('common.currency')}</span>
                </div>
              </div>
            )}

            {/* Per-item pricing now exposed via direct buttons above */}
          </div>
        </div>

        <Dialog open={customPriceOpen} onOpenChange={setCustomPriceOpen}>
          <DialogContent className="max-w-xs" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-sm">{safeT('orders.custom_unit_price', 'تخصيص سعر الوحدة')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {safeT('accounting.unit_price', 'سعر الوحدة')} ({pricingUnitLabel})
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={customUnitPriceInput}
                  onChange={(e) => setCustomUnitPriceInput(e.target.value)}
                  placeholder={String(selectedPricingUnitPrice || 0)}
                />
                <div className="text-[10px] text-muted-foreground">
                  {safeT('orders.default_price', 'السعر الافتراضي')}: {selectedPricingUnitPrice.toLocaleString()} {t('common.currency')} / {pricingUnitLabel}
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setCustomPriceOpen(false)}>
                  {t('common.save') || 'حفظ'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setCustomUnitPriceInput('');
                    setCustomPriceOpen(false);
                  }}
                >
                  {safeT('orders.use_default_price', 'استخدام السعر الافتراضي')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="sticky bottom-0 border-t border-border bg-background px-6 py-3 flex flex-row gap-2">
          <Button className="flex-1" onClick={handleConfirm} disabled={offerCheckPending || hasUnappliedOffer || mandatoryOfferUnactivated}>
            <Plus className="w-4 h-4 ms-2" />
            {offerCheckPending
              ? (safeT('common.loading', 'جاري التحقق من العرض...'))
              : mandatoryOfferUnactivated
              ? 'يجب تفعيل العرض الإجباري'
              : hasUnappliedOffer
              ? (t('offers.must_apply_offer') || 'يجب تفعيل العرض أولاً')
              : (mode === 'edit' ? (t('orders.update_item') || 'تحديث المنتج') : t('orders.add_to_order'))}
          </Button>
          {mode === 'edit' && onDelete && product ? (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                onDelete(product.id);
                onOpenChange(false);
              }}
            >
              {t('common.delete') || 'حذف'}
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductQuantityDialog;
