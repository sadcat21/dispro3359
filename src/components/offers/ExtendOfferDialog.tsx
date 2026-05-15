import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon, Clock, History, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OfferPeriod {
  id: string;
  offer_id: string;
  tier_id: string | null;
  period_start: string;
  period_end: string;
  period_type: 'original' | 'extension' | 'resume';
  sold_quantity_pieces: number;
  notes: string | null;
  created_at: string;
}

export interface ExtendTarget {
  offerId: string;
  offerName: string;
  tierId?: string | null;
  tierLabel?: string | null;
}

interface ExtendOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** عرض واحد (للتوافق مع الاستخدام السابق) */
  offerId?: string;
  offerName?: string;
  tierId?: string | null;
  tierLabel?: string | null;
  /** قائمة عروض للتطبيق الجماعي — إن مرّرت تتجاوز offerId */
  targets?: ExtendTarget[];
  mode: 'extend' | 'resume';
  onSuccess?: () => void;
}

const ExtendOfferDialog: React.FC<ExtendOfferDialogProps> = ({
  open, onOpenChange, offerId, offerName, tierId, tierLabel, targets, mode, onSuccess,
}) => {
  const effectiveTargets: ExtendTarget[] =
    targets && targets.length > 0
      ? targets
      : offerId
      ? [{ offerId, offerName: offerName || '', tierId: tierId ?? null, tierLabel: tierLabel ?? null }]
      : [];
  const isBulk = effectiveTargets.length > 1;
  const single = effectiveTargets[0];

  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<OfferPeriod[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate(new Date());
    setEndDate(undefined);
    setNotes('');
    if (!isBulk && single?.offerId) void loadHistory(single.offerId, single.tierId ?? null);
    else setPeriods([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, single?.offerId, single?.tierId, isBulk]);

  const loadHistory = async (oid: string, tid: string | null) => {
    setLoadingHistory(true);
    try {
      let query = supabase
        .from('product_offer_periods')
        .select('*')
        .eq('offer_id', oid)
        .order('period_start', { ascending: false });

      if (tid) {
        query = query.or(`tier_id.eq.${tid},tier_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPeriods((data || []) as OfferPeriod[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error('الرجاء اختيار تاريخ البداية والنهاية');
      return;
    }
    if (endDate <= startDate) {
      toast.error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }
    if (effectiveTargets.length === 0) {
      toast.error('لا توجد عروض محددة');
      return;
    }

    setLoading(true);
    let success = 0;
    let failed = 0;
    try {
      for (const t of effectiveTargets) {
        const { error } = await supabase.rpc('extend_offer_period', {
          p_offer_id: t.offerId,
          p_tier_id: t.tierId || null,
          p_new_start: startDate.toISOString(),
          p_new_end: endDate.toISOString(),
          p_period_type: mode === 'resume' ? 'resume' : 'extension',
          p_notes: notes || null,
        });
        if (error) { failed++; console.error(error); } else { success++; }
      }

      if (success > 0) {
        toast.success(
          isBulk
            ? `${mode === 'resume' ? 'تم استئناف' : 'تم تمديد'} ${success} عرض${failed ? ` (فشل ${failed})` : ''}`
            : (mode === 'resume' ? 'تم استئناف العرض' : 'تم تمديد العرض')
        );
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error('فشل تنفيذ العملية');
      }
    } finally {
      setLoading(false);
    }
  };

  const periodTypeLabel = (t: string) => {
    switch (t) {
      case 'original': return 'أصلية';
      case 'extension': return 'تمديد';
      case 'resume': return 'استئناف';
      default: return t;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {mode === 'resume' ? 'استئناف العرض' : 'تمديد العرض'}
            {isBulk && (
              <Badge className="ms-2 bg-primary text-primary-foreground">
                {effectiveTargets.length} عرض
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              {isBulk ? (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {effectiveTargets.map((t) => (
                    <Badge key={t.offerId} variant="outline" className="text-[10px]">
                      {t.offerName}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div>
                  {single?.offerName}
                  {single?.tierLabel && (
                    <Badge variant="outline" className="ms-2">{single.tierLabel}</Badge>
                  )}
                  {!single?.tierId && (
                    <Badge variant="secondary" className="ms-2">كل الشرائح</Badge>
                  )}
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>تاريخ بداية الفترة الجديدة</Label>
            <Popover open={startOpen} onOpenChange={setStartOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-right font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="ms-2 w-4 h-4" />
                  {startDate ? format(startDate, 'dd MMM yyyy', { locale: ar }) : 'اختر التاريخ'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => { setStartDate(d); setStartOpen(false); }}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>تاريخ نهاية الفترة الجديدة</Label>
            <Popover open={endOpen} onOpenChange={setEndOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-right font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="ms-2 w-4 h-4" />
                  {endDate ? format(endDate, 'dd MMM yyyy', { locale: ar }) : 'اختر التاريخ'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => { setEndDate(d); setEndOpen(false); }}
                  disabled={(d) => (startDate ? d <= startDate : false)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background p-2 text-sm"
              placeholder="سبب التمديد أو ملاحظة..."
            />
          </div>

          {!isBulk && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">سجل فترات العرض</h4>
                </div>
                {loadingHistory ? (
                  <div className="text-center py-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  </div>
                ) : periods.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">لا توجد فترات مسجلة</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {periods.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/40 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant={p.period_type === 'original' ? 'default' : 'outline'} className="text-[10px]">
                            {periodTypeLabel(p.period_type)}
                          </Badge>
                          <span>
                            {format(new Date(p.period_start), 'dd/MM/yy')} → {format(new Date(p.period_end), 'dd/MM/yy')}
                          </span>
                          {p.tier_id === null && (
                            <Badge variant="secondary" className="text-[10px]">كل الشرائح</Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {Number(p.sold_quantity_pieces || 0).toFixed(0)} قطعة
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin me-2" />}
            {mode === 'resume' ? 'استئناف' : 'تمديد'}
            {isBulk && ` (${effectiveTargets.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExtendOfferDialog;
