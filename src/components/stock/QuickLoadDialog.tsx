import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Truck, Package, Loader2, PackageX } from 'lucide-react';
import { parseBP, boxesToBP } from '@/utils/boxPieceInput';
import palletImage from '@/assets/pallet.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWarehouseStock } from '@/hooks/useWarehouseStock';
import { useWorkerLoadSuggestions } from '@/hooks/useStockAlerts';
import { useMarkProductUnavailable } from '@/hooks/useShortageTracking';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface QuickLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  workerName: string;
  deficitItems: { product_id: string; product_name: string; deficit: number; pieces_per_box?: number }[];
}

interface QuantityFields {
  boxes: string;
  pieces: string;
}

interface LoadEntry {
  product_id: string;
  product_name: string;
  deficit: number;
  quantity: number;
  warehouseAvailable: number;
  piecesPerBox: number;
  fields: QuantityFields;
}

const sanitizeDigits = (value: string, maxDigits: number) => value.replace(/\D/g, '').slice(0, maxDigits);

const quantityToFields = (quantity: number, piecesPerBox: number): QuantityFields => {
  const parsed = parseBP(boxesToBP(quantity, piecesPerBox), piecesPerBox);
  return {
    boxes: String(parsed.boxes),
    pieces: parsed.pieces > 0 ? String(parsed.pieces) : '',
  };
};

const fieldsToQuantity = (fields: QuantityFields, piecesPerBox: number): number => {
  const boxes = sanitizeDigits(fields.boxes, 5) || '0';
  const pieces = sanitizeDigits(fields.pieces, 3) || '0';
  return parseBP(`${boxes}.${pieces}`, piecesPerBox).totalBoxes;
};

