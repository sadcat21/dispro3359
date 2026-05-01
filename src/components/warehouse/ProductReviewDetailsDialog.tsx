import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle, Save, CheckCircle2 } from 'lucide-react';
import { boxesToBP } from '@/utils/boxPieceInput';

export interface ProductReviewDetails {
  /** صناديق صالحة كاملة (بعد التطبيع) */
  boxes: number;
  /** قطع صالحة متبقية (< piecesPerBox) */
  pieces: number;
  /** غير مستخدم — أُزيل (للتوافق فقط) */
  hall: number;
  /** إجمالي التالف بالصناديق الكسرية للحفظ */
  damaged: number;
  /** صناديق التالف */
  damagedBoxes?: number;
  /** قطع التالف */
  damagedPieces?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  imageUrl?: string | null;
  piecesPerBox: number;
  expected: number; // متوقع الإجمالي بالصناديق (كسري)
  /** المتوقع التالف من قاعدة البيانات (بالصناديق الكسرية) */
  expectedDamaged?: number;
  initial?: ProductReviewDetails;
  /** قيم مسؤول المخزن — لتظهر للمدير كاشارة أسفل كل حقل */
  reviewerValues?: { goodBoxes?: number; goodPieces?: number; damagedBoxes?: number; damagedPieces?: number };
  reviewerName?: string;
  /** صافي حركة المنتج بعد المراجعة (موجب = دخول، سالب = خروج) بالصناديق الكسرية */
  movementsNetChange?: number;
  /** قائمة الحركات للعرض */
  movements?: Array<{ id: string; movement_type: string; sign: 1 | -1; qtyBoxes: number; created_at: string; notes?: string | null }>;
  /** ترجمة نوع الحركة */
  movementTypeLabel?: (t: string) => string;
  onSave: (details: ProductReviewDetails) => void;
}

const sanitizeInt = (v: string): string => v.replace(/[^0-9]/g, '');

