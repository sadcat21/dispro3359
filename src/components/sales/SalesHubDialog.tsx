import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, ShoppingBag, ChevronLeft, Loader2, Warehouse } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAssignedOrders } from '@/hooks/useOrders';
import { OrderWithDetails, Product } from '@/types/database';
import DirectSaleDialog from '@/components/warehouse/DirectSaleDialog';
import DeliverySaleDialog from '@/components/orders/DeliverySaleDialog';
import CustomerSummary from '@/components/customers/CustomerSummary';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface StockItem {
  id: string;
  product_id: string;
  quantity: number;
  product?: Product;
}

interface SalesHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockItems: StockItem[];
  stockSource?: 'worker' | 'warehouse';
  initialCustomerId?: string;
  initialTab?: 'direct' | 'delivery' | 'warehouse';
  initialDeliveryOrder?: OrderWithDetails | null;
  hideDirectTab?: boolean;
}

const SalesHubDialog: React.FC<SalesHubDialogProps> = ({
  open,
  onOpenChange,
  stockItems,
  stockSource = 'worker',
  initialCustomerId,
  initialTab = 'direct',
  initialDeliveryOrder = null,
  hideDirectTab = false,
}) => {
  const { t, dir } = useLanguage();
  const { workerId, activeBranch, activeRole } = useAuth();
  const isWarehouseManager = activeRole?.custom_role_code === 'warehouse_manager';
  const { data: assignedOrders = [], isLoading } = useAssignedOrders();
  const [activeTab, setActiveTab] = useState<'direct' | 'delivery' | 'warehouse'>(initialTab);
  const [selectedDeliveryOrder, setSelectedDeliveryOrder] = useState<OrderWithDetails | null>(initialDeliveryOrder);
  const [warehouseStockItems, setWarehouseStockItems] = useState<StockItem[]>([]);
  const [isLoadingWarehouseStock, setIsLoadingWarehouseStock] = useState(false);

  // Fetch warehouse stock when warehouse tab is active
  useEffect(() => {
    if (!open || activeTab !== 'warehouse' || !activeBranch?.id) return;
    const fetchWarehouseStock = async () => {
      setIsLoadingWarehouseStock(true);
      try {
        const { data } = await supabase
          .from('warehouse_stock')
          .select('id, product_id, quantity, product:products(*)')
          .eq('branch_id', activeBranch.id)
          .gt('quantity', 0);
        setWarehouseStockItems((data || []).map((s: any) => ({
          id: s.id,
          product_id: s.product_id,
          quantity: s.quantity,
          product: s.product,
        })));
      } catch (e) {
        console.error('Failed to load warehouse stock', e);
      } finally {
        setIsLoadingWarehouseStock(false);
      }
    };
    fetchWarehouseStock();
  }, [open, activeTab, activeBranch?.id]);

  useEffect(() => {
    if (!open) {
      setSelectedDeliveryOrder(null);
      return;
    }
    if (hideDirectTab) {
      setActiveTab('delivery');
      setSelectedDeliveryOrder(initialDeliveryOrder || null);
      return;
    }
    setActiveTab(initialDeliveryOrder ? 'delivery' : initialTab);
    setSelectedDeliveryOrder(initialDeliveryOrder || null);
  }, [open, initialTab, initialDeliveryOrder, hideDirectTab]);

  useEffect(() => {
    if (hideDirectTab && activeTab === 'direct') {
      setActiveTab('delivery');
    }
  }, [hideDirectTab, activeTab]);

  const deliveryOrders = useMemo(
    () => assignedOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status || '')),
    [assignedOrders]
  );

  const statusLabel = (status?: string | null) => {
    switch (status) {
      case 'assigned':
        return t('orders.assigned');
      case 'in_progress':
        return t('orders.in_progress');
      case 'delivered':
        return t('orders.delivered');
      case 'cancelled':
        return t('orders.cancelled');
      default:
        return t('orders.pending');
    }
  };

  const statusColor = (status?: string | null) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-purple-100 text-purple-700';
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  const showWarehouseTab = isWarehouseManager;
  // Warehouse manager only sees warehouse tab
  const effectiveHideDirectTab = hideDirectTab || isWarehouseManager;
  const hideDeliveryTab = isWarehouseManager;
  const tabCount = [!effectiveHideDirectTab, !hideDeliveryTab, showWarehouseTab].filter(Boolean).length;

  // If non-warehouse-manager lands on warehouse tab, switch to a valid one
  useEffect(() => {
    if (!showWarehouseTab && activeTab === 'warehouse') {
      setActiveTab(hideDirectTab ? 'delivery' : 'direct');
    }
  }, [showWarehouseTab, activeTab, hideDirectTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col" dir={dir}>
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            {t('sales.hub_title')}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const next = value as 'direct' | 'delivery' | 'warehouse';
            if (hideDirectTab && next === 'direct') {
              setActiveTab('delivery');
              return;
            }
            if (next === 'warehouse' && !showWarehouseTab) return;
            setActiveTab(next);
            if (next !== 'delivery') setSelectedDeliveryOrder(null);
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className={`grid mx-4 mt-3 shrink-0 grid-cols-${tabCount}`}>
            {!hideDirectTab && (
              <TabsTrigger value="direct" className="gap-1 text-xs px-2">
                <ShoppingBag className="w-3.5 h-3.5" />
                {t('stock.direct_sale')}
              </TabsTrigger>
            )}
            <TabsTrigger value="delivery" className="gap-1 text-xs px-2">
              <Truck className="w-3.5 h-3.5" />
              {t('orders.delivery_sale')}
            </TabsTrigger>
            {showWarehouseTab && (
              <TabsTrigger value="warehouse" className="gap-1 text-xs px-2">
                <Warehouse className="w-3.5 h-3.5" />
                {t('sales.warehouse_sale')}
              </TabsTrigger>
            )}
          </TabsList>

          {!hideDirectTab && (
            <TabsContent value="direct" forceMount className={`p-0 mt-3 flex-1 min-h-0 flex flex-col ${activeTab === 'direct' ? '' : 'hidden'}`}>
              {activeTab === 'direct' && (
                <DirectSaleDialog
                  embedded
                  hideHeader
                  open={open}
                  onOpenChange={onOpenChange}
                  initialCustomerId={initialCustomerId}
                  stockItems={stockItems}
                  stockSource={stockSource}
                />
              )}
            </TabsContent>
          )}

          <TabsContent value="delivery" forceMount className={`p-0 mt-3 flex-1 min-h-0 flex flex-col ${activeTab === 'delivery' ? '' : 'hidden'}`}>
            {activeTab !== 'delivery' ? null : selectedDeliveryOrder ? (
              <div className="flex flex-col flex-1 min-h-0 space-y-3">
                <div className="px-4 flex-none">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setSelectedDeliveryOrder(null)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('sales.back_to_list')}
                  </Button>
                </div>
                <DeliverySaleDialog
                  embedded
                  hideHeader
                  open={open}
                  onOpenChange={onOpenChange}
                  order={selectedDeliveryOrder}
                />
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0 px-4 pb-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : deliveryOrders.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('deliveries.no_deliveries')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deliveryOrders.map((order) => (
                      <button
                        key={order.id}
                        className="w-full text-right border rounded-xl p-3 hover:bg-muted/30 transition-colors"
                        onClick={() => setSelectedDeliveryOrder(order)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <CustomerSummary
                            customer={{
                              name: order.customer?.name,
                              store_name: order.customer?.store_name,
                              customer_type: order.customer?.customer_type,
                              sector_name: (order.customer as any)?.sector?.name,
                              phone: order.customer?.phone,
                              wilaya: order.customer?.wilaya,
                            }}
                            compact
                            showAvatar={false}
                            showMeta={false}
                          />
                          <Badge className={`text-[10px] ${statusColor(order.status)}`}>
                            {statusLabel(order.status)}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</span>
                          <span className="font-semibold text-foreground">
                            {Number(order.total_amount || 0).toLocaleString()} {t('common.currency')}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </TabsContent>

          {showWarehouseTab && (
            <TabsContent value="warehouse" forceMount className={`p-0 mt-3 flex-1 min-h-0 flex flex-col ${activeTab === 'warehouse' ? '' : 'hidden'}`}>
              {activeTab !== 'warehouse' ? null : isLoadingWarehouseStock ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <DirectSaleDialog
                  embedded
                  hideHeader
                  open={open}
                  onOpenChange={onOpenChange}
                  initialCustomerId={initialCustomerId}
                  stockItems={warehouseStockItems}
                  stockSource="warehouse"
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SalesHubDialog;
