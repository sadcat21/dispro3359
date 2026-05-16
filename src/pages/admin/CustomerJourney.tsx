import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar, enUS, fr } from 'date-fns/locale';
import {
  Activity,
  ArrowLeft,
  CreditCard,
  Loader2,
  MapPin,
  ShoppingCart,
  User,
  Wallet,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Customer, OrderWithDetails } from '@/types/database';
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import CustomerSummary from '@/components/customers/CustomerSummary';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getLocalizedName } from '@/utils/sectorName';

interface NamedEntry {
  id?: string;
  name: string;
  name_fr?: string | null;
}

interface CustomerRecord extends Customer {
  sector?: NamedEntry | null;
  zone?: NamedEntry | null;
}

interface DebtRecord {
  id: string;
  customer_id: string;
  order_id: string | null;
  worker_id: string;
  branch_id: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number | null;
  status: string;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  worker?: {
    id: string;
    full_name: string;
    username: string;
  } | null;
}

interface DebtCollectionRecord {
  id: string;
  debt_id: string;
  action: string;
  amount_collected: number;
  collection_date: string;
  created_at: string;
  next_due_date: string | null;
  notes: string | null;
  payment_method: string | null;
  status: string;
  worker?: {
    id: string;
    full_name: string;
    username: string;
  } | null;
  debt?: {
    id: string;
    customer_id: string;
    total_amount: number;
    remaining_amount: number | null;
    due_date: string | null;
    order_id: string | null;
  } | null;
}

interface VisitRecord {
  id: string;
  created_at: string;
  operation_type: string;
  operation_id: string | null;
  notes: string | null;
  address: string | null;
  worker_id: string;
  worker?: {
    id: string;
    full_name: string;
    username: string;
  } | null;
  order?: OrderWithDetails | null;
}

interface DebtTimelineItem {
  id: string;
  createdAt: string;
  kind: 'debt' | 'collection' | 'visit';
  title: string;
  amount: number;
  delta: number;
  debtId: string;
  workerName: string;
  paymentMethod: string | null;
  nextDueDate: string | null;
  notes: string | null;
  status: string | null;
  balanceAfter: number;
  debtRemainingAfter: number | null;
}

const managerRoles = ['admin', 'branch_admin', 'project_manager', 'company_manager'];

