import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Store, Loader2, Package, User as UserIcon, Calendar, CreditCard } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface Props {
  workerId: string;
  periodStart: string;
  periodEnd: string;
}

interface OrderRow {
  id: string;
  status: string;
  total_amount: number | null;
  payment_status: string | null;
  payment_type: string | null;
  created_at: string;
  delivery_date: string | null;
  notes: string | null;
  customer: { name?: string | null; store_name?: string | null; phone?: string | null } | null;
  assigned: { full_name?: string | null } | null;
}

interface OrderItemRow {
  id: string;
  quantity: number | null;
  gift_quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  product: { name?: string | null; image_url?: string | null } | null;
}

const toTz = (v: string, isEnd: boolean) => {
  if (v.includes('+') || v.includes('Z')) return v;
  if (v.includes('T')) return `${v}:00+01:00`;
  return isEnd ? `${v}T23:59:59+01:00` : `${v}T00:00:00+01:00`;
};

const fmt = (n: number) => n.toLocaleString('fr-DZ');

const statusBadgeClass = (s: string) => {
  if (s === 'cancelled') return 'bg-destructive/10 text-destructive border-destructive/30';
  if (s === 'in_progress') return 'bg-blue-100 text-blue-800 border-blue-300';
  if (s === 'assigned') return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-muted text-foreground border-border';
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'cancelled': return 'ملغاة';
    case 'in_progress': return 'قيد التوصيل';
    case 'assigned': return 'مسندة';
    case 'pending': return 'معلقة';
    default: return s;
  }
};

const paymentLabel = (p: string | null) => {
  if (!p) return '—';
  if (p === 'full') return 'كامل';
  if (p === 'partial') return 'جزئي';
  if (p === 'debt') return 'دين';
  return p;
};

