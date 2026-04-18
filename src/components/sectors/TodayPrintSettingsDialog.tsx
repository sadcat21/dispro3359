import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Printer, Package, Layers, Settings2, AlertTriangle, CheckSquare, Square, Truck, Users, ShoppingCart, Calendar } from 'lucide-react';
import { OrderWithDetails, Product } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';
import PrintColumnsConfigDialog, { PrintColumnConfig } from '@/components/print/PrintColumnsConfigDialog';
import { usePrintColumnsConfig } from '@/hooks/usePrintColumnsConfig';

interface WorkerStockItem {
  product_id: string;
  quantity: number;
  product?: Product | null;
}

interface ShipmentProductCustomerDetail {
  orderId: string;
  customerId: string;
  customerName: string;
  storeName: string;
  quantity: number;
}

interface TodayPrintSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderWithDetails[];
  products: Product[];
  workerStock: WorkerStockItem[];
  sectors?: any[];
  zones?: any[];
  onPrint: (selectedOrders: OrderWithDetails[], columnConfig: PrintColumnConfig[], includeLoadedProducts: boolean, cashVanQuantities?: Record<string, number>, deliveryDate?: string | null) => void;
}

// Helpers for quick date buttons
const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const todayStr = () => toDateStr(new Date());
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d); };
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d); };

