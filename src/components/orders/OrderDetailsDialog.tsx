import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ReceiptDialog from '@/components/printing/ReceiptDialog';
import ModifyOrderDialog from '@/components/orders/ModifyOrderDialog';
import { Loader2, Pencil, Phone, Printer, RotateCcw, X, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrderItems } from '@/hooks/useOrders';
import { OrderItem, OrderWithDetails, Product } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { formatAmountWithMaxFraction } from '@/utils/amountFormatting';

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderWithDetails | null;
  hideModifyAction?: boolean;
  onCancelOrder?: (orderId: string) => Promise<void> | void;
  onResumeOrder?: (orderId: string) => Promise<void> | void;
}

const toSafeNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const normalizeSaleItem = (item: any) => {
  const product = item?.product;
  const pricingUnit = product?.pricing_unit || item?.pricing_unit || item?.pricingUnit || 'box';
  // Get the catalog price per pricing unit from product management
  const catalogUnitPrice = toSafeNumber(product?.price_gros ?? product?.price_retail ?? 0);
  const rawUnitPrice = toSafeNumber(item?.unit_price ?? item?.unitPrice);
  const piecesPerBox = toSafeNumber(product?.pieces_per_box ?? item?.pieces_per_box ?? item?.piecesPerBox ?? 1) || 1;
  const giftPieces = toSafeNumber(item?.gift_pieces ?? item?.giftPieces ?? 0);
  return {
    productId: item?.product_id || item?.productId || product?.id || '',
    productName: product?.app_name || product?.name || item?.product_name || item?.productName || '—',
    quantity: toSafeNumber(item?.quantity),
    unitPrice: rawUnitPrice > 0 ? rawUnitPrice : catalogUnitPrice,
    totalPrice: toSafeNumber(item?.total_price ?? item?.totalPrice),
    giftQuantity: toSafeNumber(item?.gift_quantity ?? item?.giftQuantity),
    giftPieces,
    piecesPerBox,
    pricingUnit,
    catalogUnitPrice,
  };
};

