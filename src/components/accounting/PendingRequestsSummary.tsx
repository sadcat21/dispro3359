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
  product: { name?: string | null } | null;
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
        .select('id, quantity, gift_quantity, unit_price, total_price, product:products(name)')
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
            إجمالي: {fmt(totalAmount)} دج
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
                <span className="font-semibold text-foreground">{fmt(Number(o.total_amount || 0))} دج</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!openOrder} onOpenChange={(o) => !o && setOpenOrder(null)}>
        <DialogContent className="max-w-md max-h-[85dvh] p-0 flex flex-col" dir="rtl">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5 text-primary" />
              تفاصيل الطلبية
            </DialogTitle>
          </DialogHeader>

          {openOrder && (
            <ScrollArea className="flex-1 p-4 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(openOrder.status)}`}>
                    {statusLabel(openOrder.status)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">#{openOrder.id.slice(0, 8)}</span>
                </div>

                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-primary" />
                  {openOrder.customer?.store_name || openOrder.customer?.name || '—'}
                </h3>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {openOrder.assigned?.full_name && (
                    <div className="bg-muted/40 rounded p-2">
                      <p className="text-muted-foreground flex items-center gap-1"><UserIcon className="w-3 h-3" /> الموصل</p>
                      <p className="font-semibold">{openOrder.assigned.full_name}</p>
                    </div>
                  )}
                  {openOrder.delivery_date && (
                    <div className="bg-muted/40 rounded p-2">
                      <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> تاريخ التوصيل</p>
                      <p className="font-semibold">{new Date(openOrder.delivery_date).toLocaleDateString('ar-DZ')}</p>
                    </div>
                  )}
                  <div className="bg-muted/40 rounded p-2">
                    <p className="text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> طريقة الدفع</p>
                    <p className="font-semibold">{paymentLabel(openOrder.payment_type)}</p>
                  </div>
                  <div className="bg-primary/10 rounded p-2">
                    <p className="text-muted-foreground">المبلغ</p>
                    <p className="font-bold text-primary">{fmt(Number(openOrder.total_amount || 0))} دج</p>
                  </div>
                </div>

                {openOrder.notes && (
                  <p className="text-[11px] bg-muted/30 rounded p-2 text-muted-foreground">{openOrder.notes}</p>
                )}
              </div>

              <div className="mt-3 pt-3 border-t space-y-1.5">
                <p className="text-xs font-semibold">المنتجات</p>
                {itemsLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                ) : !items || items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">لا توجد منتجات.</p>
                ) : (
                  items.map((it) => (
                    <div key={it.id} className="rounded-md border bg-background px-2 py-1.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate">{it.product?.name || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {fmt(Number(it.quantity || 0))} × {fmt(Number(it.unit_price || 0))} دج
                          {Number(it.gift_quantity || 0) > 0 && ` • هدية: ${fmt(Number(it.gift_quantity))}`}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold shrink-0">{fmt(Number(it.total_price || 0))} دج</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingRequestsSummary;
