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
  onSave: (details: ProductReviewDetails) => void;
}

const sanitizeInt = (v: string): string => v.replace(/[^0-9]/g, '');

export const ProductReviewDetailsDialog: React.FC<Props> = ({
  open, onOpenChange, productName, imageUrl, piecesPerBox, expected, initial, onSave,
}) => {
  const ppb = Math.max(1, piecesPerBox || 1);

  const [goodBoxes, setGoodBoxes] = useState('');
  const [goodPieces, setGoodPieces] = useState('');
  const [damagedBoxes, setDamagedBoxes] = useState('');
  const [damagedPieces, setDamagedPieces] = useState('');

  useEffect(() => {
    if (open) {
      setGoodBoxes(String(initial?.boxes ?? 0));
      setGoodPieces(String(initial?.pieces ?? 0));
      setDamagedBoxes(String(initial?.damagedBoxes ?? 0));
      setDamagedPieces(String(initial?.damagedPieces ?? 0));
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
    const normalized = normalize(boxes, pieces);
    setBoxes(String(normalized.boxes));
    setPieces(String(normalized.pieces));
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-hidden flex flex-col p-0" dir="rtl">
        <DialogHeader>
          <div className="px-6 pt-6 pb-3 border-b border-border space-y-3">
            <DialogTitle className="flex items-start gap-3">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="w-11 h-11 rounded-md object-cover border shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <span className="block truncate text-right">{productName}</span>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge variant="secondary" className="text-xs font-bold px-2.5 py-1">
                    المتوقع: {boxesToBP(expected, ppb)}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-bold px-2.5 py-1">
                    {ppb} قطعة / صندوق
                  </Badge>
                </div>
              </div>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">

            {/* تنبيه طريقة الإدخال */}
            <div className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2.5 py-1.5 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              💡 أدخل الكمية في الحقلين المنفصلين: <strong>صناديق</strong> و <strong>قطع</strong>
              <span className="block text-muted-foreground mt-0.5">إذا تجاوز عدد القطع سعة الصندوق فسيتم تحويله تلقائياً عند الخروج من الحقل</span>
            </div>

            {/* ============ القسم 1: الصالح ============ */}
            <div className={`rounded-lg border-2 p-3 space-y-2 transition-colors ${sectionStyles.good.container}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${sectionStyles.good.icon}`} />
                <h3 className={`text-sm font-bold ${sectionStyles.good.title}`}>الكمية الصالحة</h3>
              </div>

              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">صناديق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={goodBoxes}
                      onChange={e => setGoodBoxes(sanitizeInt(e.target.value))}
                      onBlur={() => applyNormalizedValues(goodBoxes, goodPieces, setGoodBoxes, setGoodPieces)}
                      className="text-center text-lg font-bold h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">قطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={goodPieces}
                      onChange={e => setGoodPieces(sanitizeInt(e.target.value))}
                      onBlur={() => applyNormalizedValues(goodBoxes, goodPieces, setGoodBoxes, setGoodPieces)}
                      className="text-center text-lg font-bold h-11"
                    />
                  </div>
                </div>
              </div>

              <div className={`pt-2 border-t ${sectionStyles.good.border} space-y-1`}>
                <div className={`text-2xl font-black text-center ${sectionStyles.good.value}`}>
                  = {goodParsed.boxes} صندوق + {goodParsed.pieces} قطعة
                </div>
                <div className="text-center text-sm font-semibold text-muted-foreground">
                  {formatBPFromParts(goodParsed.boxes, goodParsed.pieces)} صندوق
                </div>
              </div>
            </div>

            {/* ============ القسم 2: التالف ============ */}
            <div className={`rounded-lg border-2 p-3 space-y-2 transition-colors ${sectionStyles.damaged.container}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${sectionStyles.damaged.icon}`} />
                <h3 className={`text-sm font-bold ${sectionStyles.damaged.title}`}>الكمية التالفة</h3>
              </div>

              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">صناديق</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={damagedBoxes}
                      onChange={e => setDamagedBoxes(sanitizeInt(e.target.value))}
                      onBlur={() => applyNormalizedValues(damagedBoxes, damagedPieces, setDamagedBoxes, setDamagedPieces)}
                      className="text-center text-lg font-bold h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">قطع</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={damagedPieces}
                      onChange={e => setDamagedPieces(sanitizeInt(e.target.value))}
                      onBlur={() => applyNormalizedValues(damagedBoxes, damagedPieces, setDamagedBoxes, setDamagedPieces)}
                      className="text-center text-lg font-bold h-11"
                    />
                  </div>
                </div>
            </div>

              <div className={`pt-2 border-t ${sectionStyles.damaged.border} space-y-1`}>
                <div className={`text-2xl font-black text-center ${sectionStyles.damaged.value}`}>
                  = {damagedParsed.boxes} صندوق + {damagedParsed.pieces} قطعة
                </div>
                <div className="text-center text-sm font-semibold text-muted-foreground">
                  {formatBPFromParts(damagedParsed.boxes, damagedParsed.pieces)} صندوق
                </div>
              </div>
            </div>

            {/* ملخص الإجمالي */}
            <div className={`rounded-lg p-3 border-2 ${
              isMatch ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20' :
              diff > 0 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' :
              'border-destructive/40 bg-destructive/5'
            }`}>
              <div className="flex items-center justify-between text-sm gap-3">
                <span className="font-medium">الإجمالي الفعلي (صالح + تالف):</span>
                <span className="font-bold text-base whitespace-nowrap">{boxesToBP(grandTotal, ppb)} صندوق</span>
              </div>
              <div className="mt-2 text-2xl font-black text-center">
                = {totalCombinedBoxes} صندوق + {totalCombinedPieces} قطعة
              </div>
              {Math.abs(diff) >= 0.01 && (
                <div className={`mt-3 rounded-lg p-3 ${diff > 0 ? 'bg-amber-100/60 dark:bg-amber-900/20' : 'bg-destructive/10'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-lg font-bold ${diff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                      {diff > 0 ? 'فائض:' : 'عجز:'}
                    </span>
                    <span className={`text-2xl font-extrabold ${diff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                      {diff > 0 ? '+' : '-'}{formatBPFromParts(diffBoxes, diffPieces)}
                    </span>
                  </div>
                  <div className={`text-xl font-black text-center mt-2 ${diff > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-destructive/80'}`}>
                    = {diffBoxes} صندوق + {diffPieces} قطعة
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4 gap-2 sticky bottom-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">إلغاء</Button>
          <Button onClick={handleSave} className="gap-1.5 flex-1">
            <Save className="w-4 h-4" />
            حفظ التفاصيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductReviewDetailsDialog;
