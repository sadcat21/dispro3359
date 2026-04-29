import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Boxes, Layers, AlertTriangle, Save } from 'lucide-react';

export interface ProductReviewDetails {
  boxes: number;
  pieces: number;
  hall: number;
  damaged: number;
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
  const [boxes, setBoxes] = useState('');
  const [pieces, setPieces] = useState('');
  const [hall, setHall] = useState('');
  const [damaged, setDamaged] = useState('');

  useEffect(() => {
    if (open) {
      setBoxes(initial?.boxes ? String(initial.boxes) : '');
      setPieces(initial?.pieces ? String(initial.pieces) : '');
      setHall(initial?.hall ? String(initial.hall) : '');
      setDamaged(initial?.damaged ? String(initial.damaged) : '');
    }
  }, [open, initial]);

  const totalBoxes = useMemo(() => {
    const b = num(boxes);
    const p = num(pieces);
    const h = num(hall);
    return b + (piecesPerBox > 0 ? p / piecesPerBox : 0) + h;
  }, [boxes, pieces, hall, piecesPerBox]);

  const diff = totalBoxes - expected;

  const handleSave = () => {
    onSave({
      boxes: num(boxes),
      pieces: num(pieces),
      hall: num(hall),
      damaged: num(damaged),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
            ) : (
              <Package className="w-5 h-5 text-primary" />
            )}
            <span className="truncate">{productName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">المتوقع (صندوق):</span>
            <span className="font-bold">{expected.toFixed(2)}</span>
          </div>

          {/* الصناديق */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Boxes className="w-4 h-4 text-primary" />
              الكمية للصناديق الكاملة
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={boxes}
              onChange={e => setBoxes(e.target.value)}
            />
          </div>

          {/* القطع */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Package className="w-4 h-4 text-amber-500" />
              الكمية للقطع (قطعة - {piecesPerBox} قطعة/صندوق)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={pieces}
              onChange={e => setPieces(e.target.value)}
            />
          </div>

          {/* الصالة */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Layers className="w-4 h-4 text-blue-500" />
              الكمية بالصالة (صندوق)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={hall}
              onChange={e => setHall(e.target.value)}
            />
          </div>

          {/* التالف */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              الكمية التالفة (صندوق)
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={damaged}
              onChange={e => setDamaged(e.target.value)}
            />
          </div>

          {/* ملخص */}
          <div className={`rounded-lg p-3 border-2 ${
            Math.abs(diff) < 0.01 ? 'border-primary/40 bg-primary/5' :
            diff > 0 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' :
            'border-destructive/40 bg-destructive/5'
          }`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">الإجمالي الفعلي:</span>
              <span className="font-bold text-base">{totalBoxes.toFixed(2)} صندوق</span>
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