export const ProductReviewDetailsDialog: React.FC<Props> = ({
  open, onOpenChange, productName, imageUrl, piecesPerBox, expected, expectedDamaged = 0,
  initial, reviewerValues, reviewerName,
  movementsNetChange = 0, movements = [], movementTypeLabel: getMoveLabel,
  onSave,
}) => {
  const ppb = Math.max(1, piecesPerBox || 1);

  const [goodBoxes, setGoodBoxes] = useState('');
  const [goodPieces, setGoodPieces] = useState('');
  const [damagedBoxes, setDamagedBoxes] = useState('');
  const [damagedPieces, setDamagedPieces] = useState('');

  useEffect(() => {
    if (open) {
      setGoodBoxes(initial?.boxes ? String(initial.boxes) : '');
      setGoodPieces(initial?.pieces ? String(initial.pieces) : '');
      setDamagedBoxes(initial?.damagedBoxes ? String(initial.damagedBoxes) : '');
      setDamagedPieces(initial?.damagedPieces ? String(initial.damagedPieces) : '');
    }
  }, [open, initial]);

  const normalize = (boxes: string, pieces: string) => {
    const b = Math.max(0, parseInt(boxes) || 0);
    const p = Math.max(0, parseInt(pieces) || 0);
    const extraBoxes = Math.floor(p / ppb);
    const remainingPieces = p % ppb;
    const totalBoxes = b + extraBoxes;
    return { boxes: totalBoxes, pieces: remainingPieces, totalBoxes: totalBoxes + remainingPieces / ppb };
  };

  const applyNormalizedValues = (
    boxes: string,
    pieces: string,
    setBoxes: React.Dispatch<React.SetStateAction<string>>,
    setPieces: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (boxes === '' && pieces === '') return;
    const normalized = normalize(boxes, pieces);
    setBoxes(normalized.boxes > 0 ? String(normalized.boxes) : '');
    setPieces(normalized.pieces > 0 ? String(normalized.pieces) : '');
  };

  const goodParsed = useMemo(() => normalize(goodBoxes, goodPieces), [goodBoxes, goodPieces, ppb]);
  const damagedParsed = useMemo(() => normalize(damagedBoxes, damagedPieces), [damagedBoxes, damagedPieces, ppb]);

  const formatBPFromParts = (boxes: number, pieces: number): string => {
    if (pieces === 0) return String(boxes);
    return `${boxes}.${String(pieces).padStart(2, '0')}`;
  };

  const grandTotal = goodParsed.totalBoxes + damagedParsed.totalBoxes;
  const totalPiecesCombined = (goodParsed.boxes * ppb + goodParsed.pieces) + (damagedParsed.boxes * ppb + damagedParsed.pieces);
  const totalCombinedBoxes = Math.floor(totalPiecesCombined / ppb);
  const totalCombinedPieces = totalPiecesCombined % ppb;
  const diff = grandTotal - expected;

  // المتوقع الصالح بعد الحركة
  const expectedGoodAdjusted = Math.max(0, expected - expectedDamaged + (movementsNetChange || 0));
  // فجوة منفصلة للصالح والتالف
  const goodDiff = goodParsed.totalBoxes - expectedGoodAdjusted;
  const damagedDiff = damagedParsed.totalBoxes - expectedDamaged;
  const hasGoodGap = Math.abs(goodDiff) >= 0.01;
  const hasDamagedGap = Math.abs(damagedDiff) >= 0.01;
  const isMatch = !hasGoodGap && !hasDamagedGap && grandTotal > 0;
  const isSurplus = diff > 0.01;
  const hasInput = grandTotal > 0;

  const sectionStyles = {
    good: {
      container: !hasGoodGap && hasInput ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20'
        : goodDiff > 0 ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-950/20'
        : 'border-primary/30 bg-primary/5',
      icon: !hasGoodGap && hasInput ? 'text-green-600' : goodDiff > 0 ? 'text-amber-600' : 'text-primary',
      title: !hasGoodGap && hasInput ? 'text-green-700 dark:text-green-400' : goodDiff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-primary',
      border: !hasGoodGap && hasInput ? 'border-green-300/40' : goodDiff > 0 ? 'border-amber-300/40' : 'border-primary/20',
      value: !hasGoodGap && hasInput ? 'text-green-600' : goodDiff > 0 ? 'text-amber-600' : 'text-primary',
    },
    damaged: {
      container: !hasDamagedGap && hasInput ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20'
        : damagedDiff > 0 ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-950/20'
        : 'border-destructive/30 bg-destructive/5',
      icon: !hasDamagedGap && hasInput ? 'text-green-600' : damagedDiff > 0 ? 'text-amber-600' : 'text-destructive',
      title: !hasDamagedGap && hasInput ? 'text-green-700 dark:text-green-400' : damagedDiff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive',
      border: !hasDamagedGap && hasInput ? 'border-green-300/40' : damagedDiff > 0 ? 'border-amber-300/40' : 'border-destructive/20',
      value: !hasDamagedGap && hasInput ? 'text-green-600' : damagedDiff > 0 ? 'text-amber-600' : 'text-destructive',
    },
  };

  // حساب الفجوة بالصناديق والقطع لكل قسم
  const partsOf = (val: number) => {
    const total = Math.round(Math.abs(val) * ppb);
    return { boxes: Math.floor(total / ppb), pieces: total % ppb };
  };
  const goodGapParts = partsOf(goodDiff);
  const damagedGapParts = partsOf(damagedDiff);

  // (للتوافق مع ملخص الإجمالي الكلي)
  const diffAbs = Math.abs(diff);
  const diffTotalPieces = Math.round(diffAbs * ppb);
  const diffBoxes = Math.floor(diffTotalPieces / ppb);
  const diffPieces = diffTotalPieces % ppb;

  const handleSave = () => {
    onSave({
      boxes: goodParsed.boxes,
      pieces: goodParsed.pieces,
      hall: 0,
      damaged: damagedParsed.totalBoxes,
      damagedBoxes: damagedParsed.boxes,
      damagedPieces: damagedParsed.pieces,
    });
    onOpenChange(false);
  };

  const ReviewerHint: React.FC<{ value?: number }> = ({ value }) => {
    if (!reviewerValues) return null;
    return (
      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
        <span className="opacity-70">المخزني:</span>
        <span className="font-bold text-foreground">{value ?? 0}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-md max-h-[92dvh] overflow-hidden flex flex-col p-0" dir="rtl">
        <DialogHeader>
           <div className="px-4 pt-4 pb-2 border-b border-border space-y-2">
             <DialogTitle className="flex items-start gap-2">
              {imageUrl ? (
                 <img src={imageUrl} alt="" className="w-9 h-9 rounded-md object-cover border shrink-0" />
              ) : (
                 <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                   <Package className="w-4 h-4 text-primary" />
                </div>
              )}
               <div className="min-w-0 flex-1 space-y-1">
                 <span className="block truncate text-right text-sm">{productName}</span>
                 <div className="flex flex-wrap items-center justify-end gap-1.5">
                   <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5">
                    المتوقع: {boxesToBP(expected, ppb)}
                  </Badge>
                   <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5">
                    {ppb} قطعة / صندوق
                  </Badge>
                  {reviewerName && (
                    <Badge className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                      مدخلات: {reviewerName}
                    </Badge>
                  )}
                </div>
              </div>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="space-y-2">

            {/* ============ لوحة الحركة منذ المراجعة ============ */}
            {movements.length > 0 && (
              <div className="rounded-lg border-2 border-blue-500/40 bg-blue-50 dark:bg-blue-950/20 p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-blue-700 dark:text-blue-300">
                    🔄 حركة على المنتج بعد مراجعة المخزن
                  </h3>
                  <Badge className={`text-[10px] font-bold px-1.5 py-0.5 border-0 ${
                    movementsNetChange > 0 ? 'bg-green-600 text-white' : movementsNetChange < 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    صافي: {movementsNetChange > 0 ? '+' : ''}{boxesToBP(Math.abs(movementsNetChange), ppb)}
                  </Badge>
                </div>
                <div className="space-y-0.5 max-h-28 overflow-y-auto">
                  {movements.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-[10px] bg-background/60 rounded px-1.5 py-0.5">
                      <span className="text-muted-foreground">
                        {getMoveLabel ? getMoveLabel(m.movement_type) : m.movement_type}
                      </span>
                      <span className={`font-bold ${m.sign > 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
                        {m.sign > 0 ? '+' : '-'}{boxesToBP(m.qtyBoxes, ppb)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-blue-700 dark:text-blue-300 pt-1 border-t border-blue-500/30">
                  المتوقع الجديد للصالح = {boxesToBP(Math.max(0, expected - expectedDamaged), ppb)} {movementsNetChange >= 0 ? '+' : '−'} {boxesToBP(Math.abs(movementsNetChange), ppb)} = <b>{boxesToBP(Math.max(0, expected - expectedDamaged + movementsNetChange), ppb)}</b>
                </div>
              </div>
            )}

            {/* ============ القسم 1: الصالح ============ */}
            <div className={`rounded-lg border-2 p-2 space-y-1.5 transition-colors ${sectionStyles.good.container}`}>
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${sectionStyles.good.icon}`} />
                  <h3 className={`text-xs font-bold ${sectionStyles.good.title}`}>الكمية الصالحة</h3>
                  {hasGoodGap && hasInput && (
                    <Badge className={`text-[10px] font-bold px-1.5 py-0.5 border-0 ${
                      goodDiff > 0 ? 'bg-amber-500 text-white hover:bg-amber-500' : 'bg-destructive text-destructive-foreground hover:bg-destructive'
                    }`}>
                      {goodDiff > 0 ? 'فائض' : 'عجز'}: {goodDiff > 0 ? '+' : '-'}{formatBPFromParts(goodGapParts.boxes, goodGapParts.pieces)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {movementsNetChange !== 0 && (
                    <span className="text-[10px] text-muted-foreground line-through">
                      {boxesToBP(Math.max(0, expected - expectedDamaged), ppb)}
                    </span>
                  )}
                  <Badge className="text-[10px] font-bold px-1.5 py-0.5 bg-green-600 text-white hover:bg-green-600 border-0">
                    المتوقع: {boxesToBP(Math.max(0, expected - expectedDamaged + movementsNetChange), ppb)}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">صناديق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={goodBoxes}
                      onChange={e => setGoodBoxes(sanitizeInt(e.target.value))}
                      onBlur={() => applyNormalizedValues(goodBoxes, goodPieces, setGoodBoxes, setGoodPieces)}
                      className="text-center text-base font-bold h-9"
                    />
                    <ReviewerHint value={reviewerValues?.goodBoxes} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">قطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={goodPieces}
                      onChange={e => setGoodPieces(sanitizeInt(e.target.value))}
                      onBlur={() => applyNormalizedValues(goodBoxes, goodPieces, setGoodBoxes, setGoodPieces)}
                      className="text-center text-base font-bold h-9"
                    />
                    <ReviewerHint value={reviewerValues?.goodPieces} />
                  </div>
                </div>
              </div>

            </div>

            {/* ============ القسم 2: التالف ============ */}
            <div className={`rounded-lg border-2 p-2 space-y-1.5 transition-colors ${sectionStyles.damaged.container}`}>
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <AlertTriangle className={`w-3.5 h-3.5 ${sectionStyles.damaged.icon}`} />
                  <h3 className={`text-xs font-bold ${sectionStyles.damaged.title}`}>الكمية التالفة</h3>
                  {hasDamagedGap && hasInput && (
                    <Badge className={`text-[10px] font-bold px-1.5 py-0.5 border-0 ${
                      damagedDiff > 0 ? 'bg-amber-500 text-white hover:bg-amber-500' : 'bg-destructive text-destructive-foreground hover:bg-destructive'
                    }`}>
                      {damagedDiff > 0 ? 'فائض' : 'عجز'}: {damagedDiff > 0 ? '+' : '-'}{formatBPFromParts(damagedGapParts.boxes, damagedGapParts.pieces)}
                    </Badge>
                  )}
                </div>
                <Badge className="text-[10px] font-bold px-1.5 py-0.5 bg-destructive text-destructive-foreground hover:bg-destructive border-0">
                  المتوقع: {boxesToBP(expectedDamaged, ppb)}
                </Badge>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">صناديق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={damagedBoxes}
                      onChange={e => setDamagedBoxes(sanitizeInt(e.target.value))}
                      onBlur={() => applyNormalizedValues(damagedBoxes, damagedPieces, setDamagedBoxes, setDamagedPieces)}
                      className="text-center text-base font-bold h-9"
                    />
                    <ReviewerHint value={reviewerValues?.damagedBoxes} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px] text-muted-foreground">قطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={damagedPieces}
                      onChange={e => setDamagedPieces(sanitizeInt(e.target.value))}
                      onBlur={() => applyNormalizedValues(damagedBoxes, damagedPieces, setDamagedBoxes, setDamagedPieces)}
                      className="text-center text-base font-bold h-9"
                    />
                    <ReviewerHint value={reviewerValues?.damagedPieces} />
                  </div>
                </div>
            </div>

            </div>

            {/* ملخص الإجمالي */}
            <div className={`rounded-lg p-2 border-2 ${
              isMatch ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20' :
              (hasGoodGap || hasDamagedGap) ? 'border-destructive/50 bg-destructive/5' :
              'border-border bg-muted/30'
            }`}>
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium">الإجمالي الفعلي (صالح + تالف):</span>
                <span className="font-bold text-sm whitespace-nowrap">{boxesToBP(grandTotal, ppb)} صندوق</span>
              </div>
              <div className="mt-1 text-lg font-black text-center">
                = {totalCombinedBoxes} صندوق + {totalCombinedPieces} قطعة
              </div>

              {/* تفصيل الفجوة: الصالح + التالف منفصلين */}
              {(hasGoodGap || hasDamagedGap) && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[11px] font-bold text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    تفصيل الفجوة:
                  </div>

                  {hasGoodGap && (
                    <div className={`rounded-lg p-2 ${goodDiff > 0 ? 'bg-amber-100/60 dark:bg-amber-900/20 border border-amber-400/40' : 'bg-destructive/10 border border-destructive/30'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-bold ${goodDiff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                          الصالح — {goodDiff > 0 ? 'فائض' : 'عجز'}:
                        </span>
                        <span className={`text-base font-extrabold ${goodDiff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                          {goodDiff > 0 ? '+' : '-'}{formatBPFromParts(goodGapParts.boxes, goodGapParts.pieces)}
                        </span>
                      </div>
                      <div className={`text-xs font-black text-center mt-0.5 ${goodDiff > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-destructive/80'}`}>
                        = {goodGapParts.boxes} صندوق + {goodGapParts.pieces} قطعة
                      </div>
                    </div>
                  )}

                  {hasDamagedGap && (
                    <div className={`rounded-lg p-2 ${damagedDiff > 0 ? 'bg-amber-100/60 dark:bg-amber-900/20 border border-amber-400/40' : 'bg-destructive/10 border border-destructive/30'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-bold ${damagedDiff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                          التالف — {damagedDiff > 0 ? 'فائض' : 'عجز'}:
                        </span>
                        <span className={`text-base font-extrabold ${damagedDiff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                          {damagedDiff > 0 ? '+' : '-'}{formatBPFromParts(damagedGapParts.boxes, damagedGapParts.pieces)}
                        </span>
                      </div>
                      <div className={`text-xs font-black text-center mt-0.5 ${damagedDiff > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-destructive/80'}`}>
                        = {damagedGapParts.boxes} صندوق + {damagedGapParts.pieces} قطعة
                      </div>
                    </div>
                  )}

                  {/* الفرق الإجمالي للمعلومة */}
                  {Math.abs(diff) >= 0.01 && (
                    <div className="text-[10px] text-muted-foreground text-center pt-1 border-t border-border/40">
                      الفرق الإجمالي: {diff > 0 ? '+' : '-'}{formatBPFromParts(diffBoxes, diffPieces)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-4 py-2 sticky bottom-0">
          <div className="flex gap-2 w-full">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-9">إلغاء</Button>
          <Button onClick={handleSave} className="gap-1.5 flex-1 h-9">
            <Save className="w-4 h-4" />
            حفظ
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductReviewDetailsDialog;
