import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Save, PlusCircle, Gift, CalendarDays, CreditCard, Banknote, AlertTriangle, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn, isAdminRole } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLogActivity } from '@/hooks/useActivityLogs';
import { useQueryClient } from '@tanstack/react-query';
import { OrderWithDetails, OrderItem, Product, PriceSubType, PaymentType } from '@/types/database';
import DeliveryWorkerSelect from './DeliveryWorkerSelect';
import PostDeliveryConfirmDialog from './PostDeliveryConfirmDialog';
import InvoicePaymentMethodSelect from './InvoicePaymentMethodSelect';
import { useProductOffers } from '@/hooks/useProductOffers';
import { InvoicePaymentMethod } from '@/types/stamp';
import { useActiveStampTiers, calculateStampAmount } from '@/hooks/useStampTiers';
import ProductQuantityDialog from '@/components/orders/ProductQuantityDialog';
import SimpleProductPickerDialog from '@/components/stock/SimpleProductPickerDialog';
import { getGiftTotalBoxes, getGiftTotalPieces, getPaidQuantity as getStoredPaidQuantity } from '@/utils/orderItemQuantities';

interface ModifyOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderWithDetails;
  orderItems: (OrderItem & { product?: Product })[];
}

interface ModifiedItem {
  id?: string; // existing item id, undefined for new
  product_id: string;
  product_name: string;
  original_quantity: number;
  new_quantity: number;
  unit_price: number; // per-unit price (per kg, per piece, or per box)
  original_unit_price: number;
  gift_quantity: number;
  gift_pieces?: number;
  original_gift_quantity: number;
  original_gift_pieces?: number;
  pieces_per_box: number;
  pricing_unit: string; // 'box' | 'kg' | 'unit'
  weight_per_box: number;
  item_subtype?: string; // per-item override: 'super_gros' | 'gros' | 'retail' | 'invoice'
  original_item_subtype?: string;
  is_unit_sale?: boolean;
  custom_unit_price?: number;
}

const getBoxMultiplier = (pricingUnit: string, weightPerBox: number, piecesPerBox: number): number => {
  if (pricingUnit === 'kg') return Math.max(1, weightPerBox);
  if (pricingUnit === 'unit') return Math.max(1, piecesPerBox);
  return 1;
};

const supportsUnitSale = (product?: Product | null): boolean => {
  if (!product) return false;
  return !!product.allow_unit_sale && Number(product.pieces_per_box || 0) > 1;
};

const normalizePaymentType = (raw: string | null | undefined): string => {
  if (raw === 'with_invoice' || raw === 'without_invoice') return raw;
  // Legacy/other values map to without_invoice
  if (raw && ['cash', 'check', 'transfer', 'receipt'].includes(raw)) return 'without_invoice';
  return raw || 'without_invoice';
};

const resolveOrderPaymentSnapshot = (order: any) => {
  const totalAmount = Number(order?.total_amount || 0);
  const paymentStatus = String(order?.payment_status || '').toLowerCase();
  const partialAmount = order?.partial_amount != null ? Number(order.partial_amount) : null;

  if (partialAmount != null && partialAmount >= 0 && partialAmount < totalAmount) {
    return {
      paidAmount: partialAmount,
      remainingAmount: Math.max(0, totalAmount - partialAmount),
    };
  }

  if (['pending', 'payment_pending', 'no_payment', 'credit'].includes(paymentStatus)) {
    return { paidAmount: 0, remainingAmount: totalAmount };
  }

  if (['partial', 'payment_partial'].includes(paymentStatus)) {
    const paid = Math.max(0, Math.min(totalAmount, partialAmount ?? 0));
    return { paidAmount: paid, remainingAmount: Math.max(0, totalAmount - paid) };
  }

  if (['cash', 'check', 'payment_full', 'paid', 'full'].includes(paymentStatus)) {
    return { paidAmount: totalAmount, remainingAmount: 0 };
  }

  if (order?.remaining_amount != null) {
    const remainingAmount = Number(order.remaining_amount);
    return {
      paidAmount: Math.max(0, totalAmount - remainingAmount),
      remainingAmount: Math.max(0, remainingAmount),
    };
  }

  return { paidAmount: totalAmount, remainingAmount: 0 };
};

