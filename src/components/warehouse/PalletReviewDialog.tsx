import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, CheckCircle2 } from 'lucide-react';
import palletImage from '@/assets/pallet.png';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expected: number;
  initial?: string;
  onSave: (actual: string) => void;
}

const PalletReviewDialog: React.FC<Props> = ({ open, onOpenChange, expected, initial, onSave }) => {
  const [actual, setActual] = useState('');

  useEffect(() => {
    if (open) setActual(initial || '');
  }, [open, initial]);

  const actualNum = actual !== '' ? (parseFloat(actual) || 0) : null;
  const diff = actualNum !== null ? actualNum - expected : null;
  const isMatch = diff !== null && Math.abs(diff) < 0.001;
  const isSurplus = diff !== null && diff > 0.001;
  const isDeficit = diff !== null && diff < -0.001;

  const handleSave = () => {
    onSave(actual);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92dvh] overflow-hidden flex flex-col p-0" dir="rtl">
        <DialogHeader>
          <div className="px-4 pt-4 pb-2 border-b border-border space-y-2">
            <DialogTitle className="flex items-start gap-2">
              <img src={palletImage} alt="باليط" className="w-9 h-9 rounded-md object-cover border shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <span className="block truncate text-right text-sm">الباليطات</span>
                <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5">
                  المتوقع: {expected}
                </Badge>
              </div>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            {/* حقل الإدخال */}
            <div className={`rounded-lg border-2 p-3 space-y-2 transition-colors ${
              isMatch ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20' :
              isSurplus ? 'border-amber-400/40 bg-amber-50 dark:bg-amber-950/20' :
              isDeficit ? 'border-destructive/30 bg-destructive/5' :
              'border-primary/30 bg-primary/5'
            }`}>
              <Label className="text-xs font-bold">العدد الفعلي للباليطات</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={actual}
                onChange={e => setActual(e.target.value.replace(/[^0-9]/g, ''))}
                className="text-center text-lg font-bold h-11"
                autoFocus
              />
            </div>

            {/* ملخص */}
            <div className={`rounded-lg p-3 border-2 ${
              isMatch ? 'border-green-500/40 bg-green-50 dark:bg-green-950/20' :
              isSurplus ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' :
              isDeficit ? 'border-destructive/40 bg-destructive/5' :
              'border-muted'
            }`}>
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium">المتوقع:</span>
                <span className="font-bold text-sm">{expected}</span>
              </div>
              <div className="flex items-center justify-between text-xs gap-2 mt-1">
                <span className="font-medium">الفعلي:</span>
                <span className="font-bold text-sm">{actualNum !== null ? actualNum : '—'}</span>
              </div>
              {diff !== null && Math.abs(diff) >= 0.001 && (
                <div className={`mt-2 rounded-lg p-2 ${isSurplus ? 'bg-amber-100/60 dark:bg-amber-900/20' : 'bg-destructive/10'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-bold ${isSurplus ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                      {isSurplus ? 'فائض:' : 'عجز:'}
                    </span>
                    <span className={`text-lg font-extrabold ${isSurplus ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'}`}>
                      {isSurplus ? '+' : ''}{diff}
                    </span>
                  </div>
                </div>
              )}
              {isMatch && (
                <div className="mt-2 text-center text-green-600 dark:text-green-400 font-bold text-sm">
                  ✅ مطابق
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-4 py-2 sticky bottom-0">
          <div className="flex gap-2 w-full flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 min-w-[80px] h-9">إلغاء</Button>
            <Button
              type="button"
              onClick={() => setActual(String(expected))}
              className="gap-1.5 flex-1 min-w-[100px] h-9 bg-green-600 hover:bg-green-700 text-white border-0"
              title="إدراج العدد المتوقع في الحقل"
            >
              <CheckCircle2 className="w-4 h-4" />
              تأكيد المتوقع
            </Button>
            <Button onClick={handleSave} className="gap-1.5 flex-1 min-w-[80px] h-9">
              <Save className="w-4 h-4" />
              حفظ
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PalletReviewDialog;