const resolveOrderPayment = (
  order: any,
  isOrderRequest: boolean,
  totalAmountOverride?: number,
) => {
  const totalAmount = totalAmountOverride != null
    ? Number(totalAmountOverride || 0)
    : Number(order?.total_amount || 0);
  const paymentStatus = String(order?.payment_status || '').toLowerCase();
  const partialAmount = order?.partial_amount != null ? Number(order.partial_amount) : null;

  if (isOrderRequest) return { paidAmount: 0, remainingAmount: totalAmount };

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

const getPaymentMethodLabel = (order: any) => {
  const paymentType = order?.payment_type;
  if (paymentType === 'with_invoice') {
    const method = order?.invoice_payment_method;
    if (method === 'cash') return 'كاش';
    if (method === 'check') return 'شيك';
    if (method === 'transfer') return 'Virement';
    if (method === 'receipt') return 'Versement Doc';
    return 'فاتورة';
  }
  if (paymentType === 'without_invoice') return 'بدون فاتورة';
  if (paymentType === 'cash') return 'كاش';
  if (paymentType === 'check') return 'شيك';
  if (paymentType === 'transfer') return 'Virement';
  if (paymentType === 'receipt') return 'Versement Doc';
  return 'كاش';
};

const getPaymentCode = (order: any, items?: any[]) => {
  const paymentType = order?.payment_type;
  const invoiceMethod = order?.invoice_payment_method || items?.[0]?.invoice_payment_method || items?.[0]?.payment_type;
  const priceSubtype = order?.price_subtype || items?.[0]?.price_subtype || (order as any)?.items?.[0]?.price_subtype;

  if (paymentType === 'with_invoice') {
    let code = 'F1';
    if (invoiceMethod === 'cash') code += '·C';
    else if (invoiceMethod === 'check') code += '·Ch';
    else if (invoiceMethod === 'transfer') code += '·Vi';
    else if (invoiceMethod === 'receipt') code += '·Ve';
    return code;
  }
  if (paymentType === 'without_invoice') {
    let code = 'F2';
    if (priceSubtype === 'retail' || priceSubtype === 'detail') code += '·D';
    else if (priceSubtype === 'wholesale' || priceSubtype === 'gros') code += '·G';
    else if (priceSubtype === 'super_wholesale' || priceSubtype === 'super_gros') code += '·SG';
    else code += '·G';
    return code;
  }
  return '';
};

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({ open, onOpenChange, order, hideModifyAction = false, onCancelOrder, onResumeOrder }) => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [expandedItemIdx, setExpandedItemIdx] = useState<number | null>(null);
  const { data: orderItems = [], isLoading: orderItemsLoading } = useOrderItems(open ? order?.id ?? null : null);

  const { data: orderDebt } = useQuery({
    queryKey: ['order-debt-details', order?.id],
    queryFn: async () => {
      if (!order?.id) return null;
      const { data, error } = await supabase
        .from('customer_debts')
        .select('total_amount, paid_amount, remaining_amount')
        .eq('order_id', order.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && !!order?.id,
  });

  const displayItems = useMemo(() => {
    if (orderItems.length > 0) return orderItems;
    return (order?.items || []) as (OrderItem & { product?: Product })[];
  }, [order?.items, orderItems]);

  const itemsTotalAmount = useMemo(
    () => displayItems.reduce((sum, item: any) => {
      const normalizedItem = normalizeSaleItem(item);
      if (normalizedItem.totalPrice > 0) {
        return sum + normalizedItem.totalPrice;
      }
      const paidQuantity = Math.max(0, normalizedItem.quantity - normalizedItem.giftQuantity);
      return sum + (paidQuantity * normalizedItem.unitPrice);
    }, 0),
    [displayItems],
  );

  if (!order) { console.log('[OrderDetailsDialog] order is null, returning null'); return null; }
  console.log('[OrderDetailsDialog] Rendering with order:', { id: order.id, status: order.status, _isAccounted: (order as any)?._isAccounted });

  const customer = order.customer;
  const isOrderRequest = !!(order as any)._isOrderRequest;
  const shouldUseStampedTotal = order.payment_type === 'with_invoice' && order.invoice_payment_method === 'cash';
  const effectiveTotalAmount = shouldUseStampedTotal
    ? Math.max(
      itemsTotalAmount,
      Number(orderDebt?.total_amount || 0),
      Number(order.total_amount || 0),
    )
    : itemsTotalAmount > 0
      ? itemsTotalAmount
      : Number(orderDebt?.total_amount || order.total_amount || 0);
  const fallback = resolveOrderPayment(order, isOrderRequest, effectiveTotalAmount);
  const paidAmount = orderDebt
    ? Math.max(0, effectiveTotalAmount - Number(orderDebt.remaining_amount || 0))
    : fallback.paidAmount;
  const remainingAmount = orderDebt
    ? Number(orderDebt.remaining_amount || 0)
    : fallback.remainingAmount;
  const paymentStatus = String(order?.payment_status || '').toLowerCase();
  const isDetailsLoading = Boolean((order as any)?._detailsLoading);
  const hasDebt =
    remainingAmount > 0 ||
    Number(orderDebt?.total_amount || 0) > 0 ||
    ['pending', 'payment_pending', 'no_payment', 'credit', 'partial', 'payment_partial'].includes(paymentStatus);
  const paymentMethodLabel = getPaymentMethodLabel(order);
  const paymentCode = getPaymentCode(order, displayItems);
  const debtTagLabel = remainingAmount > 0
    ? (paidAmount > 0 ? 'دين جزئي' : 'دين كلي')
    : null;
  const paymentState = remainingAmount <= 0 ? 'full' : paidAmount > 0 ? 'partial' : 'debt';
  const paymentStateLabel = paymentState === 'full' ? 'دفع كلي' : paymentState === 'partial' ? 'دفع جزئي' : 'دين كلي';

  const receiptData = {
    receiptType: 'delivery' as const,
    orderId: order.id || null,
    customerId: customer?.id || '',
    customerName: customer?.store_name || customer?.name || (order as any).customer_name || '—',
    customerPhone: customer?.phone || null,
    workerId: user?.id || '',
    workerName: user?.full_name || '',
    workerPhone: null,
    branchId: user?.branch_id || null,
    items: displayItems.map((item: any) => {
      const normalizedItem = normalizeSaleItem(item);
      return {
        productId: normalizedItem.productId,
        productName: normalizedItem.productName,
        quantity: normalizedItem.quantity,
        unitPrice: normalizedItem.unitPrice,
        totalPrice: normalizedItem.totalPrice,
        giftQuantity: normalizedItem.giftQuantity,
      };
    }),
    totalAmount: effectiveTotalAmount,
    paidAmount,
    remainingAmount,
    paymentMethod: order.payment_type || 'cash',
    notes: order.notes || null,
    receiptTitleOverride: isOrderRequest ? 'BON DE COMMANDE' : undefined,
  };

  const isOrderCancelled = order.status === 'cancelled';
  const isSold = ['delivered', 'sold', 'completed', 'approved', 'cancelled'].includes(order.status || '') || !!(order as any)?._isDirectSale || !!(order as any)?._forceSold;
  const dialogTitle = isSold ? 'تفاصيل المبيعة' : 'تفاصيل الطلبية';
  const modifyLabel = isSold ? 'تعديل المبيعة' : 'تعديل الطلبية';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="relative flex max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:max-w-sm [&>button.absolute]:hidden" dir={dir}>
          {/* Accounting/Approval stamp overlay */}
          {(order as any)?._isAccounted && (order as any)?._accountedDate && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-none z-20 rotate-[-12deg]">
              <div className={`w-20 h-20 rounded-full border-[3px] flex items-center justify-center ${
                ['add_customer', 'update_customer', 'delete_customer'].includes((order as any)?._operationType || '')
                  ? 'border-blue-500/50 bg-blue-500/5' : 'border-destructive/50 bg-destructive/5'
              }`}>
                <div className={`w-16 h-16 rounded-full border-[2px] border-dashed flex flex-col items-center justify-center gap-[2px] ${
                  ['add_customer', 'update_customer', 'delete_customer'].includes((order as any)?._operationType || '')
                    ? 'border-blue-500/40' : 'border-destructive/40'
                }`}>
                  <span className={`text-[9px] font-black leading-none select-none ${
                    ['add_customer', 'update_customer', 'delete_customer'].includes((order as any)?._operationType || '')
                      ? 'text-blue-600/70' : 'text-destructive/70'
                  }`}>تمت</span>
                  <span className={`text-[8.5px] font-black leading-none select-none ${
                    ['add_customer', 'update_customer', 'delete_customer'].includes((order as any)?._operationType || '')
                      ? 'text-blue-600/70' : 'text-destructive/70'
                  }`}>
                    {['add_customer', 'update_customer', 'delete_customer'].includes((order as any)?._operationType || '') ? 'الموافقة' : 'المحاسبة'}
                  </span>
                  <span className={`text-[9px] font-bold leading-none select-none tabular-nums mt-[1px] ${
                    ['add_customer', 'update_customer', 'delete_customer'].includes((order as any)?._operationType || '')
                      ? 'text-blue-600/60' : 'text-destructive/60'
                  }`} dir="ltr">
                    {(() => { try { return format(new Date((order as any)._accountedDate), 'dd/MM'); } catch { return ''; } })()}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogHeader className="p-2.5 sm:p-3 pb-2 border-b shrink-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="min-w-0 flex-1 text-sm font-bold leading-snug truncate">
                {customer?.store_name || customer?.name || '—'}
                {customer?.store_name && customer?.name && customer.store_name !== customer.name && (
                  <span className="text-xs font-normal text-muted-foreground ms-1">({customer.name})</span>
                )}
              </DialogTitle>
              <div className="flex shrink-0 items-center gap-1.5">
                {isOrderCancelled && (
                  <Badge variant="destructive" className="text-[10px] px-2 py-0.5">ملغاة</Badge>
                )}
                <button
                  aria-label="إغلاق"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-destructive text-white transition-colors hover:bg-destructive/90"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-start justify-between text-xs">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span dir="ltr" className="font-bold text-primary text-base">{formatAmountWithMaxFraction(effectiveTotalAmount || 0)} DA</span>
                  {order.notes && (
                    <span title={order.notes} className="cursor-help">📝</span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {order.created_at && <span className="text-muted-foreground text-xs">{format(new Date(order.created_at), 'dd/MM HH:mm')}</span>}
                  {paymentCode && <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold">{paymentCode}</Badge>}
                  <Badge variant={paymentState === 'full' ? 'default' : paymentState === 'partial' ? 'secondary' : 'destructive'} className="text-[9px] px-1.5 py-0">
                    {paymentStateLabel}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-xs">
                <span className="text-emerald-600 font-bold">مدفوع: <span dir="ltr">{formatAmountWithMaxFraction(paidAmount)} DA</span></span>
                {remainingAmount > 0 && (
                  <span className="text-destructive font-bold">متبقي: <span dir="ltr">{formatAmountWithMaxFraction(remainingAmount)} DA</span></span>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">

            {orderItemsLoading || isDetailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : displayItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">لا توجد منتجات</div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {displayItems.map((item: any, idx: number) => {
                  const n = normalizeSaleItem(item);
                  const productImage = item?.product?.image_url || item?.image_url || null;
                  const catalogUnitLabel = n.pricingUnit === 'kg' ? 'Kg' : n.pricingUnit === 'unit' ? 'pcs' : '';
                  return (
                    <div
                      key={item.id || idx}
                      className="flex flex-col rounded-xl overflow-hidden shadow border border-border"
                    >
                      <div className="px-1.5 py-1 border-b bg-muted border-border">
                        <span className="font-bold text-[10px] leading-tight block truncate text-foreground">
                          {n.productName}
                        </span>
                      </div>
                      <div
                        className="relative w-full aspect-[4/3] bg-muted overflow-hidden cursor-pointer"
                        onClick={() => setExpandedItemIdx(expandedItemIdx === idx ? null : idx)}
                      >
                        {productImage ? (
                          <img src={productImage} alt={n.productName} className="w-full h-full object-contain" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-2xl text-muted-foreground/30">📦</span>
                          </div>
                        )}
                        {expandedItemIdx === idx && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 p-1.5 animate-in fade-in duration-200">
                            <div dir="ltr" className="w-full flex items-center justify-center rounded-md bg-blue-600 py-1 px-1.5 text-[10px] font-bold text-white">
                              {formatAmountWithMaxFraction(n.unitPrice || 0)} DA
                            </div>
                            {n.catalogUnitPrice > 0 && catalogUnitLabel && (
                              <div dir="ltr" className="w-full flex items-center justify-center rounded-md bg-emerald-600 py-1 text-[10px] font-bold text-white">
                                {formatAmountWithMaxFraction(n.catalogUnitPrice)} DA/{catalogUnitLabel}
                              </div>
                            )}
                            <div dir="ltr" className="w-full flex items-center justify-center rounded-md bg-destructive py-1 text-[10px] font-bold text-destructive-foreground">
                              {formatAmountWithMaxFraction(n.totalPrice || 0)} DA
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="px-1 py-1 bg-card flex items-center justify-center gap-1 border-t border-border">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {n.quantity}
                        </span>
                        {n.giftQuantity > 0 && (() => {
                          const giftBoxes = n.piecesPerBox > 1 ? Math.floor(n.giftPieces / n.piecesPerBox) : n.giftQuantity;
                          const giftRemPieces = n.piecesPerBox > 1 ? n.giftPieces % n.piecesPerBox : 0;
                          const giftLabel = n.piecesPerBox > 1 && n.giftPieces > 0
                            ? `${giftBoxes}.${String(giftRemPieces).padStart(2, '0')}`
                            : `${n.giftQuantity}`;
                          return (
                            <span className="flex h-6 shrink-0 items-center justify-center gap-0.5 rounded-full bg-emerald-600 text-white px-2 text-[10px] font-bold">
                              🎁 {giftLabel}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}


          </div>

          {/* Fixed bottom buttons */}
          <div className="shrink-0 border-t bg-background px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4">
            <div className="flex items-center gap-2">
              <Button
                className="h-11 w-11 shrink-0 px-0"
                size="icon"
                onClick={() => setShowModifyDialog(true)}
                disabled={hideModifyAction || orderItemsLoading || isDetailsLoading}
              >
                <Pencil className="h-5 w-5" />
              </Button>
              {onCancelOrder && !isOrderCancelled && order?.id && !hideModifyAction && (
                <Button
                  className="h-11 flex-1 gap-2"
                  variant="destructive"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isCancelling}
                >
                  <XCircle className="h-4 w-4" />
                  إلغاء الطلبية
                </Button>
              )}
              {onResumeOrder && isOrderCancelled && order?.id && (
                <Button
                  className="h-11 flex-1 gap-2"
                  variant="default"
                  onClick={() => setShowResumeConfirm(true)}
                  disabled={isResuming}
                >
                  <RotateCcw className="h-4 w-4" />
                  استئناف المبيعة
                </Button>
              )}
              <Button
                aria-label="طباعة الوصل"
                className="h-11 gap-2 border-0 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                onClick={() => setShowReceiptDialog(true)}
                disabled={orderItemsLoading || isDetailsLoading}
              >
                <Printer className="h-4 w-4" />
              </Button>
              {customer?.phone && (
                <a
                  aria-label="الاتصال بالعميل"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-white transition-colors hover:bg-emerald-700"
                  href={`tel:${customer.phone}`}
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReceiptDialog
        open={showReceiptDialog}
        onOpenChange={setShowReceiptDialog}
        receiptData={receiptData}
      />

      {!hideModifyAction && showModifyDialog && (
        <ModifyOrderDialog
          open={showModifyDialog}
          onOpenChange={(nextOpen) => {
            setShowModifyDialog(nextOpen);
            if (!nextOpen) onOpenChange(false);
          }}
          order={order}
          orderItems={displayItems as (OrderItem & { product?: Product })[]}
        />
      )}

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من إلغاء هذه الطلبية؟</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>سيتم إلغاء الطلبية وإرجاع المخزون إن وُجد. هذا الإجراء لا يمكن التراجع عنه.</p>
                
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="font-bold text-foreground">تفاصيل الإلغاء المالية:</div>
                  
                  <div className="flex justify-between">
                    <span>المبلغ الإجمالي:</span>
                    <span className="font-bold text-foreground">{formatAmountWithMaxFraction(effectiveTotalAmount)} DA</span>
                  </div>

                  {paymentState === 'full' && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2 space-y-1">
                      <div className="font-bold text-blue-700 dark:text-blue-400">💰 دفع كلي</div>
                      <p className="text-xs text-blue-600 dark:text-blue-300">
                        سيتم خصم <span className="font-bold">{formatAmountWithMaxFraction(effectiveTotalAmount)} DA</span> من ذمة العامل (يجب إعادة المبلغ للعميل)
                      </p>
                    </div>
                  )}

                  {paymentState === 'debt' && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2 space-y-1">
                      <div className="font-bold text-red-700 dark:text-red-400">📋 دين كلي</div>
                      <p className="text-xs text-red-600 dark:text-red-300">
                        سيتم إلغاء الدين المرتبط بالطلبية بمبلغ <span className="font-bold">{formatAmountWithMaxFraction(remainingAmount)} DA</span> من حساب العميل
                      </p>
                    </div>
                  )}

                  {paymentState === 'partial' && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 space-y-1">
                      <div className="font-bold text-amber-700 dark:text-amber-400">⚡ دفع جزئي</div>
                      <div className="text-xs text-amber-600 dark:text-amber-300 space-y-1">
                        <p>• خصم <span className="font-bold">{formatAmountWithMaxFraction(paidAmount)} DA</span> من ذمة العامل (يجب إعادته للعميل)</p>
                        <p>• إلغاء الدين المتبقي <span className="font-bold">{formatAmountWithMaxFraction(remainingAmount)} DA</span> من حساب العميل</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!order?.id || !onCancelOrder) return;
                setIsCancelling(true);
                try {
                  await onCancelOrder(order.id);
                  onOpenChange(false);
                } finally {
                  setIsCancelling(false);
                  setShowCancelConfirm(false);
                }
              }}
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الإلغاء'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResumeConfirm} onOpenChange={setShowResumeConfirm}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من استئناف هذه الطلبية؟</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>سيتم استئناف الطلبية الملغاة وإعادة كل شيء كما كان قبل الإلغاء.</p>
                
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                  <div className="font-bold text-foreground">تفاصيل الاستئناف المالية:</div>
                  
                  <div className="flex justify-between">
                    <span>المبلغ الإجمالي:</span>
                    <span className="font-bold text-foreground">{formatAmountWithMaxFraction(effectiveTotalAmount)} DA</span>
                  </div>

                  {paymentState === 'full' && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2 space-y-1">
                      <div className="font-bold text-blue-700 dark:text-blue-400">💰 دفع كلي</div>
                      <p className="text-xs text-blue-600 dark:text-blue-300">
                        سيتم إضافة <span className="font-bold">{formatAmountWithMaxFraction(effectiveTotalAmount)} DA</span> إلى ذمة العامل (لأنه سيسلم المنتجات للعميل)
                      </p>
                    </div>
                  )}

                  {paymentState === 'debt' && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2 space-y-1">
                      <div className="font-bold text-red-700 dark:text-red-400">📋 دين كلي</div>
                      <p className="text-xs text-red-600 dark:text-red-300">
                        سيتم إعادة الدين بمبلغ <span className="font-bold">{formatAmountWithMaxFraction(remainingAmount)} DA</span> على حساب العميل
                      </p>
                    </div>
                  )}

                  {paymentState === 'partial' && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 space-y-1">
                      <div className="font-bold text-amber-700 dark:text-amber-400">⚡ دفع جزئي</div>
                      <div className="text-xs text-amber-600 dark:text-amber-300 space-y-1">
                        <p>• إضافة <span className="font-bold">{formatAmountWithMaxFraction(paidAmount)} DA</span> إلى ذمة العامل</p>
                        <p>• إعادة الدين المتبقي <span className="font-bold">{formatAmountWithMaxFraction(remainingAmount)} DA</span> على حساب العميل</p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-md bg-muted p-2 text-xs">
                    <p>• سيتم خصم المنتجات من رصيد العامل</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!order?.id || !onResumeOrder) return;
                setIsResuming(true);
                try {
                  await onResumeOrder(order.id);
                  onOpenChange(false);
                } finally {
                  setIsResuming(false);
                  setShowResumeConfirm(false);
                }
              }}
            >
              {isResuming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الاستئناف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OrderDetailsDialog;
