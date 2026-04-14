import React, { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCancelOrder, useResumeOrder } from '@/hooks/useOrders';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import AdaptiveScrollContainer from '@/components/ui/adaptive-scroll-container';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, ShoppingCart, Truck, Package, UserPlus, Edit2, Banknote, Eye, CalendarCheck, ClipboardList } from 'lucide-react';
import { getOperationLabel, type OperationType } from '@/hooks/useVisitTracking';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import CollectedDebtOperationDialog, { TodayDebtCollectionOperation } from '@/components/debts/CollectedDebtOperationDialog';
import WorkerHandoverPreviewDialog from '@/components/accounting/WorkerHandoverPreviewDialog';
import WorkerSalesSummaryDialog from '@/components/accounting/WorkerSalesSummaryDialog';
import WorkerOrdersSummaryDialog from '@/components/accounting/WorkerOrdersSummaryDialog';
import type { OrderWithDetails } from '@/types/database';
import { isAdminRole } from '@/lib/utils';

const OPERATION_ICONS: Record<string, React.ReactNode> = {
  order: <ShoppingCart className="w-4 h-4 text-blue-600" />,
  direct_sale: <Package className="w-4 h-4 text-emerald-600" />,
  delivery: <Truck className="w-4 h-4 text-green-600" />,
  add_customer: <UserPlus className="w-4 h-4 text-purple-600" />,
  update_customer: <Edit2 className="w-4 h-4 text-amber-600" />,
  delete_customer: <Edit2 className="w-4 h-4 text-red-600" />,
  debt_collection: <Banknote className="w-4 h-4 text-orange-600" />,
  visit: <Eye className="w-4 h-4 text-cyan-600" />,
  delivery_visit: <MapPin className="w-4 h-4 text-teal-600" />,
};

const OPERATION_COLORS: Record<string, string> = {
  order: 'bg-blue-100/70 text-blue-700 border-blue-200',
  direct_sale: 'bg-emerald-100/70 text-emerald-700 border-emerald-200',
  delivery: 'bg-green-100/70 text-green-700 border-green-200',
  add_customer: 'bg-purple-100/70 text-purple-700 border-purple-200',
  update_customer: 'bg-amber-100/70 text-amber-700 border-amber-200',
  delete_customer: 'bg-red-100/70 text-red-700 border-red-200',
  debt_collection: 'bg-orange-100/70 text-orange-700 border-orange-200',
  visit: 'bg-cyan-100/70 text-cyan-700 border-cyan-200',
  delivery_visit: 'bg-teal-100/70 text-teal-700 border-teal-200',
};

type AchievementOrderDetails = OrderWithDetails & {
  customer_name?: string;
  _isDirectSale?: boolean;
  _forceSold?: boolean;
  _selectionKey?: string;
  _detailsLoading?: boolean;
  _hideModifyAction?: boolean;
};

const AchievementDetailContent: React.FC<{ visit: any; onClose: () => void }> = ({ visit, onClose }) => {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {OPERATION_ICONS[visit.operation_type] || <MapPin className="w-5 h-5" />}
          {getOperationLabel(visit.operation_type as OperationType)}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">التاريخ</span>
            <span dir="ltr">{format(new Date(visit.created_at), 'dd/MM/yyyy HH:mm')}</span>
          </div>
          {visit.customer_name ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">العميل</span>
              <span>{visit.customer_name}</span>
            </div>
          ) : null}
          {visit.notes ? (
            <div className="space-y-1">
              <div className="font-medium">ملاحظات</div>
              <div className="text-muted-foreground">{visit.notes}</div>
            </div>
          ) : null}
        </div>
        <Button variant="outline" className="w-full" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </>
  );
};

const DebtAggregatesDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId?: string;
  dateFrom: string;
  dateTo: string;
}> = ({ open, onOpenChange, workerId, dateFrom, dateTo }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['worker-achievement-debt-aggregates', workerId, dateFrom, dateTo],
    queryFn: async () => {
      if (!workerId) return { newDebts: [], collectedDebts: [] };
      const [{ data: newDebts }, { data: collectedDebts }] = await Promise.all([
        supabase
          .from('customer_debts')
          .select('id,total_amount,remaining_amount,created_at,status,customer:customers(name,store_name,phone)')
          .eq('worker_id', workerId)
          .gte('created_at', `${dateFrom}T00:00:00`)
          .lte('created_at', `${dateTo}T23:59:59`)
          .order('created_at', { ascending: false }),
        supabase
          .from('debt_collections')
          .select('id,amount_collected,collection_date,payment_method,debt:customer_debts(customer:customers(name,store_name,phone))')
          .eq('worker_id', workerId)
          .gte('collected_at', `${dateFrom}T00:00:00`)
          .lte('collected_at', `${dateTo}T23:59:59`)
          .order('collected_at', { ascending: false }),
      ]);
      return { newDebts: newDebts || [], collectedDebts: collectedDebts || [] };
    },
    enabled: open && !!workerId,
  });

  const newDebtTotal = (data?.newDebts || []).reduce((sum: number, item: any) => sum + Number(item.total_amount || 0), 0);
  const collectedTotal = (data?.collectedDebts || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>تجميعات الديون</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="collected" className="space-y-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="collected">الديون المحصلة</TabsTrigger>
            <TabsTrigger value="new">الديون الجديدة</TabsTrigger>
          </TabsList>

          <TabsContent value="collected" className="space-y-3">
            <Card className="rounded-2xl">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الإجمالي</span>
                <span className="font-black text-green-700" dir="ltr">{collectedTotal.toLocaleString()} DA</span>
              </CardContent>
            </Card>
            <AdaptiveScrollContainer
              maxHeightClassName="h-[45vh]"
              className="rounded-2xl border"
              contentClassName="space-y-2 p-2"
            >
                {(data?.collectedDebts || []).map((item: any) => (
                  <div key={item.id} className="rounded-xl border bg-green-50/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{item.debt?.customer?.store_name || item.debt?.customer?.name || 'عميل'}</div>
                      <div className="font-bold text-green-700" dir="ltr">{Number(item.amount || 0).toLocaleString()} DA</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {format(new Date(item.collected_at), 'dd/MM/yyyy')}
                    </div>
                  </div>
                ))}
                {!isLoading && !(data?.collectedDebts || []).length ? <div className="py-8 text-center text-sm text-muted-foreground">لا توجد تحصيلات</div> : null}
            </AdaptiveScrollContainer>
          </TabsContent>

          <TabsContent value="new" className="space-y-3">
            <Card className="rounded-2xl">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الإجمالي</span>
                <span className="font-black text-destructive" dir="ltr">{newDebtTotal.toLocaleString()} DA</span>
              </CardContent>
            </Card>
            <AdaptiveScrollContainer
              maxHeightClassName="h-[45vh]"
              className="rounded-2xl border"
              contentClassName="space-y-2 p-2"
            >
                {(data?.newDebts || []).map((item: any) => (
                  <div key={item.id} className="rounded-xl border bg-red-50/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{item.customer?.store_name || item.customer?.name || 'عميل'}</div>
                      <div className="font-bold text-destructive" dir="ltr">{Number(item.total_amount || 0).toLocaleString()} DA</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {format(new Date(item.created_at), 'dd/MM/yyyy')}
                    </div>
                  </div>
                ))}
                {!isLoading && !(data?.newDebts || []).length ? <div className="py-8 text-center text-sm text-muted-foreground">لا توجد ديون جديدة</div> : null}
            </AdaptiveScrollContainer>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const MyAchievements: React.FC = () => {
  const { workerId, user, role, activeBranch } = useAuth();
  const [searchParams] = useSearchParams();
  const today = format(new Date(), 'yyyy-MM-dd');
  const canInspectSelectedWorker = isAdminRole(role) || role === 'supervisor';
  const searchWorker = searchParams.get('worker');
  const searchName = searchParams.get('name');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(() => searchWorker || workerId || '');
  const [periodFrom, setPeriodFrom] = useState<string>(() => searchParams.get('from') || today);
  const [periodTo, setPeriodTo] = useState<string>(() => searchParams.get('to') || today);
  const [showPeriodDialog, setShowPeriodDialog] = useState(false);

  const normalizeRange = (from: string, to: string) => {
    const start = new Date(`${from || today}T00:00:00`);
    const end = new Date(`${(to || from || today)}T23:59:59`);
    if (start > end) return { start: end, end: start };
    return { start, end };
  };

  const { start, end } = normalizeRange(periodFrom, periodTo);
  const dateFrom = format(start, 'yyyy-MM-dd');
  const dateTo = format(end, 'yyyy-MM-dd');

  const { data: workersList = [] } = useQuery({
    queryKey: ['achievements-workers', activeBranch?.id, canInspectSelectedWorker],
    queryFn: async () => {
      if (!canInspectSelectedWorker) return [];
      let query = supabase.from('workers_safe').select('id, full_name, branch_id');
      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
      const { data } = await query.order('full_name');
      return data || [];
    },
    enabled: canInspectSelectedWorker,
  });

  const targetWorkerId = canInspectSelectedWorker ? selectedWorkerId : (workerId || '');
  const targetWorkerName = canInspectSelectedWorker
    ? (workersList.find((w: any) => w.id === selectedWorkerId)?.full_name || searchName || user?.full_name)
    : (searchName || user?.full_name);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<AchievementOrderDetails | null>(null);
  const [selectedDebtCollection, setSelectedDebtCollection] = useState<TodayDebtCollectionOperation | null>(null);
  const [showHandoverSummary, setShowHandoverSummary] = useState(false);
  const [showSalesSummary, setShowSalesSummary] = useState(false);
  const [showOrdersSummary, setShowOrdersSummary] = useState(false);
  const [showDebtAggregates, setShowDebtAggregates] = useState(false);
  const queryClient = useQueryClient();
  const cancelOrder = useCancelOrder();
  const resumeOrder = useResumeOrder();

  const handleCancelOrder = useCallback(async (orderId: string) => {
    await cancelOrder.mutateAsync(orderId);
    toast.success('تم إلغاء الطلبية بنجاح');
    setSelectedOrderDetails(null);
  }, [cancelOrder]);

  const handleResumeOrder = useCallback(async (orderId: string) => {
    await resumeOrder.mutateAsync(orderId);
    toast.success('تم استئناف الطلبية بنجاح');
    setSelectedOrderDetails(null);
  }, [resumeOrder]);

  const prefetchOrderDialogData = useCallback((orderId: string) => {
    if (!orderId) return;

    void queryClient.prefetchQuery({
      queryKey: ['order-items', orderId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            *,
            product:products(*)
          `)
          .eq('order_id', orderId);

        if (error) throw error;
        return data || [];
      },
      staleTime: 60_000,
    });

    void queryClient.prefetchQuery({
      queryKey: ['order-debt-details', orderId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('customer_debts')
          .select('total_amount, paid_amount, remaining_amount')
          .eq('order_id', orderId)
          .maybeSingle();

        if (error) throw error;
        return data;
      },
      staleTime: 60_000,
    });
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['my-achievements-page', targetWorkerId, dateFrom, dateTo],
    queryFn: async () => {
      if (!targetWorkerId) return { visits: [], counts: {} };
      const { data: visits } = await supabase
        .from('visit_tracking')
        .select('id, worker_id, customer_id, operation_type, operation_id, notes, created_at, branch_id')
        .eq('worker_id', targetWorkerId)
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      const customerIds = [...new Set((visits || []).filter((v) => v.customer_id).map((v) => v.customer_id!))];
      const orderLinkedTypes = new Set<OperationType>(['order', 'direct_sale', 'delivery']);
      const debtCollectionDebtIds = [...new Set(
        (visits || [])
          .filter(v => v.operation_type === 'debt_collection')
          .map(v => v.operation_id || (v as any).entity_id || (v as any).reference_id)
          .filter(Boolean) as string[]
      )];
      const orderIds = [...new Set(
        (visits || [])
          .filter(v => orderLinkedTypes.has(v.operation_type as OperationType))
          .map(v => v.operation_id)
          .filter(Boolean) as string[]
      )];

      // Run all secondary queries in parallel
      const [customersResult, ordersResult, orderItemsResult, debtsResult, debtCollectionsResult] = await Promise.all([
        // 1. Customers
        customerIds.length
          ? supabase.from('customers').select('id, name, store_name, phone').in('id', customerIds)
          : Promise.resolve({ data: [] as any[] }),
        // 2. Orders
        orderIds.length
          ? supabase.from('orders').select('id, total_amount, payment_type, invoice_payment_method, status').in('id', orderIds)
          : Promise.resolve({ data: [] as any[] }),
        // 3. Order items (only price_subtype)
        orderIds.length
          ? supabase.from('order_items').select('order_id, price_subtype').in('order_id', orderIds)
          : Promise.resolve({ data: [] as any[] }),
        // 4. Customer debts
        orderIds.length
          ? supabase.from('customer_debts').select('order_id, remaining_amount, paid_amount, total_amount').in('order_id', orderIds).gt('remaining_amount', 0)
          : Promise.resolve({ data: [] as any[] }),
        // 5. Debt collections
        debtCollectionDebtIds.length
          ? supabase.from('debt_collections').select(`debt_id, amount_collected, created_at, debt:customer_debts!debt_collections_debt_id_fkey(customer:customers(id, name, store_name))`).in('debt_id', debtCollectionDebtIds).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // Process customers
      const customerMap = new Map<string, { name: string; store_name: string; phone: string }>();
      for (const customer of customersResult.data || []) {
        customerMap.set(customer.id, {
          name: customer.name || '',
          store_name: customer.store_name || '',
          phone: customer.phone || '',
        });
      }

      // Process orders & debts
      const debtOrderIds = new Set<string>();
      const debtStatusMap = new Map<string, 'partial' | 'full'>();
      const debtMoneyMap = new Map<string, { paidAmount: number; remainingAmount: number; totalAmount: number }>();
      const orderMetaMap = new Map<string, {
        totalAmount: number;
        paymentType: string;
        invoiceMethod: string | null;
        priceSubtype: string | null;
        isCancelled: boolean;
        status: string | null;
      }>();
      const debtCollectionStoreMap = new Map<string, string>();
      const debtCollectionAmountMap = new Map<string, number>();
      if (orderIds.length) {
        const orders = ordersResult.data;
        const orderItems = orderItemsResult.data;
        const debts = debtsResult.data;

        const orderSubtypeMap = new Map<string, string>();
        (orderItems || []).forEach((item: any) => {
          if (!item?.order_id || !item?.price_subtype || orderSubtypeMap.has(item.order_id)) return;
          orderSubtypeMap.set(item.order_id, item.price_subtype);
        });

        (orders || []).forEach((o: any) => {
          if (!o.id) return;
          const orderStatus = typeof o.status === 'string' ? o.status : null;
          orderMetaMap.set(o.id, {
            totalAmount: Number(o.total_amount || 0),
            paymentType: o.payment_type || '',
            invoiceMethod: o.invoice_payment_method || null,
            priceSubtype: orderSubtypeMap.get(o.id) || null,
            isCancelled: orderStatus === 'cancelled',
            status: orderStatus,
          });
        });

        (debts || []).forEach((d: any) => {
          if (!d.order_id) return;
          debtOrderIds.add(d.order_id);
          const paidAmount = Number(d.paid_amount || 0);
          const remaining = Number(d.remaining_amount || 0);
          const totalAmount = Number(d.total_amount || 0);
          if (remaining > 0) {
            debtStatusMap.set(d.order_id, paidAmount > 0 ? 'partial' : 'full');
            debtMoneyMap.set(d.order_id, { paidAmount, remainingAmount: remaining, totalAmount });
          }
        });
      }

      if (debtCollectionDebtIds.length) {
        (debtCollectionsResult.data || []).forEach((collection: any) => {
          const storeName = collection?.debt?.customer?.store_name || collection?.debt?.customer?.name || '';
          if (collection?.debt_id && storeName) {
            debtCollectionStoreMap.set(collection.debt_id, storeName);
          }
          if (collection?.debt_id && !debtCollectionAmountMap.has(collection.debt_id)) {
            debtCollectionAmountMap.set(collection.debt_id, Number(collection.amount_collected || 0));
          }
        });
      }

      const enrichedVisits = (visits || []).map((visit) => {
        const customerInfo = visit.customer_id ? customerMap.get(visit.customer_id) : null;
        const orderMeta = visit.operation_id ? orderMetaMap.get(visit.operation_id) : null;

        return {
          ...visit,
          customer_name: customerInfo?.store_name || customerInfo?.name || '',
          customer_real_name: customerInfo?.name || '',
          customer_phone: customerInfo?.phone || '',
          store_name: customerInfo?.store_name || '',
          isDebtSale: visit.operation_id ? debtOrderIds.has(visit.operation_id) : false,
          debtStatus: visit.operation_id ? debtStatusMap.get(visit.operation_id) || null : null,
          debtMoney: visit.operation_id ? debtMoneyMap.get(visit.operation_id) || null : null,
          orderTotal: orderMeta?.totalAmount ?? null,
          order_payment_type: orderMeta?.paymentType || '',
          order_invoice_method: orderMeta?.invoiceMethod || '',
          order_price_subtype: orderMeta?.priceSubtype || '',
          order_status: orderMeta?.status || null,
          isCancelledOrder: orderMeta?.isCancelled || false,
          debtCollectionAmount: visit.operation_type === 'debt_collection'
            ? debtCollectionAmountMap.get(visit.operation_id || (visit as any).entity_id || (visit as any).reference_id || '') || null
            : null,
          debtCollectionStoreName: visit.operation_type === 'debt_collection'
            ? debtCollectionStoreMap.get(visit.operation_id || (visit as any).entity_id || (visit as any).reference_id || '') || ''
            : '',
        };
      });

      const counts: Record<string, number> = {};
      for (const visit of enrichedVisits) counts[visit.operation_type] = (counts[visit.operation_type] || 0) + 1;
      return { visits: enrichedVisits, counts };
    },
    enabled: !!targetWorkerId,
    staleTime: 60_000,
  });

  const visits = data?.visits || [];
  const counts = data?.counts || {};
  const isDebtNewAchievement = (visit: any) =>
    !!visit.isDebtSale || !!visit.debtStatus;

  const filteredVisits = useMemo(() => {
    let result = visits;

    if (activeFilter) {
      result = activeFilter === 'debt_new'
        ? result.filter((visit: any) => isDebtNewAchievement(visit))
        : result.filter((visit: any) => visit.operation_type === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((visit: any) => {
        const haystacks = [
          visit.customer_name,
          visit.customer_real_name,
          visit.store_name,
          visit.customer_phone,
          visit.debtCollectionStoreName,
        ];

        return haystacks.some((value) => String(value || '').toLowerCase().includes(query));
      });
    }

    return result;
  }, [visits, activeFilter, searchQuery]);

  const debtNewCount = useMemo(() => visits.filter((visit: any) => isDebtNewAchievement(visit)).length, [visits]);

  const handleOpenAchievement = async (visit: any) => {
    if (visit.operation_type === 'debt_collection') {
      const debtId = visit.operation_id || visit.entity_id || visit.reference_id;
      if (debtId) {
        const visitTime = new Date(visit.created_at).getTime();
        const startWindow = new Date(visitTime - 12 * 60 * 60 * 1000).toISOString();
        const endWindow = new Date(visitTime + 12 * 60 * 60 * 1000).toISOString();
        let query = supabase
          .from('debt_collections')
          .select(`
            id, debt_id, worker_id, collection_date, action, amount_collected, payment_method, next_due_date, status, notes, created_at,
            worker:workers!debt_collections_worker_id_fkey(id, full_name, username),
            debt:customer_debts!debt_collections_debt_id_fkey(
              id, customer_id, total_amount, paid_amount, remaining_amount,
              customer:customers(id, name, store_name, phone, customer_type)
            )
          `)
          .eq('debt_id', debtId)
          .gte('created_at', startWindow)
          .lte('created_at', endWindow)
          .order('created_at', { ascending: false })
          .limit(1);

        if (visit.worker_id) query = query.eq('worker_id', visit.worker_id);
        const { data } = await query;
        if (data && data.length) {
          setSelectedDebtCollection(data[0] as TodayDebtCollectionOperation);
          return;
        }
      }
    }

    const orderLinkedTypes = new Set<OperationType>(['order', 'direct_sale', 'delivery']);
    const isOrderLike = orderLinkedTypes.has(visit.operation_type as OperationType);
    const entityId = visit.operation_id || visit.entity_id || visit.order_id || visit.reference_id || '';
    const selectionKey = `${visit.id}:${entityId || 'fallback'}`;
    const cachedItems = entityId
      ? ((queryClient.getQueryData(['order-items', entityId]) as any[] | undefined) || [])
      : [];
    const isSaleOperation = ['direct_sale', 'delivery'].includes(visit.operation_type);
    const paidAmount = Number(visit?.debtMoney?.paidAmount || 0);
    const remainingAmount = Number(visit?.debtMoney?.remainingAmount || 0);

    const buildQuickOrder = (): AchievementOrderDetails => ({
      id: entityId,
      customer_id: visit.customer_id || '',
      created_by: visit.worker_id || targetWorkerId || '',
      assigned_worker_id: visit.worker_id || null,
      branch_id: activeBranch?.id || null,
      created_at: visit.created_at,
      updated_at: visit.created_at,
      total_amount: Number(visit.orderTotal || visit?.debtMoney?.totalAmount || 0),
      payment_type: visit.order_payment_type || 'without_invoice',
      invoice_payment_method: visit.order_invoice_method || null,
      status: (visit as any).order_status === 'cancelled'
        ? 'cancelled'
        : (visit.order_status || (visit.operation_type === 'order' ? 'pending' : 'delivered')),
      payment_status: remainingAmount > 0
        ? (paidAmount > 0 ? 'partial' : 'credit')
        : (visit.order_invoice_method === 'check' ? 'check' : 'cash'),
      partial_amount: paidAmount > 0 && remainingAmount > 0 ? paidAmount : null,
      prepaid_amount: 0,
      notes: visit.notes || null,
      delivery_date: null,
      customer_name: visit.customer_name || visit.store_name || '',
      customer: visit.customer_id ? {
        id: visit.customer_id,
        name: visit.customer_real_name || visit.customer_name || visit.store_name || '—',
        name_fr: null,
        internal_name: null,
        store_name: visit.store_name || visit.customer_name || visit.customer_real_name || '—',
        store_name_fr: null,
        phone: visit.customer_phone || null,
        address: null,
        wilaya: null,
        branch_id: activeBranch?.id || null,
        sector_id: null,
        latitude: null,
        longitude: null,
        location_type: null,
        zone_id: null,
        is_trusted: null,
        trust_notes: null,
        default_payment_type: visit.order_payment_type || null,
        default_price_subtype: visit.order_price_subtype || null,
        sales_rep_name: null,
        sales_rep_phone: null,
        customer_type: null,
        default_delivery_worker_id: null,
        created_at: visit.created_at,
        created_by: visit.worker_id || null,
        updated_at: visit.created_at,
      } : null,
      items: cachedItems,
      ...(visit.operation_type === 'direct_sale' ? { _isDirectSale: true } : {}),
      ...(isSaleOperation ? { _forceSold: true } : {}),
      _selectionKey: selectionKey,
      _detailsLoading: isOrderLike && !entityId,
      _hideModifyAction: !entityId,
    });

    const normalizeAchievementOrder = (order: OrderWithDetails | null): AchievementOrderDetails | null => {
      if (!order) return null;

      const resolvedStatus = (visit as any).order_status === 'cancelled' ? 'cancelled' : order.status;

      return {
        ...(order as any),
        status: resolvedStatus,
        ...(visit.operation_type === 'direct_sale' ? { _isDirectSale: true } : {}),
        ...(isSaleOperation ? { _forceSold: true } : {}),
        _selectionKey: selectionKey,
        _detailsLoading: false,
        _hideModifyAction: !order.id,
      } as AchievementOrderDetails;
    };

    const setIfStillSelected = (nextOrder: AchievementOrderDetails | null) => {
      if (!nextOrder) return;
      setSelectedOrderDetails((prev) => {
        if (!prev || (prev as any)._selectionKey !== selectionKey) return prev;
        return nextOrder;
      });
    };

    const clearLoadingState = () => {
      setSelectedOrderDetails((prev) => {
        if (!prev || (prev as any)._selectionKey !== selectionKey) return prev;
        return { ...(prev as any), _detailsLoading: false } as AchievementOrderDetails;
      });
    };

    const fetchOrderCore = async (orderId: string) => {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          created_by_worker:workers!orders_created_by_fkey(id, full_name, username),
          assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (orderError || !order) return null;
      return order as AchievementOrderDetails;
    };

    setSelectedOrderDetails(buildQuickOrder());

    if (!isOrderLike) {
      clearLoadingState();
      return;
    }

    if (entityId) {
      prefetchOrderDialogData(entityId);
      void fetchOrderCore(entityId)
        .then((order) => setIfStillSelected(normalizeAchievementOrder(order)))
        .catch(() => undefined);
      return;
    }

    if (!visit.customer_id) {
      clearLoadingState();
      return;
    }

    const visitTime = new Date(visit.created_at).getTime();
    const startWindow = new Date(visitTime - 12 * 60 * 60 * 1000).toISOString();
    const endWindow = new Date(visitTime + 12 * 60 * 60 * 1000).toISOString();

    void (async () => {
      try {
        let fallbackQuery = supabase
          .from('orders')
          .select(`
            *,
            customer:customers(*),
            created_by_worker:workers!orders_created_by_fkey(id, full_name, username),
            assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)
          `)
          .eq('customer_id', visit.customer_id)
          .gte('created_at', startWindow)
          .lte('created_at', endWindow)
          .order('created_at', { ascending: false })
          .limit(10);

        if (isSaleOperation) {
          fallbackQuery = fallbackQuery.in('status', ['delivered', 'sold', 'completed', 'approved', 'cancelled']);
        }

        if (visit.worker_id) {
          fallbackQuery = fallbackQuery.or(`created_by.eq.${visit.worker_id},assigned_worker_id.eq.${visit.worker_id}`);
        }

        const { data: fallbackOrders } = await fallbackQuery;
        if (fallbackOrders && fallbackOrders.length) {
          const targetTime = new Date(visit.created_at).getTime();
          const closest = fallbackOrders.reduce((prev: any, current: any) => {
            const prevDiff = Math.abs(new Date(prev.created_at).getTime() - targetTime);
            const currDiff = Math.abs(new Date(current.created_at).getTime() - targetTime);
            return currDiff < prevDiff ? current : prev;
          });

          if (closest?.id) {
            prefetchOrderDialogData(closest.id);
          }

          setIfStillSelected(normalizeAchievementOrder(closest as AchievementOrderDetails));
          return;
        }

        if (isSaleOperation) {
          const { data: receipts } = await supabase
            .from('receipts')
            .select('*')
            .eq('customer_id', visit.customer_id)
            .eq('receipt_type', visit.operation_type === 'direct_sale' ? 'direct_sale' : 'delivery')
            .gte('created_at', startWindow)
            .lte('created_at', endWindow)
            .order('created_at', { ascending: false })
            .limit(5);

          if (receipts && receipts.length) {
            const receipt = receipts[0] as any;

            if (receipt.order_id) {
              prefetchOrderDialogData(receipt.order_id);
              const hydrated = await fetchOrderCore(receipt.order_id);
              if (hydrated) {
                setIfStillSelected(normalizeAchievementOrder(hydrated));
                return;
              }
            }

            const rawPaymentMethod = String(receipt.payment_method || '').toLowerCase();
            const inferredPaymentType = rawPaymentMethod === 'without_invoice' || (receipt.receipt_type === 'direct_sale' && !['cash', 'check', 'transfer', 'receipt', 'with_invoice'].includes(rawPaymentMethod))
              ? 'without_invoice'
              : 'with_invoice';
            const inferredInvoiceMethod = inferredPaymentType === 'with_invoice' && ['cash', 'check', 'transfer', 'receipt'].includes(rawPaymentMethod)
              ? rawPaymentMethod
              : null;

            setIfStillSelected({
              ...(buildQuickOrder() as any),
              id: receipt.order_id || '',
              created_at: receipt.created_at,
              total_amount: Number(receipt.total_amount || 0),
              payment_type: inferredPaymentType,
              invoice_payment_method: inferredInvoiceMethod,
              status: (visit as any).order_status === 'cancelled' ? 'cancelled' : 'delivered',
              notes: receipt.notes || null,
              customer_name: receipt.customer_name,
              customer: {
                id: receipt.customer_id,
                name: receipt.customer_name,
                store_name: receipt.customer_name,
                phone: receipt.customer_phone,
              },
              items: Array.isArray(receipt.items) ? receipt.items : [],
              _isDirectSale: receipt.receipt_type === 'direct_sale',
              _forceSold: true,
              _detailsLoading: false,
              _hideModifyAction: !receipt.order_id,
            } as AchievementOrderDetails);
            return;
          }
        }
      } catch {
      } finally {
        clearLoadingState();
      }
    })();
  };

  return (
    <div className="p-3 sm:p-4 flex h-[100dvh] flex-col gap-3 overflow-hidden" dir="rtl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-black leading-tight">منجزات اليوم</h1>
          <p className="text-sm text-muted-foreground truncate">{targetWorkerName || 'العامل'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            className="h-8 rounded-full px-2.5 text-[10px] sm:text-xs whitespace-nowrap"
            variant="outline"
            onClick={() => setShowPeriodDialog(true)}
          >
            <CalendarCheck className="w-3 h-3 ml-1" />
            الرزنامة
          </Button>
          <Button
            className="h-8 rounded-full px-2.5 text-[10px] sm:text-xs whitespace-nowrap"
            variant="outline"
            onClick={() => setShowHandoverSummary(true)}
          >
            <ClipboardList className="w-3 h-3 ml-1" />
            ملخص التسليم
          </Button>
          <Button
            variant="outline"
            className="h-8 rounded-full px-2.5 text-[10px] sm:text-xs whitespace-nowrap"
            onClick={() => setShowSalesSummary(true)}
          >
            <Package className="w-3 h-3 ml-1" />
            تجميع المبيعات
          </Button>
        </div>
      </div>

      <div className="px-1">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث باسم العميل أو المحل أو الهاتف"
          className="h-10 rounded-xl"
        />
      </div>

      <Card className="rounded-2xl flex flex-1 flex-col min-h-0 overflow-hidden">
        <CardHeader className="pb-2 pt-3">
          <div className="-mx-1 px-1 pb-1">
            <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
              <button
                onClick={() => setActiveFilter(null)}
                className={`inline-flex min-w-0 items-center justify-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border shrink-0 ${!activeFilter ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/60 text-foreground border-border'}`}
              >
                الكل
                <span>{visits.length}</span>
              </button>
              <button
                onClick={() => setActiveFilter(activeFilter === 'debt_new' ? null : 'debt_new')}
                className={`inline-flex min-w-0 items-center justify-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-medium border shrink-0 ${activeFilter === 'debt_new' ? 'bg-primary text-primary-foreground border-primary' : 'bg-orange-50 text-orange-700 border-orange-200'}`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>دين جديد</span>
                <span className="font-bold">{debtNewCount}</span>
              </button>
              {Object.entries(counts).map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => setActiveFilter(activeFilter === type ? null : type)}
                  className={`inline-flex min-w-0 items-center justify-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-medium border shrink-0 ${activeFilter === type ? 'bg-primary text-primary-foreground border-primary' : OPERATION_COLORS[type] || 'border-border'}`}
                >
                  <span className="scale-90">{OPERATION_ICONS[type]}</span>
                  <span>{getOperationLabel(type as OperationType)}</span>
                  <span className="font-bold">{count}</span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 pt-0 flex-1 min-h-0">
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <AdaptiveScrollContainer
              maxHeightClassName="h-full min-h-0"
              contentClassName="space-y-2 pe-1"
            >
              {filteredVisits.map((visit: any) => {
                const isOrderLike = ['order', 'direct_sale', 'delivery'].includes(visit.operation_type);
                const paymentBadge = isOrderLike && visit.order_payment_type
                  ? (visit.order_payment_type === 'with_invoice' ? 'F1' : 'F2')
                  : null;
                const subtypeBadge = isOrderLike && visit.order_payment_type === 'without_invoice' && visit.order_price_subtype
                  ? (visit.order_price_subtype === 'super_gros' ? 'SG' : visit.order_price_subtype === 'retail' ? 'D' : 'G')
                  : null;

                return (
                  <button
                    key={visit.id}
                    type="button"
                    onClick={() => handleOpenAchievement(visit)}
                    className={`w-full rounded-2xl border p-3 text-right transition-all hover:shadow-sm active:scale-[0.995] ${OPERATION_COLORS[visit.operation_type] || 'border-border'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 shrink-0 rounded-full bg-background/70 p-1.5 shadow-sm">
                        {OPERATION_ICONS[visit.operation_type] || <MapPin className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            {visit.operation_type === 'debt_collection' ? (
                              <p className="font-bold leading-5 truncate max-w-[160px]">
                                {visit.debtCollectionStoreName || getOperationLabel(visit.operation_type as OperationType)}
                              </p>
                            ) : (
                              <>
                                {visit.store_name ? (
                                  <p className="font-bold leading-5 truncate max-w-[160px]">{visit.store_name}</p>
                                ) : (
                                  <p className="font-bold leading-5 truncate max-w-[160px]">
                                    {visit.customer_name || getOperationLabel(visit.operation_type as OperationType)}
                                  </p>
                                )}
                                {visit.customer_real_name && visit.customer_real_name !== visit.store_name ? (
                                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">{visit.customer_real_name}</p>
                                ) : null}
                              </>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] px-2 py-0.5 shrink-0">
                                {getOperationLabel(visit.operation_type as OperationType)}
                              </Badge>
                              {paymentBadge ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 shrink-0 ${paymentBadge === 'F1' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-muted-foreground/20 bg-muted text-muted-foreground'}`}
                                >
                                  {paymentBadge}
                                </Badge>
                              ) : null}
                              {subtypeBadge ? (
                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 shrink-0 border-accent/30 bg-accent/15 text-accent-foreground">
                                  {subtypeBadge}
                                </Badge>
                              ) : null}
                              {visit.isCancelledOrder && (
                                <Badge variant="destructive" className="text-[10px] px-2 py-0.5 shrink-0">
                                  ملغاة
                                </Badge>
                              )}
                              {visit.isDebtSale && (
                                <Badge
                                  variant={visit.debtStatus === 'partial' ? 'secondary' : 'destructive'}
                                  className={`text-[10px] px-2 py-0.5 shrink-0 ${visit.debtStatus === 'partial' ? 'bg-amber-100 text-amber-700 border border-amber-200' : ''}`}
                                >
                                  {visit.debtStatus === 'partial' ? 'دين جزئي' : 'دين كلي'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-[11px] text-muted-foreground text-left" dir="ltr">
                            {format(new Date(visit.created_at), 'dd/MM/yyyy')}
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          {visit.orderTotal != null ? (
                            <div className="text-sm font-semibold text-foreground" dir="ltr">
                              {Number(visit.orderTotal).toLocaleString()} DA
                            </div>
                          ) : null}
                          {visit.operation_type === 'debt_collection' && visit.debtCollectionAmount != null ? (
                            <div className="text-sm font-semibold text-foreground" dir="ltr">
                              {Number(visit.debtCollectionAmount).toLocaleString()} DA
                            </div>
                          ) : null}
                          {visit.isDebtSale && visit.debtMoney ? (
                            <div className="text-[11px] text-muted-foreground" dir="ltr">
                              {visit.debtStatus === 'partial' ? (
                                <>كاش {visit.debtMoney.paidAmount.toLocaleString()} DA • دين {visit.debtMoney.remainingAmount.toLocaleString()} DA</>
                              ) : (
                                <>دين {visit.debtMoney.remainingAmount.toLocaleString()} DA</>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!filteredVisits.length ? <div className="py-10 text-center text-sm text-muted-foreground">لا توجد منجزات ضمن هذه الفترة</div> : null}
            </AdaptiveScrollContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPeriodDialog} onOpenChange={setShowPeriodDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تحديد الفترة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">من</span>
                <Input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  className="h-9 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">إلى</span>
                <Input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  className="h-9 text-sm"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setPeriodFrom(today);
                  setPeriodTo(today);
                }}
              >
                إعادة تعيين
              </Button>
              <Button className="flex-1" onClick={() => setShowPeriodDialog(false)}>
                تطبيق
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <OrderDetailsDialog
        open={!!selectedOrderDetails}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedOrderDetails(null);
        }}
        order={selectedOrderDetails}
        hideModifyAction={Boolean((selectedOrderDetails as any)?._hideModifyAction)}
        onCancelOrder={handleCancelOrder}
        onResumeOrder={handleResumeOrder}
      />

      <CollectedDebtOperationDialog
        open={!!selectedDebtCollection}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedDebtCollection(null);
        }}
        collection={selectedDebtCollection}
      />

      <WorkerHandoverPreviewDialog open={showHandoverSummary} onOpenChange={setShowHandoverSummary} />
      <WorkerSalesSummaryDialog open={showSalesSummary} onOpenChange={setShowSalesSummary} workerId={targetWorkerId || undefined} workerName={targetWorkerName || undefined} />
      <WorkerOrdersSummaryDialog open={showOrdersSummary} onOpenChange={setShowOrdersSummary} workerId={targetWorkerId || undefined} workerName={targetWorkerName || undefined} />
      <DebtAggregatesDialog open={showDebtAggregates} onOpenChange={setShowDebtAggregates} workerId={targetWorkerId || undefined} dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
};

export default MyAchievements;
