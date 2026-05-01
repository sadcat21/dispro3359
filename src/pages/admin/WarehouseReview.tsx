import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { boxesToBP, dbBPToBoxes, parseBP } from '@/utils/boxPieceInput';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, AlertTriangle, Package, Search, Save, TrendingUp, TrendingDown, Minus, ArrowRight, ClipboardCheck, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWarehouseStock } from '@/hooks/useWarehouseStock';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import WarehouseReviewHistory from '@/components/warehouse/WarehouseReviewHistory';
import ProductReviewDetailsDialog, { ProductReviewDetails } from '@/components/warehouse/ProductReviewDetailsDialog';
import palletImage from '@/assets/pallet.png';
import PalletReviewDialog from '@/components/warehouse/PalletReviewDialog';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { stringifyMeta, type ReviewItemMeta } from '@/hooks/useWarehouseReviewDecisions';

const sanitizeBPInput = (value: string): string => value.replace(/[^0-9.]/g, '');

const fmtPlainQty = (n: number): string => {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const normalizeDbQtyToBoxes = (qty: number, piecesPerBox: number): number => {
  return piecesPerBox > 1 ? dbBPToBoxes(qty, piecesPerBox) : qty;
};

const fmtQty = (n: number, piecesPerBox: number): string => {
  return piecesPerBox > 1 ? boxesToBP(n, piecesPerBox) : fmtPlainQty(n);
};

const getActualNum = (actual: string, piecesPerBox: number): number => {
  return parseBP(actual, piecesPerBox).totalBoxes;
};

const getDbStoredQty = (actual: string, piecesPerBox: number): number => {
  const parsed = parseBP(actual, piecesPerBox);
  return piecesPerBox > 1 ? parseFloat(parsed.display) : parsed.totalBoxes;
};

interface ReviewItem {
  productId: string;
  productName: string;
  imageUrl?: string | null;
  piecesPerBox: number;
  expected: number;
  actual: string;
  status: 'matched' | 'surplus' | 'deficit' | 'unverified';
}

const computeStatus = (expected: number, actual: string, piecesPerBox: number): ReviewItem['status'] => {
  if (actual === '') return 'unverified';
  const actualNum = getActualNum(actual, piecesPerBox);
  const diff = actualNum - expected;
  if (Math.abs(diff) < 0.001) return 'matched';
  return diff > 0 ? 'surplus' : 'deficit';
};

const WarehouseReview: React.FC = () => {
  const navigate = useNavigate();
  const { workerId } = useAuth();
  const queryClient = useQueryClient();
  const { warehouseStock, isLoading: stockLoading, products, branchId } = useWarehouseStock();

  const [activeTab, setActiveTab] = useState('review');
  const [search, setSearch] = useState('');
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [detailsByProduct, setDetailsByProduct] = useState<Record<string, ProductReviewDetails>>({});
  const [detailsDialogProductId, setDetailsDialogProductId] = useState<string | null>(null);
  const [palletDialogOpen, setPalletDialogOpen] = useState(false);

  // Pallet quantity
  const { data: palletQuantity = 0 } = useQuery({
    queryKey: ['branch-pallet-qty', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('branch_pallets')
        .select('quantity')
        .eq('branch_id', branchId!)
        .single();
      return data?.quantity || 0;
    },
    enabled: !!branchId,
  });

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of warehouseStock) {
      map.set(s.product_id, (map.get(s.product_id) ?? 0) + Number(s.quantity || 0));
    }
    return map;
  }, [warehouseStock]);

  // Build a product pieces_per_box lookup
  const piecesPerBoxMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.id, p.pieces_per_box || 20);
    }
    return map;
  }, [products]);

  // Compute items reactively from products + stock (expected is always fresh)
  const items: ReviewItem[] = useMemo(() => {
    return products.map(product => {
      const rawExpected = stockMap.get(product.id) ?? 0;
      const actual = actuals[product.id] ?? '';
      const ppb = product.pieces_per_box || 20;
      const expected = normalizeDbQtyToBoxes(rawExpected, ppb);
      return {
        productId: product.id,
        productName: getProductDisplayName(product),
        imageUrl: product.image_url,
        piecesPerBox: ppb,
        expected,
        actual,
        status: computeStatus(expected, actual, ppb),
      };
    });
  }, [products, stockMap, actuals]);

  // Damaged items
  const damagedItems = useMemo(() => {
    return warehouseStock
      .filter(ws => (ws as any).damaged_quantity > 0)
      .map(ws => {
        const product = products.find(p => p.id === ws.product_id);
        const ppb = product?.pieces_per_box || 20;
        return {
          productId: ws.product_id,
          productName: product ? getProductDisplayName(product) : '—',
          expected: normalizeDbQtyToBoxes((ws as any).damaged_quantity || 0, ppb),
        };
      });
  }, [warehouseStock, products]);

  const [damagedActuals, setDamagedActuals] = useState<Record<string, string>>({});
  const [palletActual, setPalletActual] = useState('');

  useEffect(() => {
    const actuals: Record<string, string> = {};
    damagedItems.forEach(d => { actuals[d.productId] = ''; });
    setDamagedActuals(actuals);
  }, [damagedItems.length]);

  const updateActual = (productId: string, value: string) => {
    setActuals(prev => ({ ...prev, [productId]: value }));
  };

  const markAllMatched = () => {
    const newActuals: Record<string, string> = {};
    for (const product of products) {
      const rawExpected = stockMap.get(product.id) ?? 0;
      const ppb = product.pieces_per_box || 20;
      const expected = normalizeDbQtyToBoxes(rawExpected, ppb);
      newActuals[product.id] = fmtQty(expected, ppb);
    }
    setActuals(newActuals);
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter(i => i.productName.includes(search));
  }, [items, search]);

  const stats = useMemo(() => {
    let matched = 0, surplus = 0, deficit = 0, unverified = 0;
    for (const item of items) {
      if (item.status === 'matched') matched++;
      else if (item.status === 'surplus') surplus++;
      else if (item.status === 'deficit') deficit++;
      else unverified++;
    }
    // Include pallet as a step in the total count
    const palletCounted = palletActual.trim() !== '';
    const totalWithPallet = items.length + 1;
    const unverifiedWithPallet = unverified + (palletCounted ? 0 : 1);
    if (palletCounted) {
      const palletNum = parseFloat(palletActual) || 0;
      const palletDiff = palletNum - palletQuantity;
      if (Math.abs(palletDiff) < 0.001) matched++;
      else if (palletDiff > 0) surplus++;
      else deficit++;
    }
    return { matched, surplus, deficit, unverified: unverifiedWithPallet, total: totalWithPallet };
  }, [items, palletActual, palletQuantity]);

  const canSave = stats.unverified === 0 && items.length > 0 && palletActual.trim() !== '';

  const handleSave = async () => {
    if (!workerId || !branchId || !canSave) return;
    setIsSaving(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('warehouse_review_sessions')
        .insert({
          branch_id: branchId,
          reviewer_id: workerId,
          status: 'completed',
          include_damaged: true,
          include_pallets: true,
          total_products: items.length,
          total_discrepancies: stats.surplus + stats.deficit,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const reviewItems = items.map(item => {
        const d = detailsByProduct[item.productId];
        const meta: ReviewItemMeta = {
          decision_status: item.status === 'matched' ? 'auto_approved' : 'pending',
          reviewer_worker_id: workerId,
        };
        return {
          session_id: session.id,
          item_type: 'product',
          product_id: item.productId,
          expected_quantity: item.expected,
          actual_quantity: getActualNum(item.actual, item.piecesPerBox),
          status: item.status as string,
          boxes_quantity: d?.boxes ?? 0,
          pieces_quantity: d?.pieces ?? 0,
          hall_quantity: d?.hall ?? 0,
          damaged_quantity: d?.damaged ?? 0,
          notes: stringifyMeta(meta),
        };
      });

      {
        for (const d of damagedItems) {  
          const actualStr = damagedActuals[d.productId] ?? '';
          const ppb = piecesPerBoxMap.get(d.productId) || 20;
          const actualNum = getActualNum(actualStr, ppb);
          const diff = actualNum - d.expected;
          const dmgStatus = Math.abs(diff) < 0.001 ? 'matched' : diff > 0 ? 'surplus' : 'deficit';
          const meta: ReviewItemMeta = {
            decision_status: dmgStatus === 'matched' ? 'auto_approved' : 'pending',
            reviewer_worker_id: workerId,
          };
          reviewItems.push({
            session_id: session.id,
            item_type: 'damaged',
            product_id: d.productId,
            expected_quantity: d.expected,
            actual_quantity: actualNum,
            status: dmgStatus,
            boxes_quantity: 0,
            pieces_quantity: 0,
            hall_quantity: 0,
            damaged_quantity: actualNum,
            notes: stringifyMeta(meta),
          });
        }
      }

      {
        const palletNum = parseFloat(palletActual) || 0;
        const diff = palletNum - palletQuantity;
        const palStatus = Math.abs(diff) < 0.001 ? 'matched' : diff > 0 ? 'surplus' : 'deficit';
        const meta: ReviewItemMeta = {
          decision_status: palStatus === 'matched' ? 'auto_approved' : 'pending',
          reviewer_worker_id: workerId,
        };
        reviewItems.push({
          session_id: session.id,
          item_type: 'pallet',
          product_id: null as any,
          expected_quantity: palletQuantity,
          actual_quantity: palletNum,
          status: palStatus,
          boxes_quantity: 0,
          pieces_quantity: 0,
          hall_quantity: 0,
          damaged_quantity: 0,
          notes: stringifyMeta(meta),
        });
      }

      if (reviewItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('warehouse_review_items')
          .insert(reviewItems);
        if (itemsError) throw itemsError;
      }

      // تحديث المخزون فقط للعناصر المطابقة
      // الفوارق تبقى معلّقة بانتظار قرار مدير الفرع
      for (const item of items) {
        if (item.status === 'matched') {
          await supabase
            .from('warehouse_stock')
            .update({ quantity: getDbStoredQty(item.actual, item.piecesPerBox) })
            .eq('branch_id', branchId)
            .eq('product_id', item.productId);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['warehouse-review-history'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-product-summary'] });
      toast.success(`تم حفظ المراجعة: ${stats.matched} مطابق، ${stats.surplus} فائض، ${stats.deficit} عجز`);
      
      // Reset for new review
      setActuals({});
      setActiveTab('history');
    } catch (err: any) {
      toast.error(err.message || 'خطأ في حفظ المراجعة');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusIcon = (status: ReviewItem['status']) => {
    switch (status) {
      case 'matched': return <CheckCircle className="w-4 h-4 text-primary shrink-0" />;
      case 'surplus': return <TrendingUp className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'deficit': return <TrendingDown className="w-4 h-4 text-destructive shrink-0" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  if (stockLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date().getDay();
  const isReviewDay = [0, 2, 4].includes(today);
  const progressPct = stats.total > 0 ? Math.round(((stats.total - stats.unverified) / stats.total) * 100) : 0;

  // Split items: pending (unverified) vs reviewed
  const pendingItems = filteredItems.filter(i => i.status === 'unverified');
  const reviewedItems = filteredItems.filter(i => i.status !== 'unverified');

  const renderProductCard = (item: ReviewItem) => {
    const actualNum = item.actual !== '' ? getActualNum(item.actual, item.piecesPerBox) : null;
    const diffNum = actualNum !== null ? actualNum - item.expected : null;
    const ppb = item.piecesPerBox;

    const toBP = (val: number) => {
      if (ppb <= 1) return fmtPlainQty(val);
      const abs = Math.abs(val);
      const totalPieces = Math.round(abs * ppb);
      const boxes = Math.floor(totalPieces / ppb);
      const pieces = totalPieces % ppb;
      return `${boxes}.${String(pieces).padStart(2, '0')}`;
    };

    const statusStyles =
      item.status === 'matched' ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950/30' :
      item.status === 'surplus' ? 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/30' :
      item.status === 'deficit' ? 'ring-2 ring-destructive bg-destructive/10' :
      'bg-card';

    return (
      <button
        key={item.productId}
        onClick={() => setDetailsDialogProductId(item.productId)}
        className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all hover:shadow-md active:scale-95 ${statusStyles}`}
      >
        {item.status !== 'unverified' && (
          <div className="absolute top-1.5 left-1.5">
            {getStatusIcon(item.status)}
          </div>
        )}
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
            <Package className="w-7 h-7 text-muted-foreground" />
          </div>
        )}
        <span className="text-[11px] font-semibold leading-tight line-clamp-2 w-full">{item.productName}</span>
        <div className="w-full flex flex-col gap-1 mt-0.5">
          {/* المتوقع */}
          <div className="flex items-center justify-between rounded-md bg-muted/60 px-1.5 py-0.5">
            <span className="text-[8px] text-muted-foreground font-medium">المتوقع</span>
            <span className="text-[10px] font-bold text-foreground">{toBP(item.expected)}</span>
          </div>
          {actualNum !== null && (
            <>
              {/* الفعلي */}
              <div className={`flex items-center justify-between rounded-md px-1.5 py-0.5 ${
                item.status === 'matched' ? 'bg-green-100 dark:bg-green-900/30'
                : item.status === 'surplus' ? 'bg-amber-100 dark:bg-amber-900/30'
                : item.status === 'deficit' ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-muted/60'
              }`}>
                <span className="text-[8px] text-muted-foreground font-medium">الفعلي</span>
                <span className="text-[10px] font-bold">{toBP(actualNum)}</span>
              </div>
              {/* الفرق */}
              <div className={`flex items-center justify-between rounded-md px-1.5 py-0.5 ${
                diffNum !== null && Math.abs(diffNum) >= 0.001
                  ? diffNum > 0 ? 'bg-amber-200/70 dark:bg-amber-900/40' : 'bg-red-200/70 dark:bg-red-900/40'
                  : 'bg-green-200/70 dark:bg-green-900/40'
              }`}>
                <span className="text-[8px] text-muted-foreground font-medium">الفرق</span>
                <span className={`text-[10px] font-extrabold ${
                  diffNum !== null && Math.abs(diffNum) >= 0.001
                    ? diffNum > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {Math.abs(diffNum!) < 0.001 ? '0' : `${diffNum! > 0 ? '+' : '-'}${toBP(diffNum!)}`}
                </span>
              </div>
            </>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="pb-32 min-h-screen bg-muted/20 max-w-4xl mx-auto" dir="rtl">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="px-4 pt-3 pb-2 space-y-2">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              مراجعة المخزون
            </h2>
            <div className="flex items-center gap-1">
              {isReviewDay && (
                <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/15 text-[10px] gap-1">
                  ✅ يوم المراجعة
                </Badge>
              )}
              <Button
                size="sm"
                variant={activeTab === 'history' ? 'default' : 'outline'}
                onClick={() => setActiveTab(activeTab === 'history' ? 'review' : 'history')}
                className="h-8 px-2 gap-1 text-xs"
              >
                <History className="w-3.5 h-3.5" />
                {activeTab === 'history' ? 'مراجعة جديدة' : 'السجل'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(-1)} className="h-8 px-2">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="review" className="space-y-3 mt-0">
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground bg-card border rounded-lg">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                {search ? 'لا توجد منتجات مطابقة للبحث' : 'لا توجد منتجات للمراجعة'}
              </div>
            )}

            {filteredItems.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                {filteredItems.map(renderProductCard)}
                {/* بطاقة الباليطات */}
                {(() => {
                  const palletNum = palletActual !== '' ? (parseFloat(palletActual) || 0) : null;
                  const palletDiff = palletNum !== null ? palletNum - palletQuantity : null;
                  const palletStatus = palletNum === null ? 'unverified'
                    : Math.abs(palletDiff!) < 0.001 ? 'matched'
                    : palletDiff! > 0 ? 'surplus' : 'deficit';
                  const palletStyles =
                    palletStatus === 'matched' ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950/30' :
                    palletStatus === 'surplus' ? 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/30' :
                    palletStatus === 'deficit' ? 'ring-2 ring-destructive bg-destructive/10' :
                    'bg-card';
                  const palletStatusIcon =
                    palletStatus === 'matched' ? <CheckCircle className="w-4 h-4 text-primary shrink-0" /> :
                    palletStatus === 'surplus' ? <TrendingUp className="w-4 h-4 text-amber-500 shrink-0" /> :
                    palletStatus === 'deficit' ? <TrendingDown className="w-4 h-4 text-destructive shrink-0" /> : null;

                  return (
                    <button
                      key="pallet-card"
                      onClick={() => {
                        setPalletDialogOpen(true);
                      }}
                      className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all hover:shadow-md active:scale-95 ${palletStyles}`}
                    >
                      {palletStatusIcon && (
                        <div className="absolute top-1.5 left-1.5">
                          {palletStatusIcon}
                        </div>
                      )}
                      <img src={palletImage} alt="باليط" className="w-16 h-16 rounded-lg object-cover" />
                      <span className="text-[11px] font-semibold leading-tight line-clamp-2 w-full">الباليطات</span>
                      <div className="w-full flex flex-col gap-1 mt-0.5">
                        <div className="flex items-center justify-between rounded-md bg-muted/60 px-1.5 py-0.5">
                          <span className="text-[8px] text-muted-foreground font-medium">المتوقع</span>
                          <span className="text-[10px] font-bold text-foreground">{palletQuantity}</span>
                        </div>
                        {palletNum !== null && (
                          <>
                            <div className={`flex items-center justify-between rounded-md px-1.5 py-0.5 ${
                              palletStatus === 'matched' ? 'bg-green-100 dark:bg-green-900/30' :
                              palletStatus === 'surplus' ? 'bg-amber-100 dark:bg-amber-900/30' :
                              palletStatus === 'deficit' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted/40'
                            }`}>
                              <span className="text-[8px] text-muted-foreground font-medium">الفعلي</span>
                              <span className="text-[10px] font-bold">{palletNum}</span>
                            </div>
                            <div className={`flex items-center justify-between rounded-md px-1.5 py-0.5 ${
                              palletDiff !== null && Math.abs(palletDiff) >= 0.001
                                ? palletDiff > 0 ? 'bg-amber-200/70 dark:bg-amber-900/40' : 'bg-red-200/70 dark:bg-red-900/40'
                                : 'bg-green-200/70 dark:bg-green-900/40'
                            }`}>
                              <span className="text-[8px] text-muted-foreground font-medium">الفرق</span>
                              <span className={`text-[10px] font-extrabold ${
                                palletDiff !== null && Math.abs(palletDiff) >= 0.001
                                  ? palletDiff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-destructive'
                                  : 'text-green-600 dark:text-green-400'
                              }`}>
                                {Math.abs(palletDiff!) < 0.001 ? '0' : `${palletDiff! > 0 ? '+' : ''}${palletDiff}`}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })()}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {branchId && <WarehouseReviewHistory branchId={branchId} />}
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Save bar */}
      {activeTab === 'review' && canSave && (
        <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-4 py-2.5 z-50 max-w-4xl mx-auto">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full gap-2 h-11 text-sm font-bold"
            size="lg"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            حفظ المراجعة ({stats.total} منتج)
          </Button>
        </div>
      )}

      {detailsDialogProductId && (() => {
        const item = items.find(i => i.productId === detailsDialogProductId);
        if (!item) return null;
        return (
          <ProductReviewDetailsDialog
            open={!!detailsDialogProductId}
            onOpenChange={(o) => { if (!o) setDetailsDialogProductId(null); }}
            productName={item.productName}
            imageUrl={item.imageUrl}
            piecesPerBox={item.piecesPerBox}
            expected={item.expected}
            initial={detailsByProduct[item.productId]}
            onSave={(d) => {
              setDetailsByProduct(prev => ({ ...prev, [item.productId]: d }));
              const ppb = item.piecesPerBox > 0 ? item.piecesPerBox : 1;
              const goodTotal = d.boxes + d.pieces / ppb;
              const damagedTotal = d.damaged || 0;
              const total = goodTotal + damagedTotal;
              updateActual(item.productId, fmtQty(total, item.piecesPerBox));
            }}
          />
        );
      })()}

      <PalletReviewDialog
        open={palletDialogOpen}
        onOpenChange={setPalletDialogOpen}
        expected={palletQuantity}
        initial={palletActual}
        onSave={(val) => setPalletActual(val)}
      />
    </div>
  );
};

export default WarehouseReview;
