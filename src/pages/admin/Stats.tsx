import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PromoWithDetails, OrderWithDetails } from '@/types/database';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PromoStats from '@/components/stats/PromoStats';
import OrderStats from '@/components/stats/OrderStats';
import SalesStats from '@/components/stats/SalesStats';
import ProductStats from '@/components/stats/ProductStats';
import CustomerStats from '@/components/stats/CustomerStats';
import DateRangeFilter, { DateFilterType, getDateRangeFromFilter } from '@/components/stats/DateRangeFilter';
import { useCustomersQuery, useWorkersSafeQuery } from '@/hooks/useQueryData';

const Stats: React.FC = () => {
  const { activeBranch } = useAuth();
  const { t } = useLanguage();
  
  const [selectedPeriod, setSelectedPeriod] = useState<DateFilterType>('today');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [selectedWorker, setSelectedWorker] = useState<string>('all');

  // Use react-query for all data fetching
  const { data: promos = [], isLoading: promosLoading } = useQuery({
    queryKey: ['stats-promos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promos')
        .select(`*, customer:customers(*), product:products(*), worker:workers(*)`)
        .order('promo_date', { ascending: false });
      if (error) throw error;
      return (data || []) as PromoWithDetails[];
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['stats-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, customer:customers(*), created_by_worker:workers!orders_created_by_fkey(id, full_name, username), assigned_worker:workers!orders_assigned_worker_id_fkey(id, full_name, username)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OrderWithDetails[];
    },
  });

  const { data: workers = [], isLoading: workersLoading } = useWorkersSafeQuery('worker');
  const { data: customers = [], isLoading: customersLoading } = useCustomersQuery();

  const isLoading = promosLoading || ordersLoading || workersLoading || customersLoading;

  const selectedBranchId = activeBranch?.id || null;

  const dateRange = useMemo(() => {
    return getDateRangeFromFilter(selectedPeriod, customDateFrom, customDateTo);
  }, [selectedPeriod, customDateFrom, customDateTo]);

  const filteredWorkers = useMemo(() => {
    if (!selectedBranchId) return workers;
    return workers.filter(w => w.branch_id === selectedBranchId);
  }, [workers, selectedBranchId]);

  const filteredCustomers = useMemo(() => {
    if (!selectedBranchId) return customers;
    return customers.filter(c => c.branch_id === selectedBranchId || !c.branch_id);
  }, [customers, selectedBranchId]);

  const filteredPromos = useMemo(() => {
    const { start, end } = dateRange;
    return promos.filter((promo) => {
      const promoDate = new Date(promo.promo_date);
      const inDateRange = promoDate >= start && promoDate <= end;
      const matchesWorker = selectedWorker === 'all' || promo.worker_id === selectedWorker;
      const matchesBranch = !selectedBranchId || promo.worker?.branch_id === selectedBranchId;
      return inDateRange && matchesWorker && matchesBranch;
    });
  }, [promos, selectedWorker, dateRange, selectedBranchId]);

  const filteredOrders = useMemo(() => {
    const { start, end } = dateRange;
    return orders.filter((order) => {
      const orderDate = new Date(order.created_at);
      const inDateRange = orderDate >= start && orderDate <= end;
      const matchesBranch = !selectedBranchId || order.branch_id === selectedBranchId || order.branch_id === null;
      return inDateRange && matchesBranch;
    });
  }, [orders, dateRange, selectedBranchId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">{t('stats.title')}</h2>
      <DateRangeFilter
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        customDateFrom={customDateFrom}
        setCustomDateFrom={setCustomDateFrom}
        customDateTo={customDateTo}
        setCustomDateTo={setCustomDateTo}
      />
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="orders" className="text-xs py-2">{t('stats.orders_tab')}</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs py-2">{t('stats.sales_tab')}</TabsTrigger>
          <TabsTrigger value="products" className="text-xs py-2">{t('stats.products_tab')}</TabsTrigger>
          <TabsTrigger value="customers" className="text-xs py-2">{t('stats.customers_tab')}</TabsTrigger>
          <TabsTrigger value="promos" className="text-xs py-2">{t('stats.promos_tab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4">
          <OrderStats orders={filteredOrders} workers={filteredWorkers} />
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          <SalesStats orders={filteredOrders} />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductStats orders={filteredOrders} promos={filteredPromos} />
        </TabsContent>
        <TabsContent value="customers" className="mt-4">
          <CustomerStats orders={filteredOrders} promos={filteredPromos} customers={filteredCustomers} />
        </TabsContent>
        <TabsContent value="promos" className="mt-4">
          <PromoStats promos={filteredPromos} workers={filteredWorkers} selectedWorker={selectedWorker} setSelectedWorker={setSelectedWorker} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Stats;
