import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [priceBasis, setPriceBasis] = useState<'box' | 'kg' | 'unit'>('box'); // ما يمثله السعر المُدخل
  const [weightPerBoxInput, setWeightPerBoxInput] = useState<string>(''); // الوزن لكل صندوق (يدوي إن لم يتوفر)
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [managerNotes, setManagerNotes] = useState('');

  const pending = useMemo(() => items.filter(i => i.meta.decision_status === 'pending'), [items]);
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
      // مطابق → نطبّق القرار تلقائياً (لا حاجة لاختيار)
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

  // يحوّل سعر الوحدة (حسب pricing_unit) إلى سعر الصندوق وسعر القطعة
  const computePrices = (product: any, unitPriceVal: number) => {
    const ppb = Math.max(1, Number(product?.pieces_per_box || 1));
    const pricingUnit = product?.pricing_unit || 'box';
    const weightPerBox = Number(product?.weight_per_box || 0);
    let boxPrice = unitPriceVal;
    if (pricingUnit === 'kg' && weightPerBox > 0) {
      boxPrice = unitPriceVal * weightPerBox; // سعر/كغ × كغ/صندوق
    } else if (pricingUnit === 'unit') {
      boxPrice = unitPriceVal * ppb; // سعر/قطعة × قطعة/صندوق
    }
    const piecePrice = ppb > 0 ? boxPrice / ppb : boxPrice;
    return { boxPrice, piecePrice, ppb, pricingUnit, weightPerBox };
  };

  const openDecisionDialog = (item: any) => {
    setDialogItem(item);
    setChosenDecision(null);
    setManagerNotes('');
    const product = item.product;
    // افتراضي: سعر الفاتورة إن وُجد، وإلا الجملة
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

      <div className="px-4 pt-3 space-y-2">
        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              {showDecided ? 'لا توجد قرارات بعد' : 'لا توجد فوارق معلّقة 🎉'}
            </CardContent>
          </Card>
        ) : (
          visible.map((item: any) => {
            const isSurplus = item.status === 'surplus';
            const ppb = item.product?.pieces_per_box || 1;
            const expected = Number(item.expected_quantity || 0);
            const actual = Number(item.actual_quantity || 0);
            const diff = Math.abs(actual - expected);
            const meta: ReviewItemMeta = item.meta;
            const isDecided = meta.decision_status !== 'pending';

            const itemLabel =
              item.item_type === 'pallet' ? '🪵 الباليطات' :
              item.item_type === 'damaged' ? `${item.product?.name || '—'} (تالف)` :
              item.product?.name || '—';

            return (
              <Card
                key={item.id}
                className={`border ${
                  isSurplus
                    ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10'
                    : 'border-destructive/40 bg-destructive/5'
                }`}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isSurplus
                        ? <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
                        : <TrendingDown className="w-4 h-4 text-destructive shrink-0" />}
                      <span className="text-sm font-semibold truncate">{itemLabel}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge className={`text-[10px] ${isSurplus ? 'bg-amber-500 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                        {isSurplus ? 'فائض' : 'عجز'}
                      </Badge>
                      {renderDecisionBadge(meta)}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="bg-muted/60 rounded px-2 py-1">
                      <div className="text-[9px] text-muted-foreground">المتوقع</div>
                      <div className="font-bold">{fmtQty(expected, ppb)}</div>
                    </div>
                    <div className="bg-muted/60 rounded px-2 py-1">
                      <div className="text-[9px] text-muted-foreground">الفعلي</div>
                      <div className="font-bold">{fmtQty(actual, ppb)}</div>
                    </div>
                    <div className={`rounded px-2 py-1 ${isSurplus ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                      <div className="text-[9px] text-muted-foreground">الفرق</div>
                      <div className={`font-extrabold ${isSurplus ? 'text-amber-700' : 'text-destructive'}`}>
                        {isSurplus ? '+' : '-'}{fmtQty(diff, ppb)}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>المراجع: {item.session?.reviewer?.full_name || '—'}</span>
                    <span>{item.session?.created_at ? format(new Date(item.session.created_at), 'dd/MM HH:mm') : ''}</span>
                  </div>

                  {isDecided && meta.manager_notes && (
                    <div className="text-[11px] bg-card border rounded p-2">
                      <span className="text-muted-foreground">ملاحظة المدير: </span>
                      <span>{meta.manager_notes}</span>
                    </div>
                  )}
                  {isDecided && meta.manager_decision_by_name && (
                    <div className="text-[10px] text-muted-foreground">
                      قرار: {meta.manager_decision_by_name}
                      {meta.manager_decision_at && ` • ${format(new Date(meta.manager_decision_at), 'dd/MM HH:mm')}`}
                    </div>
                  )}

                  {!isDecided && (
                    <div className="space-y-1.5">
                      {overrides[item.id] && (
                        <div className="text-[10px] bg-primary/10 border border-primary/30 rounded p-1.5 text-center">
                          ✓ تمت إعادة المراجعة — الكمية الجديدة: <b>{fmtQty(overrides[item.id].actual, ppb)}</b>
                          {' '}({overrides[item.id].status === 'matched' ? 'مطابق' : overrides[item.id].status === 'surplus' ? 'فائض' : 'عجز'})
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReview(item)}
                        disabled={item.item_type !== 'product'}
                        className="w-full gap-1 h-9 text-xs"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        مراجعة كميات المنتج
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openDecisionDialog(item)}
                        disabled={item.item_type === 'product' && !overrides[item.id]}
                        className="w-full gap-1 h-9 text-xs"
                      >
                        اتخاذ قرار
                      </Button>
                      {item.item_type === 'product' && !overrides[item.id] && (
                        <p className="text-[9px] text-muted-foreground text-center">
                          يجب أولاً مراجعة كميات المنتج قبل اتخاذ القرار
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
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
              {dialogItem?.item_type === 'pallet' ? 'الباليطات' : dialogItem?.product?.name}
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
                  const { boxPrice, piecePrice, ppb: pp, pricingUnit, weightPerBox } = computePrices(product, unitPriceVal);
                  const totalPiecesDiff = Math.round(diff * pp);
                  const fullBoxes = Math.floor(totalPiecesDiff / pp);
                  const remPieces = totalPiecesDiff % pp;
                  const debt = fullBoxes * boxPrice + remPieces * piecePrice;
                  const unitLabel = pricingUnit === 'kg' ? 'الكيلوغرام' : pricingUnit === 'unit' ? 'القطعة' : 'الصندوق';

                  const tiers: Array<{ key: 'invoice' | 'retail' | 'gros' | 'super_gros'; label: string }> = [
                    { key: 'invoice', label: 'الفاتورة' },
                    { key: 'retail', label: 'التجزئة' },
                    { key: 'gros', label: 'الجملة' },
                    { key: 'super_gros', label: 'سوبر جملة' },
                  ];

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

                      <div className="space-y-1">
                        <Label className="text-xs">سعر الوحدة ({unitLabel})</Label>
                        <Input
                          type="number"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="bg-muted/60 rounded p-2 text-[11px] space-y-0.5">
                        {pricingUnit === 'kg' && weightPerBox > 0 && (
                          <div>الوزن لكل صندوق: <b>{weightPerBox}</b> كغ</div>
                        )}
                        <div>عدد القطع في الصندوق: <b>{pp}</b></div>
                        <div>سعر الصندوق: <b>{boxPrice.toFixed(2)}</b></div>
                        <div>سعر القطعة: <b>{piecePrice.toFixed(2)}</b></div>
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
          initial={overrides[reviewItem.id]?.details}
          onSave={handleReviewSave}
        />
      )}
    </div>
  );
};

export default PendingWarehouseReviews;
