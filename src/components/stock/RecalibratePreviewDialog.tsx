import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export interface PreviewRow {
  product_id: string;
  product_name: string;
  ppb: number;
  current_qty: number;
  new_qty: number;
  last_load_at: string;
  loaded_pieces: number;
  sold_pieces: number;
  movements: Array<{
    created_at: string;
    movement_type: string;
    quantity: number;
    signed_quantity: number;
    notes: string | null;
    reason: string | null;
    customer_name?: string | null;
  }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: PreviewRow[];
  loading: boolean;
  applying: boolean;
  onConfirm: () => void;
}

const MOVEMENT_LABELS: Record<string, string> = {
  load: 'شحن',
  delivery: 'توصيل',
  modification: 'تعديل',
  promo_sale: 'بيع عرض',
  promo_gift: 'هدية عرض',
  direct_sale: 'بيع مباشر',
};

const fmtBP = (n: number) => Number(n).toFixed(2);
const piecesToBP = (pieces: number, ppb: number) => {
  const b = Math.floor(pieces / ppb);
  const p = pieces - b * ppb;
  return `${b}.${String(p).padStart(2, '0')}`;
};

const RecalibratePreviewDialog: React.FC<Props> = ({
  open, onOpenChange, rows, loading, applying, onConfirm,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const hasErrors = rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[420px] sm:max-w-[420px] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            مراجعة تصحيح الرصيد
          </DialogTitle>
          <DialogDescription>
            مراجعة المنتجات التي يوجد بها فرق بين الرصيد الحالي والرصيد المحسوب من الحركات المسجَّلة.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasErrors ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-80" />
              <p>لا يوجد أي فرق — جميع الأرصدة مطابقة.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const isOpen = expanded.has(r.product_id);
                const diff = Number(r.new_qty) - Number(r.current_qty);
                const diffPositive = diff > 0;
                // unexplained: sold computed > loaded → balance was forced to 0; or any mismatch beyond movements
                const recordedSold = (r.movements || [])
                  .filter(m => m.movement_type !== 'load')
                  .length;
                const isUnexplained = recordedSold === 0 && Number(r.current_qty) !== Number(r.new_qty);

                return (
                  <div key={r.product_id} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggle(r.product_id)}
                      className="w-full p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors text-right"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{r.product_name}</span>
                          {isUnexplained && (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              فرق غير مفسَّر
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={diffPositive ? 'text-emerald-700 border-emerald-300' : 'text-red-700 border-red-300'}
                          >
                            {diffPositive ? '+' : ''}{fmtBP(diff)} ب.ق
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>الحالي: <strong className="text-foreground">{fmtBP(r.current_qty)}</strong></span>
                          <span>←</span>
                          <span>بعد التصحيح: <strong style={{ color: 'hsl(var(--primary))' }}>{fmtBP(r.new_qty)}</strong></span>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-2 border-t bg-muted/30 space-y-2 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 rounded bg-background border">
                            <p className="text-muted-foreground text-[10px]">آخر شحنة</p>
                            <p className="font-medium">{format(new Date(r.last_load_at), 'yyyy-MM-dd HH:mm')}</p>
                          </div>
                          <div className="p-2 rounded bg-background border">
                            <p className="text-muted-foreground text-[10px]">المُحمَّل (قطع)</p>
                            <p className="font-medium">{r.loaded_pieces} ({piecesToBP(Number(r.loaded_pieces), r.ppb)} ب.ق)</p>
                          </div>
                          <div className="p-2 rounded bg-background border">
                            <p className="text-muted-foreground text-[10px]">المباع (قطع)</p>
                            <p className="font-medium">{r.sold_pieces} ({piecesToBP(Number(r.sold_pieces), r.ppb)} ب.ق)</p>
                          </div>
                        </div>

                        <div>
                          <p className="font-medium mb-1">الحركات المسجَّلة منذ آخر شحنة:</p>
                          {(r.movements || []).length === 0 ? (
                            <p className="text-muted-foreground italic">لا توجد حركات.</p>
                          ) : (
                            <div className="space-y-1">
                              {r.movements.map((m, i) => (
                                <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-background border">
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {format(new Date(m.created_at), 'MM-dd HH:mm')}
                                  </span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                                  </Badge>
                                  <span className="font-medium tabular-nums">{Number(m.quantity)}</span>
                                  {m.notes && <span className="text-muted-foreground text-[10px] truncate flex-1">{m.notes}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            إلغاء
          </Button>
          {hasErrors && (
            <Button onClick={onConfirm} disabled={applying || loading}>
              {applying && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              تأكيد التصحيح ({rows.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecalibratePreviewDialog;