const QuickLoadDialog: React.FC<QuickLoadDialogProps> = ({
  open, onOpenChange, workerId, workerName, deficitItems
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { warehouseStock, loadToWorker } = useWarehouseStock();
  const { data: suggestions = [] } = useWorkerLoadSuggestions(open ? workerId : null);
  const markUnavailable = useMarkProductUnavailable();
  const [entries, setEntries] = useState<LoadEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [markingProduct, setMarkingProduct] = useState<string | null>(null);
  const [productsInfo, setProductsInfo] = useState<Record<string, number>>({});
  const [palletCount, setPalletCount] = useState<string>('');
  const confirmLockRef = useRef(false);

  // Fetch pieces_per_box for all products
  useEffect(() => {
    if (!open || deficitItems.length === 0) return;
    const ids = deficitItems.map(d => d.product_id);
    supabase
      .from('products')
      .select('id, pieces_per_box')
      .in('id', ids)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data || []).forEach((p: any) => { map[p.id] = p.pieces_per_box || 1; });
        setProductsInfo(map);
      });
  }, [open, deficitItems]);

  const handleMarkUnavailable = async (productId: string, productName: string) => {
    setMarkingProduct(productId);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, customer_id, assigned_worker_id, created_by, status, order_items!inner(product_id, quantity)')
        .in('status', ['pending', 'assigned', 'in_progress']);

      const validOrders = (orders || []).filter((o: any) =>
        (o.order_items || []).some((oi: any) => oi.product_id === productId)
      );

      if (validOrders.length === 0) {
        toast.info(t('stock.shortage_no_orders'));
        return;
      }

      const mappedOrders = validOrders.map((o: any) => {
        const item = (o.order_items || []).find((oi: any) => oi.product_id === productId);
        return {
          orderId: o.id,
          customerId: o.customer_id,
          workerId: o.assigned_worker_id || o.created_by,
          quantity: item?.quantity || 0,
        };
      });

      await markUnavailable.mutateAsync({ productId, orders: mappedOrders });
      toast.success(`${t('stock.shortage_marked')} ${productName} ${t('stock.shortage_as_unavailable')}`);
      setEntries(prev => prev.filter(e => e.product_id !== productId));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMarkingProduct(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    const items = deficitItems.map(d => {
      const available = warehouseStock.find(s => s.product_id === d.product_id)?.quantity || 0;
      const ppb = d.pieces_per_box || productsInfo[d.product_id] || 1;
      const qty = Math.min(d.deficit, available);
      return {
        product_id: d.product_id,
        product_name: d.product_name,
        deficit: d.deficit,
        quantity: qty,
        warehouseAvailable: available,
        piecesPerBox: ppb,
        fields: quantityToFields(qty, ppb),
      };
    });
    setEntries(items);
  }, [open, deficitItems, warehouseStock, productsInfo]);

  const updateFields = (index: number, field: 'boxes' | 'pieces', value: string) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e;
      const newFields = { ...e.fields, [field]: sanitizeDigits(value, field === 'boxes' ? 5 : 3) };
      const newQty = fieldsToQuantity(newFields, e.piecesPerBox);
      const clamped = Math.max(0, Math.min(newQty, e.warehouseAvailable));
      return { ...e, fields: newFields, quantity: clamped };
    }));
  };

  const handleBlur = (index: number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e;
      const qty = Math.max(0, Math.min(fieldsToQuantity(e.fields, e.piecesPerBox), e.warehouseAvailable));
      return { ...e, quantity: qty, fields: quantityToFields(qty, e.piecesPerBox) };
    }));
  };

  const validEntries = entries.filter(e => e.quantity > 0);
  const totalItems = validEntries.reduce((s, e) => s + e.quantity, 0);

  const handleConfirm = async () => {
    if (confirmLockRef.current || isSaving) return;
    if (validEntries.length === 0) {
      toast.error(t('stock.add_products'));
      return;
    }
    confirmLockRef.current = true;
    setIsSaving(true);
    try {
      const loadItems = validEntries.map(e => ({
        product_id: e.product_id,
        quantity: e.quantity,
        notes: `شحن سريع من التنبيهات - ${e.product_name}`,
      }));
      const palletNum = Math.max(0, parseInt(palletCount, 10) || 0);
      await loadToWorker(workerId, loadItems, palletNum);
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['branch-pallet-qty'] });
      toast.success(t('stock.loaded_success'));
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      confirmLockRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {t('stock.quick_load')} - {workerName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 p-1">
            {entries.map((entry, index) => {
              const ppb = entry.piecesPerBox;
              const parsed = parseBP(`${entry.fields.boxes || '0'}.${entry.fields.pieces || '0'}`, ppb);
              const displayBP = parsed.pieces > 0
                ? `${parsed.boxes}.${String(parsed.pieces).padStart(2, '0')}`
                : `${parsed.boxes}`;

              return (
                <div key={entry.product_id} className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate flex-1">{entry.product_name}</span>
                    {ppb > 1 && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        الصندوق = {ppb} قطعة
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t('stock.deficit')}: <strong className="text-destructive">{entry.deficit}</strong></span>
                    <span>|</span>
                    <span>{t('stock.available')}: <strong>{entry.warehouseAvailable}</strong></span>
                  </div>

                  {/* Box + Piece fields */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <span>الكمية (صندوق.قطع)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-center">
                        <label className="text-[10px] text-muted-foreground">الصندوق</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={entry.fields.boxes}
                          onChange={e => updateFields(index, 'boxes', e.target.value)}
                          onBlur={() => handleBlur(index)}
                          onFocus={e => e.target.select()}
                          className="text-center h-10 text-base"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex-1 text-center">
                        <label className="text-[10px] text-muted-foreground">القطع</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={entry.fields.pieces}
                          onChange={e => updateFields(index, 'pieces', e.target.value)}
                          onBlur={() => handleBlur(index)}
                          onFocus={e => e.target.select()}
                          className="text-center h-10 text-base"
                          placeholder="000"
                        />
                      </div>
                    </div>
                    {parsed.totalBoxes > 0 && (
                      <div className="text-center text-[11px] text-muted-foreground">
                        سيُحفظ: <strong>{displayBP}</strong>
                      </div>
                    )}
                  </div>

                  {entry.warehouseAvailable === 0 && (
                    <div className="flex justify-end">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-700 bg-orange-50 border-orange-300 hover:bg-orange-100 hover:text-orange-800 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-700 dark:hover:bg-orange-900/40"
                              onClick={() => handleMarkUnavailable(entry.product_id, entry.product_name)}
                              disabled={markingProduct === entry.product_id}
                            >
                              <PackageX className="w-4 h-4 me-1" />
                              {t('stock.product_unavailable_short')}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('stock.product_unavailable_short')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {validEntries.length > 0 && (
          <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
            <span className="font-medium">{t('print.header.total')}</span>
            <Badge variant="secondary">{totalItems} {t('stock.boxes')}</Badge>
          </div>
        )}

        {/* Pallets input — deducted from branch_pallets on load */}
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-3">
          <img src={palletImage} alt="باليط" className="w-10 h-10 rounded-md object-cover border shrink-0" />
          <div className="flex-1">
            <label className="text-xs font-medium text-amber-800 dark:text-amber-300">عدد الباليطات المُسلَّمة</label>
            <Input
              type="text"
              inputMode="numeric"
              value={palletCount}
              onChange={e => setPalletCount(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0"
              className="text-center h-9 mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving || validEntries.length === 0}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
            {t('stock.confirm_load')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickLoadDialog;
