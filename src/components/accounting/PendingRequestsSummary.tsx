import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Store, Loader2, Package, User as UserIcon } from 'lucide-react';
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
  created_at: string;
  customer: { name?: string | null; store_name?: string | null } | null;
  assigned: { full_name?: string | null } | null;
}

const toTz = (v: string, isEnd: boolean) => {
  if (v.includes('+') || v.includes('Z')) return v;
  if (v.includes('T')) return `${v}:00+01:00`;
  return isEnd ? `${v}T23:59:59+01:00` : `${v}T00:00:00+01:00`;
};

const fmt = (n: number) => n.toLocaleString('fr-DZ');

const statusBadgeClass = (s: string) => {
  if (s === 'delivered') return 'bg-green-100 text-green-800 border-green-300';
  if (s === 'cancelled') return 'bg-destructive/10 text-destructive border-destructive/30';
  if (s === 'in_progress' || s === 'assigned') return 'bg-blue-100 text-blue-800 border-blue-300';
  return 'bg-muted text-foreground border-border';
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'delivered': return 'تم التوصيل';
    case 'cancelled': return 'ملغاة';
    case 'in_progress': return 'قيد التوصيل';
    case 'assigned': return 'مسندة';
    case 'pending': return 'معلقة';
    default: return s;
  }
};

const PendingRequestsSummary: React.FC<Props> = ({ workerId, periodStart, periodEnd }) => {
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
          id, status, total_amount, payment_status, created_at,
          customer:customers(name, store_name),
          assigned:workers!orders_assigned_worker_id_fkey(full_name)
        `)
        .eq('created_by', workerId)
        .gte('created_at', toTz(periodStart, false))
        .lte('created_at', toTz(periodEnd, true))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OrderRow[];
    },
    enabled: !!workerId && !!periodStart && !!periodEnd,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return <p className="text-xs text-muted-foreground">لا توجد طلبيات جديدة أنشأها العامل خلال هذه الفترة ✓</p>;
  }

  const totalAmount = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-primary/10 text-primary border border-primary/30 text-[10px]">
          <Package className="w-3 h-3 ml-1" />
          {orders.length} طلبية
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          إجمالي: {fmt(totalAmount)} دج
        </Badge>
      </div>

      {orders.map((o) => (
        <Card key={o.id} className="overflow-hidden">
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
  );
};

export default PendingRequestsSummary;
