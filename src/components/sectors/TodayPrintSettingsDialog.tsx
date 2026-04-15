import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Printer, Package, Layers, Settings2, AlertTriangle, CheckSquare, Square, Truck, Users, ShoppingCart } from 'lucide-react';
import { OrderWithDetails, Product } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import PrintColumnsConfigDialog, { PrintColumnConfig } from '@/components/print/PrintColumnsConfigDialog';
import { usePrintColumnsConfig } from '@/hooks/usePrintColumnsConfig';

interface WorkerStockItem {
  product_id: string;
  quantity: number;
  product?: Product | null;
}

interface TodayPrintSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderWithDetails[];
  products: Product[];
  workerStock: WorkerStockItem[];
  sectors?: any[];
  zones?: any[];
  onPrint: (selectedOrders: OrderWithDetails[], columnConfig: PrintColumnConfig[], includeLoadedProducts: boolean, cashVanQuantities?: Record<string, number>) => void;
}

const TodayPrintSettingsDialog: React.FC<TodayPrintSettingsDialogProps> = ({
  open, onOpenChange, orders, products, workerStock, sectors = [], zones = [], onPrint,
}) => {
  const { dir } = useLanguage();
  const { columns: dbColumns, saveColumns } = usePrintColumnsConfig();
  const [showColumnsConfig, setShowColumnsConfig] = useState(false);
  const [showCustomerSelection, setShowCustomerSelection] = useState(false);
  const [showShipmentSummary, setShowShipmentSummary] = useState(false);
  const [showCashVan, setShowCashVan] = useState(false);
  const [columnConfig, setColumnConfig] = useState<PrintColumnConfig[]>(dbColumns);
  const [groupCustomers, setGroupCustomers] = useState(true);
  const [groupProducts, setGroupProducts] = useState(true);
  const [includeLoadedProducts, setIncludeLoadedProducts] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [cashVanQuantities, setCashVanQuantities] = useState<Record<string, number>>({});

  useEffect(() => { setColumnConfig(dbColumns); }, [dbColumns]);

  // Build unique customers from orders
  const customerList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; storeName: string; orderCount: number }>();
    orders.forEach(o => {
      if (!o.customer_id) return;
      const existing = map.get(o.customer_id);
      if (existing) {
        existing.orderCount++;
      } else {
        map.set(o.customer_id, {
          id: o.customer_id,
          name: (o.customer as any)?.name || o.customer_id,
          storeName: (o.customer as any)?.store_name || '',
          orderCount: 1,
        });
      }
    });
    return Array.from(map.values());
  }, [orders]);

  // Select all customers by default when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCustomerIds(new Set(customerList.map(c => c.id)));
      setCashVanQuantities({});
    }
  }, [open, customerList]);

  const allSelected = selectedCustomerIds.size === customerList.length && customerList.length > 0;

  const toggleAll = () => {
    setSelectedCustomerIds(allSelected ? new Set() : new Set(customerList.map(c => c.id)));
  };

  const toggleCustomer = (id: string) => {
    const next = new Set(selectedCustomerIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedCustomerIds(next);
  };

  const selectedOrders = useMemo(() => {
    return orders.filter(o => o.customer_id && selectedCustomerIds.has(o.customer_id));
  }, [orders, selectedCustomerIds]);

  // Required shipment summary
  const shipmentSummary = useMemo(() => {
    const productNeeds: Record<string, { name: string; needed: number; image?: string }> = {};
    selectedOrders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        const pid = item.product_id || item.product?.id;
        const pname = item.product?.name || item.product_name || '—';
        const qty = Number(item.quantity || 0);
        if (!productNeeds[pid]) productNeeds[pid] = { name: pname, needed: 0, image: item.product?.image_url };
        productNeeds[pid].needed += qty;
      });
    });
    const stockMap = new Map<string, number>();
    workerStock.forEach(ws => stockMap.set(ws.product_id, Number(ws.quantity || 0)));
    return Object.entries(productNeeds)
      .map(([pid, info]) => {
        const stock = stockMap.get(pid) || 0;
        return { pid, ...info, stock, diff: stock - info.needed };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [selectedOrders, workerStock]);

  // Auto-calculate cash van quantities when customer selection changes
  useEffect(() => {
    const stockMap = new Map<string, number>();
    workerStock.forEach(ws => stockMap.set(ws.product_id, Number(ws.quantity || 0)));
    
    const neededMap: Record<string, number> = {};
    selectedOrders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        const pid = item.product_id || item.product?.id;
        const qty = Number(item.quantity || 0);
        neededMap[pid] = (neededMap[pid] || 0) + qty;
      });
    });

    const newCashVan: Record<string, number> = {};
    stockMap.forEach((stockQty, pid) => {
      const needed = neededMap[pid] || 0;
      const remaining = Math.max(0, stockQty - needed);
      if (remaining > 0) newCashVan[pid] = remaining;
    });
    setCashVanQuantities(newCashVan);
  }, [selectedOrders, workerStock]);

  const handleColumnsChange = (cols: PrintColumnConfig[]) => {
    setColumnConfig(cols);
    saveColumns(cols);
  };

  const handlePrint = () => {
    onPrint(selectedOrders, columnConfig, includeLoadedProducts, cashVanQuantities);
    onOpenChange(false);
  };

  const cashVanTotal = Object.values(cashVanQuantities).reduce((s, q) => s + q, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-4" dir={dir}>
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Printer className="w-4 h-4" />
              إعدادات الطباعة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Action Buttons Row */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 min-w-[100px] h-10 gap-1.5"
                onClick={() => setShowCustomerSelection(true)}
              >
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs">تحديد العملاء</span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ms-1">
                  {selectedCustomerIds.size}/{customerList.length}
                </Badge>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 min-w-[100px] h-10 gap-1.5"
                onClick={() => setShowCashVan(true)}
              >
                <ShoppingCart className="w-4 h-4 text-orange-600" />
                <span className="text-xs">كاش فان</span>
                {cashVanTotal > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ms-1 bg-orange-100 text-orange-700">
                    {cashVanTotal}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-1.5 px-3"
                onClick={() => setShowColumnsConfig(true)}
              >
                <Settings2 className="w-4 h-4 text-primary" />
                <span className="text-xs">الأعمدة</span>
              </Button>
            </div>

            {/* Shipment Summary Button */}
            {shipmentSummary.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 gap-2 justify-start"
                onClick={() => setShowShipmentSummary(true)}
              >
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-sm">الشحنة المطلوبة</span>
                {shipmentSummary.some(s => s.diff < 0) && (
                  <Badge variant="destructive" className="text-[10px] h-5 px-1.5 ms-auto">
                    <AlertTriangle className="w-3 h-3 me-0.5" />
                    يوجد عجز
                  </Badge>
                )}
              </Button>
            )}

            {/* Grouping Options */}
            <div className="bg-muted/50 p-3 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="groupCustomers" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium">تجميع حسب العميل</div>
                    <p className="text-xs text-muted-foreground">دمج طلبيات العميل الواحد</p>
                  </div>
                </Label>
                <Switch id="groupCustomers" checked={groupCustomers} onCheckedChange={setGroupCustomers} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="groupProducts" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium">تجميع حسب المنتج</div>
                    <p className="text-xs text-muted-foreground">ملخص الكميات لكل منتج</p>
                  </div>
                </Label>
                <Switch id="groupProducts" checked={groupProducts} onCheckedChange={setGroupProducts} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="includeLoaded" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium">صفحة المنتجات المحملة</div>
                    <p className="text-xs text-muted-foreground">إضافة صفحة ملحقة بالمنتجات في الشاحنة</p>
                  </div>
                </Label>
                <Switch id="includeLoaded" checked={includeLoadedProducts} onCheckedChange={setIncludeLoadedProducts} />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-primary/10 p-3 rounded-lg text-center">
              <p className="text-base font-bold">{selectedOrders.length}</p>
              <p className="text-xs text-muted-foreground">طلبية للطباعة</p>
            </div>

            {/* Print Button */}
            <Button onClick={handlePrint} disabled={selectedOrders.length === 0} className="w-full h-10">
              <Printer className="w-4 h-4 ms-2" />
              طباعة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Selection Popup */}
      <Dialog open={showCustomerSelection} onOpenChange={setShowCustomerSelection}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-4" dir={dir}>
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              تحديد العملاء للطباعة
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {selectedCustomerIds.size}/{customerList.length} عميل محدد
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={toggleAll}>
              {allSelected ? (
                <span className="flex items-center gap-1"><Square className="w-3 h-3" /> إلغاء الكل</span>
              ) : (
                <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" /> تحديد الكل</span>
              )}
            </Button>
          </div>
          <ScrollArea className="max-h-[60vh] border rounded-lg">
            <div className="p-1.5 space-y-0.5">
              {customerList.map(c => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCustomerIds.has(c.id)}
                    onCheckedChange={() => toggleCustomer(c.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{c.storeName || c.name}</span>
                    <span className="text-xs text-muted-foreground block truncate">{c.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                    {c.orderCount}
                  </Badge>
                </label>
              ))}
              {customerList.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-3">لا توجد طلبيات</p>
              )}
            </div>
          </ScrollArea>
          <Button className="w-full mt-2" onClick={() => setShowCustomerSelection(false)}>
            حفظ ({selectedCustomerIds.size} عميل)
          </Button>
        </DialogContent>
      </Dialog>

      {/* Shipment Summary Popup - Grid View */}
      <Dialog open={showShipmentSummary} onOpenChange={setShowShipmentSummary}>
        <DialogContent className="w-[95vw] max-w-md h-[85dvh] max-h-[85dvh] gap-0 flex flex-col overflow-hidden p-0" dir={dir}>
          <DialogHeader className="px-3 pt-3 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-blue-600" />
              الشحنة المطلوبة
              {shipmentSummary.some(s => s.diff < 0) && (
                <Badge variant="destructive" className="text-[10px] rounded-full">
                  <AlertTriangle className="w-3 h-3 me-0.5" />
                  يوجد عجز
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-1 touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="grid grid-cols-4 gap-1.5 pb-3">
              {shipmentSummary.map(item => {
                const isDeficit = item.diff < 0;
                const isSurplus = item.diff > 0;
                return (
                  <div
                    key={item.pid}
                    className={`flex flex-col rounded-xl overflow-hidden text-center relative bg-card shadow-sm border
                      ${isDeficit ? 'border-red-400 ring-1 ring-red-300/50' : isSurplus ? 'border-green-400 ring-1 ring-green-300/50' : 'border-blue-300'}
                    `}
                  >
                    {/* Product name */}
                    <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full
                      ${isDeficit ? 'bg-red-500/10 text-red-700' : isSurplus ? 'bg-green-500/10 text-green-700' : 'bg-blue-500/10 text-blue-700'}
                    `}>
                      {item.name}
                    </div>

                    {/* Image */}
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full aspect-square object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted/20">
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Info badges */}
                    <div className="flex flex-col items-center gap-0.5 p-0.5 min-h-[28px]">
                      <div className="flex items-center gap-0.5 flex-wrap justify-center">
                        <Badge variant="secondary" className="text-[8px] px-0.5 py-0 h-3.5">
                          مطلوب: {item.needed}
                        </Badge>
                        <Badge variant="secondary" className="text-[8px] px-0.5 py-0 h-3.5">
                          رصيد: {item.stock}
                        </Badge>
                      </div>
                      <Badge
                        className={`text-[8px] px-1 py-0 h-3.5 ${
                          isDeficit ? 'bg-red-500 text-white' : isSurplus ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                        }`}
                      >
                        {isDeficit ? (
                          <span className="flex items-center gap-0.5"><AlertTriangle className="w-2 h-2" /> عجز {Math.abs(item.diff)}</span>
                        ) : isSurplus ? `فائض ${item.diff}` : 'متطابق ✓'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Van Popup - Grid View */}
      <Dialog open={showCashVan} onOpenChange={setShowCashVan}>
        <DialogContent className="w-[95vw] max-w-md h-[85dvh] max-h-[85dvh] gap-0 flex flex-col overflow-hidden p-0" dir={dir}>
          <DialogHeader className="px-3 pt-3 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="w-4 h-4 text-orange-600" />
              كاش فان — المنتجات الاحتياطية
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground px-3 pb-1">
            الكميات المتبقية بعد حذف المطلوب للعملاء المحددين
          </p>
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-1 touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="grid grid-cols-4 gap-1.5 pb-3">
              {workerStock.filter(ws => ws.quantity > 0).map(ws => {
                const product = ws.product || products.find(p => p.id === ws.product_id);
                const productName = product?.name || ws.product_id;
                const currentQty = cashVanQuantities[ws.product_id] || 0;
                const hasReserve = currentQty > 0;
                return (
                  <div
                    key={ws.product_id}
                    className={`flex flex-col rounded-xl overflow-hidden text-center relative bg-card shadow-sm border
                      ${hasReserve ? 'border-orange-400 ring-1 ring-orange-300/50' : 'border-border/50'}
                    `}
                  >
                    {/* Product name */}
                    <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full
                      ${hasReserve ? 'bg-orange-500/10 text-orange-700' : 'bg-muted/30 text-foreground'}
                    `}>
                      {productName}
                    </div>

                    {/* Image */}
                    {(product as any)?.image_url ? (
                      <img src={(product as any).image_url} alt={productName} className="w-full aspect-square object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted/20">
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Info + input */}
                    <div className="flex flex-col items-center gap-0.5 p-1 min-h-[32px]">
                      <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
                        <span>محمل: {ws.quantity}</span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={ws.quantity}
                        value={currentQty}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(ws.quantity, parseInt(e.target.value) || 0));
                          setCashVanQuantities(prev => ({ ...prev, [ws.product_id]: val }));
                        }}
                        className="h-6 w-14 text-center text-[11px] font-bold px-0.5"
                      />
                    </div>
                  </div>
                );
              })}
              {workerStock.filter(ws => ws.quantity > 0).length === 0 && (
                <p className="col-span-4 text-center text-xs text-muted-foreground py-4">لا توجد منتجات محملة</p>
              )}
            </div>
          </div>
          <div className="px-3 pb-3 pt-2 border-t shrink-0">
            <Button className="w-full" onClick={() => setShowCashVan(false)}>
              تأكيد
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrintColumnsConfigDialog
        open={showColumnsConfig}
        onOpenChange={setShowColumnsConfig}
        columns={columnConfig}
        onColumnsChange={handleColumnsChange}
      />
    </>
  );
};

export default TodayPrintSettingsDialog;
