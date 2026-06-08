import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, PackageX, Truck, Warehouse } from 'lucide-react';

interface EmptyTruckItem {
  id: string | null; // null = لا يوجد صف في worker_stock (مُستنتَج من الشحنات)
  product_id: string;
  product_name: string;
  currentQty: number; // ما في الشاحنة حالياً (حسب worker_stock أو الرصيد المتوقَّع)
  returnQty: number;  // الكمية المراد إرجاعها للمخزن
  inferred?: boolean; // الرصيد محسوب من الشحنات لا من worker_stock
}

interface EmptyTruckDialogProps {
  workerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoFullUnload?: boolean;
  onUnloaded?: () => void;
}

const EmptyTruckDialog: React.FC<EmptyTruckDialogProps> = ({ workerId, open, onOpenChange, autoFullUnload, onUnloaded }) => {
  const { t } = useLanguage();
  const { workerId: currentWorkerId, activeBranch } = useAuth();
  const queryClient = useQueryClient();
  const branchId = activeBranch?.id;

  const [isLoading, setIsLoading] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);
  const [items, setItems] = useState<EmptyTruckItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadWorkerStock = async () => {
    if (!workerId || !branchId || !currentWorkerId) return;
    setIsLoading(true);

    // 1) جلب رصيد الشاحنة من worker_stock
    const { data: workerStock } = await supabase
      .from('worker_stock')
      .select('id, product_id, quantity, product:products(name)')
      .eq('worker_id', workerId);

    const stockMap = new Map<string, { id: string; quantity: number; name: string }>();
    (workerStock || []).forEach((ws: any) => {
      stockMap.set(ws.product_id, {
        id: ws.id,
        quantity: Number(ws.quantity || 0),
        name: ws.product?.name || ws.product_id,
      });
    });

    // 2) استنتاج الرصيد المتوقَّع منذ آخر جلسة محاسبة مغلقة
    //    (شحنات − مبيعات) لاكتشاف منتجات بقيت في الشاحنة لكن worker_stock أصبح غير متزامن.
    const { data: lastSession } = await supabase
      .from('accounting_sessions')
      .select('period_end, completed_at')
      .eq('worker_id', workerId)
      .eq('status', 'completed')
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sinceIso = lastSession
      ? (new Date(lastSession.completed_at || lastSession.period_end).toISOString())
      : new Date(0).toISOString();

    // شحنات (تستثني جلسات المراجعة وجلسات التفريغ)
    const { data: shipSessions } = await supabase
      .from('loading_sessions')
      .select('id, notes, status')
      .eq('worker_id', workerId)
      .gte('created_at', sinceIso)
      .neq('status', 'unloaded');

    const shipSessionIds = (shipSessions || [])
      .filter((s: any) => !(s.notes || '').startsWith('جلسة مراجعة'))
      .map((s: any) => s.id);

    const inferredMap = new Map<string, number>();
    if (shipSessionIds.length > 0) {
      const { data: shipItems } = await supabase
        .from('loading_session_items')
        .select('product_id, quantity')
        .in('session_id', shipSessionIds);
      (shipItems || []).forEach((it: any) => {
        inferredMap.set(it.product_id, (inferredMap.get(it.product_id) || 0) + Number(it.quantity || 0));
      });
    }

    // تفريغات سابقة منذ آخر محاسبة
    const { data: unloadSessions } = await supabase
      .from('loading_sessions')
      .select('id')
      .eq('worker_id', workerId)
      .eq('status', 'unloaded')
      .gte('created_at', sinceIso);
    const unloadIds = (unloadSessions || []).map((s: any) => s.id);
    if (unloadIds.length > 0) {
      const { data: unloadItems } = await supabase
        .from('loading_session_items')
        .select('product_id, quantity')
        .in('session_id', unloadIds);
      (unloadItems || []).forEach((it: any) => {
        inferredMap.set(it.product_id, (inferredMap.get(it.product_id) || 0) - Number(it.quantity || 0));
      });
    }

    // المبيعات
    const productIds = Array.from(new Set([...inferredMap.keys(), ...stockMap.keys()]));
    if (productIds.length > 0) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_items(product_id, quantity)')
        .eq('assigned_worker_id', workerId)
        .eq('status', 'delivered')
        .gte('updated_at', sinceIso);
      (orders || []).forEach((o: any) => {
        (o.order_items || []).forEach((oi: any) => {
          if (inferredMap.has(oi.product_id) || stockMap.has(oi.product_id)) {
            inferredMap.set(
              oi.product_id,
              (inferredMap.get(oi.product_id) || 0) - Number(oi.quantity || 0),
            );
          }
        });
      });
    }

    // أسماء المنتجات المُستنتَجة غير الموجودة في stockMap
    const missingNames = productIds.filter(pid => !stockMap.has(pid));
    const namesMap = new Map<string, string>();
    if (missingNames.length > 0) {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name')
        .in('id', missingNames);
      (prods || []).forEach((p: any) => namesMap.set(p.id, p.name));
    }

    // 3) دمج: أي منتج برصيد > 0 (سواء من worker_stock أو الاستنتاج)
    const merged = new Map<string, EmptyTruckItem>();
    stockMap.forEach((v, pid) => {
      const inferred = inferredMap.get(pid);
      const qty = v.quantity > 0 ? v.quantity : (inferred && inferred > 0 ? inferred : 0);
      if (qty > 0) {
        merged.set(pid, {
          id: v.id,
          product_id: pid,
          product_name: v.name,
          currentQty: qty,
          returnQty: qty,
          inferred: v.quantity <= 0 && (inferred || 0) > 0,
        });
      }
    });
    inferredMap.forEach((qty, pid) => {
      if (merged.has(pid) || qty <= 0) return;
      merged.set(pid, {
        id: null,
        product_id: pid,
        product_name: namesMap.get(pid) || pid,
        currentQty: qty,
        returnQty: qty,
        inferred: true,
      });
    });

    const mapped = Array.from(merged.values());
    if (mapped.length === 0) {
      toast.error(t('stock.empty_truck_nothing'));
      setIsLoading(false);
      onOpenChange(false);
      return;
    }

    setItems(mapped);
    setLoaded(true);
    setIsLoading(false);
  };

  React.useEffect(() => {
    if (open && !loaded) {
      loadWorkerStock();
    }
    if (!open) {
      setLoaded(false);
      setItems([]);
    }
  }, [open]);

  // Auto full-unload mode: as soon as items are loaded, fire handleConfirm with full quantities
  React.useEffect(() => {
    if (open && autoFullUnload && loaded && items.length > 0 && !isEmptying) {
      handleConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoFullUnload, loaded, items.length]);

  // تفريغ كلي - إرجاع كل الكميات
  const setFullUnload = () => {
    setItems(prev => prev.map(it => ({ ...it, returnQty: it.currentQty })));
  };

  // تصفير الكل
  const setZeroUnload = () => {
    setItems(prev => prev.map(it => ({ ...it, returnQty: 0 })));
  };

  const handleConfirm = async () => {
    if (!branchId || !currentWorkerId) return;
    setIsEmptying(true);

    try {
      const itemsToReturn = items.filter(it => it.returnQty > 0);
      if (itemsToReturn.length === 0) {
        toast.error(t('empty_truck.no_qty_selected'));
        setIsEmptying(false);
        return;
      }

      const isFullUnload = itemsToReturn.every(it => it.returnQty === it.currentQty) && itemsToReturn.length === items.length;

      const unloadingDetails = itemsToReturn.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        system_qty: item.currentQty,
        return_qty: item.returnQty,
        remaining_qty: item.currentQty - item.returnQty,
      }));

      // إنشاء جلسة تفريغ
      const { data: unloadSession, error: sessionError } = await supabase
        .from('loading_sessions')
        .insert({
          worker_id: workerId,
          manager_id: currentWorkerId,
          branch_id: branchId,
          status: 'unloaded',
          notes: isFullUnload ? t('empty_truck.full_unload_note') : t('empty_truck.partial_unload_note'),
          completed_at: new Date().toISOString(),
          unloading_details: unloadingDetails,
        } as any)
        .select()
        .single();

      if (sessionError) throw sessionError;

      // جلب مخزون المستودع
      const { data: warehouseStock } = await supabase
        .from('warehouse_stock')
        .select('id, product_id, quantity')
        .eq('branch_id', branchId);

      for (const item of itemsToReturn) {
        // تسجيل عنصر الجلسة
        const { error: itemErr } = await supabase.from('loading_session_items').insert({
          session_id: unloadSession.id,
          product_id: item.product_id,
          quantity: item.returnQty,
          gift_quantity: 0,
          surplus_quantity: 0,
          previous_quantity: item.currentQty,
          notes: `تفريغ ${item.returnQty} من ${item.currentQty} - متبقي: ${item.currentQty - item.returnQty}`,
        });
        if (itemErr) throw new Error(`فشل تسجيل عنصر الجلسة: ${itemErr.message}`);

        // خصم من رصيد العامل (أو إنشاء صف بصفر إن لم يكن موجوداً)
        const newWorkerQty = Math.max(0, item.currentQty - item.returnQty);
        if (item.id) {
          const { data: updatedRows, error: wsErr } = await supabase
            .from('worker_stock')
            .update({ quantity: newWorkerQty })
            .eq('id', item.id)
            .select('id');
          if (wsErr) throw new Error(`فشل خصم رصيد العامل: ${wsErr.message}`);
          if (!updatedRows || updatedRows.length === 0) {
            throw new Error(`لم يتم خصم رصيد العامل للمنتج "${item.product_name}" — تحقق من صلاحيات RLS على worker_stock`);
          }
        } else {
          // لا يوجد صف worker_stock — أنشئ واحداً بكمية متبقية (عادةً 0)
          const { error: wsInsErr } = await supabase.from('worker_stock').insert({
            worker_id: workerId,
            product_id: item.product_id,
            branch_id: branchId,
            quantity: newWorkerQty,
          });
          if (wsInsErr) throw new Error(`فشل إنشاء رصيد العامل: ${wsInsErr.message}`);
        }

        // إضافة للمستودع
        const existingWh = warehouseStock?.find(s => s.product_id === item.product_id);
        if (existingWh) {
          const { error: whUpdErr } = await supabase
            .from('warehouse_stock')
            .update({ quantity: existingWh.quantity + item.returnQty })
            .eq('id', existingWh.id);
          if (whUpdErr) throw new Error(`فشل تحديث مخزون المستودع: ${whUpdErr.message}`);
        } else {
          const { error: whInsErr } = await supabase.from('warehouse_stock').insert({
            branch_id: branchId,
            product_id: item.product_id,
            quantity: item.returnQty,
          });
          if (whInsErr) throw new Error(`فشل إضافة مخزون المستودع: ${whInsErr.message}`);
        }

        // تسجيل الحركة
        const { error: mvErr } = await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          branch_id: branchId,
          quantity: item.returnQty,
          movement_type: 'return',
          status: 'approved',
          created_by: currentWorkerId,
          worker_id: workerId,
          notes: `تفريغ ${item.returnQty} من ${item.product_name} (كان ${item.currentQty}، متبقي ${newWorkerQty})`,
        });
        if (mvErr) throw new Error(`فشل تسجيل الحركة: ${mvErr.message}`);
      }

      queryClient.invalidateQueries({ queryKey: ['my-worker-stock'] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock', workerId] });
      queryClient.invalidateQueries({ queryKey: ['worker-truck-stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
      queryClient.invalidateQueries({ queryKey: ['sold-products-summary'] });
      queryClient.invalidateQueries({ queryKey: ['loading-sessions'] });
      toast.success(t('stock.empty_truck_success'));
      // Fire the unload callback FIRST so the parent kicks off the save,
      // then close this dialog. This guarantees the accounting session save
      // runs even if React unmounts this component immediately.
      try {
        await onUnloaded?.();
      } finally {
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsEmptying(false);
    }
  };

  const totalReturn = items.reduce((s, it) => s + it.returnQty, 0);
  const totalRemaining = items.reduce((s, it) => s + (it.currentQty - it.returnQty), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg !z-[100000]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="w-5 h-5 text-destructive" />
            {t('stock.empty_truck')}
          </DialogTitle>
          <DialogDescription>{t('empty_truck.choose_quantities')}</DialogDescription>
        </DialogHeader>

        {/* أزرار سريعة */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={setFullUnload}>
            {t('empty_truck.full_unload')}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={setZeroUnload}>
            {t('empty_truck.zero_all')}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              {items.map((item, idx) => {
                const remaining = item.currentQty - item.returnQty;
                return (
                  <Card key={item.product_id} className="border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{item.product_name}</span>
                          {item.inferred && (
                            <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                              مُستنتَج
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          <Truck className="w-3 h-3 ml-1" />
                          {item.currentQty}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Warehouse className="w-3 h-3" />
                            {t('empty_truck.return_to_warehouse')}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={item.currentQty}
                            value={item.returnQty}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const val = Math.min(Math.max(0, parseFloat(e.target.value) || 0), item.currentQty);
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: val } : it));
                            }}
                            className="text-center h-8"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {t('empty_truck.stays_in_truck')}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={item.currentQty}
                            value={remaining}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const keepVal = Math.min(Math.max(0, parseFloat(e.target.value) || 0), item.currentQty);
                              setItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: item.currentQty - keepVal } : it));
                            }}
                            className="text-center h-8"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ملخص */}
            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-md p-2 gap-3">
              <div className="flex items-center gap-1">
                <Warehouse className="w-4 h-4 text-destructive" />
                <span>{t('empty_truck.return_label')}: <strong>{totalReturn}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <Truck className="w-4 h-4 text-primary" />
                <span>{t('empty_truck.remaining_label')}: <strong>{totalRemaining}</strong></span>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={isEmptying || totalReturn === 0}
              >
                {isEmptying && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {t('stock.confirm_return')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EmptyTruckDialog;
