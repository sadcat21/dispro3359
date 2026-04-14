import { getProductDisplayName } from '@/utils/productDisplayName';
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Package, Trash2, Loader2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ExchangeItem {
  product_id: string;
  product_name: string;
  damaged_pieces: number;
  pieces_per_box: number;
}

interface ExchangeSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  workerName: string;
  branchId: string;
  onComplete?: () => void | Promise<void>;
}

const fmtQty = (n: number) => {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const customToTotalPieces = (customQty: number, piecesPerBox: number): number => {
  const rounded = Math.round(customQty * 100) / 100;
  const boxes = Math.floor(rounded);
  const pieces = Math.round((rounded - boxes) * 100);
  return (boxes * piecesPerBox) + pieces;
};

const totalPiecesToCustom = (totalPieces: number, piecesPerBox: number): number => {
  const boxes = Math.floor(totalPieces / piecesPerBox);
  const pieces = totalPieces % piecesPerBox;
  return boxes + pieces / 100;
};

const piecesToCustomQty = (pieces: number, piecesPerBox: number): number => {
  return totalPiecesToCustom(Math.max(0, Math.floor(pieces)), piecesPerBox);
};

const ExchangeSessionDialog: React.FC<ExchangeSessionDialogProps> = ({
  open, onOpenChange, workerId, workerName, branchId, onComplete,
}) => {
  const queryClient = useQueryClient();
  const { workerId: currentWorkerId } = useAuth();
  const [items, setItems] = useState<ExchangeItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; app_name?: string | null; pieces_per_box: number; image_url?: string | null }[]>([]);
  const [workerStock, setWorkerStock] = useState<Record<string, number>>({});
  
  // Single product quantity entry (like ProductPickerDialog)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setSelectedProductId(null);
    setQtyInput('');
    const fetchData = async () => {
      const prodRes = await supabase.from('products').select('id, name, app_name, pieces_per_box, image_url').eq('is_active', true).order('name');
      setProducts(prodRes.data || []);
      // Fetch worker's current truck stock from worker_stock table
      const { data: stockData } = await supabase
        .from('worker_stock')
        .select('product_id, quantity')
        .eq('worker_id', workerId)
        .gt('quantity', 0);
      const stockMap: Record<string, number> = {};
      (stockData || []).forEach((item: any) => {
        stockMap[item.product_id] = Number(item.quantity || 0);
      });
      setWorkerStock(stockMap);
    };
    fetchData();
  }, [open, workerId]);

  const addedMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.product_id] = i.damaged_pieces; });
    return map;
  }, [items]);

  const handleProductTap = (p: typeof products[0]) => {
    const existing = items.find(i => i.product_id === p.id);
    setSelectedProductId(p.id);
    setQtyInput(existing ? String(existing.damaged_pieces) : '');
  };

  const handleConfirmQty = () => {
    if (!selectedProductId) return;
    const qty = parseInt(qtyInput || '0', 10);
    if (qty <= 0) {
      // Remove if zero
      setItems(prev => prev.filter(i => i.product_id !== selectedProductId));
    } else {
      const product = products.find(p => p.id === selectedProductId);
      if (!product) return;
      setItems(prev => {
        const existing = prev.find(i => i.product_id === selectedProductId);
        if (existing) {
          return prev.map(i => i.product_id === selectedProductId ? { ...i, damaged_pieces: qty } : i);
        }
        return [...prev, {
          product_id: selectedProductId,
          product_name: getProductDisplayName(product),
          damaged_pieces: qty,
          pieces_per_box: product.pieces_per_box,
        }];
      });
    }
    setSelectedProductId(null);
    setQtyInput('');
  };

  const handleRemoveProduct = (productId: string) => {
    setItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const validItems = items.filter(i => i.damaged_pieces > 0);

  const handleConfirm = async () => {
    if (validItems.length === 0) {
      toast.error('يرجى إضافة منتج واحد على الأقل مع كمية');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('loading_sessions')
        .insert({
          worker_id: workerId,
          manager_id: currentWorkerId!,
          branch_id: branchId,
          status: 'exchange',
          notes: `جلسة استبدال تالف - ${validItems.length} منتج`,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (sessionError) throw sessionError;

      for (const item of validItems) {
        const exchangeQtyCustom = piecesToCustomQty(item.damaged_pieces, item.pieces_per_box);

        await supabase.from('loading_session_items').insert({
          session_id: session.id,
          product_id: item.product_id,
          quantity: exchangeQtyCustom,
          gift_quantity: 0,
          gift_unit: 'piece',
          surplus_quantity: 0,
          is_custom_load: false,
          notes: `استبدال تالف: ${fmtQty(exchangeQtyCustom)}`,
        });

        const { data: whStock } = await supabase
          .from('warehouse_stock')
          .select('id, quantity, damaged_quantity')
          .eq('branch_id', branchId)
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (whStock) {
          const warehouseQtyPieces = customToTotalPieces(Number(whStock.quantity || 0), item.pieces_per_box);
          const warehouseDamagedPieces = customToTotalPieces(Number(whStock.damaged_quantity || 0), item.pieces_per_box);
          const newQtyPieces = Math.max(0, warehouseQtyPieces - item.damaged_pieces);
          const newDamagedPieces = warehouseDamagedPieces + item.damaged_pieces;

          await supabase
            .from('warehouse_stock')
            .update({
              quantity: totalPiecesToCustom(newQtyPieces, item.pieces_per_box),
              damaged_quantity: totalPiecesToCustom(newDamagedPieces, item.pieces_per_box),
            })
            .eq('id', whStock.id);
        } else {
          await supabase.from('warehouse_stock').insert({
            branch_id: branchId,
            product_id: item.product_id,
            quantity: 0,
            damaged_quantity: exchangeQtyCustom,
          });
        }

        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          branch_id: branchId,
          quantity: exchangeQtyCustom,
          movement_type: 'exchange',
          status: 'approved',
          created_by: currentWorkerId,
          worker_id: workerId,
          notes: `استبدال تالف - ${item.product_name}`,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['loading-sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] }),
        queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] }),
        queryClient.invalidateQueries({ queryKey: ['worker-load-suggestions'] }),
        queryClient.invalidateQueries({ queryKey: ['warehouse-product-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] }),
      ]);

      toast.success(`تم تسجيل استبدال ${validItems.length} منتج تالف بنجاح`);
      onOpenChange(false);
      await onComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'خطأ في تسجيل الاستبدال');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = selectedProductId ? products.find(p => p.id === selectedProductId) : null;

  const renderProductButton = (p: typeof products[0]) => {
    const isAdded = !!addedMap[p.id];
    const addedQty = addedMap[p.id] || 0;

    return (
      <button
        key={p.id}
        className={`flex flex-col rounded-xl overflow-hidden text-center transition-all relative bg-card shadow-sm border cursor-pointer active:scale-95
          ${isAdded ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-border/50'}
        `}
        onClick={() => handleProductTap(p)}
      >
        <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full
          ${isAdded ? 'bg-orange-500/10 text-orange-700' : 'bg-muted/30 text-foreground'}
        `}>
          {getProductDisplayName(p)}
        </div>

        {p.image_url ? (
          <img src={p.image_url} alt={getProductDisplayName(p)} className="w-full aspect-square object-cover" loading="lazy" />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center bg-muted/20">
            <Package className="w-6 h-6 text-muted-foreground/30" />
          </div>
        )}

        <div className="flex flex-col items-center gap-0.5 p-0.5 min-h-[22px]">
          {isAdded ? (
            <div className="flex items-center gap-0.5 w-full">
              <Badge className="bg-orange-500 text-white text-[9px] px-1 py-0 h-4 flex items-center gap-0.5 flex-1 justify-center">
                <RefreshCw className="w-2.5 h-2.5" />
                {fmtQty(piecesToCustomQty(addedQty, p.pieces_per_box))}
              </Badge>
              <div
                className="flex items-center justify-center bg-destructive text-destructive-foreground rounded h-4 w-5 cursor-pointer shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveProduct(p.id);
                }}
              >
                <Trash2 className="w-2.5 h-2.5" />
              </div>
            </div>
          ) : (
            <span className="text-[9px] text-muted-foreground font-medium">
              {workerStock[p.id] > 0 ? fmtQty(workerStock[p.id]) : '0'}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-md h-[90dvh] max-h-[90dvh] gap-0 flex flex-col overflow-hidden p-0 [&>button:last-child]:hidden" dir="rtl">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق"
            className="absolute start-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-white shadow-sm transition-colors hover:bg-destructive/90"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="flex items-center gap-2 text-sm font-bold">
              <RefreshCw className="w-5 h-5 text-orange-500" />
              استبدال تالف
              <span className="text-orange-600 truncate max-w-[120px]">{workerName}</span>
              {validItems.length > 0 && (
                <Badge className="bg-orange-500 text-white text-[10px]">{validItems.length} منتج</Badge>
              )}
            </div>
            
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-1 touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="grid grid-cols-4 gap-1.5">
              {products.map(renderProductButton)}
            </div>
            {products.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">لا توجد منتجات</div>
            )}
          </div>

          <div className="px-3 py-2 border-t shrink-0 flex gap-2">
            <Button variant="outline" className="h-10 px-4 text-xs font-semibold" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              className="flex-1 h-10 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleConfirm}
              disabled={isSubmitting || validItems.length === 0}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              <Check className="w-4 h-4 me-1" />
              {validItems.length > 0 ? `تأكيد الاستبدال (${validItems.length})` : 'تأكيد الاستبدال'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quantity entry dialog */}
      <Dialog
        open={!!selectedProduct}
        onOpenChange={(v) => {
          if (!v) { setSelectedProductId(null); setQtyInput(''); }
        }}
      >
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="w-4 h-4 text-orange-500" />
              كمية التالف
            </DialogTitle>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-2">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={getProductDisplayName(selectedProduct)} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-base text-orange-600 truncate">{getProductDisplayName(selectedProduct)}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">الصندوق = {selectedProduct.pieces_per_box} قطعة</p>
                  {addedMap[selectedProduct.id] > 0 && (
                    <p className="text-xs text-orange-600 mt-0.5">الكمية الحالية: <strong>{addedMap[selectedProduct.id]}</strong> قطعة</p>
                  )}
                </div>
              </div>

              <div className="space-y-1 border rounded-lg p-2.5 bg-muted/40">
                <Label className="text-xs font-semibold">عدد القطع التالفة</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={qtyInput}
                  onChange={e => setQtyInput(e.target.value)}
                  onFocus={e => e.target.select()}
                  className="h-11 text-center text-lg font-bold"
                  placeholder="0"
                  autoFocus
                />
                {parseInt(qtyInput || '0') > 0 && (
                  <div className="text-center text-[11px] text-muted-foreground">
                    = {fmtQty(piecesToCustomQty(parseInt(qtyInput), selectedProduct.pieces_per_box))} (صندوق.قطعة)
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleConfirmQty}
                  disabled={!qtyInput || parseInt(qtyInput) <= 0}
                  className="w-full h-11 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {addedMap[selectedProduct.id] > 0 ? 'تعديل الكمية' : 'إضافة كتالف'}
                </Button>
                {addedMap[selectedProduct.id] > 0 && (
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs text-destructive border-destructive/30"
                    onClick={() => {
                      handleRemoveProduct(selectedProduct.id);
                      setSelectedProductId(null);
                      setQtyInput('');
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 me-1" />
                    إزالة المنتج
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => { setSelectedProductId(null); setQtyInput(''); }}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExchangeSessionDialog;
