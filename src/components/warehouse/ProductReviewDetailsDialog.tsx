import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const sanitizeBP = (v: string): string => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const sanitizeInt = (v: string): string => v.replace(/[^0-9]/g, '');

export const ProductReviewDetailsDialog: React.FC<Props> = ({
  open, onOpenChange, productName, imageUrl, piecesPerBox, expected, initial, onSave,
}) => {
  const ppb = Math.max(1, piecesPerBox || 1);

  const [goodInput, setGoodInput] = useState('');
  const [damagedInput, setDamagedInput] = useState('');
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

  const goodParsed = useMemo(() => normalize(goodBoxes, goodPieces), [goodBoxes, goodPieces, ppb]);
  const damagedParsed = useMemo(() => normalize(damagedBoxes, damagedPieces), [damagedBoxes, damagedPieces, ppb]);

  const grandTotal = goodParsed.totalBoxes + damagedParsed.totalBoxes;
  const diff = grandTotal - expected;

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
      <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="w-9 h-9 rounded-md object-cover border" />
            ) : (
              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
            )}
            <span className="truncate flex-1 text-right">{productName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* المتوقع */}
          <div className="bg-muted/50 rounded-lg p-2.5 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">المتوقع (صندوق):</span>
            <span className="font-bold text-base">{boxesToBP(expected, ppb)}</span>
          </div>

          {/* تنبيه طريقة الإدخال */}
          <div className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2.5 py-1.5 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
            💡 أدخل الكمية في الحقلين المنفصلين: <strong>صناديق</strong> و <strong>قطع</strong>
            <span className="block text-muted-foreground mt-0.5">({ppb} قطعة في الصندوق) — يتم التطبيع تلقائياً</span>
          </div>

          {/* ============ القسم 1: الصالح ============ */}
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-primary">الكمية الصالحة</h3>
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
                    className="text-center text-lg font-bold h-11"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-primary/20">
              <span className="text-muted-foreground">
                = {goodParsed.boxes} صندوق + {goodParsed.pieces} قطعة
              </span>
              <span className="font-bold text-primary">
                {goodParsed.totalBoxes.toFixed(2)} صندوق
              </span>
            </div>
          </div>

          {/* ============ القسم 2: التالف ============ */}
          <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-bold text-destructive">الكمية التالفة</h3>
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
                    className="text-center text-lg font-bold h-11"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-destructive/20">
              <span className="text-muted-foreground">
                = {damagedParsed.boxes} صندوق + {damagedParsed.pieces} قطعة
              </span>
              <span className="font-bold text-destructive">
                {damagedParsed.totalBoxes.toFixed(2)} صندوق
              </span>
            </div>
          </div>

          {/* ملخص الإجمالي */}
          <div className={`rounded-lg p-3 border-2 ${
            Math.abs(diff) < 0.01 ? 'border-primary/40 bg-primary/5' :
            diff > 0 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' :
            'border-destructive/40 bg-destructive/5'
          }`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">الإجمالي الفعلي (صالح + تالف):</span>
              <span className="font-bold text-base">{boxesToBP(grandTotal, ppb)} صندوق</span>
            </div>
            {Math.abs(diff) >= 0.01 && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground">{diff > 0 ? 'فائض:' : 'عجز:'}</span>
                <span className={`font-bold ${diff > 0 ? 'text-amber-600' : 'text-destructive'}`}>
                  {diff > 0 ? '+' : '-'}{boxesToBP(Math.abs(diff), ppb)}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} className="gap-1.5">
            <Save className="w-4 h-4" />
            حفظ التفاصيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductReviewDetailsDialog;
