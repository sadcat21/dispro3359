import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, AlertTriangle, Loader2, CheckCircle2, XCircle, Truck, Gift, ShoppingCart } from 'lucide-react';
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
  image_url?: string | null;
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

type GapKind = 'shipping' | 'gift' | 'sale';
const GAP_META: Record<GapKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  shipping: { label: 'الشحن', icon: Truck },
  gift: { label: 'الهدايا', icon: Gift },
  sale: { label: 'البيع', icon: ShoppingCart },
};
const ANALYSIS_STEPS: GapKind[] = ['shipping', 'gift', 'sale'];

// Returns pieces per gap kind (already scoped to "after last shipment" by the SQL function).
function computeGaps(r: PreviewRow): Record<GapKind, number> {
  const ppb = Math.max(Number(r.ppb) || 1, 1);
  const movs = r.movements || [];
  // Gifts: sum promo_gift movement pieces (quantity stored as B.P encoded "b.pp")
  const giftPieces = movs
    .filter(m => m.movement_type === 'promo_gift')
    .reduce((s, m) => {
      const q = Math.abs(Number(m.quantity) || 0);
      const b = Math.floor(q);
      const p = Math.round((q - b) * 100);
      return s + b * ppb + p;
    }, 0);
  return {
    shipping: Number(r.loaded_pieces) || 0,
    gift: giftPieces,
    sale: Number(r.sold_pieces) || 0,
  };
}

const RecalibratePreviewDialog: React.FC<Props> = ({
  open, onOpenChange, rows, loading, applying, onConfirm,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    if (!loading) { setAnalysisStep(ANALYSIS_STEPS.length); return; }
    setAnalysisStep(0);
    const id = setInterval(() => {
      setAnalysisStep(s => (s < ANALYSIS_STEPS.length ? s + 1 : s));
    }, 600);
    return () => clearInterval(id);
  }, [loading]);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const totalsByKind = useMemo(() => {
    const t: Record<GapKind, number> = { shipping: 0, gift: 0, sale: 0 };
    rows.forEach(r => {
      const g = computeGaps(r);
      (Object.keys(g) as GapKind[]).forEach(k => { t[k] += g[k]; });
    });
    return t;
  }, [rows]);

  const hasErrors = rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[420px] sm:max-w-[420px] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            مراجعة تصحيح الرصيد
          </DialogTitle>
          <DialogDescription className="text-xs">
            مراجعة المنتجات التي يوجد بها فرق بين الرصيد الحالي والرصيد المحسوب من الحركات المسجَّلة.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-3 py-3">
          {loading ? (
            <div className="py-8 px-2 space-y-3">
              <p className="text-center text-sm font-medium mb-2">جارٍ تحليل الفجوات…</p>
              {ANALYSIS_STEPS.map((kind, idx) => {
                const meta = GAP_META[kind];
                const Icon = meta.icon;
                const done = idx < analysisStep;
                const active = idx === analysisStep;
                return (
                  <div
                    key={kind}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      active ? 'border-primary bg-primary/5' : done ? 'border-muted bg-muted/30' : 'border-dashed opacity-60'
                    }`}
                  >
                    {active ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      {active ? `جارٍ تحليل فجوة ${meta.label}…` : `تحليل فجوة ${meta.label}`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : !hasErrors ? (
            <div className="text-center py-12 text-muted-foreground space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-1 text-emerald-500 opacity-80" />
              <p>لا يوجد أي فرق — جميع الأرصدة مطابقة.</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {ANALYSIS_STEPS.map(kind => {
                  const meta = GAP_META[kind];
                  const Icon = meta.icon;
                  return (
                    <Badge key={kind} variant="outline" className="gap-1 text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                      <Icon className="w-3 h-3" /> {meta.label}: لا فجوة
                    </Badge>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5 px-1">
                {ANALYSIS_STEPS.map(kind => {
                  const meta = GAP_META[kind];
                  const Icon = meta.icon;
                  const v = totalsByKind[kind];
                  const has = v > 0;
                  return (
                    <Badge
                      key={kind}
                      variant="outline"
                      className={`gap-1 text-[10px] ${
                        has ? 'text-red-700 border-red-300 bg-red-50' : 'text-emerald-700 border-emerald-300 bg-emerald-50'
                      }`}
                    >
                      {has ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      <Icon className="w-3 h-3" />
                      {meta.label}: {has ? `${v} قطعة` : 'لا فجوة'}
                    </Badge>
                  );
                })}
              </div>
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
                const gaps = computeGaps(r);

                return (
                  <div key={r.product_id} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggle(r.product_id)}
                      className="w-full p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors text-right"
                    >
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt={r.product_name}
                          className="w-10 h-10 rounded-md object-cover border shrink-0 bg-muted"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md border bg-muted shrink-0" />
                      )}
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
                        <div className="flex items-center gap-1 flex-wrap mt-1.5">
                          {ANALYSIS_STEPS.map(kind => {
                            const meta = GAP_META[kind];
                            const Icon = meta.icon;
                            const v = gaps[kind];
                            const has = v > 0;
                            return (
                              <Badge
                                key={kind}
                                variant="outline"
                                className={`gap-1 text-[10px] py-0 px-1.5 ${
                                  has ? 'text-red-700 border-red-300 bg-red-50' : 'text-emerald-700 border-emerald-300 bg-emerald-50'
                                }`}
                              >
                                <Icon className="w-2.5 h-2.5" />
                                {meta.label}: {has ? v : '0'}
                              </Badge>
                            );
                          })}
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
                                <div key={i} className="flex flex-col gap-1 p-1.5 rounded bg-background border">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] text-muted-foreground tabular-nums">
                                      {format(new Date(m.created_at), 'MM-dd HH:mm')}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">
                                      {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                                    </Badge>
                                    <span className="font-medium tabular-nums">
                                      {m.movement_type === 'load'
                                        ? `${fmtBP(Number(m.quantity))} ب.ق`
                                        : `${piecesToBP(Number(m.quantity), r.ppb)} ب.ق`}
                                    </span>
                                    {m.customer_name && (
                                      <span className="text-[10px] text-foreground truncate">
                                        🏪 {m.customer_name}
                                      </span>
                                    )}
                                  </div>
                                  {m.notes && <span className="text-muted-foreground text-[10px] truncate">{m.notes}</span>}
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
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-3 border-t shrink-0 flex-col-reverse sm:flex-col-reverse gap-2 sm:gap-2 sm:space-x-0">
          {hasErrors && (
            <Button onClick={onConfirm} disabled={applying || loading} className="w-full">
              {applying && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              تأكيد التصحيح ({rows.length})
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying} className="w-full">
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecalibratePreviewDialog;
