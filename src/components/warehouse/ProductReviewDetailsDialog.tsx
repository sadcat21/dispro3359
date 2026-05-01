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
  expected: number; // متوقع بالصناديق (كسري)
  initial?: ProductReviewDetails;
  /** قيم مسؤول المخزن — لتظهر للمدير كاشارة أسفل كل حقل */
  reviewerValues?: { goodBoxes?: number; goodPieces?: number; damagedBoxes?: number; damagedPieces?: number };
  reviewerName?: string;
  onSave: (details: ProductReviewDetails) => void;
}

const sanitizeInt = (v: string): string => v.replace(/[^0-9]/g, '');

export const ProductReviewDetailsDialog: React.FC<Props> = ({
  open, onOpenChange, productName, imageUrl, piecesPerBox, expected, initial, reviewerValues, reviewerName, onSave,
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
  const isMatch = Math.abs(diff) < 0.01 && grandTotal > 0;
  const isSurplus = diff > 0.01;
  const hasInput = grandTotal > 0;

  const sectionStyles = {
    good: {
      container: isMatch ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20'
        : isSurplus ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-950/20'
        : 'border-primary/30 bg-primary/5',
      icon: isMatch ? 'text-green-600' : isSurplus ? 'text-amber-600' : 'text-primary',
      title: isMatch ? 'text-green-700 dark:text-green-400' : isSurplus ? 'text-amber-700 dark:text-amber-400' : 'text-primary',
      border: isMatch ? 'border-green-300/40' : isSurplus ? 'border-amber-300/40' : 'border-primary/20',
      value: isMatch ? 'text-green-600' : isSurplus ? 'text-amber-600' : 'text-primary',
    },
    damaged: {
      container: isMatch ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20'
        : isSurplus ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-950/20'
        : 'border-destructive/30 bg-destructive/5',
      icon: isMatch ? 'text-green-600' : isSurplus ? 'text-amber-600' : 'text-destructive',
      title: isMatch ? 'text-green-700 dark:text-green-400' : isSurplus ? 'text-amber-700 dark:text-amber-400' : 'text-destructive',
      border: isMatch ? 'border-green-300/40' : isSurplus ? 'border-amber-300/40' : 'border-destructive/20',
      value: isMatch ? 'text-green-600' : isSurplus ? 'text-amber-600' : 'text-destructive',
    },
  };

  // حساب الفائض/العجز بالصناديق والقطع
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

            {/* ============ القسم 1: الصالح ============ */}
            <div className={`rounded-lg border-2 p-2 space-y-1.5 transition-colors ${sectionStyles.good.container}`}>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${sectionStyles.good.icon}`} />
                <h3 className={`text-xs font-bold ${sectionStyles.good.title}`}>الكمية الصالحة</h3>
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
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={`w-3.5 h-3.5 ${sectionStyles.damaged.icon}`} />
                <h3 className={`text-xs font-bold ${sectionStyles.damaged.title}`}>الكمية التالفة</h3>
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
              diff > 0 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' :
              'border-destructive/40 bg-destructive/5'
            }`}>
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium">الإجمالي الفعلي (صالح + تالف):</span>
                <span className="font-bold text-sm whitespace-nowrap">{boxesToBP(grandTotal, ppb)} صندوق</span>
              </div>
              <div className="mt-1 text-lg font-black text-center">
                = {totalCombinedBoxes} صندوق + {totalCombinedPieces} قطعة
              </div>
              {Math.abs(diff) >= 0.01 && (
                <div className={`mt-2 rounded-lg p-2 ${diff > 0 ? 'bg-amber-100/60 dark:bg-amber-900/20' : 'bg-destructive/10'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-bold ${diff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                      {diff > 0 ? 'فائض:' : 'عجز:'}
                    </span>
                    <span className={`text-lg font-extrabold ${diff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                      {diff > 0 ? '+' : '-'}{formatBPFromParts(diffBoxes, diffPieces)}
                    </span>
                  </div>
                  <div className={`text-base font-black text-center mt-1 ${diff > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-destructive/80'}`}>
                    = {diffBoxes} صندوق + {diffPieces} قطعة
                  </div>
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
