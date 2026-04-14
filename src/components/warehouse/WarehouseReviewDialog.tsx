import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertTriangle, Package, Search, Save, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getProductDisplayName } from '@/utils/productDisplayName';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import BoxPieceInput from '@/components/ui/BoxPieceInput';
import { boxesToBP, dbBPDisplay, dbBPToBoxes } from '@/utils/boxPieceInput';

interface WarehouseReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  products: { id: string; name: string; image_url?: string | null; pieces_per_box?: number | null }[];
  warehouseStock: { product_id: string; quantity: number; damaged_quantity?: number }[];
  palletQuantity?: number;
}

interface ReviewItem {
  productId: string;
  productName: string;
  imageUrl?: string | null;
  itemType: 'product' | 'damaged' | 'pallet';
  expected: number;
  actualNum: number;
  hasValue: boolean;
  status: 'matched' | 'surplus' | 'deficit' | 'unverified';
  piecesPerBox: number;
}

const computeStatus = (expected: number, actualNum: number, hasValue: boolean): ReviewItem['status'] => {
  if (!hasValue) return 'unverified';
  const diff = actualNum - expected;
  if (Math.abs(diff) < 0.001) return 'matched';
  return diff > 0 ? 'surplus' : 'deficit';
};

const WarehouseReviewDialog: React.FC<WarehouseReviewDialogProps> = ({
  open, onOpenChange, branchId, products, warehouseStock, palletQuantity = 0,
}) => {
  const { workerId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [includeDamaged, setIncludeDamaged] = useState(false);
  const [includePallets, setIncludePallets] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const reviewItems: ReviewItem[] = [];

    for (const ws of warehouseStock) {
      const product = products.find(p => p.id === ws.product_id);
      if (!product || ws.quantity <= 0) continue;
      const ppb = product.pieces_per_box || 1;
      // DB stores quantities in BP format (e.g. 1308.08 = 1308 boxes + 8 pieces)
      // Convert to proper fractional boxes for internal calculations
      const expectedInBoxes = ppb > 1 ? dbBPToBoxes(ws.quantity, ppb) : ws.quantity;
      reviewItems.push({
        productId: ws.product_id,
        productName: getProductDisplayName(product),
        imageUrl: (product as any).image_url,
        itemType: 'product',
        expected: expectedInBoxes,
        actualNum: 0,
        hasValue: false,
        status: 'unverified',
        piecesPerBox: ppb,
      });
    }

    setItems(reviewItems);
    setActiveProductId(null);
  }, [open, warehouseStock, products]);

  const damagedItems = useMemo(() => {
    if (!includeDamaged) return [];
    return warehouseStock
      .filter(ws => (ws as any).damaged_quantity > 0)
      .map(ws => {
        const product = products.find(p => p.id === ws.product_id);
        return {
          productId: ws.product_id,
          productName: product?.name || '—',
          expected: (ws as any).damaged_quantity || 0,
          piecesPerBox: product?.pieces_per_box || 1,
        };
      });
  }, [includeDamaged, warehouseStock, products]);

  const [damagedActuals, setDamagedActuals] = useState<Record<string, number>>({});
  const [palletActual, setPalletActual] = useState('');

  useEffect(() => {
    if (includeDamaged) {
      const actuals: Record<string, number> = {};
      damagedItems.forEach(d => { actuals[d.productId] = 0; });
      setDamagedActuals(actuals);
    }
  }, [includeDamaged, damagedItems.length]);

  useEffect(() => {
    if (includePallets) setPalletActual('');
  }, [includePallets]);

  const updateActual = (productId: string, boxValue: number) => {
    setItems(prev => prev.map(item => {
      if (item.productId !== productId || item.itemType !== 'product') return item;
      return { ...item, actualNum: boxValue, hasValue: true, status: computeStatus(item.expected, boxValue, true) };
    }));
  };

  const markAllMatched = () => {
    setActiveProductId(null);
    setItems(prev => prev.map(item => ({
      ...item,
      actualNum: item.expected,
      hasValue: true,
      status: 'matched' as const,
    })));
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter(i => i.productName.includes(search));
  }, [items, search]);

  const pendingItems = useMemo(() => {
    return filteredItems.filter(item => item.status === 'unverified' || item.productId === activeProductId);
  }, [filteredItems, activeProductId]);

  const reviewedItems = useMemo(() => {
    return filteredItems.filter(item => item.status !== 'unverified' && item.productId !== activeProductId);
  }, [filteredItems, activeProductId]);

  const stats = useMemo(() => {
    let matched = 0, surplus = 0, deficit = 0, unverified = 0;
    for (const item of items) {
      if (item.status === 'matched') matched++;
      else if (item.status === 'surplus') surplus++;
      else if (item.status === 'deficit') deficit++;
      else unverified++;
    }
    return { matched, surplus, deficit, unverified, total: items.length };
  }, [items]);

  const canSave = stats.unverified === 0;

  const handleSave = async () => {
    if (!workerId || !canSave) return;
    setIsSaving(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('warehouse_review_sessions')
        .insert({
          branch_id: branchId,
          reviewer_id: workerId,
          status: 'completed',
          include_damaged: includeDamaged,
          include_pallets: includePallets,
          total_products: items.length,
          total_discrepancies: stats.surplus + stats.deficit,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const reviewItemsData = items.map(item => ({
        session_id: session.id,
        item_type: 'product',
        product_id: item.productId,
        expected_quantity: item.expected,
        actual_quantity: item.actualNum,
        status: item.status,
      }));

      if (includeDamaged) {
        for (const d of damagedItems) {
          const actual = damagedActuals[d.productId] ?? 0;
          const diff = actual - d.expected;
          reviewItemsData.push({
            session_id: session.id,
            item_type: 'damaged',
            product_id: d.productId,
            expected_quantity: d.expected,
            actual_quantity: actual,
            status: Math.abs(diff) < 0.001 ? 'matched' : diff > 0 ? 'surplus' : 'deficit',
          });
        }
      }

      if (includePallets) {
        const palletNum = parseFloat(palletActual) || 0;
        const diff = palletNum - palletQuantity;
        reviewItemsData.push({
          session_id: session.id,
          item_type: 'pallet',
          product_id: null as any,
          expected_quantity: palletQuantity,
          actual_quantity: palletNum,
          status: Math.abs(diff) < 0.001 ? 'matched' : diff > 0 ? 'surplus' : 'deficit',
        });
      }

      if (reviewItemsData.length > 0) {
        const { error: itemsError } = await supabase
          .from('warehouse_review_items')
          .insert(reviewItemsData);
        if (itemsError) throw itemsError;
      }

      for (const item of items) {
        if (item.status !== 'matched') {
          // Convert fractional boxes back to BP format for DB storage
          const bpValue = item.piecesPerBox > 1 
            ? parseFloat(boxesToBP(item.actualNum, item.piecesPerBox)) 
            : item.actualNum;
          await supabase
            .from('warehouse_stock')
            .update({ quantity: bpValue })
            .eq('branch_id', branchId)
            .eq('product_id', item.productId);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['warehouse-review-history'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-product-summary'] });
      toast.success(`تم حفظ المراجعة: ${stats.matched} مطابق، ${stats.surplus} فائض، ${stats.deficit} عجز`);
      onOpenChange(false);
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

  const renderProductRow = (item: ReviewItem) => {
    const diff = item.hasValue ? item.actualNum - item.expected : 0;

    return (
      <div key={item.productId} className={`rounded-lg px-3 py-2.5 border ${
        item.status === 'deficit' ? 'border-destructive/30 bg-destructive/5' :
        item.status === 'surplus' ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10' :
        item.status === 'unverified' ? 'border-muted-foreground/20 bg-muted/30' :
        'border-primary/30 bg-primary/5'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{item.productName}</div>
              {item.piecesPerBox > 1 && (
                <div className="text-[9px] text-muted-foreground">{item.piecesPerBox} ق/ص</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-16 text-center">
              <span className="text-sm font-bold text-muted-foreground">
                {item.piecesPerBox > 1 ? boxesToBP(item.expected, item.piecesPerBox) : String(item.expected)}
              </span>
            </div>
            {item.piecesPerBox > 1 ? (
              <BoxPieceInput
                value={item.hasValue ? item.actualNum : 0}
                onChange={(val) => updateActual(item.productId, val)}
                piecesPerBox={item.piecesPerBox}
                className={`w-20 h-8 text-center text-sm font-bold ${
                  item.status === 'matched' ? 'border-primary/50 bg-primary/5' :
                  item.status === 'deficit' ? 'border-destructive/50 bg-destructive/5' :
                  item.status === 'surplus' ? 'border-amber-400/50 bg-amber-50 dark:bg-amber-950/20' :
                  ''
                }`}
                placeholder="—"
                showHint={false}
                onFocus={() => setActiveProductId(item.productId)}
              />
            ) : (
              <Input
                type="number"
                step="0.01"
                placeholder="—"
                value={item.hasValue ? item.actualNum : ''}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  updateActual(item.productId, val);
                }}
                onFocus={() => setActiveProductId(item.productId)}
                onBlur={() => setActiveProductId(current => current === item.productId ? null : current)}
                className={`w-20 h-8 text-center text-sm font-bold ${
                  item.status === 'matched' ? 'border-primary/50 bg-primary/5' :
                  item.status === 'deficit' ? 'border-destructive/50 bg-destructive/5' :
                  item.status === 'surplus' ? 'border-amber-400/50 bg-amber-50 dark:bg-amber-950/20' :
                  ''
                }`}
              />
            )}
            <div className="w-8 flex justify-center">
              {getStatusIcon(item.status)}
            </div>
          </div>
        </div>
        {item.hasValue && item.status !== 'matched' && item.status !== 'unverified' && (
          <div className="mt-1 flex justify-end">
            {item.status === 'surplus' && (
              <Badge className="bg-amber-500 text-white text-[9px]">
                فائض: +{item.piecesPerBox > 1 ? boxesToBP(diff, item.piecesPerBox) : diff}
              </Badge>
            )}
            {item.status === 'deficit' && (
              <Badge variant="destructive" className="text-[9px]">
                عجز: -{item.piecesPerBox > 1 ? boxesToBP(Math.abs(diff), item.piecesPerBox) : Math.abs(diff)}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col overflow-hidden" dir="rtl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            مراجعة مخزون الفرع
          </DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Switch id="include-damaged" checked={includeDamaged} onCheckedChange={setIncludeDamaged} />
              <Label htmlFor="include-damaged" className="text-xs">مراجعة التالف</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="include-pallets" checked={includePallets} onCheckedChange={setIncludePallets} />
              <Label htmlFor="include-pallets" className="text-xs">مراجعة الباليطات</Label>
            </div>
            <Button size="sm" variant="ghost" className="text-xs ms-auto" onClick={markAllMatched}>
              <CheckCircle className="w-3.5 h-3.5 me-1" />
              تطابق الكل
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">{stats.total} منتج</Badge>
            {stats.unverified > 0 && <Badge variant="outline" className="text-[10px] border-muted-foreground/30">{stats.unverified} لم يُراجع</Badge>}
            <Badge className="bg-primary/80 text-primary-foreground text-[10px]">{stats.matched} مطابق</Badge>
            {stats.surplus > 0 && <Badge className="bg-amber-500 text-white text-[10px]">{stats.surplus} فائض</Badge>}
            {stats.deficit > 0 && <Badge variant="destructive" className="text-[10px]">{stats.deficit} عجز</Badge>}
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="بحث عن منتج..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 h-9 text-sm" />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 pe-1 pb-2">
            <div className="flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-muted-foreground">
              <span>المنتج</span>
              <div className="flex items-center gap-4">
                <span className="w-16 text-center">المتوقع</span>
                <span className="w-20 text-center">الفعلي</span>
                <span className="w-8"></span>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                لا توجد منتجات مطابقة للبحث
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {pendingItems.map(renderProductRow)}
                </div>

                {reviewedItems.length > 0 && (
                  <div className="space-y-1.5 border-t pt-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      تمت مراجعتها ({reviewedItems.length})
                    </p>
                    {reviewedItems.map(renderProductRow)}
                  </div>
                )}
              </>
            )}

            {includeDamaged && damagedItems.length > 0 && (
              <div className="pt-2 border-t mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> التالف ({damagedItems.length})
                </p>
                {damagedItems.map(d => {
                  const ppb = d.piecesPerBox || 1;
                  return (
                    <div key={`damaged-${d.productId}`} className="rounded-lg px-3 py-2 border border-border bg-card flex items-center justify-between mb-1.5">
                      <div>
                        <div className="text-sm font-medium">{d.productName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          المتوقع: {ppb > 1 ? boxesToBP(d.expected, ppb) : d.expected}
                        </div>
                      </div>
                      {ppb > 1 ? (
                        <BoxPieceInput
                          value={damagedActuals[d.productId] ?? 0}
                          onChange={val => setDamagedActuals(prev => ({ ...prev, [d.productId]: val }))}
                          piecesPerBox={ppb}
                          className="w-20 h-8 text-center text-sm font-bold"
                          placeholder="—"
                          showHint={false}
                        />
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="—"
                          value={damagedActuals[d.productId] ?? ''}
                          onChange={e => setDamagedActuals(prev => ({ ...prev, [d.productId]: parseFloat(e.target.value) || 0 }))}
                          className="w-20 h-8 text-center text-sm font-bold"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {includePallets && (
              <div className="pt-2 border-t mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">🪵 الباليطات</p>
                <div className="rounded-lg px-3 py-2 border border-border bg-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">رصيد الباليطات</div>
                    <div className="text-[10px] text-muted-foreground">المتوقع: {palletQuantity}</div>
                  </div>
                  <Input
                    type="number"
                    placeholder="—"
                    value={palletActual}
                    onChange={e => setPalletActual(e.target.value)}
                    className="w-20 h-8 text-center text-sm font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 flex-col gap-2">
          {!canSave && (
            <p className="text-xs text-muted-foreground text-center">
              يرجى إدخال الكمية الفعلية لجميع المنتجات ({stats.unverified} متبقي)
            </p>
          )}
          <Button onClick={handleSave} disabled={isSaving || !canSave} className="w-full gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ المراجعة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WarehouseReviewDialog;
