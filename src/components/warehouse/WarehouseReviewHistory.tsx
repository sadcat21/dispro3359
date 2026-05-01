import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { boxesToBP } from '@/utils/boxPieceInput';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, AlertTriangle, Package, ClipboardCheck, TrendingUp, TrendingDown, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import palletImage from '@/assets/pallet.png';
import { getProductDisplayName } from '@/utils/productDisplayName';

const fmtQty = (n: number) => {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const formatReviewQty = (item: any, value: number) => {
  const numeric = Number(value || 0);
  if (item.item_type === 'pallet') return fmtQty(numeric);
  const piecesPerBox = Number((item.product as any)?.pieces_per_box || 1);
  // Review records store product quantities as real boxes; display them in B.P format.
  return piecesPerBox > 1 ? boxesToBP(numeric, piecesPerBox) : fmtQty(numeric);
};

// Compute true numerical difference from review records stored as real boxes.
// Returns { absDiff, sign } where sign is -1 (deficit), 0 (matched), 1 (surplus).
const computeDiff = (item: any) => {
  const expected = Number(item.expected_quantity || 0);
  const actual = Number(item.actual_quantity || 0);
  const piecesPerBox = Number((item.product as any)?.pieces_per_box || 1);

  let expectedReal: number;
  let actualReal: number;
  if (item.item_type === 'pallet' || piecesPerBox <= 1) {
    expectedReal = expected;
    actualReal = actual;
  } else {
    expectedReal = expected;
    actualReal = actual;
  }

  const diff = actualReal - expectedReal;
  const sign = Math.abs(diff) < 1e-6 ? 0 : diff > 0 ? 1 : -1;
  return { absDiff: Math.abs(diff), sign, piecesPerBox };
};

const formatDiffDisplay = (item: any, absDiff: number, piecesPerBox: number) => {
  if (item.item_type === 'pallet' || piecesPerBox <= 1) return fmtQty(absDiff);
  // absDiff is fractional boxes -> use boxesToBP for display
  return boxesToBP(absDiff, piecesPerBox);
};

interface WarehouseReviewHistoryProps {
  branchId: string;
}

const WarehouseReviewHistory: React.FC<WarehouseReviewHistoryProps> = ({ branchId }) => {
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['warehouse-review-history', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_review_sessions')
        .select('*, reviewer:workers!warehouse_review_sessions_reviewer_id_fkey(full_name)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!branchId,
  });

  const { data: sessionItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['warehouse-review-items', viewSessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_review_items')
        .select('*, product:products(name, app_name, pieces_per_box, image_url)')
        .eq('session_id', viewSessionId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!viewSessionId,
  });

  // Stats
  const stats = useMemo(() => {
    let totalReviews = sessions.length;
    let totalDiscrepancies = sessions.reduce((s, sess) => s + (sess.total_discrepancies || 0), 0);
    let surplusCount = 0, deficitCount = 0;
    // We'd need items for accurate counts, but session-level is sufficient for overview
    return { totalReviews, totalDiscrepancies };
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const viewSession = sessions.find(s => s.id === viewSessionId);
  // Recompute status using B.P-aware diff to avoid false discrepancies caused by legacy decimal-based saves
  const itemsWithDiff = sessionItems.map((i: any) => {
    const d = computeDiff(i);
    const recomputedStatus = d.sign === 0 ? 'matched' : d.sign > 0 ? 'surplus' : 'deficit';
    return { ...i, _diff: d, _status: recomputedStatus };
  });
  const productItems = itemsWithDiff.filter(i => i.item_type === 'product');
  const damagedItems = itemsWithDiff.filter(i => i.item_type === 'damaged');
  const palletItems = itemsWithDiff.filter(i => i.item_type === 'pallet');
  const deficitItems = itemsWithDiff.filter(i => i._status === 'deficit');
  const surplusItems = itemsWithDiff.filter(i => i._status === 'surplus');
  const matchedItemsView = itemsWithDiff.filter(i => i._status === 'matched');

  return (
    <div className="space-y-3">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <ClipboardCheck className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-lg font-bold text-primary">{stats.totalReviews}</div>
            <div className="text-[10px] text-muted-foreground">عدد المراجعات</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-amber-600">{stats.totalDiscrepancies}</div>
            <div className="text-[10px] text-muted-foreground">إجمالي الفوارق</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-lg font-bold text-primary">
              {sessions.length > 0 ? format(new Date(sessions[0].created_at), 'dd/MM') : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">آخر مراجعة</div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions list */}
      <h4 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
        <History className="w-4 h-4" />
        سجل المراجعات
        <Badge variant="secondary" className="text-[10px]">{sessions.length}</Badge>
      </h4>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            لم تتم أي مراجعة بعد
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2">
            {sessions.map(sess => (
              <Card
                key={sess.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors border-border/60"
                onClick={() => setViewSessionId(sess.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground text-[10px]">مراجعة</Badge>
                      {(sess.total_discrepancies || 0) > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">{sess.total_discrepancies} فوارق</Badge>
                      ) : (
                        <Badge className="bg-primary/20 text-primary text-[10px]">مطابق</Badge>
                      )}
                      {sess.include_damaged && <Badge variant="outline" className="text-[9px]">تالف</Badge>}
                      {sess.include_pallets && <Badge variant="outline" className="text-[9px]">باليط</Badge>}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(sess.created_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    المراجع: {(sess.reviewer as any)?.full_name || '—'} • {sess.total_products || 0} منتج
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Session details dialog */}
      <Dialog open={!!viewSessionId} onOpenChange={open => { if (!open) setViewSessionId(null); }}>
        <DialogContent className="max-w-2xl h-[90dvh] overflow-hidden flex flex-col p-4 sm:p-6" dir="rtl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              تفاصيل المراجعة
            </DialogTitle>
          </DialogHeader>

          {itemsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pe-1 pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="space-y-3">
                {viewSession && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">التاريخ:</div>
                    <div>{format(new Date(viewSession.created_at), 'dd/MM/yyyy HH:mm')}</div>
                    <div className="text-muted-foreground">المراجع:</div>
                    <div>{(viewSession.reviewer as any)?.full_name || '—'}</div>
                  </div>
                )}

                {(deficitItems.length > 0 || surplusItems.length > 0) && (() => {
                  const renderGroup = (items: any[], label: string, isDeficit: boolean) => (
                    items.length > 0 && (
                      <div className="space-y-2">
                        <p className={`text-xs font-semibold flex items-center gap-1 ${isDeficit ? 'text-destructive' : 'text-amber-600'}`}>
                          <AlertTriangle className="w-3 h-3" />
                          {label} ({items.length})
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {items.map(item => {
                            const imgUrl = (item.product as any)?.image_url as string | null | undefined;
                            const productName = item.item_type === 'pallet' ? '🪵 الباليطات' : (getProductDisplayName(item.product as any) || '—');
                            const diffStr = formatDiffDisplay(item, item._diff.absDiff, item._diff.piecesPerBox);
                            return (
                              <div
                                key={item.id}
                                className={`relative rounded-xl overflow-hidden border-4 flex flex-col ${
                                  isDeficit
                                    ? 'bg-destructive/5 border-destructive'
                                    : 'bg-amber-50 dark:bg-amber-950/10 border-amber-500'
                                }`}
                              >
                                <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                  {item.item_type === 'pallet' ? (
                                    <img src={palletImage} alt="الباليطات" className="w-full h-full object-cover" loading="lazy" />
                                  ) : imgUrl ? (
                                    <img src={imgUrl} alt={productName} className="w-full h-full object-cover" loading="lazy" />
                                  ) : (
                                    <Package className="w-10 h-10 text-muted-foreground/50" />
                                  )}
                                  <Badge className={`absolute top-1.5 start-1.5 text-[10px] shadow ${
                                    isDeficit ? 'bg-destructive text-destructive-foreground' : 'bg-amber-400 text-black'
                                  }`}>
                                    {isDeficit ? 'عجز' : 'فائض'}
                                  </Badge>
                                  <div className={`absolute bottom-1.5 end-1.5 px-2 py-0.5 rounded-md text-xs font-bold shadow ${
                                    isDeficit ? 'bg-destructive text-destructive-foreground' : 'bg-amber-400 text-black'
                                  }`}>
                                    {isDeficit ? '-' : '+'}{diffStr}
                                  </div>
                                </div>
                                <div className="p-2 space-y-1.5">
                                  <p className="text-[12px] font-bold leading-tight line-clamp-2 min-h-[30px] text-center">
                                    {productName}
                                    {item.item_type === 'damaged' && <span className="text-[9px] text-muted-foreground ms-1">(تالف)</span>}
                                  </p>
                                  <div className="flex flex-col gap-1">
                                    <Badge className="text-[12px] px-2 py-1 font-bold justify-center bg-green-600 text-white hover:bg-green-600 border-0">
                                      متوقع: {formatReviewQty(item, item.expected_quantity)}
                                    </Badge>
                                    <Badge className={`text-[12px] px-2 py-1 font-bold justify-center border-0 ${
                                      isDeficit
                                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive'
                                        : 'bg-amber-400 text-black hover:bg-amber-400'
                                    }`}>
                                      فعلي: {formatReviewQty(item, item.actual_quantity)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  );
                  return (
                    <>
                      {renderGroup(deficitItems, 'العجز', true)}
                      {renderGroup(surplusItems, 'الفائض', false)}
                    </>
                  );
                })()}

                {matchedItemsView.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      مطابق ({matchedItemsView.length})
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {matchedItemsView.map(item => {
                        const imgUrl = (item.product as any)?.image_url as string | null | undefined;
                        const productName = item.item_type === 'pallet' ? '🪵 الباليطات' : (getProductDisplayName(item.product as any) || '—');
                        return (
                          <div
                            key={item.id}
                            className="relative rounded-xl overflow-hidden border-4 border-green-500 bg-green-50 dark:bg-green-950/10 flex flex-col"
                          >
                            <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
                              {item.item_type === 'pallet' ? (
                                <img src={palletImage} alt="الباليطات" className="w-full h-full object-cover" loading="lazy" />
                              ) : imgUrl ? (
                                <img src={imgUrl} alt={productName} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <Package className="w-10 h-10 text-muted-foreground/50" />
                              )}
                              <Badge className="absolute top-1.5 start-1.5 text-[10px] bg-green-600 text-white shadow hover:bg-green-600">
                                مطابق
                              </Badge>
                            </div>
                            <div className="p-2 space-y-1.5">
                              <p className="text-[12px] font-bold leading-tight line-clamp-2 min-h-[30px] text-center">
                                {productName}
                                {item.item_type === 'damaged' && <span className="text-[9px] text-muted-foreground ms-1">(تالف)</span>}
                              </p>
                              <Badge className="w-full text-[12px] px-2 py-1 font-bold justify-center bg-green-600 text-white hover:bg-green-600 border-0">
                                الكمية: {formatReviewQty(item, item.expected_quantity)}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sessionItems.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    لا توجد عناصر في هذه المراجعة
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseReviewHistory;
