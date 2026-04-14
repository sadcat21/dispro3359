import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAllOrderEvents, useOrderEvents } from '@/hooks/useOrderEvents';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Search, Filter, ArrowRightLeft, UserCheck, CreditCard, Package, Plus, DollarSign,
  Clock, Users, ChevronLeft, Loader2, Copy, FileJson, FileText, XCircle, Pencil, Ban, BarChart3
} from 'lucide-react';

// Only modification-related event types
const MOD_EVENT_TYPES = ['status_change', 'worker_changed', 'payment_updated', 'item_modified', 'amount_changed', 'price_changed'];

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  created: { label: 'إنشاء', icon: Plus, color: 'bg-green-100 text-green-700 border-green-200' },
  status_change: { label: 'تغيير حالة', icon: ArrowRightLeft, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  worker_changed: { label: 'تغيير عامل', icon: UserCheck, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  payment_updated: { label: 'تحديث دفع', icon: CreditCard, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  item_modified: { label: 'تعديل منتجات', icon: Package, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  amount_changed: { label: 'تغيير مبلغ', icon: DollarSign, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  price_changed: { label: 'تغيير سعر', icon: DollarSign, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  assigned: 'معيّنة',
  in_transit: 'قيد التوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغاة',
  postponed: 'مؤجلة',
  confirmed: 'مؤكدة',
  completed: 'مكتملة',
};

interface GroupedOrder {
  orderId: string;
  customerName: string;
  storeName: string | null;
  currentStatus: string;
  totalAmount: number | null;
  events: any[];
  latestEvent: string;
  createdByName: string | null;
  assignedWorkerName: string | null;
  paymentType: string | null;
  createdAt: string | null;
}

const OrderModificationsLog: React.FC = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [dateFrom, setDateFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<GroupedOrder | null>(null);

  const { data: workers } = useQuery({
    queryKey: ['workers-list-mod-log'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workers').select('id, full_name, role').eq('is_active', true).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: events, isLoading } = useAllOrderEvents({ dateFrom, dateTo, eventType: eventTypeFilter, workerId: workerFilter });

  // Filter to only modification events (exclude 'created' and 'printed')
  const modEvents = useMemo(() => {
    if (!events) return [];
    return (events as any[]).filter(e => MOD_EVENT_TYPES.includes(e.event_type));
  }, [events]);

  const groupedOrders = useMemo<GroupedOrder[]>(() => {
    const map = new Map<string, GroupedOrder>();
    for (const e of modEvents) {
      if (!map.has(e.order_id)) {
        map.set(e.order_id, {
          orderId: e.order_id,
          customerName: e.order?.customer?.name || 'غير معروف',
          storeName: e.order?.customer?.store_name || null,
          currentStatus: e.order?.status || 'pending',
          totalAmount: e.order?.total_amount,
          events: [],
          latestEvent: e.created_at,
          createdByName: e.order?.created_by_worker?.full_name || null,
          assignedWorkerName: e.order?.assigned_worker?.full_name || null,
          paymentType: e.order?.payment_type || null,
          createdAt: e.order?.created_at || null,
        });
      }
      map.get(e.order_id)!.events.push(e);
    }
    for (const g of map.values()) {
      g.events.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.latestEvent).getTime() - new Date(a.latestEvent).getTime());
  }, [modEvents]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return groupedOrders;
    const q = searchQuery.toLowerCase();
    return groupedOrders.filter(o =>
      o.customerName.toLowerCase().includes(q) || o.orderId.toLowerCase().includes(q) || (o.storeName || '').toLowerCase().includes(q)
    );
  }, [groupedOrders, searchQuery]);

  // Daily summary stats
  const dailyStats = useMemo(() => {
    const cancellations = modEvents.filter(e => e.event_type === 'status_change' && e.new_value === 'cancelled').length;
    const amountChanges = modEvents.filter(e => e.event_type === 'amount_changed').length;
    const workerChanges = modEvents.filter(e => e.event_type === 'worker_changed').length;
    const paymentChanges = modEvents.filter(e => e.event_type === 'payment_updated').length;
    return { total: modEvents.length, cancellations, amountChanges, workerChanges, paymentChanges, ordersAffected: groupedOrders.length };
  }, [modEvents, groupedOrders]);

  // Copy helpers
  const buildOrderEventsData = (order: GroupedOrder) => ({
    order_id: order.orderId,
    customer: order.customerName,
    store: order.storeName,
    status: order.currentStatus,
    total_amount: order.totalAmount,
    created_by: order.createdByName,
    assigned_worker: order.assignedWorkerName,
    created_at: order.createdAt,
    events: order.events.map((e: any) => ({
      type: e.event_type,
      old_value: e.old_value,
      new_value: e.new_value,
      details: e.details,
      performed_by: e.performer?.full_name || null,
      at: e.created_at,
    })),
  });

  const copyJSON = (order: GroupedOrder) => {
    navigator.clipboard.writeText(JSON.stringify(buildOrderEventsData(order), null, 2));
    toast.success('تم نسخ JSON');
  };

  const copyMarkdown = (order: GroupedOrder) => {
    const d = buildOrderEventsData(order);
    let md = `# طلبية ${d.order_id.slice(0, 8)}\n`;
    md += `- **العميل**: ${d.customer}${d.store ? ` (${d.store})` : ''}\n`;
    md += `- **الحالة**: ${STATUS_LABELS[d.status] || d.status}\n`;
    md += `- **المبلغ**: ${d.total_amount?.toLocaleString() || '—'} د.ج\n`;
    md += `- **منشئ الطلب**: ${d.created_by || '—'}\n`;
    md += `- **عامل التوصيل**: ${d.assigned_worker || '—'}\n\n`;
    md += `## سجل الأحداث\n\n`;
    md += `| الوقت | النوع | القيمة القديمة | القيمة الجديدة | بواسطة |\n`;
    md += `|-------|-------|---------------|---------------|--------|\n`;
    for (const ev of d.events) {
      const time = format(new Date(ev.at), 'HH:mm dd/MM');
      const type = EVENT_TYPE_CONFIG[ev.type]?.label || ev.type;
      md += `| ${time} | ${type} | ${ev.old_value || '—'} | ${ev.new_value || '—'} | ${ev.performed_by || '—'} |\n`;
    }
    navigator.clipboard.writeText(md);
    toast.success('تم نسخ Markdown');
  };

  const copyDailyReport = () => {
    let md = `# تقرير التعديلات اليومي — ${dateFrom}\n\n`;
    md += `- **إجمالي الأحداث**: ${dailyStats.total}\n`;
    md += `- **الطلبيات المتأثرة**: ${dailyStats.ordersAffected}\n`;
    md += `- **الإلغاءات**: ${dailyStats.cancellations}\n`;
    md += `- **تغييرات المبلغ**: ${dailyStats.amountChanges}\n`;
    md += `- **تغييرات العامل**: ${dailyStats.workerChanges}\n`;
    md += `- **تغييرات الدفع**: ${dailyStats.paymentChanges}\n\n`;
    md += `## تفاصيل الطلبيات\n\n`;
    for (const o of filteredOrders) {
      md += `### #${o.orderId.slice(0, 8)} — ${o.customerName}\n`;
      md += `الحالة: ${STATUS_LABELS[o.currentStatus] || o.currentStatus} | المبلغ: ${o.totalAmount?.toLocaleString() || '—'} | ${o.events.length} حدث\n\n`;
    }
    navigator.clipboard.writeText(md);
    toast.success('تم نسخ التقرير اليومي');
  };

  return (
    <div className="space-y-3 pb-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">سجل تعديلات الطلبيات</h1>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={copyDailyReport}>
          <BarChart3 className="h-3.5 w-3.5" />
          نسخ التقرير
        </Button>
      </div>

      {/* Daily Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-2 text-center">
          <div className="text-lg font-bold text-primary">{dailyStats.ordersAffected}</div>
          <div className="text-[9px] text-muted-foreground">طلبية متأثرة</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-lg font-bold text-destructive">{dailyStats.cancellations}</div>
          <div className="text-[9px] text-muted-foreground">إلغاء</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-lg font-bold text-orange-600">{dailyStats.total}</div>
          <div className="text-[9px] text-muted-foreground">حدث تعديل</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">من</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">إلى</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute end-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث بالعميل أو #رمز..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 text-sm pe-8" />
            </div>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <Filter className="h-3 w-3 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="status_change">حالة</SelectItem>
                <SelectItem value="worker_changed">عامل</SelectItem>
                <SelectItem value="payment_updated">دفع</SelectItem>
                <SelectItem value="amount_changed">مبلغ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={workerFilter} onValueChange={setWorkerFilter}>
            <SelectTrigger className="h-8 text-sm">
              <Users className="h-3 w-3 ml-1" />
              <SelectValue placeholder="كل العمال" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العمال</SelectItem>
              {workers?.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Orders List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          لا توجد تعديلات في الفترة المحددة
        </Card>
      ) : (
        <div className="space-y-2 pb-20">
          {filteredOrders.map(order => (
            <Card
              key={order.orderId}
              className="cursor-pointer hover:shadow-md transition-all border-s-[3px] border-s-orange-400 active:scale-[0.99]"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{order.customerName}</div>
                    {order.storeName && <div className="text-[10px] text-muted-foreground truncate">{order.storeName}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className={`text-[10px] ${
                      order.currentStatus === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-muted text-muted-foreground'
                    }`}>
                      {STATUS_LABELS[order.currentStatus] || order.currentStatus}
                    </Badge>
                    {order.totalAmount != null && (
                      <span className="text-xs font-bold">{Number(order.totalAmount).toLocaleString()} د.ج</span>
                    )}
                  </div>
                </div>
                {/* Event type badges */}
                <div className="flex flex-wrap gap-1">
                  {[...new Set(order.events.map((e: any) => e.event_type))].map(type => {
                    const cfg = EVENT_TYPE_CONFIG[type as string];
                    if (!cfg) return null;
                    const count = order.events.filter((e: any) => e.event_type === type).length;
                    return (
                      <Badge key={type as string} variant="outline" className={`text-[9px] py-0 px-1.5 ${cfg.color}`}>
                        {cfg.label} {count > 1 ? `×${count}` : ''}
                      </Badge>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>#{order.orderId.slice(0, 6)}</span>
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
          {selectedOrder && (
            <OrderDetailTimeline order={selectedOrder} onCopyJSON={copyJSON} onCopyMarkdown={copyMarkdown} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Sub-component that fetches ALL events for the selected order
const OrderDetailTimeline: React.FC<{
  order: GroupedOrder;
  onCopyJSON: (o: GroupedOrder) => void;
  onCopyMarkdown: (o: GroupedOrder) => void;
}> = ({ order, onCopyJSON, onCopyMarkdown }) => {
  const { data: allEvents, isLoading } = useOrderEvents(order.orderId);

  const eventsToShow = allEvents && allEvents.length > 0 ? allEvents : order.events;

  return (
    <>
      <div className="p-4 pb-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-mono">#{order.orderId.slice(0, 8)}</span>
          <Badge variant="outline" className="text-[10px]">
            {STATUS_LABELS[order.currentStatus] || order.currentStatus}
          </Badge>
        </div>
        <div className="font-semibold text-sm">{order.customerName}</div>
        {order.storeName && <div className="text-xs text-muted-foreground">{order.storeName}</div>}
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1 flex-1" onClick={() => onCopyJSON(order)}>
            <FileJson className="h-3 w-3" />
            نسخ JSON
          </Button>
          <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1 flex-1" onClick={() => onCopyMarkdown(order)}>
            <FileText className="h-3 w-3" />
            نسخ Markdown
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="relative pe-4 space-y-0">
            <div className="absolute end-[7px] top-2 bottom-2 w-0.5 bg-border" />
            {eventsToShow.map((event: any, idx: number) => {
              const config = EVENT_TYPE_CONFIG[event.event_type] || { label: event.event_type, icon: Clock, color: 'bg-muted text-muted-foreground' };
              const Icon = config.icon;
              const isLast = idx === eventsToShow.length - 1;
              return (
                <div key={event.id} className="relative flex items-start gap-3 pb-4">
                  <div className={`relative z-10 w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-1 ${isLast ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/40'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-3 w-3 ${config.color.split(' ')[1]}`} />
                        <span className="text-xs font-medium">{config.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(event.created_at), 'HH:mm dd/MM')}</span>
                    </div>
                    {event.event_type === 'created' && event.details?.total_amount && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        المبلغ: {Number(event.details.total_amount).toLocaleString()} د.ج
                      </div>
                    )}
                    {event.event_type === 'status_change' && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                        <span className="text-muted-foreground">{STATUS_LABELS[event.old_value] || event.old_value}</span>
                        <span>←</span>
                        <span className="font-medium text-primary">{STATUS_LABELS[event.new_value] || event.new_value}</span>
                      </div>
                    )}
                    {event.event_type === 'amount_changed' && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr" style={{ unicodeBidi: 'embed' }}>
                        {Number(event.old_value).toLocaleString()} → {Number(event.new_value).toLocaleString()} د.ج
                      </div>
                    )}
                    {event.event_type === 'payment_updated' && (
                      <div className="mt-0.5 text-[11px]">
                        {event.details?.payment_type_change && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[8px] py-0 px-1">{event.old_value === 'with_invoice' ? 'F1' : 'F2'}</Badge>
                            <span className="text-[10px]">←</span>
                            <Badge variant="outline" className="text-[8px] py-0 px-1 font-bold">{event.new_value === 'with_invoice' ? 'F1' : 'F2'}</Badge>
                          </div>
                        )}
                        {event.details?.invoice_method_change && (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[8px] py-0 px-1">{event.details.old_invoice_method || '—'}</Badge>
                            <span className="text-[10px]">←</span>
                            <Badge variant="outline" className="text-[8px] py-0 px-1 font-bold">{event.details.new_invoice_method || '—'}</Badge>
                          </div>
                        )}
                      </div>
                    )}
                    {event.event_type === 'worker_changed' && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">تم تغيير العامل</div>
                    )}
                    {event.performer?.full_name && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Users className="h-2.5 w-2.5" />
                        {event.performer.full_name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </>
  );
};

export default OrderModificationsLog;
