import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Boxes, Layers, AlertTriangle, Save, CheckCircle2 } from 'lucide-react';

export interface ProductReviewDetails {
  boxes: number;       // صناديق صالحة كاملة
  pieces: number;      // قطع صالحة (مفردة)
  hall: number;        // كمية بالصالة (بالصناديق)
  damaged: number;     // إجمالي التالف بالصناديق (boxes + pieces/ppb)
  damagedBoxes?: number;
  damagedPieces?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  imageUrl?: string | null;
  piecesPerBox: number;
  expected: number; // متوقع بالصناديق
  initial?: ProductReviewDetails;
  onSave: (details: ProductReviewDetails) => void;
}

const num = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export const ProductReviewDetailsDialog: React.FC<Props> = ({
  open, onOpenChange, productName, imageUrl, piecesPerBox, expected, initial, onSave,
}) => {
  // الصالح
  const [goodBoxes, setGoodBoxes] = useState('');
  const [goodPieces, setGoodPieces] = useState('');
  const [hall, setHall] = useState('');
  // التالف
  const [damagedBoxes, setDamagedBoxes] = useState('');
  const [damagedPieces, setDamagedPieces] = useState('');

  useEffect(() => {
    if (open) {
      setGoodBoxes(initial?.boxes ? String(initial.boxes) : '');
      setGoodPieces(initial?.pieces ? String(initial.pieces) : '');
      setHall(initial?.hall ? String(initial.hall) : '');
      setDamagedBoxes(initial?.damagedBoxes ? String(initial.damagedBoxes) : '');
      setDamagedPieces(initial?.damagedPieces ? String(initial.damagedPieces) : '');
    }
  }, [open, initial]);

  const ppb = piecesPerBox > 0 ? piecesPerBox : 1;

  const goodTotal = useMemo(() => {
    return num(goodBoxes) + num(goodPieces) / ppb + num(hall);
  }, [goodBoxes, goodPieces, hall, ppb]);

  const damagedTotal = useMemo(() => {
    return num(damagedBoxes) + num(damagedPieces) / ppb;
  }, [damagedBoxes, damagedPieces, ppb]);

  const grandTotal = goodTotal + damagedTotal;
  const diff = grandTotal - expected;

  const handleSave = () => {
    onSave({
      boxes: num(goodBoxes),
      pieces: num(goodPieces),
      hall: num(hall),
      damaged: damagedTotal,
      damagedBoxes: num(damagedBoxes),
      damagedPieces: num(damagedPieces),
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
            <span className="font-bold text-base">{expected.toFixed(2)}</span>
          </div>

          {/* ============ القسم 1: الصالح ============ */}
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-primary">الكمية الصالحة</h3>
              <span className="text-[10px] text-muted-foreground ms-auto">
                ({ppb} قطعة/صندوق)
              </span>
            </div>

            {/* B.P: Box + Piece */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Boxes className="w-3 h-3" />
                  صناديق (B)
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={goodBoxes}
                  onChange={e => setGoodBoxes(e.target.value)}
                  className="text-center text-base font-bold h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Package className="w-3 h-3" />
                  قطع (P)
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={goodPieces}
                  onChange={e => setGoodPieces(e.target.value)}
                  className="text-center text-base font-bold h-10"
                />
              </div>
            </div>

            {/* الصالة */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Layers className="w-3 h-3 text-blue-500" />
                الصالة (صندوق)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={hall}
                onChange={e => setHall(e.target.value)}
                className="text-center text-base font-bold h-10"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-primary/20">
              <span className="text-muted-foreground">إجمالي الصالح:</span>
              <span className="font-bold text-primary">{goodTotal.toFixed(2)} صندوق</span>
            </div>
          </div>

          {/* ============ القسم 2: التالف ============ */}
          <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-bold text-destructive">الكمية التالفة</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Boxes className="w-3 h-3" />
                  صناديق (B)
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={damagedBoxes}
                  onChange={e => setDamagedBoxes(e.target.value)}
                  className="text-center text-base font-bold h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Package className="w-3 h-3" />
                  قطع (P)
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={damagedPieces}
                  onChange={e => setDamagedPieces(e.target.value)}
                  className="text-center text-base font-bold h-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-destructive/20">
              <span className="text-muted-foreground">إجمالي التالف:</span>
              <span className="font-bold text-destructive">{damagedTotal.toFixed(2)} صندوق</span>
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
              <span className="font-bold text-base">{grandTotal.toFixed(2)} صندوق</span>
            </div>
            {Math.abs(diff) >= 0.01 && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground">{diff > 0 ? 'فائض:' : 'عجز:'}</span>
                <span className={`font-bold ${diff > 0 ? 'text-amber-600' : 'text-destructive'}`}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
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
