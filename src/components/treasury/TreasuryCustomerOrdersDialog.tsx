import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle, Coins, Package, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CustomerSummary from '@/components/customers/CustomerSummary';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GroupOrder {
  id: string;
  total_amount: number;
  created_at: string;
  debt_amount: number;
  stamp_amount: number;
  stamp_percentage: number;
}

interface TreasuryCustomerGroup {
  customer_id: string;
  customer_name: string;
  store_name: string | null;
  orders: GroupOrder[];
  total: number;
  totalStamp: number;
  totalDebt: number;
}

interface TreasuryCustomerOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: TreasuryCustomerGroup | null;
}

const MoneyValue = ({ value, className = '' }: { value: number; className?: string }) => (
  <bdi dir="ltr" className={`inline-block whitespace-nowrap tabular-nums ${className}`.trim()}>
    {value.toLocaleString()} DA
  </bdi>
);

const normalizeItem = (item: any) => ({
  id: item?.id || `${item?.product_id || 'item'}-${item?.quantity || 0}`,
  productName: item?.product?.name || item?.product_name || '—',
  productImage: item?.product?.image_url || item?.image_url || null,
  quantity: Number(item?.quantity || 0),
  unitPrice: Number(item?.unit_price || 0),
  totalPrice: Number(item?.total_price || 0),
  giftQuantity: Number(item?.gift_quantity || 0),
});

const TreasuryCustomerOrdersDialog = ({
  open,
  onOpenChange,
  group,
}: TreasuryCustomerOrdersDialogProps) => {
  const { activeBranch } = useAuth();
  const orderIds = useMemo(() => group?.orders.map((order) => order.id).filter(Boolean) || [], [group]);

  const { data: orderDetails = [], isLoading } = useQuery({
    queryKey: ['treasury-customer-orders-dialog', orderIds, activeBranch?.id],
    enabled: open && orderIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          customer:customers(id, name, store_name, customer_type, phone, wilaya),
          order_items(
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            gift_quantity,
            product:products(name, image_url)
          )
        `)
        .in('id', orderIds);

      if (activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const detailsById = useMemo(
    () => new Map(orderDetails.map((order: any) => [order.id, order])),
    [orderDetails],
  );

  const customerDetails = orderDetails[0]?.customer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">تفاصيل الطلبيات</DialogTitle>
        </DialogHeader>

        {!group ? (
          <div className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات لعرضها.</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg bg-muted/50 p-3">
              <CustomerSummary
                customer={{
                  name: customerDetails?.name || group.customer_name,
                  store_name: customerDetails?.store_name || group.store_name,
                  customer_type: customerDetails?.customer_type,
                  phone: customerDetails?.phone,
                  wilaya: customerDetails?.wilaya,
                }}
                compact
                showAvatar={false}
                showMeta={false}
              />

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {customerDetails?.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {customerDetails.phone}
                  </span>
                )}
                <span>• {group.orders.length} عمليات</span>
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 p-3 flex items-center justify-between">
              <span className="font-bold">الإجمالي الموحد</span>
              <MoneyValue value={group.total} className="text-lg font-bold text-primary" />
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">جاري تحميل تفاصيل الطلبيات...</div>
            ) : (
              <div className="space-y-3">
                {group.orders.map((order, index) => {
                  const orderDetailsEntry: any = detailsById.get(order.id);
                  const items = (orderDetailsEntry?.order_items || []).map(normalizeItem);

                  return (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="border-b bg-muted/30 px-4 py-3 flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold">طلبية {index + 1}</span>
                              {order.stamp_amount > 0 && (
                                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                                  <Coins className="w-3 h-3 ml-1" />
                                  طابع {order.stamp_amount.toLocaleString()} DA
                                </Badge>
                              )}
                              {order.debt_amount > 0 && (
                                <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                                  <AlertCircle className="w-3 h-3 ml-1" />
                                  دين {order.debt_amount.toLocaleString()} DA
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>

                          <MoneyValue value={order.total_amount} className="text-sm font-bold" />
                        </div>

                        {items.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-muted-foreground">لا توجد منتجات لهذه الطلبية.</div>
                        ) : (
                          <div className="divide-y">
                            {items.map((item) => (
                              <div key={item.id} className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-muted/40">
                                    {item.productImage ? (
                                      <img
                                        src={item.productImage}
                                        alt={item.productName}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                        <Package className="w-4 h-4" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="font-medium text-sm leading-5">{item.productName}</span>
                                      <MoneyValue value={item.totalPrice} className="text-sm font-bold" />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                      <span>الكمية: {item.quantity}</span>
                                      <span>السعر: {item.unitPrice.toLocaleString()} DA</span>
                                      {item.giftQuantity > 0 && <span className="text-emerald-600">هدية: {item.giftQuantity}</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TreasuryCustomerOrdersDialog;
