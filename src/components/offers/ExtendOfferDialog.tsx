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

interface ExtendOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  offerName: string;
  tierId?: string | null;
  tierLabel?: string | null;
  /** يحدد نوع الفترة الافتراضي */
  mode: 'extend' | 'resume';
  onSuccess?: () => void;
}

const ExtendOfferDialog: React.FC<ExtendOfferDialogProps> = ({
  open, onOpenChange, offerId, offerName, tierId, tierLabel, mode, onSuccess,
}) => {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<OfferPeriod[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate(new Date());
    setEndDate(undefined);
    setNotes('');
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, offerId, tierId]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      let query = supabase
        .from('product_offer_periods')
        .select('*')
        .eq('offer_id', offerId)
        .order('period_start', { ascending: false });

      if (tierId) {
        query = query.or(`tier_id.eq.${tierId},tier_id.is.null`);
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

    setLoading(true);
    try {
      const { error } = await supabase.rpc('extend_offer_period', {
        p_offer_id: offerId,
        p_tier_id: tierId || null,
        p_new_start: startDate.toISOString(),
        p_new_end: endDate.toISOString(),
        p_period_type: mode === 'resume' ? 'resume' : 'extension',
        p_notes: notes || null,
      });
      if (error) throw error;

      toast.success(mode === 'resume' ? 'تم استئناف العرض' : 'تم تمديد العرض');
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل تنفيذ العملية');
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
          </DialogTitle>
          <DialogDescription>
            {offerName}
            {tierLabel && (
              <Badge variant="outline" className="ms-2">
                {tierLabel}
              </Badge>
            )}
            {!tierId && (
              <Badge variant="secondary" className="ms-2">
                كل الشرائح
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* تاريخ البداية */}
          <div className="space-y-2">
            <Label>تاريخ بداية الفترة الجديدة</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
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
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* تاريخ النهاية */}
          <div className="space-y-2">
            <Label>تاريخ نهاية الفترة الجديدة</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
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
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(d) => (startDate ? d <= startDate : false)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* ملاحظات */}
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

          <Separator />

          {/* سجل الفترات */}
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
              <p className="text-sm text-muted-foreground text-center py-3">
                لا توجد فترات مسجلة
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {periods.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 p-2 rounded bg-muted/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={p.period_type === 'original' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
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
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin me-2" />}
            {mode === 'resume' ? 'استئناف' : 'تمديد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExtendOfferDialog;