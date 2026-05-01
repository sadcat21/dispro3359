import React, { useState, useMemo } from 'react';
import palletImage from '@/assets/pallet.png';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Loader2, AlertTriangle, ArrowRight, TrendingUp, TrendingDown,
  CheckCircle, XCircle, UserMinus, Package, ClipboardCheck, Banknote,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingReviewItems, useApplyManagerDecision, type ReviewItemMeta } from '@/hooks/useWarehouseReviewDecisions';
import { boxesToBP, dbBPToBoxes } from '@/utils/boxPieceInput';
import { toast } from 'sonner';
import ProductReviewDetailsDialog, { ProductReviewDetails } from '@/components/warehouse/ProductReviewDetailsDialog';
import ReviewCardMovementBadge from '@/components/warehouse/ReviewCardMovementBadge';
import { useReviewItemMovements, movementTypeLabel, type MovementRow } from '@/hooks/useReviewItemMovements';
import { format } from 'date-fns';

const fmtPlain = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? r.toString() : r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const fmtQty = (n: number, ppb: number) => (ppb > 1 ? boxesToBP(n, ppb) : fmtPlain(n));

const PendingWarehouseReviews: React.FC = () => {
  const navigate = useNavigate();
  const { activeBranch } = useAuth();
  const { data: items = [], isLoading } = usePendingReviewItems(activeBranch?.id);
  const applyDecision = useApplyManagerDecision();

  const [showDecided, setShowDecided] = useState(false);
  const [reviewItem, setReviewItem] = useState<any | null>(null); // للنافذة الأولى (تعديل الكميات)
  const [dialogItem, setDialogItem] = useState<any | null>(null);
  // الكميات التي عدّلها المدير لكل عنصر (overrides)
  const [overrides, setOverrides] = useState<Record<string, { actual: number; status: 'matched' | 'surplus' | 'deficit'; details: ProductReviewDetails }>>({});
  const [chosenDecision, setChosenDecision] = useState<'accept_surplus' | 'reject_surplus' | 'charge_worker' | 'absorb_deficit' | null>(null);
  const [priceTier, setPriceTier] = useState<'invoice' | 'retail' | 'gros' | 'super_gros'>('invoice');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [managerNotes, setManagerNotes] = useState('');

  const pending = useMemo(() => items.filter(i => i.meta.decision_status === 'pending' || i.meta.decision_status === 'auto_approved'), [items]);

  // جلب المتوقع التالف من warehouse_stock لكل منتجات الفرع — لاحتساب الفجوة على البطاقات
  const productIds = useMemo(
    () => Array.from(new Set(items.map(i => i.product_id).filter(Boolean))) as string[],
    [items]
  );
  const { data: stockMap } = useQuery({
    queryKey: ['warehouse-stock-damaged-map', activeBranch?.id, productIds.join(',')],
    queryFn: async () => {
      if (!activeBranch?.id || productIds.length === 0) return {} as Record<string, number>;
      const { data } = await supabase
        .from('warehouse_stock')
        .select('product_id, damaged_quantity')
        .eq('branch_id', activeBranch.id)
        .in('product_id', productIds);
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.product_id] = Number(r.damaged_quantity || 0); });
      return map;
    },
    enabled: !!activeBranch?.id && productIds.length > 0,
  });

  // المتوقع التالف من warehouse_stock للعنصر المفتوح
  const { data: reviewItemStock } = useQuery({
    queryKey: ['warehouse-stock-damaged', reviewItem?.product_id, reviewItem?.session?.branch_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouse_stock')
        .select('damaged_quantity')
        .eq('branch_id', reviewItem.session.branch_id)
        .eq('product_id', reviewItem.product_id)
        .maybeSingle();
      return data;
    },
    enabled: !!reviewItem?.product_id && !!reviewItem?.session?.branch_id,
  });

  // حركات المنتج بعد المراجعة (شحن/استلام/مرتجعات)
  const { data: reviewItemMovements } = useReviewItemMovements({
    productId: reviewItem?.product_id || null,
    branchId: reviewItem?.session?.branch_id || null,
    sinceIso: reviewItem?.created_at || null,
    piecesPerBox: reviewItem?.product?.pieces_per_box || 1,
    enabled: !!reviewItem,
  });
  const decided = useMemo(() => items.filter(i => i.meta.decision_status !== 'pending' && i.meta.decision_status !== 'auto_approved'), [items]);

  const visible = showDecided ? decided : pending;

  // فتح نافذة مراجعة المنتج (الكميات) — يجب أن تُفتح أولاً قبل القرار
  const openReview = (item: any) => {
    setReviewItem(item);
  };

  // عند حفظ تعديلات الكميات من نافذة المراجعة
  const handleReviewSave = (details: ProductReviewDetails) => {
    if (!reviewItem) return;
    const ppb = reviewItem.product?.pieces_per_box || 1;
    const expected = Number(reviewItem.expected_quantity || 0);
    // الإجمالي = الصالح + التالف بالصناديق الكسرية
    const totalPieces = (details.boxes * ppb + details.pieces) + ((details.damagedBoxes || 0) * ppb + (details.damagedPieces || 0));
    const newActual = ppb > 1 ? totalPieces / ppb : totalPieces;
    const diff = newActual - expected;
    const newStatus: 'matched' | 'surplus' | 'deficit' =
      Math.abs(diff) < 0.001 ? 'matched' : diff > 0 ? 'surplus' : 'deficit';

    setOverrides(prev => ({
      ...prev,
      [reviewItem.id]: { actual: newActual, status: newStatus, details },
    }));

    // نُغلق نافذة المراجعة ونفتح نافذة القرار بناءً على الحالة الجديدة
    const updatedItem = { ...reviewItem, actual_quantity: newActual, status: newStatus };
    setReviewItem(null);

    if (newStatus === 'matched') {
      // مطابق → نعتمد المنتج تلقائياً
      applyMatched(updatedItem, details);
    } else {
      openDecisionDialog(updatedItem);
    }
  };

  const applyMatched = async (item: any, details: ProductReviewDetails) => {
    const ppb = item.product?.pieces_per_box || 1;
    const newActual = Number(item.actual_quantity || 0);
    const newStockQty = item.item_type === 'product'
      ? (ppb > 1 ? parseFloat(boxesToBP(newActual, ppb)) : newActual)
      : null;
    try {
      await applyDecision.mutateAsync({
        itemId: item.id,
        productId: item.product_id,
        itemType: item.item_type,
        currentMeta: item.meta as ReviewItemMeta,
        decision: 'absorb_deficit', // أي قرار غير reject — نستعمله كـ "موافق"
        managerNotes: 'تمت المراجعة — مطابق بعد إعادة العد',
        branchId: item.session?.branch_id || activeBranch?.id || null,
        newStockQty,
        newActualQuantity: newActual,
        newStatus: 'matched',
        newBoxesQuantity: details.boxes,
        newPiecesQuantity: details.pieces,
        newDamagedQuantity: details.damaged,
      });
      toast.success('تم اعتماد المنتج كمطابق ✅');
    } catch (err: any) {
      toast.error(err.message || 'فشل الحفظ');
    }
  };

  const getProductTierPrice = (product: any, tier: 'invoice' | 'retail' | 'gros' | 'super_gros'): number => {
    if (!product) return 0;
    const map: Record<string, number> = {
      invoice: Number(product.price_invoice || 0),
      retail: Number(product.price_retail || 0),
      gros: Number(product.price_gros || 0),
      super_gros: Number(product.price_super_gros || 0),
    };
    return map[tier] || 0;
  };

  // تُحسب على ضوء نوع التسعير المعرَّف في إدارة المنتجات (pricing_unit)
  const computePrices = (product: any, unitPriceVal: number) => {
    const ppb = Math.max(1, Number(product?.pieces_per_box || 1));
    const weightPerBox = Number(product?.weight_per_box || 0);
    const basis: 'box' | 'kg' | 'unit' = (product?.pricing_unit === 'kg' || product?.pricing_unit === 'unit') ? product.pricing_unit : 'box';
    let boxPrice = unitPriceVal;
    if (basis === 'kg' && weightPerBox > 0) {
      boxPrice = unitPriceVal * weightPerBox; // سعر/كغ × عدد الكغ في الصندوق
    } else if (basis === 'unit') {
      boxPrice = unitPriceVal * ppb; // سعر/قطعة × عدد القطع في الصندوق
    }
    const piecePrice = ppb > 0 ? boxPrice / ppb : boxPrice;
    return { boxPrice, piecePrice, ppb, weightPerBox, basis };
  };

  const openDecisionDialog = (item: any) => {
    setDialogItem(item);
    setChosenDecision(null);
    setManagerNotes('');
    const product = item.product;
    const defaultTier: 'invoice' | 'retail' | 'gros' | 'super_gros' =
      product?.price_invoice ? 'invoice' :
      product?.price_gros ? 'gros' :
      product?.price_super_gros ? 'super_gros' : 'retail';
    setPriceTier(defaultTier);
    setUnitPrice(String(getProductTierPrice(product, defaultTier)));
  };

  const closeDialog = () => {
    setDialogItem(null);
    setChosenDecision(null);
    setManagerNotes('');
    setUnitPrice('');
  };

  const handleConfirm = async () => {
    if (!dialogItem || !chosenDecision) return;

    const ppb = dialogItem.product?.pieces_per_box || 1;
    const itemType = dialogItem.item_type;
    const expected = Number(dialogItem.expected_quantity || 0);
    const actual = Number(dialogItem.actual_quantity || 0);
    const diffBoxes = actual - expected;
    const override = overrides[dialogItem.id];

    let newStockQty: number | null = null;
    if (itemType === 'product') {
      const actualForDb = ppb > 1 ? parseFloat(boxesToBP(actual, ppb)) : actual;
      newStockQty = actualForDb;
    }

    let debtAmount = 0;
    if (chosenDecision === 'charge_worker') {
      const unitPriceVal = parseFloat(unitPrice) || 0;
      const { boxPrice, piecePrice } = computePrices(dialogItem.product, unitPriceVal);
      const deficitTotalBoxes = Math.abs(diffBoxes); // كسري بالصناديق
      const totalPiecesDiff = Math.round(deficitTotalBoxes * ppb);
      const fullBoxes = Math.floor(totalPiecesDiff / ppb);
      const remPieces = totalPiecesDiff % ppb;
      debtAmount = fullBoxes * boxPrice + remPieces * piecePrice;
      if (debtAmount <= 0) {
        toast.error('أدخل سعر الوحدة لاحتساب قيمة الدين');
        return;
      }
    }

    try {
      await applyDecision.mutateAsync({
        itemId: dialogItem.id,
        productId: dialogItem.product_id,
        itemType,
        currentMeta: dialogItem.meta as ReviewItemMeta,
        decision: chosenDecision,
        managerNotes,
        reviewerWorkerId: dialogItem.meta.reviewer_worker_id || dialogItem.session?.reviewer_id || null,
        debtAmount,
        debtDescription: `عجز في مراجعة المخزون - ${dialogItem.product?.name || dialogItem.item_type} (${fmtQty(Math.abs(diffBoxes), ppb)})`,
        branchId: dialogItem.session?.branch_id || activeBranch?.id || null,
        newStockQty,
        // إذا كان هناك override، نحدّث الكميات في DB
        newActualQuantity: override ? override.actual : null,
        newStatus: override ? override.status : null,
        newBoxesQuantity: override ? override.details.boxes : null,
        newPiecesQuantity: override ? override.details.pieces : null,
        newDamagedQuantity: override ? override.details.damaged : null,
      });
      toast.success('تم تطبيق القرار بنجاح');
      closeDialog();
    } catch (err: any) {
      toast.error(err.message || 'فشل تطبيق القرار');
    }
  };

  const renderDecisionBadge = (meta: ReviewItemMeta) => {
    if (meta.decision_status === 'approved') {
      return <Badge className="bg-green-600 text-white text-[10px] gap-1"><CheckCircle className="w-3 h-3" />موافق عليه</Badge>;
    }
    if (meta.decision_status === 'rejected') {
      return <Badge className="bg-slate-500 text-white text-[10px] gap-1"><XCircle className="w-3 h-3" />مرفوض</Badge>;
    }
    if (meta.decision_status === 'charged_to_worker') {
      return <Badge className="bg-destructive text-destructive-foreground text-[10px] gap-1"><Banknote className="w-3 h-3" />خُصم على المسؤول</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] gap-1"><AlertTriangle className="w-3 h-3" />معلّق</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-20 min-h-screen bg-muted/20 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            المراجعات المعلقة
          </h2>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={showDecided ? 'default' : 'outline'}
              onClick={() => setShowDecided(s => !s)}
              className="h-8 px-2 gap-1 text-xs"
            >
              {showDecided ? `المعلّقة (${pending.length})` : `المُقرّرة (${decided.length})`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate(-1)} className="h-8 px-2">
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px]">معلّق: {pending.length}</Badge>
          <Badge variant="secondary" className="text-[10px]">مُقرّر: {decided.length}</Badge>
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-3 space-y-2">
        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              {showDecided ? 'لا توجد قرارات بعد' : 'لا توجد بنود للمراجعة 🎉'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {visible.map((item: any) => {
              const ppb = item.product?.pieces_per_box || 1;
              const expected = Number(item.expected_quantity || 0);
              const actual = Number(item.actual_quantity || 0);
              const meta: ReviewItemMeta = item.meta;
              const isDecided = meta.decision_status !== 'pending' && meta.decision_status !== 'auto_approved';
              const imgUrl = item.item_type === 'pallet'
                ? palletImage
                : (item.product?.image_url as string | undefined);
              const displayName = getProductDisplayName(item.product) || '—';
              const productName =
                item.item_type === 'pallet' ? 'الباليطات' :
                item.item_type === 'damaged' ? `${displayName} (تالف)` :
                displayName;

              // فصل فجوة الصالح عن فجوة التالف
              const expectedDamaged = item.product_id ? dbBPToBoxes(Number(stockMap?.[item.product_id] || 0), ppb) : 0;
              const expectedGood = Math.max(0, expected - expectedDamaged);
              const actualDamagedRaw = Number(item.damaged_quantity || 0); // مخزّن بصيغة BP عشرية
              const actualDamaged = ppb > 1 ? dbBPToBoxes(actualDamagedRaw, ppb) : actualDamagedRaw;
              const actualGood = Math.max(0, actual - actualDamaged);

              const goodDiff = actualGood - expectedGood;
              const damagedDiff = actualDamaged - expectedDamaged;
              const hasGoodGap = Math.abs(goodDiff) >= 0.01;
              const hasDamagedGap = Math.abs(damagedDiff) >= 0.01;
              const hasGap = hasGoodGap || hasDamagedGap;
              const isMatched = !hasGap;

              const borderClass = isMatched
                ? 'border-green-500 bg-green-50/40 dark:bg-green-950/10'
                : 'border-destructive bg-destructive/5';

              const statusBadge = isMatched
                ? <Badge className="absolute top-1.5 start-1.5 text-[10px] bg-green-600 text-white shadow">مطابق</Badge>
                : <Badge className="absolute top-1.5 start-1.5 text-[10px] bg-destructive text-destructive-foreground shadow gap-1">
                    <AlertTriangle className="w-3 h-3" />فجوة
                  </Badge>;

              const clickable = !isDecided && item.item_type === 'product';
              return (
                <div
                  key={item.id}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => openReview(item) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReview(item); } } : undefined}
                  className={`relative rounded-xl overflow-hidden border-4 flex flex-col ${borderClass} ${clickable ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-transform' : ''}`}
                >
                  <div className="relative h-20 sm:h-24 md:aspect-square bg-muted flex items-center justify-center overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={productName} className="w-full h-full object-contain p-1" loading="lazy" />
                    ) : (
                      <Package className="w-10 h-10 text-muted-foreground/50" />
                    )}
                    {statusBadge}
                    {item.item_type === 'product' && !isDecided && (
                      <ReviewCardMovementBadge
                        productId={item.product_id}
                        branchId={item.session?.branch_id || null}
                        sinceIso={item.created_at}
                        piecesPerBox={ppb}
                      />
                    )}
                    {hasGap && (
                      <div className="absolute bottom-1.5 end-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold shadow bg-destructive text-destructive-foreground">
                        فجوة
                      </div>
                    )}
                  </div>

                  <div className="p-2 space-y-1.5 flex-1 flex flex-col">
                    <p className="text-[12px] font-bold leading-tight line-clamp-2 min-h-[30px] text-center">
                      {productName}
                    </p>

                    {isMatched ? (
                      <Badge className="w-full text-[12px] px-2 py-1 font-bold justify-center bg-green-600 text-white border-0">
                        مطابق: {fmtQty(expected, ppb)}
                      </Badge>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {hasGoodGap && (
                          <Badge className="text-[10px] px-2 py-1 font-bold justify-center border-0 bg-destructive text-destructive-foreground">
                            صالح: {goodDiff > 0 ? '+' : ''}{fmtQty(Math.abs(goodDiff), ppb)}
                          </Badge>
                        )}
                        {hasDamagedGap && (
                          <Badge className="text-[10px] px-2 py-1 font-bold justify-center border-0 bg-destructive/80 text-destructive-foreground">
                            تالف: {damagedDiff > 0 ? '+' : ''}{fmtQty(Math.abs(damagedDiff), ppb)}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="text-[9px] text-muted-foreground text-center">
                      {item.session?.created_at ? format(new Date(item.session.created_at), 'dd/MM HH:mm') : ''}
                      {' • '}
                      {item.session?.reviewer?.full_name || '—'}
                    </div>

                    {isDecided ? (
                      <div className="flex justify-center mt-auto">
                        {renderDecisionBadge(meta)}
                      </div>
                    ) : null}

                    {overrides[item.id] && !isDecided && (
                      <div className="text-[9px] bg-primary/10 border border-primary/30 rounded p-1 text-center">
                        ✓ كمية جديدة: <b>{fmtQty(overrides[item.id].actual, ppb)}</b>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decision Dialog */}
      <Dialog open={!!dialogItem} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              قرار المدير
            </DialogTitle>
            <DialogDescription>
              {dialogItem?.item_type === 'pallet' ? 'الباليطات' : getProductDisplayName(dialogItem?.product)}
            </DialogDescription>
          </DialogHeader>

          {dialogItem && (() => {
            const isSurplus = dialogItem.status === 'surplus';
            const ppb = dialogItem.product?.pieces_per_box || 1;
            const diff = Math.abs(Number(dialogItem.actual_quantity) - Number(dialogItem.expected_quantity));
            return (
              <div className="space-y-3">
                <div className={`rounded-lg p-2.5 text-center text-sm ${isSurplus ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <span className="font-semibold">
                    {isSurplus ? 'فائض' : 'عجز'}: {fmtQty(diff, ppb)}
                  </span>
                </div>

                {isSurplus ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={chosenDecision === 'accept_surplus' ? 'default' : 'outline'}
                      onClick={() => setChosenDecision('accept_surplus')}
                      className="h-auto py-3 flex-col gap-1"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-xs">قبول الفائض</span>
                      <span className="text-[9px] text-muted-foreground">يُضاف للمخزون</span>
                    </Button>
                    <Button
                      variant={chosenDecision === 'reject_surplus' ? 'default' : 'outline'}
                      onClick={() => setChosenDecision('reject_surplus')}
                      className="h-auto py-3 flex-col gap-1"
                    >
                      <XCircle className="w-5 h-5" />
                      <span className="text-xs">رفض الفائض</span>
                      <span className="text-[9px] text-muted-foreground">يبقى المتوقع</span>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={chosenDecision === 'charge_worker' ? 'default' : 'outline'}
                      onClick={() => setChosenDecision('charge_worker')}
                      className="h-auto py-3 flex-col gap-1"
                    >
                      <UserMinus className="w-5 h-5" />
                      <span className="text-xs">خصم على المسؤول</span>
                      <span className="text-[9px] text-muted-foreground">يُسجَّل كدين</span>
                    </Button>
                    <Button
                      variant={chosenDecision === 'absorb_deficit' ? 'default' : 'outline'}
                      onClick={() => setChosenDecision('absorb_deficit')}
                      className="h-auto py-3 flex-col gap-1"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-xs">تحمّل العجز</span>
                      <span className="text-[9px] text-muted-foreground">قبول النقص</span>
                    </Button>
                  </div>
                )}

                {chosenDecision === 'charge_worker' && (() => {
                  const product = dialogItem.product;
                  const unitPriceVal = parseFloat(unitPrice) || 0;
                  const { boxPrice, piecePrice, ppb: pp, weightPerBox, basis } = computePrices(product, unitPriceVal);
                  const totalPiecesDiff = Math.round(diff * pp);
                  const fullBoxes = Math.floor(totalPiecesDiff / pp);
                  const remPieces = totalPiecesDiff % pp;
                  const debt = fullBoxes * boxPrice + remPieces * piecePrice;
                  const unitLabel = basis === 'kg' ? 'الكيلوغرام' : basis === 'unit' ? 'القطعة' : 'الصندوق';
                  const unitsPerBox = basis === 'kg' ? weightPerBox : basis === 'unit' ? pp : 1;
                  const unitsLabel = basis === 'kg' ? 'كغ' : basis === 'unit' ? 'قطعة' : 'صندوق';

                  const tiers: Array<{ key: 'invoice' | 'retail' | 'gros' | 'super_gros'; label: string }> = [
                    { key: 'invoice', label: 'الفاتورة' },
                    { key: 'retail', label: 'التجزئة' },
                    { key: 'gros', label: 'الجملة' },
                    { key: 'super_gros', label: 'سوبر جملة' },
                  ];

                  const basisLabelFull = basis === 'kg' ? 'كيلوغرام (kg)' : basis === 'unit' ? 'قطعة (unit)' : 'صندوق (box)';

                  return (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs mb-1 block">طريقة احتساب السعر الأساسي</Label>
                        <div className="grid grid-cols-4 gap-1">
                          {tiers.map(t => {
                            const p = getProductTierPrice(product, t.key);
                            const active = priceTier === t.key;
                            return (
                              <button
                                key={t.key}
                                type="button"
                                disabled={p <= 0}
                                onClick={() => { setPriceTier(t.key); setUnitPrice(String(p)); }}
                                className={`text-[10px] py-1.5 px-1 rounded border transition ${
                                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                              >
                                <div className="font-bold">{t.label}</div>
                                <div className="text-[9px] opacity-80">{p > 0 ? p.toFixed(2) : '—'}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-muted/60 rounded p-2 text-[11px] space-y-0.5">
                        <div>عدد {unitsLabel === 'صندوق' ? 'القطع' : unitsLabel} في الصندوق: <b>{unitsPerBox || pp}</b></div>
                        {basis !== 'box' && (
                          <div className="text-[10px] text-muted-foreground">
                            سعر الصندوق = {unitPriceVal.toFixed(2)} × {unitsPerBox} = <b>{boxPrice.toFixed(2)}</b>
                          </div>
                        )}
                        <div>سعر الصندوق: <b>{boxPrice.toFixed(2)}</b></div>
                        <div>سعر القطعة: <b>{piecePrice.toFixed(2)}</b> (= {boxPrice.toFixed(2)} ÷ {pp})</div>
                        <div className="pt-1 border-t mt-1">
                          الفرق: <b>{fullBoxes}</b> صندوق + <b>{remPieces}</b> قطعة
                        </div>
                        <div>
                          الاحتساب: {fullBoxes} × {boxPrice.toFixed(2)} + {remPieces} × {piecePrice.toFixed(2)}
                        </div>
                        <div className="text-sm pt-1">
                          قيمة الدين: <b className="text-destructive">{debt.toFixed(2)}</b>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-1.5">
                  <Label className="text-xs">ملاحظة (اختياري)</Label>
                  <Textarea
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeDialog} disabled={applyDecision.isPending}>
              إلغاء
            </Button>
            <Button onClick={handleConfirm} disabled={!chosenDecision || applyDecision.isPending}>
              {applyDecision.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              تأكيد القرار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة مراجعة كميات المنتج (للمدير) — مطابقة لنافذة مسؤول المخزن */}
      {reviewItem && (
        <ProductReviewDetailsDialog
          open={!!reviewItem}
          onOpenChange={(o) => { if (!o) setReviewItem(null); }}
          productName={reviewItem.product?.name || '—'}
          imageUrl={reviewItem.product?.image_url}
          piecesPerBox={reviewItem.product?.pieces_per_box || 1}
          expected={Number(reviewItem.expected_quantity || 0)}
          expectedDamaged={dbBPToBoxes(Number((reviewItemStock as any)?.damaged_quantity || 0), reviewItem.product?.pieces_per_box || 1)}
          movementsNetChange={reviewItemMovements?.netChange || 0}
          movements={reviewItemMovements?.rows || []}
          movementTypeLabel={movementTypeLabel}
          initial={overrides[reviewItem.id]?.details}
          reviewerName={reviewItem.session?.reviewer?.full_name || undefined}
          reviewerValues={(() => {
            const ppb = Math.max(1, reviewItem.product?.pieces_per_box || 1);
            const dmgFrac = Number(reviewItem.damaged_quantity || 0);
            const dmgPiecesTotal = Math.round(dmgFrac * ppb);
            return {
              goodBoxes: Number(reviewItem.boxes_quantity || 0),
              goodPieces: Number(reviewItem.pieces_quantity || 0),
              damagedBoxes: Math.floor(dmgPiecesTotal / ppb),
              damagedPieces: dmgPiecesTotal % ppb,
            };
          })()}
          onSave={handleReviewSave}
        />
      )}
    </div>
  );
};

export default PendingWarehouseReviews;