const TodayPrintSettingsDialog: React.FC<TodayPrintSettingsDialogProps> = ({
  open, onOpenChange, orders, products, workerStock, sectors = [], zones = [], onPrint,
}) => {
  const { role, activeRole } = useAuth();
  const canSeeCashVan = isAdminRole(role) || role === 'supervisor' || activeRole?.custom_role_code === 'warehouse_manager';
  const { dir } = useLanguage();
  const { columns: dbColumns, saveColumns } = usePrintColumnsConfig();
  const [showColumnsConfig, setShowColumnsConfig] = useState(false);
  const [showCustomerSelection, setShowCustomerSelection] = useState(false);
  const [showShipmentSummary, setShowShipmentSummary] = useState(false);
  const [showCashVan, setShowCashVan] = useState(false);
  const [selectedShipmentProductId, setSelectedShipmentProductId] = useState<string | null>(null);
  const [columnConfig, setColumnConfig] = useState<PrintColumnConfig[]>(dbColumns);
  const [groupCustomers, setGroupCustomers] = useState(true);
  const [groupProducts, setGroupProducts] = useState(true);
  const [includeLoadedProducts, setIncludeLoadedProducts] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [cashVanQuantities, setCashVanQuantities] = useState<Record<string, number>>({});
  const [deliveryDate, setDeliveryDate] = useState<string>(''); // '' = all dates, otherwise YYYY-MM-DD

  useEffect(() => { setColumnConfig(dbColumns); }, [dbColumns]);

  // Apply delivery_date filter (when user selects a specific date)
  const dateFilteredOrders = useMemo(() => {
    if (!deliveryDate) return orders;
    return orders.filter(o => {
      const dd = (o as any).delivery_date as string | null | undefined;
      if (dd) return dd.startsWith(deliveryDate);
      // Fallback: if no delivery_date, match by created_at date
      const created = (o as any).created_at as string | undefined;
      return created ? created.startsWith(deliveryDate) : false;
    });
  }, [orders, deliveryDate]);

  const customerList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; storeName: string; orderCount: number }>();
    dateFilteredOrders.forEach(o => {
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
  }, [dateFilteredOrders]);

  useEffect(() => {
    if (open) {
      setSelectedCustomerIds(new Set(customerList.map(c => c.id)));
      setCashVanQuantities({});
      setSelectedShipmentProductId(null);
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
    return dateFilteredOrders.filter(o => o.customer_id && selectedCustomerIds.has(o.customer_id));
  }, [dateFilteredOrders, selectedCustomerIds]);

  const shipmentSummary = useMemo(() => {
    const productNeeds: Record<string, { name: string; needed: number; image?: string; details: ShipmentProductCustomerDetail[] }> = {};

    selectedOrders.forEach(o => {
      const customerName = (o.customer as any)?.name || '—';
      const storeName = (o.customer as any)?.store_name || customerName;

      (o.items || []).forEach((item: any) => {
        const pid = item.product_id || item.product?.id;
        if (!pid) return;

        const pname = item.product?.name || item.product_name || '—';
        const qty = Number(item.quantity || 0);

        if (!productNeeds[pid]) {
          productNeeds[pid] = {
            name: pname,
            needed: 0,
            image: item.product?.image_url,
            details: [],
          };
        }

        productNeeds[pid].needed += qty;
        productNeeds[pid].details.push({
          orderId: o.id,
          customerId: o.customer_id || '—',
          customerName,
          storeName,
          quantity: qty,
        });
      });
    });

    const stockMap = new Map<string, number>();
    workerStock.forEach(ws => stockMap.set(ws.product_id, Number(ws.quantity || 0)));

    return Object.entries(productNeeds)
      .map(([pid, info]) => {
        const stock = stockMap.get(pid) || 0;
        return {
          pid,
          ...info,
          stock,
          diff: stock - info.needed,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [selectedOrders, workerStock]);

  useEffect(() => {
    const stockMap = new Map<string, number>();
    workerStock.forEach(ws => stockMap.set(ws.product_id, Number(ws.quantity || 0)));

    const neededMap: Record<string, number> = {};
    selectedOrders.forEach(o => {
      (o.items || []).forEach((item: any) => {
        const pid = item.product_id || item.product?.id;
        if (!pid) return;
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
    onPrint(selectedOrders, columnConfig, includeLoadedProducts, cashVanQuantities, deliveryDate || null);
    onOpenChange(false);
  };

  const dateButtons: { label: string; value: string }[] = [
    { label: 'أمس', value: yesterdayStr() },
    { label: 'اليوم', value: todayStr() },
    { label: 'غداً', value: tomorrowStr() },
  ];

  const cashVanTotal = Object.values(cashVanQuantities).reduce((s, q) => s + q, 0);
  const selectedShipmentProduct = shipmentSummary.find(item => item.pid === selectedShipmentProductId) || null;

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
            {/* Delivery date filter */}
            <div className="bg-muted/40 rounded-lg p-2 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>تاريخ التوصيل</span>
                {deliveryDate && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ms-auto">
                    {deliveryDate}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dateButtons.map(b => (
                  <Button
                    key={b.value}
                    type="button"
                    size="sm"
                    variant={deliveryDate === b.value ? 'default' : 'outline'}
                    className="h-8 px-2.5 text-xs"
                    onClick={() => setDeliveryDate(deliveryDate === b.value ? '' : b.value)}
                  >
                    {b.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={!deliveryDate ? 'default' : 'outline'}
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setDeliveryDate('')}
                >
                  الكل
                </Button>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="h-8 text-xs flex-1 min-w-[130px]"
                />
              </div>
            </div>

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
              {canSeeCashVan && (
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
              )}
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

            <div className="bg-primary/10 p-3 rounded-lg text-center">
              <p className="text-base font-bold">{selectedOrders.length}</p>
              <p className="text-xs text-muted-foreground">طلبية للطباعة</p>
            </div>

            <Button onClick={handlePrint} disabled={selectedOrders.length === 0} className="w-full h-10">
              <Printer className="w-4 h-4 ms-2" />
              طباعة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      <Dialog open={showShipmentSummary} onOpenChange={setShowShipmentSummary}>
        <DialogContent className="w-[95vw] max-w-md h-[85dvh] max-h-[85dvh] gap-0 flex flex-col overflow-hidden p-0" dir={dir}>
          <DialogHeader className="px-3 pt-3 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-primary" />
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
                  <button
                    type="button"
                    key={item.pid}
                    onClick={() => setSelectedShipmentProductId(item.pid)}
                    className={`flex flex-col rounded-xl overflow-hidden text-center relative bg-card shadow-sm border transition-all active:scale-[0.98]
                      ${isDeficit ? 'border-destructive/60 ring-1 ring-destructive/20' : isSurplus ? 'border-primary/40 ring-1 ring-primary/15' : 'border-border'}
                    `}
                  >
                    <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full
                      ${isDeficit ? 'bg-destructive/10 text-destructive' : isSurplus ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-foreground'}
                    `}>
                      {item.name}
                    </div>

                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full aspect-square object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted/20">
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}

                    <div className="px-1 py-1 bg-card flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 flex items-center justify-center gap-1 rounded-md bg-primary/10 text-primary py-1 text-[10px] font-bold">
                          <Package className="w-3 h-3" />
                          مطلوب {item.needed}
                        </div>
                        <div className="flex items-center justify-center gap-0.5 rounded-md bg-muted py-1 px-1 text-[9px] font-semibold text-muted-foreground">
                          رصيد {item.stock}
                        </div>
                      </div>
                      <div className={`flex items-center justify-center rounded-md py-1 text-[9px] font-semibold ${
                        isDeficit ? 'bg-destructive/10 text-destructive' : isSurplus ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isDeficit ? `عجز ${Math.abs(item.diff)}` : isSurplus ? `فائض ${item.diff}` : 'متطابق'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedShipmentProduct} onOpenChange={(value) => !value && setSelectedShipmentProductId(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden" dir={dir}>
          {selectedShipmentProduct && (
            <>
              <DialogHeader className="px-4 pt-4 pb-3 border-b">
                <DialogTitle className="flex items-center gap-3 text-base">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted/40">
                    {selectedShipmentProduct.image ? (
                      <img src={selectedShipmentProduct.image} alt={selectedShipmentProduct.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{selectedShipmentProduct.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                      <Badge variant="secondary">مطلوب {selectedShipmentProduct.needed}</Badge>
                      <Badge variant="secondary">رصيد {selectedShipmentProduct.stock}</Badge>
                      <Badge variant={selectedShipmentProduct.diff < 0 ? 'destructive' : 'secondary'}>
                        {selectedShipmentProduct.diff < 0 ? `عجز ${Math.abs(selectedShipmentProduct.diff)}` : selectedShipmentProduct.diff > 0 ? `فائض ${selectedShipmentProduct.diff}` : 'متطابق'}
                      </Badge>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="max-h-[60dvh] overflow-y-auto px-3 py-3 space-y-2">
                {selectedShipmentProduct.details.map((detail, index) => (
                  <div key={`${detail.orderId}-${detail.customerId}-${index}`} className="rounded-xl border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate">{detail.storeName || detail.customerName}</div>
                        <div className="text-xs text-muted-foreground truncate">{detail.customerName}</div>
                      </div>
                      <div className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary shrink-0">
                        {detail.quantity}
                      </div>
                    </div>
                  </div>
                ))}
                {selectedShipmentProduct.details.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">لا توجد تفاصيل لهذا المنتج</div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
            {(() => {
              // Build needed map from selected orders
              const neededMap: Record<string, number> = {};
              selectedOrders.forEach(o => {
                (o.items || []).forEach((item: any) => {
                  const pid = item.product_id || item.product?.id;
                  if (!pid) return;
                  neededMap[pid] = (neededMap[pid] || 0) + Number(item.quantity || 0);
                });
              });

              // Union of: loaded stock products + products in orders + all products (so user can add any)
              const productMap = new Map<string, { id: string; name: string; image?: string; stock: number; needed: number }>();
              workerStock.forEach(ws => {
                const p = ws.product || products.find(pp => pp.id === ws.product_id);
                productMap.set(ws.product_id, {
                  id: ws.product_id,
                  name: p?.name || ws.product_id,
                  image: (p as any)?.image_url,
                  stock: Number(ws.quantity || 0),
                  needed: neededMap[ws.product_id] || 0,
                });
              });
              Object.keys(neededMap).forEach(pid => {
                if (!productMap.has(pid)) {
                  const p = products.find(pp => pp.id === pid);
                  productMap.set(pid, {
                    id: pid,
                    name: p?.name || pid,
                    image: (p as any)?.image_url,
                    stock: 0,
                    needed: neededMap[pid],
                  });
                }
              });
              products.forEach(p => {
                if (!productMap.has(p.id)) {
                  productMap.set(p.id, {
                    id: p.id,
                    name: p.name,
                    image: (p as any).image_url,
                    stock: 0,
                    needed: 0,
                  });
                }
              });

              const list = Array.from(productMap.values()).sort((a, b) => {
                // Show items with stock or orders first, then the rest
                const aActive = (a.stock > 0 || a.needed > 0) ? 0 : 1;
                const bActive = (b.stock > 0 || b.needed > 0) ? 0 : 1;
                if (aActive !== bActive) return aActive - bActive;
                return a.name.localeCompare(b.name, 'ar');
              });

              if (list.length === 0) {
                return <p className="text-center text-xs text-muted-foreground py-4">لا توجد منتجات</p>;
              }

              return (
                <div className="grid grid-cols-4 gap-1.5 pb-3">
                  {list.map(item => {
                    const currentQty = cashVanQuantities[item.id] || 0;
                    const hasReserve = currentQty > 0;
                    const hasOrders = item.needed > 0;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col rounded-xl overflow-hidden text-center relative shadow-sm border-2 transition-all
                          ${hasOrders
                            ? 'bg-primary/5 border-primary ring-2 ring-primary/30 shadow-md'
                            : hasReserve
                              ? 'bg-card border-orange-400 ring-1 ring-orange-300/50'
                              : 'bg-card/60 border-border/40 opacity-80'}
                        `}
                      >
                        {hasOrders && (
                          <div className="absolute top-1 left-1 z-10 flex items-center gap-0.5 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-extrabold shadow">
                            {item.needed}
                          </div>
                        )}
                        <div className={`px-1 py-1 border-b text-[10px] font-bold leading-tight truncate w-full
                          ${hasOrders ? 'bg-primary/10 text-primary' : hasReserve ? 'bg-orange-500/10 text-orange-700' : 'bg-muted/30 text-muted-foreground'}
                        `}>
                          {item.name}
                        </div>

                        {item.image ? (
                          <img src={item.image} alt={item.name} className={`w-full aspect-square object-cover ${!hasOrders && !hasReserve ? 'opacity-70' : ''}`} loading="lazy" />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center bg-muted/20">
                            <Package className="w-6 h-6 text-muted-foreground/30" />
                          </div>
                        )}

                        <div className="flex flex-col items-center gap-0.5 p-1 min-h-[44px]">
                          {hasOrders ? (
                            <div className="flex items-center justify-center gap-1 w-full rounded-md bg-primary/15 text-primary py-0.5 text-[10px] font-bold">
                              <span>طلبيات</span>
                              <span className="text-[12px]">{item.needed}</span>
                            </div>
                          ) : (
                            <span className="text-[8px] text-muted-foreground">لا طلبيات</span>
                          )}
                          <div className="flex items-center justify-center text-[8px] text-muted-foreground leading-none">
                            محمل: {item.stock}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            value={currentQty}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setCashVanQuantities(prev => ({ ...prev, [item.id]: val }));
                            }}
                            className="h-6 w-14 text-center text-[11px] font-bold px-0.5"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
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