const PendingRequestsSummary: React.FC<Props> = ({ workerId, periodStart, periodEnd }) => {
  const [openOrder, setOpenOrder] = useState<OrderRow | null>(null);

  useRealtimeSubscription(
    `session-created-orders-${workerId || 'none'}`,
    [{ table: 'orders', filter: workerId ? `created_by=eq.${workerId}` : undefined }],
    [['session-created-orders', workerId, periodStart, periodEnd]],
    !!workerId && !!periodStart && !!periodEnd,
  );

  const { data: orders, isLoading } = useQuery({
    queryKey: ['session-created-orders', workerId, periodStart, periodEnd],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, status, total_amount, payment_status, payment_type, created_at, delivery_date, notes,
          customer:customers(name, store_name, phone),
          assigned:workers!orders_assigned_worker_id_fkey(full_name)
        `)
        .eq('created_by', workerId)
        .not('status', 'in', '(delivered,cancelled)')
        .gte('created_at', toTz(periodStart, false))
        .lte('created_at', toTz(periodEnd, true))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OrderRow[];
    },
    enabled: !!workerId && !!periodStart && !!periodEnd,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['session-created-order-items', openOrder?.id],
    queryFn: async (): Promise<OrderItemRow[]> => {
      if (!openOrder) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('id, quantity, gift_quantity, unit_price, total_price, product:products(name, image_url)')
        .eq('order_id', openOrder.id);
      if (error) throw error;
      return (data || []) as unknown as OrderItemRow[];
    },
    enabled: !!openOrder,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return <p className="text-xs text-muted-foreground">لا توجد طلبيات قيد التوصيل أنشأها العامل خلال هذه الفترة ✓</p>;
  }

  const totalAmount = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary/10 text-primary border border-primary/30 text-[10px]">
            <Package className="w-3 h-3 ml-1" />
            {orders.length} طلبية قيد التوصيل
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            إجمالي: {fmt(totalAmount)} DA
          </Badge>
        </div>

        {orders.map((o) => (
          <Card
            key={o.id}
            className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors active:scale-[0.99]"
            onClick={() => setOpenOrder(o)}
          >
            <CardContent className="p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(o.status)}`}>
                  {statusLabel(o.status)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(o.created_at).toLocaleString('ar-DZ')}
                </span>
              </div>

              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <Store className="w-3 h-3 text-primary" />
                {o.customer?.store_name || o.customer?.name || '—'}
              </h4>

              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground flex-wrap">
                {o.assigned?.full_name && (
                  <span className="flex items-center gap-0.5">
                    <UserIcon className="w-2.5 h-2.5" />
                    {o.assigned.full_name}
                  </span>
                )}
                <span className="font-semibold text-foreground">{fmt(Number(o.total_amount || 0))} DA</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openOrder} onOpenChange={(o) => !o && setOpenOrder(null)}>
        <DialogContent className="max-w-md max-h-[90dvh] p-0 flex flex-col gap-0 overflow-hidden bg-background" dir="rtl">
          <DialogHeader className="p-3 bg-destructive/10 border-b">
            <DialogTitle className="flex items-center justify-end gap-2 text-sm font-bold text-destructive">
              تفاصيل الطلبية
              <Package className="w-4 h-4" />
            </DialogTitle>
          </DialogHeader>

          {openOrder && (
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {/* Customer card */}
                <Card className="overflow-hidden">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(openOrder.status)}`}>
                        {statusLabel(openOrder.status)}
                      </Badge>
                      <h3 className="text-sm font-bold flex items-center gap-1.5">
                        {openOrder.customer?.store_name || openOrder.customer?.name || '—'}
                        {openOrder.assigned?.full_name && (
                          <span className="text-[11px] text-muted-foreground font-normal">— {openOrder.assigned.full_name}</span>
                        )}
                        <Store className="w-4 h-4 text-primary" />
                      </h3>
                    </div>
                    {openOrder.customer?.phone && (
                      <p className="text-[11px] text-muted-foreground text-end">📞 {openOrder.customer.phone}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground text-end">
                      التاريخ: {new Date(openOrder.created_at).toLocaleString('ar-DZ')}
                    </p>
                  </CardContent>
                </Card>

                {/* Products */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-end">المنتجات</p>
                  {itemsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  ) : !items || items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-2">لا توجد منتجات.</p>
                  ) : (
                    items.map((it) => (
                      <Card key={it.id} className="overflow-hidden bg-card border-border shadow-sm">
                        <CardContent className="p-2.5 flex items-center gap-2.5">
                          <div className="shrink-0 flex flex-col items-start gap-0.5">
                            <p className="text-xs font-bold text-destructive whitespace-nowrap">
                              DA {fmt(Number(it.total_price || 0))}
                            </p>
                            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                              السعر: <span className="text-blue-600 font-bold">{fmt(Number(it.unit_price || 0))}</span>
                            </p>
                          </div>
                          <div className="flex-1 min-w-0 text-end space-y-0.5">
                            <p className="text-xs font-semibold leading-tight">{it.product?.name || '—'}</p>
                            <p className="text-[11px] text-muted-foreground">
                              الكمية المتفق عليها: <span className="text-blue-600 font-bold text-xs">{fmt(Number(it.quantity || 0))}</span>
                            </p>
                            {Number(it.gift_quantity || 0) > 0 && (
                              <p className="text-[10px] text-destructive font-semibold">
                                هدية: {fmt(Number(it.gift_quantity))}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 w-12 h-12 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                            {it.product?.image_url ? (
                              <img src={it.product.image_url} alt={it.product.name || ''} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Package className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {openOrder.notes && (
                  <p className="text-[11px] bg-muted/50 rounded p-2 text-muted-foreground text-end">{openOrder.notes}</p>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Total bar */}
          {openOrder && (
            <div className="border-t bg-destructive/10 p-3 flex items-center justify-between">
              <span className="text-base font-bold text-destructive">
                DA {fmt(Number(openOrder.total_amount || 0))}
              </span>
              <span className="text-sm font-bold text-destructive">المجموع</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingRequestsSummary;