const CustomerJourney = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCustomerId = searchParams.get('customerId');
  const { role, activeBranch, activeRole } = useAuth();
  const isCompanyManager = activeRole?.custom_role_code === 'company_manager';
  const effectiveRole = isCompanyManager ? 'company_manager' : (role || '');
  const { t, dir, language } = useLanguage();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [activeTab, setActiveTab] = useState('debts');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);

  const dateLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;
  const amountLocale = language === 'fr' ? 'fr-FR' : language === 'en' ? 'en-US' : 'ar-DZ';

  useEffect(() => {
    if (initialCustomerId && initialCustomerId !== selectedCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId, selectedCustomerId]);

  const formatAmount = (value: number | null | undefined) =>
    new Intl.NumberFormat(amountLocale, {
      minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '—';
    return format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: dateLocale });
  };

  const getPaymentMethodLabel = (method: string | null | undefined) => {
    if (!method) return '—';
    if (method === 'cash') return language === 'fr' ? 'Espèces' : language === 'en' ? 'Cash' : 'كاش';
    if (method === 'check') return language === 'fr' ? 'Chèque' : language === 'en' ? 'Check' : 'شيك';
    if (method === 'transfer') return language === 'fr' ? 'Virement' : language === 'en' ? 'Transfer' : 'تحويل';
    if (method === 'receipt') return language === 'fr' ? 'Versement' : language === 'en' ? 'Receipt' : 'وصل';
    return method;
  };

  const getPaymentTypeLabel = (type: string | null | undefined) => {
    if (!type) return '—';
    const key = String(type).toLowerCase();
    if (key === 'with_invoice') return t('orders.with_invoice');
    if (key === 'without_invoice') return t('orders.without_invoice');
    const map: Record<string, { ar: string; fr: string; en: string }> = {
      cash: { ar: 'كاش', fr: 'ESP', en: 'Cash' },
      credit: { ar: 'دين', fr: 'Crédit', en: 'Credit' },
      debt: { ar: 'دين', fr: 'Crédit', en: 'Credit' },
      check: { ar: 'شيك', fr: 'CHQ', en: 'Check' },
      transfer: { ar: 'تحويل', fr: 'VRMT', en: 'Transfer' },
      receipt: { ar: 'وصل', fr: 'Reçu', en: 'Receipt' },
    };
    const entry = map[key];
    return entry ? entry[language] : type;
  };

  const getPriceSubtypeAbbr = (subtype: string | null | undefined) => {
    switch (String(subtype || '').toLowerCase()) {
      case 'retail': return 'D';
      case 'gros': return 'G';
      case 'super_gros': return 'SG';
      case 'invoice': return 'F';
      default: return null;
    }
  };

  const getChannelLabel = (channel: string | null | undefined) => {
    const map: Record<string, { ar: string; fr: string; en: string }> = {
      delivery: { ar: 'توصيل', fr: 'Livraison', en: 'Delivery' },
      cash_van: { ar: 'كاش فان', fr: 'Cash Van', en: 'Cash Van' },
      direct_sale: { ar: 'كاش فان', fr: 'Cash Van', en: 'Cash Van' },
      depot: { ar: 'مستودع', fr: 'Dépôt', en: 'Depot' },
      order: { ar: 'مستودع', fr: 'Dépôt', en: 'Depot' },
    };
    const entry = map[String(channel || '').toLowerCase()];
    return entry ? entry[language] : null;
  };


  const getCollectionStatusLabel = (status: string | null | undefined) => {
    if (status === 'pending') return t('customers.journey.status_pending');
    if (status === 'approved') return t('customers.journey.status_approved');
    if (status === 'rejected') return t('customers.journey.status_rejected');
    return status || '—';
  };

  const getVisitOperationLabel = (type: string) => {
    const labels: Record<string, { ar: string; fr: string; en: string }> = {
      order: { ar: 'طلبية', fr: 'Commande', en: 'Order' },
      direct_sale: { ar: 'بيع مباشر', fr: 'Vente directe', en: 'Direct Sale' },
      delivery: { ar: 'توصيل', fr: 'Livraison', en: 'Delivery' },
      debt_collection: { ar: 'تحصيل دين', fr: 'Recouvrement', en: 'Debt Collection' },
      visit: { ar: 'زيارة', fr: 'Visite', en: 'Visit' },
      delivery_visit: { ar: 'زيارة بدون تسليم', fr: 'Visite sans livraison', en: 'Visit Without Delivery' },
      add_customer: { ar: 'إضافة عميل', fr: 'Ajout client', en: 'Add Customer' },
      update_customer: { ar: 'تعديل عميل', fr: 'Modification client', en: 'Update Customer' },
      delete_customer: { ar: 'حذف عميل', fr: 'Suppression client', en: 'Delete Customer' },
    };

    const label = labels[type];
    if (!label) return type;
    return label[language];
  };

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customer-journey-customers', role, activeBranch?.id],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select(`
          *,
          sector:sectors(id, name, name_fr),
          zone:sector_zones(id, name, name_fr)
        `)
        .order('name');

      if ((role === 'branch_admin' || isCompanyManager) && activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerRecord[];
    },
    enabled: managerRoles.includes(effectiveRole),
  });

  const { data: selectedCustomerRecord, isLoading: selectedCustomerLoading } = useQuery({
    queryKey: ['customer-journey-customer', selectedCustomerId, role, activeBranch?.id],
    queryFn: async () => {
      if (!selectedCustomerId) return null;

      let query = supabase
        .from('customers')
        .select(`
          *,
          sector:sectors(id, name, name_fr),
          zone:sector_zones(id, name, name_fr)
        `)
        .eq('id', selectedCustomerId);

      if ((role === 'branch_admin' || isCompanyManager) && activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as CustomerRecord | null;
    },
    enabled: !!selectedCustomerId,
  });

  const { data: customerDebts = [], isLoading: debtsLoading } = useQuery({
    queryKey: ['customer-journey-debts', selectedCustomerId, role, activeBranch?.id],
    queryFn: async () => {
      if (!selectedCustomerId) return [];

      let query = supabase
        .from('customer_debts')
        .select(`
          *,
          worker:workers!customer_debts_worker_id_fkey(id, full_name, username)
        `)
        .eq('customer_id', selectedCustomerId)
        .order('created_at', { ascending: false });

      if ((role === 'branch_admin' || isCompanyManager) && activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DebtRecord[];
    },
    enabled: !!selectedCustomerId,
  });

  const debtIds = useMemo(() => customerDebts.map((debt) => debt.id), [customerDebts]);

  const { data: debtCollections = [], isLoading: collectionsLoading } = useQuery({
    queryKey: ['customer-journey-collections', debtIds],
    queryFn: async () => {
      if (debtIds.length === 0) return [];

      const { data, error } = await supabase
        .from('debt_collections')
        .select(`
          *,
          worker:workers!debt_collections_worker_id_fkey(id, full_name, username),
          debt:customer_debts!debt_collections_debt_id_fkey(id, customer_id, total_amount, remaining_amount, due_date, order_id)
        `)
        .in('debt_id', debtIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DebtCollectionRecord[];
    },
    enabled: debtIds.length > 0,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-journey-orders', selectedCustomerId, role, activeBranch?.id],
    queryFn: async () => {
      if (!selectedCustomerId) return [];

      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*, sector:sectors(id, name, name_fr), zone:sector_zones(id, name, name_fr)),
          created_by_worker:workers!orders_created_by_fkey(id, full_name, username),
          assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)
        `)
        .eq('customer_id', selectedCustomerId)
        .order('created_at', { ascending: false });

      if ((role === 'branch_admin' || isCompanyManager) && activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OrderWithDetails[];
    },
    enabled: !!selectedCustomerId,
  });

  const orderIdsList = useMemo(() => orders.map((o) => o.id), [orders]);

  const { data: orderItemsSubtypes = {} } = useQuery({
    queryKey: ['customer-journey-order-subtypes', orderIdsList],
    queryFn: async () => {
      if (orderIdsList.length === 0) return {} as Record<string, string[]>;
      const { data, error } = await supabase
        .from('order_items')
        .select('order_id, price_subtype')
        .in('order_id', orderIdsList);
      if (error) throw error;
      const map: Record<string, Set<string>> = {};
      (data || []).forEach((row: any) => {
        if (!row.price_subtype) return;
        if (!map[row.order_id]) map[row.order_id] = new Set();
        map[row.order_id].add(row.price_subtype);
      });
      const result: Record<string, string[]> = {};
      Object.entries(map).forEach(([k, v]) => { result[k] = Array.from(v); });
      return result;
    },
    enabled: orderIdsList.length > 0,
  });

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['customer-journey-visits', selectedCustomerId, role, activeBranch?.id],
    queryFn: async () => {
      if (!selectedCustomerId) return [];

      let query = supabase
        .from('visit_tracking')
        .select(`
          *,
          worker:workers!visit_tracking_worker_id_fkey(id, full_name, username)
        `)
        .eq('customer_id', selectedCustomerId)
        .order('created_at', { ascending: false });

      if ((role === 'branch_admin' || isCompanyManager) && activeBranch?.id) {
        query = query.eq('branch_id', activeBranch.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const orderIds = Array.from(
        new Set((data || []).map((visit) => visit.operation_id).filter(Boolean))
      ) as string[];

      const linkedOrders = orderIds.length > 0
        ? await supabase
            .from('orders')
            .select(`
              *,
              customer:customers(*, sector:sectors(id, name, name_fr), zone:sector_zones(id, name, name_fr)),
              created_by_worker:workers!orders_created_by_fkey(id, full_name, username),
              assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)
            `)
            .in('id', orderIds)
        : { data: [], error: null };

      if (linkedOrders.error) throw linkedOrders.error;

      const orderMap = new Map((linkedOrders.data || []).map((order) => [order.id, order as OrderWithDetails]));

      return ((data || []).map((visit) => ({
        ...visit,
        order: visit.operation_id ? orderMap.get(visit.operation_id) || null : null,
      })) as VisitRecord[]);
    },
    enabled: !!selectedCustomerId,
  });

  const selectedCustomer = selectedCustomerRecord || customers.find((customer) => customer.id === selectedCustomerId) || null;

  const selectedCustomerSummary = useMemo(() => {
    if (!selectedCustomer) return null;

    return {
      ...selectedCustomer,
      name: language !== 'ar' ? (selectedCustomer.name_fr || selectedCustomer.name) : selectedCustomer.name,
      store_name: language !== 'ar' ? (selectedCustomer.store_name_fr || selectedCustomer.store_name) : selectedCustomer.store_name,
      sector_name: selectedCustomer.sector ? getLocalizedName(selectedCustomer.sector, language) : undefined,
      zone_name: selectedCustomer.zone ? getLocalizedName(selectedCustomer.zone, language) : undefined,
    };
  }, [language, selectedCustomer]);

  const debtSummary = useMemo(() => {
    const activeDebts = customerDebts.filter((debt) => debt.status !== 'paid');
    const currentDebt = activeDebts.reduce((sum, debt) => sum + Number(debt.remaining_amount || 0), 0);
    return {
      currentDebt,
      activeCount: activeDebts.length,
    };
  }, [customerDebts]);

  const purchaseSummary = useMemo(() => ({
    totalAmount: orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    ordersCount: orders.length,
  }), [orders]);

  const displayVisits = useMemo(
    () => visits.filter((v) => !['direct_sale', 'delivery'].includes(v.operation_type)),
    [visits]
  );

  const channelByOrderId = useMemo(() => {
    const map: Record<string, string> = {};
    visits.forEach((v) => {
      if (v.operation_id) {
        if (v.operation_type === 'delivery') map[v.operation_id] = 'delivery';
        else if (v.operation_type === 'direct_sale') map[v.operation_id] = 'cash_van';
        else if (!map[v.operation_id]) map[v.operation_id] = 'depot';
      }
    });
    return map;
  }, [visits]);

  const visitSummary = useMemo(() => {
    const withOrder = displayVisits.filter((visit) => !!visit.order || visit.operation_type === 'order').length;
    return {
      total: displayVisits.length,
      withOrder,
      withoutOrder: Math.max(0, displayVisits.length - withOrder),
    };
  }, [displayVisits]);

  const debtTimeline = useMemo(() => {
    const baseItems = [
      ...customerDebts.map((debt) => ({
        id: `debt-${debt.id}`,
        createdAt: debt.created_at,
        kind: 'debt' as const,
        title: t('customers.journey.created_debt'),
        amount: Number(debt.total_amount || 0),
        delta: Number(debt.total_amount || 0),
        debtId: debt.id,
        workerName: debt.worker?.full_name || debt.worker?.username || '—',
        paymentMethod: null,
        nextDueDate: debt.due_date,
        notes: debt.notes,
        status: debt.status,
      })),
      ...debtCollections.map((collection) => ({
        id: `collection-${collection.id}`,
        createdAt: collection.created_at || collection.collection_date,
        kind: collection.amount_collected > 0 ? ('collection' as const) : ('visit' as const),
        title: collection.amount_collected > 0 ? t('customers.journey.collected_debt') : t('customers.journey.no_payment_visit'),
        amount: Number(collection.amount_collected || 0),
        delta: ['partial_payment', 'full_payment'].includes(collection.action)
          ? -Number(collection.amount_collected || 0)
          : 0,
        debtId: collection.debt_id,
        workerName: collection.worker?.full_name || collection.worker?.username || '—',
        paymentMethod: collection.payment_method,
        nextDueDate: collection.next_due_date,
        notes: collection.notes,
        status: collection.status,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let runningBalance = 0;
    const debtRunning = new Map<string, number>();

    const enriched = baseItems.map((item) => {
      if (item.kind === 'debt') {
        runningBalance += item.delta;
        debtRunning.set(item.debtId, item.amount);
      } else if (item.delta !== 0) {
        runningBalance += item.delta;
        const currentRemaining = debtRunning.get(item.debtId) ?? 0;
        debtRunning.set(item.debtId, Math.max(0, currentRemaining + item.delta));
      }

      return {
        ...item,
        balanceAfter: runningBalance,
        debtRemainingAfter: debtRunning.get(item.debtId) ?? null,
      };
    });

    return enriched.reverse() as DebtTimelineItem[];
  }, [customerDebts, debtCollections, t]);

  const isPageLoading = customersLoading || selectedCustomerLoading;
  const isDebtTabLoading = debtsLoading || collectionsLoading;
  const isPurchaseTabLoading = ordersLoading;
  const isVisitTabLoading = visitsLoading;

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setSearchParams({ customerId: customer.id });
    setCustomerPickerOpen(false);
  };

  return (
    <div className="p-3 pb-24 space-y-3" dir={dir}>
      {selectedCustomerSummary && (
        <Card className="border-primary/15 shadow-sm">
          <CardContent className="p-3">
            <div className="rounded-2xl border bg-muted/30 p-3">
              <CustomerSummary
                customer={selectedCustomerSummary}
                avatarSize="lg"
                meta={[
                  selectedCustomerSummary.phone,
                  selectedCustomerSummary.sector_name,
                  selectedCustomerSummary.zone_name,
                  selectedCustomerSummary.wilaya,
                ].filter(Boolean).join(' • ')}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedCustomerId ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
            <User className="w-12 h-12 text-muted-foreground/60" />
            <p className="max-w-sm text-sm text-muted-foreground">{t('customers.journey.empty')}</p>
            <Button type="button" onClick={() => setCustomerPickerOpen(true)}>
              {t('customers.journey.select_customer')}
            </Button>
          </CardContent>
        </Card>
      ) : isPageLoading ? (
        <Card>
          <CardContent className="flex min-h-[220px] items-center justify-center p-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="grid w-full grid-cols-3 h-auto rounded-2xl p-1">
            <TabsTrigger value="debts" className="rounded-xl px-2 py-2.5 text-xs sm:text-sm">
              {t('customers.journey.debts_tab')}
            </TabsTrigger>
            <TabsTrigger value="purchases" className="rounded-xl px-2 py-2.5 text-xs sm:text-sm">
              {t('customers.journey.purchases_tab')}
            </TabsTrigger>
            <TabsTrigger value="visits" className="rounded-xl px-2 py-2.5 text-xs sm:text-sm">
              {t('customers.journey.visits_tab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="debts" className="space-y-3 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard
                title={t('customers.journey.current_debt')}
                value={formatAmount(debtSummary.currentDebt)}
                icon={Wallet}
                tone="rose"
                currency={t('common.currency')}
              />
              <SummaryCard
                title={t('customers.journey.active_debts')}
                value={String(debtSummary.activeCount)}
                icon={CreditCard}
                tone="amber"
              />
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('customers.journey.debt_movement')}</CardTitle>
                <CardDescription>{debtTimeline.length} {t('common.events')}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isDebtTabLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : debtTimeline.length === 0 ? (
                  <div className="p-6"><EmptyState label={t('customers.journey.no_debt_events')} /></div>
                ) : (
                  <div className="border-t bg-white overflow-y-auto max-h-[60vh]">
                    {debtTimeline.map((item, idx) => {
                      const isDebt = item.kind === 'debt';
                      const isCollection = item.kind === 'collection';
                      const tone = isCollection
                        ? { bar: 'bg-emerald-500', text: 'text-emerald-700' }
                        : isDebt
                          ? { bar: 'bg-destructive', text: 'text-destructive' }
                          : { bar: 'bg-slate-300', text: 'text-slate-700' };
                      const dateStr = formatDateTime(item.createdAt);
                      const [datePart, ...timeRest] = dateStr.split(' ');
                      const timePart = timeRest.join(' ');
                      return (
                        <div
                          key={item.id}
                          dir={dir}
                          className={cn(
                            'relative flex items-center gap-3 px-4 py-3 text-sm w-full border-b last:border-b-0',
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                          )}
                        >
                          <span className={cn('absolute inset-y-0 w-1', dir === 'rtl' ? 'right-0' : 'left-0', tone.bar)} />
                          <span className={cn('font-black tabular-nums whitespace-nowrap text-[clamp(0.7rem,2.6vw,0.95rem)]', tone.text)} dir="ltr">
                            {formatAmount(item.amount)} {t('common.currency')}
                          </span>
                          <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
                            {item.workerName}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full text-[10px] font-semibold">
                            {isDebt
                              ? (language === 'fr' ? 'Dette' : language === 'en' ? 'Debt' : 'دين')
                              : getPaymentMethodLabel(item.paymentMethod)}
                          </Badge>
                          <span className="ms-auto text-xs font-semibold tabular-nums whitespace-nowrap text-left shrink-0 min-w-[110px]" dir="ltr">
                            <span className="text-black">{datePart}</span>
                            {timePart && <span className="text-red-600 ml-1">{timePart}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-3 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard
                title={t('customers.journey.total_purchases')}
                value={formatAmount(purchaseSummary.totalAmount)}
                icon={ShoppingCart}
                tone="emerald"
                currency={t('common.currency')}
              />
              <SummaryCard
                title={t('customers.journey.orders_count')}
                value={String(purchaseSummary.ordersCount)}
                icon={Activity}
                tone="sky"
              />
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('customers.journey.purchase_history')}</CardTitle>
                <CardDescription>{purchaseSummary.ordersCount} {t('nav.orders')}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isPurchaseTabLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="p-6"><EmptyState label={t('customers.journey.no_orders')} /></div>
                ) : (
                  <div className="border-t bg-white overflow-y-auto max-h-[60vh]">
                    {orders.map((order, idx) => {
                      const isCancelled = order.status === 'cancelled';
                      const isDelivered = order.status === 'delivered';
                      const tone = isCancelled
                        ? { bar: 'bg-slate-300', text: 'text-slate-500 line-through' }
                        : isDelivered
                          ? { bar: 'bg-emerald-500', text: 'text-emerald-700' }
                          : { bar: 'bg-primary', text: 'text-primary' };
                      const dateStr = formatDateTime(order.created_at);
                      const [datePart, ...timeRest] = dateStr.split(' ');
                      const timePart = timeRest.join(' ');
                      const workerName = order.assigned_worker?.full_name || order.created_by_worker?.full_name || '—';
                      return (
                        <button
                          key={order.id}
                          type="button"
                          dir={dir}
                          onClick={() => setSelectedOrder(order)}
                          className={cn(
                            'relative flex items-stretch gap-3 px-4 py-3 text-sm w-full border-b last:border-b-0 hover:bg-slate-100 cursor-pointer',
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                          )}
                        >
                          <span className={cn('absolute inset-y-0 w-1', dir === 'rtl' ? 'right-0' : 'left-0', tone.bar)} />
                          <div className="flex flex-col items-start gap-1">
                            <span className={cn('font-black tabular-nums whitespace-nowrap text-[clamp(0.7rem,2.6vw,0.95rem)]', tone.text)} dir="ltr">
                              {formatAmount(order.total_amount)} {t('common.currency')}
                            </span>
                            {(order.payment_type || (orderItemsSubtypes[order.id] || []).length > 0) && (
                              <div className="inline-flex items-stretch rounded-full overflow-hidden border border-slate-200 text-[10px] font-semibold leading-none">
                                {order.payment_type && (
                                  <span className="inline-flex items-center bg-slate-900 text-white px-2 py-1">
                                    {getPaymentTypeLabel(order.payment_type)}
                                  </span>
                                )}
                                {(orderItemsSubtypes[order.id] || []).map((st) => {
                                  const abbr = getPriceSubtypeAbbr(st);
                                  return abbr ? (
                                    <span key={st} className="inline-flex items-center bg-indigo-100 text-indigo-700 px-2 py-1 font-bold border-s border-white/40">
                                      {abbr}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                          <div className="ms-auto flex flex-col items-start gap-1 shrink-0">
                            <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-left" dir="ltr">
                              <span className="text-black">{datePart}</span>
                              {timePart && <span className="text-red-600 ml-1">{timePart}</span>}
                            </span>
                            {(() => {
                              const ch = channelByOrderId[order.id];
                              const chClass =
                                ch === 'delivery'
                                  ? 'bg-amber-100 text-amber-800'
                                  : ch === 'cash_van'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ch === 'depot'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-slate-100 text-slate-700';
                              return (
                                <div className="inline-flex items-stretch rounded-full overflow-hidden border border-red-500 text-[10px] font-semibold leading-none">
                                  <span className="inline-flex items-center bg-white text-red-600 px-2 py-1">
                                    {workerName}
                                  </span>
                                  {ch && (
                                    <span className={cn('inline-flex items-center px-2 py-1 border-s border-red-500', chClass)}>
                                      {getChannelLabel(ch)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visits" className="space-y-3 mt-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard
                title={t('customers.journey.total_visits')}
                value={String(visitSummary.total)}
                icon={Activity}
                tone="sky"
              />
              <SummaryCard
                title={t('customers.journey.with_order')}
                value={String(visitSummary.withOrder)}
                icon={ShoppingCart}
                tone="emerald"
              />
              <SummaryCard
                title={t('customers.journey.without_order')}
                value={String(visitSummary.withoutOrder)}
                icon={MapPin}
                tone="amber"
              />
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('customers.journey.visit_timeline')}</CardTitle>
                <CardDescription>{displayVisits.length} {t('common.events')}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isVisitTabLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : displayVisits.length === 0 ? (
                  <div className="p-6"><EmptyState label={t('customers.journey.no_visits')} /></div>
                ) : (
                  <div className="border-t bg-white overflow-y-auto max-h-[60vh]">
                    {displayVisits.map((visit, idx) => {
                      const hasOrder = !!visit.order;
                      const isPlainVisit = ['visit', 'delivery_visit'].includes(visit.operation_type);
                      const operationLabel = getVisitOperationLabel(visit.operation_type);
                      const tone = hasOrder
                        ? { bar: 'bg-emerald-500', text: 'text-emerald-700' }
                        : isPlainVisit
                          ? { bar: 'bg-amber-400', text: 'text-amber-700' }
                          : { bar: 'bg-sky-400', text: 'text-sky-700' };
                      const dateStr = formatDateTime(visit.created_at);
                      const [datePart, ...timeRest] = dateStr.split(' ');
                      const timePart = timeRest.join(' ');
                      const workerName = visit.worker?.full_name || visit.worker?.username || '—';
                      const clickable = hasOrder;
                      return (
                        <button
                          key={visit.id}
                          type="button"
                          dir={dir}
                          disabled={!clickable}
                          onClick={() => visit.order && setSelectedOrder(visit.order)}
                          className={cn(
                            'relative flex items-center gap-3 px-4 py-3 text-sm w-full border-b last:border-b-0',
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60',
                            clickable ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'
                          )}
                        >
                          <span className={cn('absolute inset-y-0 w-1', dir === 'rtl' ? 'right-0' : 'left-0', tone.bar)} />
                          {hasOrder ? (
                            <span className={cn('font-black tabular-nums whitespace-nowrap text-[clamp(0.7rem,2.6vw,0.95rem)]', tone.text)} dir="ltr">
                              {formatAmount(visit.order!.total_amount)} {t('common.currency')}
                            </span>
                          ) : (
                            <span className={cn('font-black whitespace-nowrap text-[clamp(0.7rem,2.6vw,0.95rem)] inline-flex items-center gap-1', tone.text)}>
                              <MapPin className="h-3.5 w-3.5" />
                              {isPlainVisit ? t('customers.journey.without_order') : operationLabel}
                            </span>
                          )}
                          <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
                            {workerName}
                          </Badge>
                          {(hasOrder || isPlainVisit) && (
                            <Badge variant="secondary" className="rounded-full text-[10px] font-semibold">
                              {operationLabel}
                            </Badge>
                          )}
                          <span className="ms-auto text-xs font-semibold tabular-nums whitespace-nowrap text-left shrink-0 min-w-[110px]" dir="ltr">
                            <span className="text-black">{datePart}</span>
                            {timePart && <span className="text-red-600 ml-1">{timePart}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <CustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        customers={customers}
        selectedCustomerId={selectedCustomerId || undefined}
        onSelect={handleSelectCustomer}
        isLoading={customersLoading}
      />

      <OrderDetailsDialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
        order={selectedOrder}
        hideModifyAction
      />
    </div>
  );
};

const SummaryCard = ({
  title,
  value,
  icon: Icon,
  tone,
  currency,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'rose' | 'amber' | 'emerald' | 'sky' | 'slate';
  currency?: string;
}) => {
  const tones = {
    rose: 'border-rose-200 bg-rose-50/80 text-rose-700',
    amber: 'border-amber-200 bg-amber-50/80 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
    sky: 'border-sky-200 bg-sky-50/80 text-sky-700',
    slate: 'border-slate-200 bg-slate-50/80 text-slate-700',
  };

  return (
    <Card className={cn('shadow-sm', tones[tone])}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">{title}</span>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-lg font-black" dir="ltr">
          {value}{currency ? ` ${currency}` : ''}
        </div>
      </CardContent>
    </Card>
  );
};

const MiniInfoCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'rose' | 'slate';
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border p-2',
        tone === 'rose' ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-slate-50/70'
      )}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-bold text-sm" dir="ltr">{value}</div>
    </div>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
    {label}
  </div>
);

export default CustomerJourney;