const ModifyOrderDialog: React.FC<ModifyOrderDialogProps> = ({
  open, onOpenChange, order, orderItems,
}) => {
  const { t, dir, language } = useLanguage();
  const { workerId, role } = useAuth();
  const logActivity = useLogActivity();
  const queryClient = useQueryClient();
  const { activeOffers } = useProductOffers();
  const { data: stampTiers } = useActiveStampTiers();

  const [items, setItems] = useState<ModifiedItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [newProductSaleUnit, setNewProductSaleUnit] = useState<'box' | 'piece'>('box');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [assignedWorkerId, setAssignedWorkerId] = useState(order.assigned_worker_id || '');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'adjustment' | 'cancel' | null>(null);
  const [confirmChanges, setConfirmChanges] = useState<Array<{
    product_name: string;
    original_quantity: number;
    new_quantity: number;
    unit_price: number;
    difference: number;
  }>>([]);
  const [confirmOriginalTotal, setConfirmOriginalTotal] = useState(0);
  const [confirmNewTotal, setConfirmNewTotal] = useState(0);
  const [customerDebtTotal, setCustomerDebtTotal] = useState(0);
  const [customerCreditTotal, setCustomerCreditTotal] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(order.delivery_date ? new Date(order.delivery_date) : undefined);
  const [paymentType, setPaymentType] = useState<string>(normalizePaymentType(order.payment_type || order.customer?.default_payment_type));
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<InvoicePaymentMethod | null>((order.invoice_payment_method as InvoicePaymentMethod) || null);
  const [priceSubType, setPriceSubType] = useState<PriceSubType>('gros');
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingTargetProductId, setEditingTargetProductId] = useState<string | null>(null);
  const [editingInitialQuantity, setEditingInitialQuantity] = useState(1);
  const [editingInitialGiftPieces, setEditingInitialGiftPieces] = useState(0);
  const [editingInitialOfferApplied, setEditingInitialOfferApplied] = useState(false);
  const [editingInitialIsUnitSale, setEditingInitialIsUnitSale] = useState(false);
  const [editingInitialCustomUnitPrice, setEditingInitialCustomUnitPrice] = useState<number | undefined>(undefined);
  const [editingInitialGiftOfferId, setEditingInitialGiftOfferId] = useState<string | undefined>(undefined);

  const paymentInitializationKeyRef = useRef<string | null>(null);
  const initPaid = (() => {
    const ps = String(order.payment_status || '').toLowerCase();
    if (ps === 'partial' && order.partial_amount != null) return Number(order.partial_amount);
    if (['pending', 'credit'].includes(ps)) return 0;
    return Number(order.total_amount || 0);
  })();
  const [adjustPaidAmount, setAdjustPaidAmount] = useState<number>(initPaid);
  const [adjustRemainingAmount, setAdjustRemainingAmount] = useState<number>(Math.max(0, Number(order.total_amount || 0) - initPaid));

  const isSold = ['delivered', 'sold', 'completed', 'approved', 'cancelled'].includes(order.status || '') || !!(order as any)?._isDirectSale || !!(order as any)?._forceSold;
  const canChangeWorker = isAdminRole(role) || order.created_by === workerId;
  const dialogText = useMemo(() => ({
    removeDate: language === 'ar' ? 'إزالة التاريخ' : language === 'fr' ? 'Retirer la date' : 'Remove date',
    detail: language === 'ar' ? 'تجزئة' : language === 'fr' ? 'Detail' : 'Retail',
    adjustPaymentTitle: language === 'ar' ? 'تعديل المبلغ المدفوع / المتبقي' : language === 'fr' ? 'Ajuster le montant paye / restant' : 'Adjust paid / remaining amount',
    adjustPaymentDescription: language === 'ar'
      ? 'إذا لم يدفع العميل أو دفع جزئيا بعد التسليم، عدل المبالغ هنا وسيتم تحديث الدين والوصل تلقائيا.'
      : language === 'fr'
        ? 'Si le client n\'a pas paye ou a paye partiellement apres la livraison, ajustez les montants ici et la dette ainsi que le recu seront mis a jour automatiquement.'
        : 'If the customer did not pay or only partially paid after delivery, adjust the amounts here and the debt and receipt will be updated automatically.',
    remainingDebtLabel: language === 'ar' ? 'المبلغ المتبقي (دين)' : language === 'fr' ? 'Montant restant (dette)' : 'Remaining amount (debt)',
    noPaymentDebt: language === 'ar' ? 'بدون دفع (دين)' : language === 'fr' ? 'Sans paiement (dette)' : 'No payment (debt)',
    halfAmount: language === 'ar' ? 'نصف المبلغ' : language === 'fr' ? 'Moitie du montant' : 'Half amount',
    willUpdate: language === 'ar' ? 'سيتم تحديث:' : language === 'fr' ? 'Mise a jour :' : 'Will update:',
    paidAmount: language === 'ar' ? 'المبلغ المدفوع' : language === 'fr' ? 'Montant paye' : 'Paid amount',
    remainingAmount: language === 'ar' ? 'المبلغ المتبقي' : language === 'fr' ? 'Montant restant' : 'Remaining amount',
    createDebt: language === 'ar' ? 'سيتم إنشاء/تحديث دين بقيمة' : language === 'fr' ? 'Une dette sera creee/mise a jour de' : 'A debt will be created/updated for',
    settleDebt: language === 'ar' ? 'سيتم تسوية ديون بقيمة' : language === 'fr' ? 'Des dettes seront reglees de' : 'Debts will be settled for',
    fullDebt: language === 'ar' ? 'دين كلي' : language === 'fr' ? 'Dette totale' : 'Full debt',
    noImage: language === 'ar' ? 'لا صورة' : language === 'fr' ? 'Aucune image' : 'No image',
    addProductUnit: language === 'ar' ? 'وحدة إضافة المنتج' : language === 'fr' ? 'Unite d\'ajout du produit' : 'Product add unit',
    gift: language === 'ar' ? 'هدية' : language === 'fr' ? 'Cadeau' : 'Gift',
    newItem: language === 'ar' ? 'جديد' : language === 'fr' ? 'Nouveau' : 'New',
    currency: 'DA',
  }), [language]);

  // Initialize items from orderItems
  useEffect(() => {
    if (open && orderItems.length > 0) {
      setItems(orderItems.map(item => {
        const piecesPerBox = Number((item as any).pieces_per_box || item.product?.pieces_per_box || 1);
        const pricingUnit = (item as any).pricing_unit || item.product?.pricing_unit || 'box';
        const weightPerBox = Number((item as any).weight_per_box || item.product?.weight_per_box || 1);
        // unit_price in order_items is already the BOX price (pre-multiplied).
        // Reverse the multiplier so getBoxPrice() doesn't double-multiply.
        const storedUnitPrice = Number(item.unit_price || 0);
        const multiplier = getBoxMultiplier(pricingUnit, weightPerBox, piecesPerBox);
        const rawUnitPrice = multiplier > 0 ? storedUnitPrice / multiplier : storedUnitPrice;
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name || '',
          original_quantity: item.quantity,
          new_quantity: item.quantity,
          unit_price: rawUnitPrice,
          original_unit_price: rawUnitPrice,
          gift_quantity: Number(item.gift_quantity || 0),
          gift_pieces: Number((item as any).gift_pieces || 0),
          original_gift_quantity: Number(item.gift_quantity || 0),
          original_gift_pieces: Number((item as any).gift_pieces || 0),
          pieces_per_box: piecesPerBox,
          pricing_unit: pricingUnit,
          weight_per_box: weightPerBox,
          item_subtype: ((item as any).price_subtype as string | undefined) || undefined,
          original_item_subtype: ((item as any).price_subtype as string | undefined) || undefined,
          is_unit_sale: false,
        };
      }));
      setAssignedWorkerId(order.assigned_worker_id || '');
      setDeliveryDate(order.delivery_date ? new Date(order.delivery_date) : undefined);

      const firstItemSubtype = orderItems[0] && (orderItems[0] as any).price_subtype;
      const customerDefault = order.customer?.default_price_subtype;
      const derivedPaymentType = normalizePaymentType(
        order.payment_type || (firstItemSubtype === 'invoice' ? 'with_invoice' : 'without_invoice') || order.customer?.default_payment_type,
      );
      const paymentInitializationKey = JSON.stringify({
        orderId: order.id,
        paymentType: order.payment_type,
        invoicePaymentMethod: order.invoice_payment_method,
        firstItemSubtype,
      });

      if (paymentInitializationKeyRef.current !== paymentInitializationKey) {
        paymentInitializationKeyRef.current = paymentInitializationKey;
        setPaymentType(derivedPaymentType);
        setInvoicePaymentMethod(
          derivedPaymentType === 'with_invoice'
            ? ((order.invoice_payment_method as InvoicePaymentMethod) || 'cash')
            : null,
        );
      }

      // Initialize price subtype from first order item or customer default
      setPriceSubType((firstItemSubtype || customerDefault || 'gros') as PriceSubType);
      // Resolve paid amount from partial_amount + payment_status
      const ps = String(order.payment_status || '').toLowerCase();
      const resolvedPaid = (() => {
        if (ps === 'partial' && order.partial_amount != null) return Number(order.partial_amount);
        if (['pending', 'credit'].includes(ps)) return 0;
        return Number(order.total_amount || 0);
      })();
      setAdjustPaidAmount(resolvedPaid);
      setAdjustRemainingAmount(Math.max(0, Number(order.total_amount || 0) - resolvedPaid));
    }
  }, [open, order.id, orderItems, order.assigned_worker_id, order.delivery_date, order.payment_type, order.invoice_payment_method, order.partial_amount, order.payment_status, order.total_amount, order.customer?.default_price_subtype]);

  // Fetch available products for adding
  useEffect(() => {
    if (!open) return;
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setProducts(data || []);
    };
    fetchProducts();
  }, [open]);

  useEffect(() => {
    const selectedProduct = products.find((p) => p.id === newProductId);
    if (!supportsUnitSale(selectedProduct)) {
      setNewProductSaleUnit('box');
    }
  }, [newProductId, products]);

  const recalcGiftBoxes = useCallback((productId: string, paidQty: number, piecesPerBox: number) => {
    const offersForProduct = activeOffers.filter((o: any) => o.product_id === productId);
    if (offersForProduct.length === 0) return 0;

    let totalGiftPieces = 0;
    const safePiecesPerBox = piecesPerBox > 0 ? piecesPerBox : 1;

    for (const offer of offersForProduct as any[]) {
      const tiers = offer.tiers && offer.tiers.length > 0 ? offer.tiers : null;
      if (tiers) {
        if (offer.condition_type === 'multiplier') {
          const sortedTiers = [...tiers].sort((a: any, b: any) => b.min_quantity - a.min_quantity);
          let remaining = paidQty;
          for (const tier of sortedTiers) {
            if (remaining < tier.min_quantity) continue;
            const timesApplied = Math.floor(remaining / tier.min_quantity);
            remaining = remaining % tier.min_quantity;
            const giftUnit = tier.gift_quantity_unit || 'piece';
            const giftAmount = timesApplied * tier.gift_quantity;
            totalGiftPieces += giftUnit === 'box' ? giftAmount * safePiecesPerBox : giftAmount;
          }
        } else {
          for (const tier of [...tiers].sort((a: any, b: any) => b.min_quantity - a.min_quantity)) {
            if (paidQty >= tier.min_quantity && (tier.max_quantity === null || paidQty <= tier.max_quantity)) {
              const giftUnit = tier.gift_quantity_unit || 'piece';
              totalGiftPieces += giftUnit === 'box' ? tier.gift_quantity * safePiecesPerBox : tier.gift_quantity;
              break;
            }
          }
        }
      } else {
        if (paidQty < offer.min_quantity) continue;
        const timesApplied = offer.condition_type === 'multiplier' ? Math.floor(paidQty / offer.min_quantity) : 1;
        const giftPerThreshold = offer.gift_quantity;
        if (offer.gift_quantity_unit === 'box') {
          totalGiftPieces += timesApplied * giftPerThreshold * safePiecesPerBox;
        } else {
          totalGiftPieces += timesApplied * giftPerThreshold;
        }
      }
    }

    return Math.floor(totalGiftPieces / safePiecesPerBox);
  }, [activeOffers]);

  const recalcFromPaidQuantity = useCallback((productId: string, paidQty: number, piecesPerBox: number) => {
    const safePaidQty = Math.max(0, paidQty);
    const giftQty = Math.max(0, recalcGiftBoxes(productId, safePaidQty, piecesPerBox));

    return {
      gift_quantity: giftQty,
      total_quantity: safePaidQty + giftQty,
    };
  }, [recalcGiftBoxes]);

  const getPaidQuantity = useCallback((item: ModifiedItem) => {
    // Paid quantity = total boxes minus full-box gifts only.
    // gift_pieces are EXTRA pieces gifted on top of the paid boxes
    // (e.g. buy 20 boxes, get 10 pieces free → paid = 20, gift = 10 pieces).
    const giftBoxes = Math.max(0, Number(item.gift_quantity || 0));
    return Math.max(0, Number(item.new_quantity || 0) - giftBoxes);
  }, []);

  const getProductById = useCallback((productId: string) => {
    return (
      products.find((product) => product.id === productId) ||
      orderItems.find((item) => item.product_id === productId)?.product ||
      null
    );
  }, [orderItems, products]);

  const getRawProductPrice = useCallback((product: Product, subtype: string): number => {
    if (subtype === 'invoice') return Number(product.price_invoice || 0);

    switch (subtype) {
      case 'super_gros':
        return Number(product.price_super_gros || product.price_no_invoice || 0);
      case 'retail':
        return Number(product.price_retail || 0);
      default:
        return Number(product.price_gros || product.price_no_invoice || 0);
    }
  }, []);

  const resolveCustomSalePrice = useCallback((product: Product, baseUnitPrice: number, unitSale: boolean): number => {
    const piecesPerBox = product.pieces_per_box || 1;
    const weightPerBox = product.weight_per_box || 1;
    const pricingUnit = product.pricing_unit || 'box';

    if (pricingUnit === 'kg') {
      const boxPrice = baseUnitPrice * weightPerBox;
      return unitSale ? boxPrice / piecesPerBox : boxPrice;
    }

    if (pricingUnit === 'unit') {
      const piecePrice = baseUnitPrice;
      return unitSale ? piecePrice : piecePrice * piecesPerBox;
    }

    const boxPrice = baseUnitPrice;
    return unitSale ? boxPrice / piecesPerBox : boxPrice;
  }, []);

  const getCurrentItemSubtype = useCallback((item: ModifiedItem) => {
    return item.item_subtype || (paymentType === 'with_invoice' ? 'invoice' : priceSubType);
  }, [paymentType, priceSubType]);

  const openItemEditor = useCallback((item: ModifiedItem) => {
    const product = getProductById(item.product_id);
    if (!product) return;

    const totalGiftPieces = getGiftTotalPieces(item);

    setEditingTargetProductId(item.product_id);
    setEditingInitialQuantity(getPaidQuantity(item));
    setEditingInitialGiftPieces(totalGiftPieces);
    setEditingInitialOfferApplied(totalGiftPieces > 0);
    setEditingInitialIsUnitSale(!!item.is_unit_sale);
    setEditingInitialCustomUnitPrice(item.custom_unit_price);
    setEditingInitialGiftOfferId(undefined);
    setSelectedProduct(product);
    setShowQuantityDialog(true);
  }, [getPaidQuantity, getProductById]);

  const handleEditProductWithQuantity = useCallback((
    productId: string,
    quantity: number,
    giftInfo?: { giftQuantity: number; giftPieces: number; offerId?: string },
    isUnitSale?: boolean,
    perItemPricing?: { paymentType: PaymentType; invoicePaymentMethod: InvoicePaymentMethod | null; priceSubType: PriceSubType; customUnitPrice?: number }
  ) => {
    const product = getProductById(productId);
    if (!product) return;

    setItems((prev) => prev.map((item) => {
      if (item.product_id !== productId) return item;

      const currentSubtype = getCurrentItemSubtype(item);
      const nextSubtype = perItemPricing
        ? (perItemPricing.paymentType === 'with_invoice' ? 'invoice' : perItemPricing.priceSubType)
        : currentSubtype;
      const rawUnitPrice = perItemPricing
        ? (
          perItemPricing.customUnitPrice !== undefined
            ? perItemPricing.customUnitPrice
            : getRawProductPrice(product, nextSubtype)
        )
        : (
          item.custom_unit_price !== undefined
            ? item.custom_unit_price
            : getRawProductPrice(product, currentSubtype)
        );
      const totalGiftPieces = giftInfo?.giftPieces || 0;
      const safePiecesPerBox = product.pieces_per_box || item.pieces_per_box || 1;
      const giftQuantity = isUnitSale ? 0 : (giftInfo?.giftQuantity || 0);
      const giftPiecesRemainder = isUnitSale ? 0 : (safePiecesPerBox > 0 ? totalGiftPieces % safePiecesPerBox : totalGiftPieces);

      return {
        ...item,
        new_quantity: quantity,
        gift_quantity: giftQuantity,
        gift_pieces: giftPiecesRemainder,
        unit_price: isUnitSale ? resolveCustomSalePrice(product, rawUnitPrice, true) : rawUnitPrice,
        item_subtype: nextSubtype,
        is_unit_sale: !!isUnitSale,
        custom_unit_price: perItemPricing ? perItemPricing.customUnitPrice : item.custom_unit_price,
      };
    }));

    setShowQuantityDialog(false);
    setSelectedProduct(null);
    setEditingTargetProductId(null);
    setEditingInitialGiftOfferId(undefined);
  }, [getCurrentItemSubtype, getProductById, getRawProductPrice, resolveCustomSalePrice]);

  const addProduct = () => {
    if (!newProductId) return;
    if (items.some(i => i.product_id === newProductId)) {
      toast.error(t('orders.product_already_added'));
      return;
    }
    const product = products.find(p => p.id === newProductId);
    if (!product) return;

    const initialPaidQuantity = 1;
    let unitPrice: number;
    if (paymentType === 'with_invoice') {
      unitPrice = Number(product.price_invoice || 0);
    } else {
      switch (priceSubType) {
        case 'super_gros': unitPrice = Number(product.price_super_gros || product.price_no_invoice || 0); break;
        case 'retail': unitPrice = Number(product.price_retail || 0); break;
        default: unitPrice = Number(product.price_gros || product.price_no_invoice || 0); break;
      }
    }
    const piecesPerBox = Number(product.pieces_per_box || 1);
    const pricingUnit = product.pricing_unit || 'box';
    const weightPerBox = Number(product.weight_per_box || 1);
    const isUnitSale = supportsUnitSale(product) && newProductSaleUnit === 'piece';
    const effectiveUnitPrice = isUnitSale
      ? unitPrice / Math.max(1, piecesPerBox)
      : unitPrice;
    const recalculated = isUnitSale
      ? { gift_quantity: 0, total_quantity: initialPaidQuantity }
      : recalcFromPaidQuantity(product.id, initialPaidQuantity, piecesPerBox);

    setItems(prev => [...prev, {
      product_id: product.id,
      product_name: getProductDisplayName(product),
      original_quantity: 0,
      new_quantity: recalculated.total_quantity,
      unit_price: effectiveUnitPrice,
      original_unit_price: effectiveUnitPrice,
      gift_quantity: recalculated.gift_quantity,
      gift_pieces: 0,
      original_gift_quantity: 0,
      original_gift_pieces: 0,
      pieces_per_box: piecesPerBox,
      pricing_unit: pricingUnit,
      weight_per_box: weightPerBox,
      is_unit_sale: isUnitSale,
    }]);
    setNewProductId('');
    setNewProductSaleUnit('box');
  };

  const handleRemoveItem = useCallback((productId: string) => {
    setItems((prev) => {
      const targetItem = prev.find((item) => item.product_id === productId);
      if (!targetItem) return prev;

      if (targetItem.id) {
        return prev.map((item) => item.product_id === productId ? {
          ...item,
          new_quantity: 0,
          gift_quantity: 0,
          gift_pieces: 0,
        } : item);
      }

      return prev.filter((item) => item.product_id !== productId);
    });
  }, []);

  const updateQuantity = useCallback(() => {}, []);
  const setQuantity = useCallback(() => {}, []);
  const changeItemSubtype = useCallback(() => {}, []);

  // Recalculate item prices when payment type or price subtype changes
  const recalcItemPrices = useCallback((pt: string, pst: PriceSubType) => {
    setItems(prev => prev.map(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) return item;

      if (item.custom_unit_price !== undefined) return item;

      const subtype = item.item_subtype || (pt === 'with_invoice' ? 'invoice' : pst);
      const rawUnitPrice = getRawProductPrice(product, subtype);

      return {
        ...item,
        unit_price: item.is_unit_sale ? resolveCustomSalePrice(product, rawUnitPrice, true) : rawUnitPrice,
      };
    }));
  }, [getRawProductPrice, products, resolveCustomSalePrice]);

  const workerChanged = assignedWorkerId !== (order.assigned_worker_id || '');
  const deliveryDateChanged = (() => {
    const origDate = order.delivery_date ? order.delivery_date.split('T')[0] : '';
    const newDate = deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : '';
    return origDate !== newDate;
  })();
  const paymentTypeChanged = paymentType !== (order.payment_type || order.customer?.default_payment_type || 'cash');
  const invoiceMethodChanged = (invoicePaymentMethod || null) !== (order.invoice_payment_method || null);
  const originalPriceSubType = ((orderItems[0] as any)?.price_subtype || order.customer?.default_price_subtype || 'gros') as string;
  const priceSubTypeChanged = paymentType === 'without_invoice' && priceSubType !== originalPriceSubType;
  const originalPaymentSnapshot = resolveOrderPaymentSnapshot(order);
  const originalPaidAmount = originalPaymentSnapshot.paidAmount;
  const originalRemainingAmount = originalPaymentSnapshot.remainingAmount;
  const paymentAmountChanged = isSold && (adjustPaidAmount !== originalPaidAmount || adjustRemainingAmount !== originalRemainingAmount);

  const hasItemSubtypeChanges = items.some((item) => (item.item_subtype || undefined) !== (item.original_item_subtype || undefined));
  const hasPriceChanges = items.some((item) => item.unit_price !== item.original_unit_price);
  const hasGiftPieceChanges = items.some((item) => (item.gift_pieces || 0) !== (item.original_gift_pieces || 0));

  const hasChanges = items.some(i => i.new_quantity !== i.original_quantity) ||
    items.some(i => !i.id && i.new_quantity > 0) ||
    workerChanged ||
    deliveryDateChanged ||
    paymentTypeChanged ||
    invoiceMethodChanged ||
    priceSubTypeChanged ||
    paymentAmountChanged ||
    hasItemSubtypeChanges ||
    hasPriceChanges ||
    hasGiftPieceChanges;

  const getBoxEquivalentPrice = useCallback((item: ModifiedItem) => {
    if (item.is_unit_sale) return item.unit_price * Math.max(1, item.pieces_per_box);
    const multiplier = getBoxMultiplier(item.pricing_unit, item.weight_per_box, item.pieces_per_box);
    return item.unit_price * multiplier;
  }, []);

  const getDisplayUnitPrice = useCallback((item: ModifiedItem) => {
    return item.is_unit_sale ? item.unit_price : getBoxEquivalentPrice(item);
  }, [getBoxEquivalentPrice]);

  const calculateOrderStamp = useCallback((
    subtotal: number,
    targetPaymentType: string,
    targetInvoicePaymentMethod: InvoicePaymentMethod | null,
  ) => {
    let stampAmount = 0;
    let stampPercentage = 0;

    if (
      subtotal > 0 &&
      targetPaymentType === 'with_invoice' &&
      targetInvoicePaymentMethod === 'cash' &&
      stampTiers?.length
    ) {
      stampAmount = calculateStampAmount(subtotal, stampTiers);
      const activeTiers = stampTiers.filter((tier) => tier.is_active);
      const matchedTier = activeTiers.find((tier) => (
        subtotal >= tier.min_amount &&
        (tier.max_amount === null || subtotal <= tier.max_amount)
      ));

      if (matchedTier) {
        stampPercentage = matchedTier.percentage;
      }
    }

    return {
      stampAmount,
      stampPercentage,
      totalAmount: subtotal + stampAmount,
    };
  }, [stampTiers]);

  const isMissingSchemaColumnError = useCallback((error: any, table: string, column: string) => {
    const message = String(error?.message || '');
    return message.includes(`Could not find the '${column}' column of '${table}'`);
  }, []);

  const updateOrderItemWithFallback = useCallback(async (itemId: string, payload: Record<string, any>) => {
    let { error } = await supabase.from('order_items').update(payload as any).eq('id', itemId);

    if (error && isMissingSchemaColumnError(error, 'order_items', 'gift_pieces')) {
      const { gift_pieces, ...fallbackPayload } = payload;
      ({ error } = await supabase.from('order_items').update(fallbackPayload as any).eq('id', itemId));
    }

    if (error) {
      throw error;
    }
  }, [isMissingSchemaColumnError]);

  const insertOrderItemWithFallback = useCallback(async (payload: Record<string, any>) => {
    let { error } = await supabase.from('order_items').insert(payload as any);

    if (error && isMissingSchemaColumnError(error, 'order_items', 'gift_pieces')) {
      const { gift_pieces, ...fallbackPayload } = payload;
      ({ error } = await supabase.from('order_items').insert(fallbackPayload as any));
    }

    if (error) {
      throw error;
    }
  }, [isMissingSchemaColumnError]);

  const syncOrderLinkedDebt = useCallback(async (targetRemainingAmount: number) => {
    const normalizedTarget = Math.max(0, Number(targetRemainingAmount || 0));

    const { data: linkedDebts, error: linkedDebtsError } = await supabase
      .from('customer_debts')
      .select('id, total_amount, paid_amount, remaining_amount, status, notes')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (linkedDebtsError) {
      throw linkedDebtsError;
    }

    const linkedDebtIds = (linkedDebts || []).map((debt) => debt.id);
    let paidViaCollections = 0;

    if (linkedDebtIds.length > 0) {
      const { data: debtPayments, error: debtPaymentsError } = await supabase
        .from('debt_payments')
        .select('amount')
        .in('debt_id', linkedDebtIds);

      if (debtPaymentsError) {
        throw debtPaymentsError;
      }

      paidViaCollections = (debtPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    }

    const nextPaidAmount = Math.min(normalizedTarget, paidViaCollections);
    const nextRemainingAmount = Math.max(0, normalizedTarget - nextPaidAmount);
    const nextStatus = nextRemainingAmount <= 0 ? 'paid' : nextPaidAmount > 0 ? 'partially_paid' : 'active';
    const linkedWorkerId = (assignedWorkerId && assignedWorkerId !== 'none')
      ? assignedWorkerId
      : (order.assigned_worker_id || workerId || null);

    if (linkedDebts && linkedDebts.length > 0) {
      const primaryDebt = linkedDebts[0];
      const { error: updateDebtError } = await supabase
        .from('customer_debts')
        .update({
          worker_id: linkedWorkerId,
          branch_id: order.branch_id,
          total_amount: normalizedTarget,
          paid_amount: nextPaidAmount,
          status: nextStatus,
          notes: primaryDebt.notes || (normalizedTarget > 0
            ? 'Order debt synced after modification'
            : 'Order debt settled after modification'),
        })
        .eq('id', primaryDebt.id);

      if (updateDebtError) {
        throw updateDebtError;
      }

      return;
    }

    if (normalizedTarget > 0) {
      const resolvedCustomerId = order.customer_id || order.customer?.id;
      if (!resolvedCustomerId) {
        throw new Error('Cannot create debt: customer_id is missing from the order.');
      }
      const { error: insertDebtError } = await supabase
        .from('customer_debts')
        .insert({
          customer_id: resolvedCustomerId,
          order_id: order.id,
          worker_id: linkedWorkerId,
          branch_id: order.branch_id,
          total_amount: normalizedTarget,
          paid_amount: 0,
          status: 'active',
          notes: 'Debt created from order modification',
        });

      if (insertDebtError) {
        throw insertDebtError;
      }
    }
  }, [assignedWorkerId, order.assigned_worker_id, order.branch_id, order.customer_id, order.id, workerId]);

  const originalSubtotal = orderItems.reduce((sum, item) => {
    const giftQty = Number((item as any).gift_quantity || 0);
    const paidQty = Math.max(0, Number(item.quantity) - giftQty);
    // unit_price in order_items is already the box price
    return sum + (paidQty * Number(item.unit_price || 0));
  }, 0);

  const currentSubtotal = items.reduce((sum, item) => {
    const paidQty = Math.max(0, item.new_quantity - (item.gift_quantity || 0));
    const multiplier = getBoxMultiplier(item.pricing_unit, item.weight_per_box, item.pieces_per_box);
    return sum + (paidQty * item.unit_price * multiplier);
  }, 0);

  const originalCalculatedTotal = useMemo(() => (
    calculateOrderStamp(
      originalSubtotal,
      order.payment_type || order.customer?.default_payment_type || 'cash',
      (order.invoice_payment_method as InvoicePaymentMethod) || null,
    )
  ), [calculateOrderStamp, order.invoice_payment_method, order.payment_type, originalSubtotal]);

  const currentCalculatedTotal = useMemo(() => (
    calculateOrderStamp(currentSubtotal, paymentType, invoicePaymentMethod)
  ), [calculateOrderStamp, currentSubtotal, invoicePaymentMethod, paymentType]);

  const originalTotal = Number(order.total_amount || originalCalculatedTotal.totalAmount || 0);
  const orderTotal = currentCalculatedTotal.totalAmount;
  const resolvedOrderTotal = Math.max(0, Number(orderTotal || order.total_amount || 0));
  const quickPaymentMode = adjustRemainingAmount <= 0 ? 'full' : adjustPaidAmount <= 0 ? 'debt' : 'partial';

  const handleQuickPaymentMode = useCallback((mode: 'full' | 'partial' | 'debt') => {
    if (resolvedOrderTotal <= 0) {
      setAdjustPaidAmount(0);
      setAdjustRemainingAmount(0);
      return;
    }

    if (mode === 'full') {
      setAdjustPaidAmount(resolvedOrderTotal);
      setAdjustRemainingAmount(0);
      return;
    }

    if (mode === 'debt') {
      setAdjustPaidAmount(0);
      setAdjustRemainingAmount(resolvedOrderTotal);
      return;
    }

    const nextPaidAmount = adjustPaidAmount > 0 && adjustPaidAmount < resolvedOrderTotal
      ? adjustPaidAmount
      : Math.ceil(resolvedOrderTotal / 2);

    setAdjustPaidAmount(nextPaidAmount);
    setAdjustRemainingAmount(Math.max(0, resolvedOrderTotal - nextPaidAmount));
  }, [adjustPaidAmount, resolvedOrderTotal]);

  const productChanges = items
    .filter(i => i.new_quantity !== i.original_quantity)
    .map(i => ({
      product_name: i.product_name,
      original_quantity: i.original_quantity,
      new_quantity: i.new_quantity,
      unit_price: i.unit_price,
      difference: i.new_quantity - i.original_quantity,
    }));

  const loadCustomerFinancialContext = useCallback(async () => {
    const resolvedCustomerId = order.customer_id || order.customer?.id;

    if (!resolvedCustomerId) {
      setCustomerDebtTotal(0);
      setCustomerCreditTotal(0);
      return;
    }

    const [debtsResult, creditsResult] = await Promise.all([
      supabase
        .from('customer_debts')
        .select('total_amount, paid_amount, remaining_amount')
        .eq('customer_id', resolvedCustomerId)
        .in('status', ['active', 'partially_paid']),
      supabase
        .from('customer_credits')
        .select('amount')
        .eq('customer_id', resolvedCustomerId)
        .eq('is_used', false)
        .eq('status', 'approved')
        .eq('credit_type', 'financial'),
    ]);

    if (debtsResult.error) throw debtsResult.error;
    if (creditsResult.error) throw creditsResult.error;

    const debtSum = (debtsResult.data || []).reduce((sum, debt) => (
      sum + Number(debt.remaining_amount ?? (Number(debt.total_amount || 0) - Number(debt.paid_amount || 0)))
    ), 0);
    const creditSum = (creditsResult.data || []).reduce((sum, credit) => sum + Number(credit.amount || 0), 0);

    setCustomerDebtTotal(debtSum);
    setCustomerCreditTotal(creditSum);
  }, [order.customer?.id, order.customer_id]);

  const handleSaveClick = async () => {
    if (!hasChanges || !workerId) return;
    if (isSold && Math.abs(orderTotal - originalTotal) > 0.009) {
      await loadCustomerFinancialContext();
      setConfirmMode('adjustment');
      setConfirmChanges(productChanges);
      setConfirmOriginalTotal(originalTotal);
      setConfirmNewTotal(orderTotal);
      setShowConfirmDialog(true);
      return;
    }
    handleSave();
  };

  const handlePostDeliveryConfirm = async (diffPaymentType: 'full' | 'partial' | 'no_payment', paidAmount?: number) => {
    const mode = confirmMode;
    setShowConfirmDialog(false);
    setConfirmMode(null);

    if (mode === 'cancel') {
      await executeConfirmedCancellation(diffPaymentType, paidAmount);
      return;
    }

    await handleSave(diffPaymentType, paidAmount);
  };

  const handleSave = async (diffPaymentType?: 'full' | 'partial' | 'no_payment', paidAmount?: number) => {
    if (!hasChanges || !workerId) return;
    setIsSubmitting(true);

    try {
      const changes: Record<string, any>[] = [];
      let finalOrderDebtRemaining = 0;

      if (isSold) {
        const { data: linkedOrderDebts, error: linkedOrderDebtsError } = await supabase
          .from('customer_debts')
          .select('total_amount, paid_amount, remaining_amount')
          .eq('order_id', order.id);

        if (linkedOrderDebtsError) {
          throw new Error(`Failed to load order debt: ${linkedOrderDebtsError.message}`);
        }

        const currentLinkedDebtRemaining = (linkedOrderDebts || []).reduce((sum, debt) => {
          const remaining = debt.remaining_amount ?? (Number(debt.total_amount || 0) - Number(debt.paid_amount || 0));
          return sum + Number(remaining || 0);
        }, 0);

        finalOrderDebtRemaining = paymentAmountChanged ? adjustRemainingAmount : currentLinkedDebtRemaining;
      }

      for (const item of items) {
        const itemSubtype = getCurrentItemSubtype(item);
        const itemPayType = itemSubtype === 'invoice' ? 'with_invoice' : 'without_invoice';
        const itemInvMethod = itemSubtype === 'invoice' ? (invoicePaymentMethod || null) : null;
        const itemChanged =
          item.new_quantity !== item.original_quantity ||
          (item.gift_quantity || 0) !== (item.original_gift_quantity || 0) ||
          (item.gift_pieces || 0) !== (item.original_gift_pieces || 0) ||
          itemSubtype !== (item.original_item_subtype || undefined) ||
          item.unit_price !== item.original_unit_price;

        if (item.id && itemChanged) {
          if (item.new_quantity === 0) {
            const { error: deleteError } = await supabase.from('order_items').delete().eq('id', item.id);
            if (deleteError) throw new Error(`Failed to delete order item: ${deleteError.message}`);

            changes.push({
              operation: 'delete_item',
              product: item.product_name,
              old_quantity: item.original_quantity,
              new_quantity: 0,
            });
          } else {
            const paidQty = Math.max(0, item.new_quantity - (item.gift_quantity || 0));
            const multiplier = getBoxMultiplier(item.pricing_unit, item.weight_per_box, item.pieces_per_box);
            const boxPrice = item.unit_price * multiplier;

            await updateOrderItemWithFallback(item.id, {
              quantity: item.new_quantity,
              gift_quantity: item.gift_quantity || 0,
              gift_pieces: item.gift_pieces || 0,
              unit_price: boxPrice,
              total_price: paidQty * boxPrice,
              price_subtype: itemSubtype,
              payment_type: itemPayType,
              invoice_payment_method: itemInvMethod,
            });

            changes.push({
              operation: itemSubtype !== (item.original_item_subtype || undefined) || item.unit_price !== item.original_unit_price
                ? 'edit_item'
                : 'edit_quantity',
              product: item.product_name,
              old_quantity: item.original_quantity,
              new_quantity: item.new_quantity,
              old_gift_boxes: item.original_gift_quantity || 0,
              new_gift_boxes: item.gift_quantity || 0,
              old_gift_pieces: item.original_gift_pieces || 0,
              new_gift_pieces: item.gift_pieces || 0,
              price_subtype: itemSubtype,
            });
          }
        } else if (!item.id && item.new_quantity > 0) {
          const paidQty = Math.max(0, item.new_quantity - (item.gift_quantity || 0));
          const multiplier = getBoxMultiplier(item.pricing_unit, item.weight_per_box, item.pieces_per_box);
          const boxPrice = item.unit_price * multiplier;

          await insertOrderItemWithFallback({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.new_quantity,
            gift_quantity: item.gift_quantity || 0,
            gift_pieces: item.gift_pieces || 0,
            unit_price: boxPrice,
            total_price: paidQty * boxPrice,
            pricing_unit: item.pricing_unit,
            weight_per_box: item.weight_per_box,
            pieces_per_box: item.pieces_per_box,
            price_subtype: itemSubtype,
            payment_type: itemPayType,
            invoice_payment_method: itemInvMethod,
          });

          changes.push({
            operation: 'add_item',
            product: item.product_name,
            quantity: item.new_quantity,
            gift_boxes: item.gift_quantity || 0,
            gift_pieces: item.gift_pieces || 0,
            price_subtype: itemSubtype,
          });
        }
      }

      const { data: updatedItems } = await supabase
        .from('order_items')
        .select('quantity, unit_price, gift_quantity, pricing_unit, weight_per_box, pieces_per_box')
        .eq('order_id', order.id);

      // If all items were removed, treat as cancelled order
      const allItemsRemoved = !updatedItems || updatedItems.length === 0;

      const newSubtotal = updatedItems?.reduce((sum, i: any) => {
        const paidQty = Math.max(0, Number(i.quantity) - Number(i.gift_quantity || 0));
        return sum + (paidQty * Number(i.unit_price || 0));
      }, 0) || 0;
      const newCalculatedTotal = calculateOrderStamp(newSubtotal, paymentType, invoicePaymentMethod);
      const newTotal = newCalculatedTotal.totalAmount;

      const orderUpdate: Record<string, any> = {};

      if (allItemsRemoved) {
        orderUpdate.status = 'cancelled';
        orderUpdate.total_amount = 0;
        orderUpdate.payment_status = 'pending';
        orderUpdate.partial_amount = null;
      }
      if (!allItemsRemoved) {
        orderUpdate.total_amount = newTotal;
      }

      if (workerChanged) {
        const newWorker = assignedWorkerId && assignedWorkerId !== 'none' ? assignedWorkerId : null;
        orderUpdate.assigned_worker_id = newWorker;
        if (newWorker && order.status === 'pending') {
          orderUpdate.status = 'assigned';
        }
        changes.push({ operation: 'change_delivery_worker' });
      }

      if (deliveryDateChanged) {
        orderUpdate.delivery_date = deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : null;
        changes.push({ operation: 'change_delivery_date', new_date: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : null });
      }

      if (paymentTypeChanged || invoiceMethodChanged || priceSubTypeChanged) {
        orderUpdate.payment_type = paymentType;
        orderUpdate.invoice_payment_method = paymentType === 'with_invoice' ? (invoicePaymentMethod || null) : null;
        changes.push({
          operation: 'change_payment_setup',
          payment_type: paymentType,
          invoice_payment_method: invoicePaymentMethod || null,
          price_subtype: priceSubType,
        });

        const newSubtype = paymentType === 'with_invoice' ? 'invoice' : priceSubType;
        for (const item of items) {
          if (!item.id) continue;
          const effectiveSubtype = item.item_subtype || newSubtype;
          const effectivePaymentType = effectiveSubtype === 'invoice' ? 'with_invoice' : 'without_invoice';
          const effectiveInvoiceMethod = effectiveSubtype === 'invoice' ? (invoicePaymentMethod || null) : null;
          const paidQty = Math.max(0, item.new_quantity - (item.gift_quantity || 0));
          const multiplier = getBoxMultiplier(item.pricing_unit, item.weight_per_box, item.pieces_per_box);
          const boxPrice = item.unit_price * multiplier;

          await supabase.from('order_items')
            .update({
              price_subtype: effectiveSubtype,
              payment_type: effectivePaymentType,
              invoice_payment_method: effectiveInvoiceMethod,
              unit_price: boxPrice,
              total_price: paidQty * boxPrice,
            })
            .eq('id', item.id);
        }
      }

      if (paymentAmountChanged) {
        if (adjustRemainingAmount <= 0) {
          orderUpdate.payment_status = 'cash';
          orderUpdate.partial_amount = null;
        } else if (adjustPaidAmount <= 0) {
          orderUpdate.payment_status = 'pending';
          orderUpdate.partial_amount = null;
        } else {
          orderUpdate.payment_status = 'partial';
          orderUpdate.partial_amount = adjustPaidAmount;
        }

        changes.push({
          operation: 'edit_payment_amount',
          old_paid: originalPaidAmount,
          new_paid: adjustPaidAmount,
          old_remaining: originalRemainingAmount,
          new_remaining: adjustRemainingAmount,
        });

        finalOrderDebtRemaining = adjustRemainingAmount;
      }

      if (Object.keys(orderUpdate).length > 0) {
        const { error: orderErr } = await supabase.from('orders')
          .update(orderUpdate as any)
          .eq('id', order.id);
        if (orderErr) throw new Error(`Failed to update order: ${orderErr.message}`);
      }

      if (isSold && order.assigned_worker_id) {
        for (const item of items) {
          const giftPiecesDiff = (Number(item.gift_pieces || 0) - Number(item.original_gift_pieces || 0)) / 100;
          const qtyDiff = (Number(item.new_quantity || 0) - Number(item.original_quantity || 0)) + giftPiecesDiff;
          if (qtyDiff === 0) continue;

          const { data: ws } = await supabase
            .from('worker_stock')
            .select('id, quantity')
            .eq('worker_id', order.assigned_worker_id)
            .eq('product_id', item.product_id)
            .maybeSingle();

          if (ws) {
            const newStockQty = Math.max(0, ws.quantity - qtyDiff);
            await supabase.from('worker_stock')
              .update({ quantity: newStockQty })
              .eq('id', ws.id);
          } else if (qtyDiff < 0) {
            await supabase.from('worker_stock').insert({
              worker_id: order.assigned_worker_id,
              product_id: item.product_id,
              quantity: Math.abs(qtyDiff),
              branch_id: order.branch_id,
            });
          }
        }
      }

      if (allItemsRemoved) {
        finalOrderDebtRemaining = 0;
      }

      const totalDiff = (allItemsRemoved ? 0 : orderTotal) - originalTotal;
      if (isSold && totalDiff !== 0 && diffPaymentType) {
        if (totalDiff > 0) {
          let remainingDiff = totalDiff;

          if (diffPaymentType === 'partial' && paidAmount) {
            remainingDiff = totalDiff - paidAmount;
          } else if (diffPaymentType === 'full') {
            remainingDiff = 0;
          }

          if (remainingDiff > 0) {
            const { data: credits } = await supabase
              .from('customer_credits')
              .select('id, amount')
              .eq('customer_id', order.customer_id)
              .eq('is_used', false)
              .eq('status', 'approved')
              .eq('credit_type', 'financial')
              .order('created_at', { ascending: true });

            for (const credit of (credits || [])) {
              if (remainingDiff <= 0) break;
              const deduct = Math.min(Number(credit.amount || 0), remainingDiff);
              if (deduct >= Number(credit.amount || 0)) {
                await supabase.from('customer_credits').update({
                  is_used: true,
                  used_at: new Date().toISOString(),
                  used_in_order_id: order.id,
                }).eq('id', credit.id);
              } else {
                await supabase.from('customer_credits').update({
                  amount: Number(credit.amount || 0) - deduct,
                }).eq('id', credit.id);
              }
              remainingDiff -= deduct;
            }

            if (!paymentAmountChanged) {
              finalOrderDebtRemaining += remainingDiff;
            }
          }
        } else {
          const refundAmount = Math.abs(totalDiff);
          let remainingRefund = refundAmount;

          if (!paymentAmountChanged) {
            finalOrderDebtRemaining = Math.max(0, finalOrderDebtRemaining - refundAmount);
          }

          if (diffPaymentType === 'full') {
            remainingRefund = 0;
          } else if (diffPaymentType === 'partial' && paidAmount) {
            remainingRefund = refundAmount - paidAmount;
          }

          if (remainingRefund > 0) {
            const { data: debts } = await supabase
              .from('customer_debts')
              .select('id, order_id, total_amount, paid_amount, remaining_amount, notes')
              .eq('customer_id', order.customer_id)
              .in('status', ['active', 'partially_paid'])
              .order('created_at', { ascending: true });

            let debtDeducted = 0;
            for (const debt of (debts || [])) {
              if (remainingRefund <= 0) break;
              if (debt.order_id === order.id) continue;

              const debtRemaining = Number(debt.remaining_amount ?? (Number(debt.total_amount || 0) - Number(debt.paid_amount || 0)));
              const deduct = Math.min(debtRemaining, remainingRefund);
              const newPaid = Number(debt.paid_amount || 0) + deduct;
              const newRemaining = Math.max(0, Number(debt.total_amount || 0) - newPaid);

              await supabase.from('customer_debts').update({
                paid_amount: newPaid,
                status: newRemaining <= 0 ? 'paid' : 'partially_paid',
                notes: debt.notes ? `${debt.notes} | Adjustment deduction ${deduct}` : `Adjustment deduction ${deduct}`,
              }).eq('id', debt.id);

              remainingRefund -= deduct;
              debtDeducted += deduct;
            }

            if (remainingRefund > 0) {
              await supabase.from('customer_credits').insert({
                customer_id: order.customer_id,
                order_id: order.id,
                worker_id: workerId,
                branch_id: order.branch_id,
                amount: remainingRefund,
                credit_type: 'financial',
                status: 'approved',
                approved_by: workerId,
                approved_at: new Date().toISOString(),
                notes: debtDeducted > 0
                  ? `Surplus after order adjustment (deducted ${debtDeducted})`
                  : 'Surplus after order adjustment',
              });

              await supabase.from('manager_treasury').insert({
                manager_id: workerId,
                branch_id: order.branch_id || null,
                source_type: 'customer_surplus',
                payment_method: 'cash',
                amount: remainingRefund,
                customer_name: order.customer?.name || '',
                notes: `Customer surplus from modified order ${order.id.slice(0, 8)}`,
              });
            }
          }
        }
      }

      if (isSold) {
        await syncOrderLinkedDebt(finalOrderDebtRemaining);
      }

      const shouldUpdateReceipt = paymentAmountChanged || paymentTypeChanged || invoiceMethodChanged || priceSubTypeChanged || hasItemSubtypeChanges || productChanges.length > 0;
      if (shouldUpdateReceipt) {
        const { data: freshItems } = await supabase
          .from('order_items')
          .select('*, product:products(name)')
          .eq('order_id', order.id);

        const receiptUpdate: Record<string, any> = {};
        if (paymentAmountChanged) {
          receiptUpdate.paid_amount = adjustPaidAmount;
          receiptUpdate.remaining_amount = adjustRemainingAmount;
        }
        if (paymentTypeChanged || invoiceMethodChanged) {
          receiptUpdate.payment_method = paymentType === 'with_invoice' ? (invoicePaymentMethod || 'cash') : 'cash';
        }
        if (freshItems && freshItems.length > 0) {
          const receiptItems = freshItems.map((fi: any) => ({
            product_id: fi.product_id,
            product_name: fi.product?.name || '',
            quantity: fi.quantity,
            gift_quantity: fi.gift_quantity || 0,
            unit_price: fi.unit_price,
            total_price: fi.total_price,
            pricing_unit: fi.pricing_unit || 'box',
            weight_per_box: fi.weight_per_box || 1,
            pieces_per_box: fi.pieces_per_box || 1,
          }));
          receiptUpdate.items = receiptItems;
          receiptUpdate.total_amount = newTotal;
        }
        if (Object.keys(receiptUpdate).length > 0) {
          await supabase.from('receipts')
            .update(receiptUpdate as any)
            .eq('order_id', order.id);
        }
      }

      await logActivity.mutateAsync({
        actionType: 'update',
        entityType: 'order',
        entityId: order.id,
        details: {
          edit_type: allItemsRemoved ? 'auto_cancelled' : (isSold ? 'after_delivery' : 'during_delivery'),
          customer: order.customer?.name,
          auto_cancelled: allItemsRemoved || undefined,
          changes,
          ...(diffPaymentType && { diff_payment_type: diffPaymentType, diff_paid_amount: paidAmount }),
          ...(paymentAmountChanged && { payment_adjustment: { paid: adjustPaidAmount, remaining: adjustRemainingAmount } }),
        },
      });

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['my-stock-sold'] });
      queryClient.invalidateQueries({ queryKey: ['my-stock-loaded'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debt-summary'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts-summary-all'] });
      queryClient.invalidateQueries({ queryKey: ['due-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-collections'] });
      queryClient.invalidateQueries({ queryKey: ['today-debt-collections-dialog'] });
      queryClient.invalidateQueries({ queryKey: ['order-debt-details'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });

      toast.success(allItemsRemoved ? t('orders.cancel_success') : t('orders.order_modified'));
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  const isOrderCancelled = order.status === 'cancelled';
  console.log('[ModifyOrderDialog] order.status =', order.status, 'isOrderCancelled =', isOrderCancelled, 'order.id =', order.id);
  const effectiveWorkerId = (assignedWorkerId && assignedWorkerId !== 'none')
    ? assignedWorkerId
    : (order.assigned_worker_id || workerId || null);

  const executeConfirmedCancellation = async (diffPaymentType?: 'full' | 'partial' | 'no_payment', paidAmount?: number) => {
    if (!workerId || !effectiveWorkerId) return;

    setIsCancellingOrder(true);
    try {
      const { data: currentItems, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity, unit_price, total_price, gift_quantity, gift_pieces')
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;

      for (const item of (currentItems || [])) {
        const stockReturnQty = Number(item.quantity || 0) + (Number((item as any).gift_pieces || 0) / 100);
        const { data: ws } = await supabase
          .from('worker_stock')
          .select('id, quantity')
          .eq('worker_id', effectiveWorkerId)
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (ws) {
          await supabase.from('worker_stock')
            .update({ quantity: Number(ws.quantity || 0) + stockReturnQty })
            .eq('id', ws.id);
        } else {
          await supabase.from('worker_stock').insert({
            worker_id: effectiveWorkerId,
            product_id: item.product_id,
            quantity: stockReturnQty,
            branch_id: order.branch_id,
          });
        }
      }

      await supabase.from('stock_movements').delete().eq('order_id', order.id);

      await supabase.from('orders')
        .update({ status: 'cancelled', total_amount: 0, payment_status: 'pending', partial_amount: null } as any)
        .eq('id', order.id);

      await supabase.from('customer_debts')
        .update({ total_amount: 0, paid_amount: 0, remaining_amount: 0, status: 'paid' } as any)
        .eq('order_id', order.id);

      const refundableAmount = Math.max(0, Number(originalPaidAmount || 0));
      const refundedToCustomer = diffPaymentType === 'full'
        ? refundableAmount
        : diffPaymentType === 'partial'
          ? Math.min(refundableAmount, Math.max(0, Number(paidAmount || 0)))
          : 0;

      let remainingRefund = Math.max(0, refundableAmount - refundedToCustomer);
      let deductedFromOtherDebts = 0;
      let creditedToCustomer = 0;

      if (remainingRefund > 0 && order.customer_id) {
        const { data: activeDebts, error: activeDebtsError } = await supabase
          .from('customer_debts')
          .select('id, order_id, total_amount, paid_amount, remaining_amount')
          .eq('customer_id', order.customer_id)
          .neq('order_id', order.id)
          .in('status', ['active', 'partially_paid'])
          .order('created_at', { ascending: true });

        if (activeDebtsError) throw activeDebtsError;

        for (const debt of (activeDebts || [])) {
          if (remainingRefund <= 0) break;

          const remaining = Number(debt.remaining_amount) || (Number(debt.total_amount || 0) - Number(debt.paid_amount || 0));
          const deduction = Math.min(remainingRefund, remaining);
          const newPaid = Number(debt.paid_amount || 0) + deduction;
          const newRemaining = Math.max(0, Number(debt.total_amount || 0) - newPaid);

          await supabase.from('customer_debts')
            .update({
              paid_amount: newPaid,
              remaining_amount: newRemaining,
              status: newRemaining <= 0 ? 'paid' : 'partially_paid',
            } as any)
            .eq('id', debt.id);

          await supabase.from('debt_payments').insert({
            debt_id: debt.id,
            worker_id: workerId,
            amount: deduction,
            payment_method: 'cash',
            notes: `خصم من إلغاء المبيعة ${order.id.slice(0, 8)}`,
          } as any);

          await supabase.from('debt_collections').insert({
            debt_id: debt.id,
            worker_id: workerId,
            action: deduction >= remaining ? 'full_payment' : 'partial_payment',
            amount_collected: deduction,
            payment_method: 'cash',
            notes: `خصم من إلغاء المبيعة ${order.id.slice(0, 8)}`,
            status: 'pending',
          } as any);

          remainingRefund -= deduction;
          deductedFromOtherDebts += deduction;
        }
      }

      if (remainingRefund > 0 && order.customer_id) {
        creditedToCustomer = remainingRefund;

        await supabase.from('customer_credits').insert({
          customer_id: order.customer_id,
          order_id: order.id,
          worker_id: workerId,
          branch_id: order.branch_id,
          amount: remainingRefund,
          credit_type: 'financial',
          status: 'approved',
          approved_by: workerId,
          approved_at: new Date().toISOString(),
          notes: `رصيد ناتج عن إلغاء المبيعة ${order.id.slice(0, 8)}`,
        } as any);

        await supabase.from('manager_treasury').insert({
          manager_id: workerId,
          branch_id: order.branch_id || null,
          source_type: 'customer_surplus',
          payment_method: 'cash',
          amount: remainingRefund,
          customer_name: order.customer?.name || order.customer?.store_name || '',
          notes: `رصيد عميل من إلغاء المبيعة ${order.id.slice(0, 8)}`,
        } as any);
      }

      await supabase.from('receipts')
        .update({ total_amount: 0, paid_amount: 0, remaining_amount: 0 } as any)
        .eq('order_id', order.id);

      await logActivity.mutateAsync({
        actionType: 'update',
        entityType: 'order',
        entityId: order.id,
        details: {
          action: 'cancel_sale',
          customer: order.customer?.name,
          worker_id: effectiveWorkerId,
          refunded_to_customer: refundedToCustomer,
          deducted_from_other_debts: deductedFromOtherDebts,
          credited_to_customer: creditedToCustomer,
          cleared_order_debt: originalRemainingAmount,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debt-summary'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts-summary-all'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] });
      queryClient.invalidateQueries({ queryKey: ['pending-collections'] });
      queryClient.invalidateQueries({ queryKey: ['order-debt-details'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('تم إلغاء المبيعة بنجاح');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const handleCancelOrResume = async () => {
    if (!workerId || !effectiveWorkerId) return;

    if (!isOrderCancelled) {
      try {
        const { data: currentItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, unit_price, gift_quantity, gift_pieces, product:products(name)')
          .eq('order_id', order.id);

        if (itemsError) throw itemsError;

        await loadCustomerFinancialContext();

        setConfirmMode('cancel');
        setConfirmChanges((currentItems || []).map((item: any) => ({
          product_name: item.product?.name || items.find((entry) => entry.product_id === item.product_id)?.product_name || 'منتج',
          original_quantity: Number(item.quantity || 0),
          new_quantity: 0,
          unit_price: Number(item.unit_price || 0),
          difference: -Number(item.quantity || 0),
        })));
        setConfirmOriginalTotal(Math.max(0, Number(originalPaidAmount || 0)));
        setConfirmNewTotal(0);
        setShowConfirmDialog(true);
      } catch (error: any) {
        toast.error(error.message || 'حدث خطأ');
      }
      return;
    }

    setIsCancellingOrder(true);
    try {
      const { data: currentItems, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity, unit_price, total_price, gift_quantity, gift_pieces')
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;

      for (const item of (currentItems || [])) {
        const stockDeduction = Number(item.quantity || 0) + (Number((item as any).gift_pieces || 0) / 100);
        const { data: ws } = await supabase
          .from('worker_stock')
          .select('id, quantity')
          .eq('worker_id', effectiveWorkerId)
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (ws) {
          await supabase.from('worker_stock')
            .update({ quantity: Math.max(0, Number(ws.quantity || 0) - stockDeduction) })
            .eq('id', ws.id);
        }

        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          branch_id: order.branch_id || null,
          quantity: stockDeduction,
          movement_type: 'delivery',
          status: 'approved',
          created_by: workerId,
          worker_id: effectiveWorkerId,
          order_id: order.id,
          notes: 'استئناف مبيعة ملغاة',
        } as any);
      }

      const totalAmount = (currentItems || []).reduce((sum, item) => {
        const paidQty = Math.max(0, Number(item.quantity || 0) - Number(item.gift_quantity || 0));
        return sum + (paidQty * Number(item.unit_price || 0));
      }, 0);

      await supabase.from('orders')
        .update({ status: 'delivered', total_amount: totalAmount, payment_status: 'pending', partial_amount: null } as any)
        .eq('id', order.id);

      const resolvedCustomerId = order.customer_id || order.customer?.id;
      if (resolvedCustomerId) {
        const { data: existingDebt } = await supabase
          .from('customer_debts')
          .select('id')
          .eq('order_id', order.id)
          .maybeSingle();

        if (existingDebt) {
          await supabase.from('customer_debts')
            .update({ total_amount: totalAmount, paid_amount: 0, remaining_amount: totalAmount, status: 'active', worker_id: effectiveWorkerId } as any)
            .eq('id', existingDebt.id);
        } else if (totalAmount > 0) {
          await supabase.from('customer_debts').insert({
            customer_id: resolvedCustomerId,
            order_id: order.id,
            worker_id: effectiveWorkerId,
            branch_id: order.branch_id,
            total_amount: totalAmount,
            paid_amount: 0,
            remaining_amount: totalAmount,
            status: 'active',
          } as any);
        }
      }

      await supabase.from('receipts')
        .update({ total_amount: totalAmount, paid_amount: 0, remaining_amount: totalAmount } as any)
        .eq('order_id', order.id);

      await logActivity.mutateAsync({
        actionType: 'update',
        entityType: 'order',
        entityId: order.id,
        details: { action: 'resume_cancelled', customer: order.customer?.name, total_amount: totalAmount, worker_id: effectiveWorkerId },
      });

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debts'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debt-summary'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debt-summary-all'] });
      queryClient.invalidateQueries({ queryKey: ['order-debt-details'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success('تم استئناف المبيعة بنجاح');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const availableProducts = products.filter(p => !items.some(i => i.product_id === p.id));
  const selectedNewProduct = products.find((p) => p.id === newProductId);
  const canToggleNewProductUnit = supportsUnitSale(selectedNewProduct);
  const editingItem = useMemo(() => {
    if (!editingTargetProductId) return null;
    return items.find((item) => item.product_id === editingTargetProductId) || null;
  }, [editingTargetProductId, items]);
  const editingSubtype = editingItem ? getCurrentItemSubtype(editingItem) : (paymentType === 'with_invoice' ? 'invoice' : priceSubType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(100dvh-0.75rem,56rem)] max-h-[100dvh-0.75rem] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-md" dir={dir}>
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {isSold ? (language === 'ar' ? 'تعديل المبيعة' : t('orders.modify_order')) : t('orders.modify_order')}
            {(order.customer?.store_name || order.customer?.name) && (
              <span className="text-sm font-normal text-muted-foreground">
                — {order.customer?.store_name || order.customer?.name}
              </span>
            )}
            {isOrderCancelled && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5">ملغاة</Badge>
            )}
          </DialogTitle>
          {isSold && (order.created_at || order.updated_at) && (
            <p className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">
              {format(new Date(order.updated_at || order.created_at), 'dd/MM/yyyy HH:mm')}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 sm:px-4 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-3">

            {/* Assign delivery worker */}
            {canChangeWorker && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <DeliveryWorkerSelect
                  customerBranchId={order.branch_id || order.customer?.branch_id || null}
                  value={assignedWorkerId}
                  onChange={setAssignedWorkerId}
                />
              </div>
            )}

            {/* Delivery date — only for non-sold orders */}
            {!isSold && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {t('orders.delivery_date')}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-start h-9", !deliveryDate && "text-muted-foreground")}>
                      <CalendarDays className="w-4 h-4 me-2" />
                      {deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : t('deliveries.no_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[10060]" align="start">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      className={cn("p-3 pointer-events-auto")}
                      locale={ar}
                    />
                  </PopoverContent>
                </Popover>
                {deliveryDate && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setDeliveryDate(undefined)}>
                    {dialogText.removeDate}
                  </Button>
                )}
              </div>
            )}

            {/* Payment type */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" />
                {t('orders.payment_method')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={paymentType === 'with_invoice' ? 'default' : 'outline'}
                  className={`h-10 text-sm font-bold ${paymentType === 'with_invoice' ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-400' : 'border-blue-300 text-blue-700 hover:bg-blue-50 opacity-60'}`}
                  onClick={() => { setPaymentType('with_invoice'); recalcItemPrices('with_invoice', priceSubType); }}
                >
                  {t('orders.with_invoice')}
                </Button>
                <Button
                  type="button"
                  variant={paymentType === 'without_invoice' ? 'default' : 'outline'}
                  className={`h-10 text-sm font-bold ${paymentType === 'without_invoice' ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 opacity-60'}`}
                  onClick={() => { setPaymentType('without_invoice'); setInvoicePaymentMethod(null); recalcItemPrices('without_invoice', priceSubType); }}
                >
                  {t('orders.without_invoice')}
                </Button>
              </div>
              {paymentType === 'without_invoice' && (
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'super_gros' as PriceSubType, label: 'Super Gros', colors: { active: 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 ring-2 ring-indigo-400', inactive: 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600' } },
                    { value: 'gros' as PriceSubType, label: 'Gros', colors: { active: 'bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600 ring-2 ring-cyan-400', inactive: 'bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600' } },
                    { value: 'retail' as PriceSubType, label: dialogText.detail, colors: { active: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 ring-2 ring-rose-400', inactive: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600' } },
                  ]).map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={priceSubType === option.value ? 'default' : 'outline'}
                      size="sm"
                      className={`h-10 text-sm font-bold transition-opacity ${priceSubType === option.value ? option.colors.active : option.colors.inactive} ${priceSubType !== option.value ? 'opacity-50' : ''}`}
                      onClick={() => { setPriceSubType(option.value); recalcItemPrices('without_invoice', option.value); }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
              {paymentType === 'with_invoice' && (
                <InvoicePaymentMethodSelect
                  value={invoicePaymentMethod}
                  onChange={setInvoicePaymentMethod}
                />
              )}
            </div>

            {/* Payment amount adjustment for delivered orders */}
            {isSold && (
              <div className="border rounded-lg p-3 space-y-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5" />
                  {dialogText.adjustPaymentTitle}
                </label>
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  {dialogText.adjustPaymentDescription}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={quickPaymentMode === 'full' ? 'default' : 'outline'}
                    className="h-12 px-2 text-[11px] sm:text-xs whitespace-normal leading-tight"
                    onClick={() => handleQuickPaymentMode('full')}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>{t('debts.full_payment')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant={quickPaymentMode === 'partial' ? 'secondary' : 'outline'}
                    className="h-12 px-2 text-[11px] sm:text-xs whitespace-normal leading-tight"
                    onClick={() => handleQuickPaymentMode('partial')}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>{t('debts.partial_payment')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant={quickPaymentMode === 'debt' ? 'destructive' : 'outline'}
                    className="h-12 px-2 text-[11px] sm:text-xs whitespace-normal leading-tight"
                    onClick={() => handleQuickPaymentMode('debt')}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>{dialogText.fullDebt}</span>
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">{t('orders.paid_amount')}</label>
                    <Input
                      type="number"
                      value={adjustPaidAmount}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(Number(e.target.value) || 0, resolvedOrderTotal));
                        setAdjustPaidAmount(val);
                        setAdjustRemainingAmount(Math.max(0, resolvedOrderTotal - val));
                      }}
                      className="h-10 text-base"
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">{dialogText.remainingDebtLabel}</label>
                    <Input
                      type="number"
                      value={adjustRemainingAmount}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(Number(e.target.value) || 0, resolvedOrderTotal));
                        setAdjustRemainingAmount(val);
                        setAdjustPaidAmount(Math.max(0, resolvedOrderTotal - val));
                      }}
                      className="h-10 text-base"
                      min={0}
                    />
                  </div>
                </div>
                {paymentAmountChanged && (
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded-md p-2 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">{dialogText.willUpdate}</p>
                      <ul className="list-disc list-inside text-[10px] mt-0.5 space-y-0.5">
                        <li>{dialogText.paidAmount}: {originalPaidAmount.toLocaleString()} {'->'} {adjustPaidAmount.toLocaleString()} {dialogText.currency}</li>
                        <li>{dialogText.remainingAmount}: {originalRemainingAmount.toLocaleString()} {'->'} {adjustRemainingAmount.toLocaleString()} {dialogText.currency}</li>
                        {adjustRemainingAmount > originalRemainingAmount && <li className="text-red-700">{dialogText.createDebt} {(adjustRemainingAmount - originalRemainingAmount).toLocaleString()} {dialogText.currency}</li>}
                        {adjustRemainingAmount < originalRemainingAmount && <li className="text-green-700">{dialogText.settleDebt} {(originalRemainingAmount - adjustRemainingAmount).toLocaleString()} {dialogText.currency}</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {items.map((item, index) => {
              const changed = item.new_quantity !== item.original_quantity || item.unit_price !== item.original_unit_price;
              const product = getProductById(item.product_id);
              const imgUrl = product?.image_url || (orderItems.find((orderItem) => orderItem.product_id === item.product_id)?.product as any)?.image_url;
              const paidQty = getPaidQuantity(item);
              const displayUnitPrice = getDisplayUnitPrice(item);
              const currentSubtype = getCurrentItemSubtype(item);
              const subtypeLabel = currentSubtype === 'invoice'
                ? 'F1'
                : currentSubtype === 'super_gros'
                  ? 'SG'
                  : currentSubtype === 'retail'
                    ? 'D'
                    : 'G';
              return (
                <div
                  key={item.product_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openItemEditor(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openItemEditor(item);
                    }
                  }}
                  className={`rounded-xl border p-3 transition-colors ${
                    item.new_quantity === 0
                      ? 'border-destructive/20 bg-destructive/5 opacity-60'
                      : changed
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-card hover:border-primary/35'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-xl border bg-muted/40 shrink-0">
                      {imgUrl ? (
                        <img src={imgUrl} alt={item.product_name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          {dialogText.noImage}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate block">{item.product_name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {subtypeLabel}
                            </Badge>
                            {item.is_unit_sale && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {t('offers.unit_piece')}
                              </Badge>
                            )}
                            {(item.gift_quantity || 0) > 0 && (
                              <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 text-[10px] px-1.5 py-0 gap-0.5">
                                <Gift className="w-3 h-3" />
                                {dialogText.gift} {item.gift_quantity}
                              </Badge>
                            )}
                              {item.id && changed && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {`${item.original_quantity} -> ${item.new_quantity}`}
                                </Badge>
                              )}
                            {!item.id && (
                              <Badge className="bg-green-100 text-green-800 text-[10px]">{dialogText.newItem}</Badge>
                            )}
                          </div>
                          {displayUnitPrice > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {displayUnitPrice.toLocaleString()} DA x {paidQty} = {(displayUnitPrice * paidQty).toLocaleString()} DA
                              {(item.gift_quantity || 0) > 0 ? ` (${paidQty} + ${item.gift_quantity} gift = ${item.new_quantity})` : ''}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveItem(item.product_id);
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col items-start min-w-12">
                          <span className="text-[11px] text-muted-foreground">
                            {item.is_unit_sale ? (t('orders.quantity_pieces') || 'Pieces') : (t('orders.quantity_boxes') || 'Boxes')}
                          </span>
                          <span className="font-bold text-sm">{paidQty}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground text-end">
                          {t('orders.tap_product_to_edit') || 'Tap the product to edit'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add new product */}
            <div className="border-2 border-dashed rounded-lg p-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 gap-2 text-primary border-primary/40 hover:bg-primary/5"
                onClick={() => setShowProductPicker(true)}
              >
                <PlusCircle className="w-5 h-5" />
                {t('orders.add_product')}
              </Button>
            </div>

            {currentSubtotal > 0 && (
              <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('orders.subtotal')}:</span>
                  <span className="font-medium">
                    {currentSubtotal.toLocaleString('ar-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {dialogText.currency}
                  </span>
                </div>
                {currentCalculatedTotal.stampAmount > 0 && (
                  <div className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-400">
                    <span>
                      {t('orders.stamp_tax')}
                      {currentCalculatedTotal.stampPercentage > 0 ? ` (${currentCalculatedTotal.stampPercentage}%)` : ''}:
                    </span>
                    <span className="font-medium">
                      {currentCalculatedTotal.stampAmount.toLocaleString('ar-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {dialogText.currency}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-2 text-sm font-bold">
                  <span>{t('orders.grand_total')}:</span>
                  <span className="text-primary">
                    {orderTotal.toLocaleString('ar-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {dialogText.currency}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4 space-y-2">
          {isSold && effectiveWorkerId && (
            <Button
              className="h-10 w-full"
              variant={isOrderCancelled ? 'default' : 'destructive'}
              onClick={handleCancelOrResume}
              disabled={isCancellingOrder || isSubmitting}
            >
              {isCancellingOrder ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isOrderCancelled ? (
                <>
                  <Package className="w-4 h-4 me-2" />
                  استئناف المبيعة
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 me-2" />
                  إلغاء المبيعة
                </>
              )}
            </Button>
          )}
          <Button
            className="h-11 w-full"
            onClick={handleSaveClick}
            disabled={!hasChanges || isSubmitting || isCancellingOrder}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 me-2" />
                {t('orders.save_changes')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>

      <ProductQuantityDialog
        open={showQuantityDialog}
        onOpenChange={(openState) => {
          setShowQuantityDialog(openState);
          if (!openState) {
            setSelectedProduct(null);
            setEditingTargetProductId(null);
            setEditingInitialGiftOfferId(undefined);
          }
        }}
        product={selectedProduct}
        onConfirm={handleEditProductWithQuantity}
        unitPrice={
          editingItem
            ? getBoxEquivalentPrice(editingItem)
            : selectedProduct
              ? resolveCustomSalePrice(selectedProduct, getRawProductPrice(selectedProduct, editingSubtype), false)
              : 0
        }
        unitPiecePrice={
          editingItem
            ? (editingItem.is_unit_sale
              ? editingItem.unit_price
              : getBoxEquivalentPrice(editingItem) / Math.max(1, editingItem.pieces_per_box))
            : selectedProduct
              ? resolveCustomSalePrice(selectedProduct, getRawProductPrice(selectedProduct, editingSubtype), true)
              : 0
        }
        defaultPaymentType={editingSubtype === 'invoice' ? 'with_invoice' : 'without_invoice'}
        defaultPriceSubType={editingSubtype === 'invoice' ? priceSubType : (editingSubtype as PriceSubType)}
        defaultInvoicePaymentMethod={editingSubtype === 'invoice' ? invoicePaymentMethod : null}
        mode="edit"
        initialQuantity={editingInitialQuantity}
        initialGiftPieces={editingInitialGiftPieces}
        initialGiftOfferId={editingInitialGiftOfferId}
        initialOfferApplied={editingInitialOfferApplied}
        initialIsUnitSale={editingInitialIsUnitSale}
        initialCustomUnitPrice={editingInitialCustomUnitPrice}
        customerTypes={getCustomerTypesArray(order.customer)}
      />

      {/* Post-delivery confirmation dialog */}
      <PostDeliveryConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        changes={productChanges}
        originalTotal={originalTotal}
        newTotal={orderTotal}
        onConfirm={handlePostDeliveryConfirm}
        isSubmitting={isSubmitting}
        customerHasDebt={customerDebtTotal > 0}
        customerDebtAmount={customerDebtTotal}
        customerCreditBalance={customerCreditTotal}
      />

      <SimpleProductPickerDialog
        open={showProductPicker}
        onOpenChange={setShowProductPicker}
        products={availableProducts.map(p => ({ id: p.id, name: getProductDisplayName(p), image_url: p.image_url }))}
        selectedProductId={newProductId}
        onSelect={(id) => {
          setNewProductId(id);
          // Auto-add the product immediately
          const product = products.find(p => p.id === id);
          if (product && !items.some(i => i.product_id === id)) {
            const initialPaidQuantity = 1;
            let unitPrice: number;
            if (paymentType === 'with_invoice') {
              unitPrice = Number(product.price_invoice || 0);
            } else {
              switch (priceSubType) {
                case 'super_gros': unitPrice = Number(product.price_super_gros || product.price_no_invoice || 0); break;
                case 'retail': unitPrice = Number(product.price_retail || 0); break;
                default: unitPrice = Number(product.price_gros || product.price_no_invoice || 0); break;
              }
            }
            const piecesPerBox = Number(product.pieces_per_box || 1);
            const pricingUnit = product.pricing_unit || 'box';
            const weightPerBox = Number(product.weight_per_box || 1);
            const recalculated = recalcFromPaidQuantity(product.id, initialPaidQuantity, piecesPerBox);
            setItems(prev => [...prev, {
              product_id: product.id,
              product_name: getProductDisplayName(product),
              original_quantity: 0,
              new_quantity: recalculated.total_quantity,
              unit_price: unitPrice,
              original_unit_price: unitPrice,
              gift_quantity: recalculated.gift_quantity,
              gift_pieces: 0,
              original_gift_quantity: 0,
              original_gift_pieces: 0,
              pieces_per_box: piecesPerBox,
              pricing_unit: pricingUnit,
              weight_per_box: weightPerBox,
            }]);
            setNewProductId('');
          }
        }}
      />
    </Dialog>
  );
};

export default ModifyOrderDialog;

