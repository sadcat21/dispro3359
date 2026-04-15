import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, Package, Layers, Settings2, AlertTriangle, CheckSquare, Square, Truck } from 'lucide-react';
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
  onPrint: (selectedOrders: OrderWithDetails[], columnConfig: PrintColumnConfig[], includeLoadedProducts: boolean) => void;
}

const TodayPrintSettingsDialog: React.FC<TodayPrintSettingsDialogProps> = ({
  open, onOpenChange, orders, products, workerStock, onPrint,
}) => {
  const { dir } = useLanguage();
  const { columns: dbColumns, saveColumns } = usePrintColumnsConfig();
  const [showColumnsConfig, setShowColumnsConfig] = useState(false);
  const [columnConfig, setColumnConfig] = useState<PrintColumnConfig[]>(dbColumns);
  const [groupCustomers, setGroupCustomers] = useState(true);
  const [groupProducts, setGroupProducts] = useState(true);
  const [includeLoadedProducts, setIncludeLoadedProducts] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  // Sync columns from DB
  useEffect(() => { setColumnConfig(dbColumns); }, [dbColumns]);

  // Build unique customers from orders
  const customerList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; orderCount: number }>();
    orders.forEach(o => {
      if (!o.customer_id) return;
      const existing = map.get(o.customer_id);
      if (existing) {
        existing.orderCount++;
      } else {
        map.set(o.customer_id, {
          id: o.customer_id,
          name: (o.customer as any)?.name || o.customer_id,
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
    }
  }, [open, customerList]);

  const allSelected = selectedCustomerIds.size === customerList.length && customerList.length > 0;
  const noneSelected = selectedCustomerIds.size === 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(customerList.map(c => c.id)));
    }
  };

  const toggleCustomer = (id: string) => {
    const next = new Set(selectedCustomerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCustomerIds(next);
  };

  // Filter orders by selected customers
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

  const handleColumnsChange = (cols: PrintColumnConfig[]) => {
    setColumnConfig(cols);
    saveColumns(cols);
  };

  const handlePrint = () => {
    onPrint(selectedOrders, columnConfig, includeLoadedProducts);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-4" dir={dir}>
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Printer className="w-4 h-4" />
                إعدادات الطباعة
              </DialogTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowColumnsConfig(true)}>
                <Settings2 className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[75vh]">
            <div className="space-y-3 py-2 px-1">
              {/* Customer Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <CheckSquare className="w-3.5 h-3.5" />
                    تحديد العملاء ({selectedCustomerIds.size}/{customerList.length})
                  </Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={toggleAll}>
                    {allSelected ? (
                      <span className="flex items-center gap-1"><Square className="w-3 h-3" /> إلغاء الكل</span>
                    ) : (
                      <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" /> تحديد الكل</span>
                    )}
                  </Button>
                </div>
                <ScrollArea className="max-h-40 border rounded-lg">
                  <div className="p-1.5 space-y-0.5">
                    {customerList.map(c => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedCustomerIds.has(c.id)}
                          onCheckedChange={() => toggleCustomer(c.id)}
                        />
                        <span className="text-sm flex-1 truncate">{c.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {c.orderCount}
                        </Badge>
                      </label>
                    ))}
                    {customerList.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-3">لا توجد طلبيات</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

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

              {/* Required Shipment Summary */}
              {shipmentSummary.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                    الشحنة المطلوبة
                  </Label>
                  <ScrollArea className="max-h-44 border rounded-lg">
                    <div className="p-1.5 space-y-1">
                      {shipmentSummary.map(item => {
                        const isDeficit = item.diff < 0;
                        const isSurplus = item.diff > 0;
                        return (
                          <Card key={item.pid} className={`p-2 ${isDeficit ? 'border-red-300 bg-red-50/50' : isSurplus ? 'border-green-300 bg-green-50/50' : 'border-blue-300 bg-blue-50/50'}`}>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted/40">
                                {item.image ? (
                                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[8px]">📦</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs truncate">{item.name}</p>
                                <div className="flex items-center gap-2 text-[10px] mt-0.5">
                                  <span className="text-blue-700">مطلوب: <strong>{item.needed}</strong></span>
                                  <span className="text-muted-foreground">رصيد: <strong>{item.stock}</strong></span>
                                  <span className={`font-bold ${isDeficit ? 'text-red-600' : isSurplus ? 'text-green-600' : 'text-blue-600'}`}>
                                    {isDeficit ? (
                                      <span className="flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> عجز {Math.abs(item.diff)}</span>
                                    ) : isSurplus ? `فائض ${item.diff}` : 'متطابق ✓'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Summary */}
              <div className="bg-primary/10 p-3 rounded-lg text-center">
                <p className="text-base font-bold">{selectedOrders.length}</p>
                <p className="text-xs text-muted-foreground">طلبية للطباعة</p>
              </div>

              {/* Print Button */}
              <Button
                onClick={handlePrint}
                disabled={selectedOrders.length === 0}
                className="w-full h-10"
              >
                <Printer className="w-4 h-4 ms-2" />
                طباعة
              </Button>
            </div>
          </ScrollArea>
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
