import React, { useState, useEffect, useMemo } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkerPermissions } from '@/hooks/usePermissions';
import { useIsElementHidden } from '@/hooks/useUIOverrides';
import ProductGrid from '@/components/promo/ProductGrid';
import AddPromoDialog from '@/components/promo/AddPromoDialog';
import SalesHubDialog from '@/components/sales/SalesHubDialog';
import FactoryReceiptQuickDialog from '@/components/stock/FactoryReceiptQuickDialog';
import FactoryDeliveryQuickDialog from '@/components/stock/FactoryDeliveryQuickDialog';
import CustomerActionDialog from '@/components/orders/CustomerActionDialog';
import OrderFlowDialog from '@/components/orders/OrderFlowDialog';
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import { useTrackVisit } from '@/hooks/useVisitTracking';
import { Customer } from '@/types/database';
import { toast } from 'sonner';
import { ShoppingCart, Gift, Loader2, ShoppingBag, Truck, Package, Banknote, Users, Wallet, ClipboardList, MapPin, Trophy, MessageCircle, HardHat, CalendarCheck, ArrowDownToLine, Warehouse, ClipboardCheck } from 'lucide-react';
import WorkerPickerDialog from '@/components/stock/WorkerPickerDialog';
import FinalReviewDialog from '@/components/warehouse/FinalReviewDialog';
import { useSelectedWorker } from '@/contexts/SelectedWorkerContext';

import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import WorkerHandoverPreviewDialog from '@/components/accounting/WorkerHandoverPreviewDialog';
import TodayCustomersDialog from '@/components/sectors/TodayCustomersDialog';
import PalletCalculatorDialog from '@/components/stock/PalletCalculatorDialog';
import AttendanceButton from '@/components/attendance/AttendanceButton';
import ManualPromoEntryDialog from '@/components/offers/ManualPromoEntryDialog';
import WorkerSalesSummaryCard from '@/components/workers/WorkerSalesSummaryCard';
import WorkerSalesSummaryDialog from '@/components/accounting/WorkerSalesSummaryDialog';

const WorkerHome: React.FC = () => {
  const { user, workerId, role, activeRole, activeBranch, availableRoles } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setSelectedWorker: setContextWorker } = useSelectedWorker();
  const { data: permissions = [], isLoading: permissionsLoading } = useWorkerPermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [showSalesHubDialog, setShowSalesHubDialog] = useState(false);
  const [salesHubTab, setSalesHubTab] = useState<'direct' | 'delivery'>('direct');
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [showCustomerPickerForOrder, setShowCustomerPickerForOrder] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [selectedCustomerForAction, setSelectedCustomerForAction] = useState<Customer | null>(null);
  const [showHandoverPreview, setShowHandoverPreview] = useState(false);
  const [showTodayCustomers, setShowTodayCustomers] = useState(false);
  const [showPalletCalculator, setShowPalletCalculator] = useState(false);
  const [showManualPromoEntry, setShowManualPromoEntry] = useState(false);
  const [showFactoryReceipt, setShowFactoryReceipt] = useState(false);
  const [showFactoryDelivery, setShowFactoryDelivery] = useState(false);
  const [showStockManagement, setShowStockManagement] = useState(false);
  const [showLoadWorkerPicker, setShowLoadWorkerPicker] = useState(false);
  const [showSalesSummary, setShowSalesSummary] = useState(false);
  const [showFinalReviewPicker, setShowFinalReviewPicker] = useState(false);
  const [finalReviewWorker, setFinalReviewWorker] = useState<{ id: string; name: string } | null>(null);

  const { trackVisit } = useTrackVisit();
  const isDirectSaleHidden = useIsElementHidden('button', 'home_direct_sale');
  const isCreateOrderHidden = useIsElementHidden('button', 'home_orders');
  const isAddCustomerHidden = useIsElementHidden('button', 'home_customers');
  const isAddPromoHidden = useIsElementHidden('button', 'home_promos');
  const isCollectDebtHidden = useIsElementHidden('button', 'home_debts');
  const isDeliveriesHidden = useIsElementHidden('button', 'home_deliveries');
  const isMyStockHidden = useIsElementHidden('button', 'home_my_stock');
  const isExpensesHidden = useIsElementHidden('button', 'home_expenses');
  const isOrdersPageHidden = useIsElementHidden('page', '/orders');
  const isDeliveriesPageHidden = useIsElementHidden('page', '/my-deliveries');
  const isMyStockPageHidden = useIsElementHidden('page', '/my-stock');
  const isCustomersPageHidden = useIsElementHidden('page', '/customers');
  const isExpensesPageHidden = useIsElementHidden('page', '/expenses');
  const isMyPromosPageHidden = useIsElementHidden('page', '/my-promos');
  const isDebtsPageHidden = useIsElementHidden('page', '/customer-debts');
  const isRewardsHidden = useIsElementHidden('button', 'home_rewards');
  const isRewardsPageHidden = useIsElementHidden('page', '/my-rewards');
  const isDailyReceiptsHidden = useIsElementHidden('button', 'home_daily_receipts');
  const isDailyReceiptsPageHidden = useIsElementHidden('page', '/daily-receipts');
  const isAvailableOffersHidden = useIsElementHidden('button', 'home_available_offers');
  const isAvailableOffersPageHidden = useIsElementHidden('page', '/available-offers');
  const isWorkerActionsHidden = useIsElementHidden('page', '/worker-actions');
  const isWorkerActionsButtonHidden = useIsElementHidden('button', 'home_worker_actions');
  const isWarehouseStockHidden = useIsElementHidden('page', '/warehouse');
  const isWarehouseStockButtonHidden = useIsElementHidden('button', 'home_warehouse_stock');
  const isTodayCustomersHidden = useIsElementHidden('button', 'home_today_customers');
  const isSupervisor = role === 'supervisor';
  const isAdminAssistant = role === 'admin_assistant';
  const isSalesRole = activeRole?.custom_role_code === 'sales_rep';
  // Delivery role from primary OR any secondary role assigned to this worker
  const isDeliveryRole = activeRole?.custom_role_code === 'delivery_rep'
    || (availableRoles || []).some(r => r.custom_role_code === 'delivery_rep');
  const isWarehouseManager = activeRole?.custom_role_code === 'warehouse_manager';

  const JS_DAY_TO_NAME: Record<number, string> = {
    6: 'saturday', 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
  };
  const DAY_NAMES: Record<string, string> = {
    saturday: t('days.saturday'), sunday: t('days.sunday'), monday: t('days.monday'),
    tuesday: t('days.tuesday'), wednesday: t('days.wednesday'), thursday: t('days.thursday'),
  };
  const todayName = JS_DAY_TO_NAME[new Date().getDay()] || '';
  const todayDayLabel = DAY_NAMES[todayName] || todayName;

  // Fetch today's scheduled sectors for current worker
  const { data: todaySectorNames = [] } = useQuery({
    queryKey: ['home-today-sector-names', workerId, todayName],
    queryFn: async () => {
      // Get sector_schedules for today
      const { data: schedules } = await supabase
        .from('sector_schedules')
        .select('sector_id')
        .eq('worker_id', workerId!)
        .eq('day', todayName);
      const sectorIds = (schedules || []).map(s => s.sector_id);
      if (sectorIds.length === 0) return [];
      const { data: sectors } = await supabase
        .from('sectors')
        .select('name')
        .in('id', sectorIds);
      return (sectors || []).map(s => s.name);
    },
    enabled: !!workerId && !!todayName,
    staleTime: 5 * 60 * 1000,
  });

  const todayCustomersLabel = useMemo(() => {
    const parts = [t('worker.today_customers'), todayDayLabel];
    if (todaySectorNames.length > 0) parts.push(todaySectorNames.join(' / '));
    return parts.join(' — ');
  }, [todayDayLabel, todaySectorNames]);

  const { data: stockItems } = useQuery({
    queryKey: ['my-worker-stock', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_stock')
        .select('*, product:products(*)')
        .eq('worker_id', workerId!)
        .gt('quantity', 0);
      if (error) throw error;
      return data;
    },
    enabled: !!workerId,
  });

  // Resolve branch from the active role/user when activeBranch is null for non-admin roles
  const { data: workerBranchId } = useQuery({
    queryKey: ['worker-branch-id', workerId],
    queryFn: async () => {
      const { data } = await supabase.from('workers').select('branch_id').eq('id', workerId!).maybeSingle();
      return data?.branch_id || null;
    },
    enabled: !activeBranch?.id && !activeRole?.branch_id && !user?.branch_id && !!workerId,
  });
  const effectiveBranchId = activeBranch?.id || activeRole?.branch_id || user?.branch_id || workerBranchId;

  // Warehouse stock for warehouse manager direct sales
  const { data: warehouseStockItems } = useQuery({
    queryKey: ['warehouse-stock-for-sale', effectiveBranchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select('*, product:products(*)')
        .eq('branch_id', effectiveBranchId!)
        .gt('quantity', 0);
      if (error) throw error;
      return data;
    },
    enabled: isWarehouseManager && !!effectiveBranchId,
  });

  const { data: allCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers-for-order-picker', effectiveBranchId],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (effectiveBranchId) {
        query = query.or(`branch_id.eq.${effectiveBranchId},branch_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      // De-duplicate by id (in case of join/RLS overlap)
      const seen = new Set<string>();
      const unique = (data as Customer[]).filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      return unique;
    },
    enabled: showCustomerPickerForOrder,
  });

  // Check permissions
  const hasPromoAccess = permissions.some(p =>
    ['view_promos', 'create_promos', 'page_promos'].includes(p.permission_code)
  );
  const hasOrdersAccess = permissions.some(p =>
    ['view_orders', 'create_orders', 'page_orders'].includes(p.permission_code)
  );
  const hasDeliveryAccess = permissions.some(p =>
    ['page_my_deliveries', 'update_order_status'].includes(p.permission_code)
    || (isDeliveryRole && p.permission_code === 'view_assigned_orders')
  ) && !isSalesRole;
  const hasDebtAccess = permissions.some(p =>
    ['page_customer_debts', 'view_customer_debts', 'collect_debts'].includes(p.permission_code)
  );
  const hasCustomerAccess = permissions.some(p =>
    ['page_customers'].includes(p.permission_code)
  );
  const hasExpenseAccess = true; // All workers can access expenses

  useEffect(() => {
    if (!permissionsLoading && hasPromoAccess) {
      fetchProducts();
    } else if (!permissionsLoading) {
      setIsLoading(false);
    }
  }, [hasPromoAccess, permissionsLoading]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(t('products.loading_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setShowPromoDialog(true);
  };

  // Determine welcome message based on permissions
  const getWelcomeMessage = () => {
    if (permissionsLoading) return t('common.loading_permissions');
    if (hasPromoAccess) {
      return t('products.choose');
    }
    if (hasOrdersAccess) {
      return t('orders.manage');
    }
    return t('common.welcome');
  };

  // Workers for load-stock picker (warehouse manager)
  const { data: loadWorkersList = [] } = useQuery({
    queryKey: ['wh-load-workers', effectiveBranchId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: roleRows } = await supabase
        .from('worker_roles')
        .select('worker_id, branch_id, valid_from, valid_until, custom_roles!inner(code)')
        .eq('is_active', true)
        .eq('custom_roles.code', 'delivery_rep');

      const eligibleDeliveryRoles = (roleRows || []).filter(row =>
        row.worker_id
        && (row.branch_id === effectiveBranchId || row.branch_id === null)
        && (!row.valid_from || row.valid_from <= now)
        && (!row.valid_until || row.valid_until >= now)
      );

      const deliveryRoleBranchByWorker = new Map(
        eligibleDeliveryRoles
          .sort((a, b) => Number(a.branch_id === effectiveBranchId) - Number(b.branch_id === effectiveBranchId))
          .map(row => [row.worker_id as string, row.branch_id as string | null])
      );
      const deliveryWorkerIds = Array.from(new Set(
        (roleRows || [])
          .filter(row => eligibleDeliveryRoles.some(roleRow => roleRow.worker_id === row.worker_id))
          .map(row => row.worker_id as string)
      ));

      if (deliveryWorkerIds.length === 0) return [];

      const { data } = await supabase
        .from('workers_safe')
        .select('id, full_name, username, branch_id')
        .eq('is_active', true)
        .eq('is_test', false)
        .in('id', deliveryWorkerIds)
        .order('full_name');
      return (data || []).filter(w =>
        deliveryRoleBranchByWorker.get(w.id!) === effectiveBranchId
        || (!deliveryRoleBranchByWorker.get(w.id!) && w.branch_id === effectiveBranchId)
      );
    },
    enabled: isWarehouseManager && !!effectiveBranchId,
  });


  // Loading skeleton for permissions
  if (permissionsLoading) {
    return (
      <div className="pb-4">
        {/* Welcome Section */}
        <div className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-6">
          <h2 className="text-xl font-bold mb-1">{t('common.welcome')} {user?.full_name} 👋</h2>
          <p className="text-primary-foreground/80 text-sm">{t('common.loading_permissions')}</p>
        </div>

        {/* Loading Skeleton */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 touch-pan-y">
      {/* Welcome Section */}
      <div className="bg-gradient-to-l from-primary to-primary/80 text-primary-foreground p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold mb-1">{t('common.welcome')} {user?.full_name} 👋</h2>
            <p className="text-primary-foreground/80 text-sm">
              {getWelcomeMessage()}
            </p>
          </div>
        </div>
      </div>

      {/* Worker Sales Summary */}
      <WorkerSalesSummaryCard onOpenSalesSummary={() => setShowSalesSummary(true)} />

      {/* Today's Customers Notification for Supervisors */}
      {isSupervisor && (
        <div className="px-4 mt-3">
          <div
            onClick={() => setShowTodayCustomers(true)}
            className="relative overflow-hidden rounded-xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-blue-100 p-4 cursor-pointer active:scale-[0.97] transition-all hover:shadow-lg flex items-center gap-3"
          >
            <CalendarCheck className="w-8 h-8 text-sky-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-sky-900">{todayCustomersLabel}</p>
              <p className="text-xs text-sky-700">{t('worker.today_schedule_desc')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Manager: Today's Customers */}
      {isWarehouseManager && !isSupervisor && (
        <div className="px-4 mt-3">
          <div
            onClick={() => setShowTodayCustomers(true)}
            className="relative overflow-hidden rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 cursor-pointer active:scale-[0.97] transition-all hover:shadow-lg flex items-center gap-3"
          >
            <CalendarCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-900">{todayCustomersLabel}</p>
              <p className="text-xs text-emerald-700">{t('worker.today_schedule_desc')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Manager: Final Review (always visible) */}
      {isWarehouseManager && (
        <div className="px-4 mt-3">
          <div
            onClick={() => setShowFinalReviewPicker(true)}
            className="relative overflow-hidden rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-100 p-4 cursor-pointer active:scale-[0.97] transition-all hover:shadow-lg flex items-center gap-3"
          >
            <ClipboardCheck className="w-8 h-8 text-blue-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-blue-900">المراجعة النهائية</p>
              <p className="text-xs text-blue-700">مراجعة شاملة للشحن والتفريغ قبل جلسة المحاسبة</p>
            </div>
          </div>
        </div>
      )}


      {hasPromoAccess ? (
        <>
          <div className="px-4 mt-4">
            <button
              onClick={() => setShowManualPromoEntry(true)}
              className="w-full rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white p-4 flex items-center justify-center gap-2 shadow-lg active:scale-[0.97] transition-all"
            >
              <Gift className="w-5 h-5" />
              <span className="font-bold text-sm">{t('worker.manual_promo')}</span>
            </button>
          </div>

          {/* Products Section for Promo */}
          <div className="mt-4">
            <div className="px-4 mb-2">
              <h3 className="text-lg font-bold">{t('products.list')}</h3>
            </div>
            <ProductGrid
              products={products}
              onProductSelect={handleProductSelect}
              isLoading={isLoading}
            />
          </div>

          {/* Add Promo Dialog */}
          <AddPromoDialog
            open={showPromoDialog}
            onOpenChange={setShowPromoDialog}
            product={selectedProduct}
            onSuccess={() => {
              // Optionally refresh data
            }}
          />
        </>
      ) : (hasOrdersAccess || hasDeliveryAccess || hasDebtAccess || isWarehouseManager) ? (
        (() => {
          type Action = { key: string; icon: React.ReactNode; label: string; onClick: () => void; group: 'sales' | 'delivery' | 'stock' | 'customers' | 'other' };
          const quickActions: Action[] = [];

          if (hasDeliveryAccess && !isDeliveriesPageHidden && !isDeliveriesHidden) {
            quickActions.push({ key: 'deliveries', icon: <Truck className="w-6 h-6" />, label: t('deliveries.title'), onClick: () => navigate('/my-deliveries'), group: 'delivery' });
          }
          if ((hasDeliveryAccess || isWarehouseManager) && !isDirectSaleHidden) {
            quickActions.push({
              key: 'direct-sale',
              icon: <ShoppingBag className="w-6 h-6" />,
              label: isWarehouseManager ? `${t('worker_home.depot_sale')} - Vente Dépôt` : t('stock.direct_sale'),
              onClick: () => {
                setSalesHubTab('direct');
                setShowActionDialog(true);
              },
              group: 'sales',
            });
          }
          if (isWarehouseManager) {
            quickActions.push({ key: 'stock-management', icon: <Warehouse className="w-6 h-6" />, label: t('worker_home.stock_management'), onClick: () => setShowStockManagement(true), group: 'stock' });
            quickActions.push({ key: 'load-worker', icon: <ArrowDownToLine className="w-6 h-6" />, label: t('worker_home.load_worker'), onClick: () => setShowLoadWorkerPicker(true), group: 'stock' });
            quickActions.push({ key: 'final-review', icon: <ClipboardCheck className="w-6 h-6" />, label: 'المراجعة النهائية', onClick: () => setShowFinalReviewPicker(true), group: 'stock' });
            quickActions.push({ key: 'order-tracking', icon: <ClipboardCheck className="w-6 h-6" />, label: t('worker_home.order_tracking'), onClick: () => navigate('/order-tracking'), group: 'other' });
          }
          if (hasDeliveryAccess && !isMyStockPageHidden && !isMyStockHidden) {
            quickActions.push({ key: 'my-stock', icon: <Package className="w-6 h-6" />, label: t('stock.my_stock'), onClick: () => navigate('/my-stock'), group: 'stock' });
          }
          if (hasOrdersAccess && !isWarehouseManager && !isOrdersPageHidden && !isCreateOrderHidden) {
            quickActions.push({ key: 'create-order', icon: <ShoppingCart className="w-6 h-6" />, label: t('orders.create_new'), onClick: () => setShowCustomerPickerForOrder(true), group: 'sales' });
            quickActions.push({ key: 'orders', icon: <ShoppingCart className="w-6 h-6" />, label: t('orders.manage'), onClick: () => navigate('/orders'), group: 'sales' });
            quickActions.push({ key: 'order-tracking', icon: <ClipboardCheck className="w-6 h-6" />, label: t('worker_home.my_order_tracking'), onClick: () => navigate('/my-order-tracking'), group: 'other' });
          }
          if (hasOrdersAccess && !hasDeliveryAccess && !isWarehouseManager && !isMyPromosPageHidden) {
            quickActions.push({ key: 'promos', icon: <Gift className="w-6 h-6" />, label: t('promos.add_new'), onClick: () => navigate('/my-promos'), group: 'sales' });
          }
          if (hasDebtAccess && !isCollectDebtHidden && !isDebtsPageHidden) {
            quickActions.push({ key: 'debts', icon: <Banknote className="w-6 h-6" />, label: t('debts.title'), onClick: () => navigate('/customer-debts'), group: 'customers' });
          }
          if (hasCustomerAccess && !isCustomersPageHidden && !isAddCustomerHidden) {
            quickActions.push({ key: 'customers', icon: <Users className="w-6 h-6" />, label: t('nav.customers'), onClick: () => navigate('/customers'), group: 'customers' });
          }
          if (hasExpenseAccess && !isExpensesPageHidden && !isExpensesHidden) {
            quickActions.push({ key: 'expenses', icon: <Wallet className="w-6 h-6" />, label: t('expenses.my_expenses'), onClick: () => navigate('/expenses'), group: 'other' });
          }
          if (!isTodayCustomersHidden) {
            quickActions.push({ key: 'today-customers', icon: <MapPin className="w-6 h-6" />, label: todayCustomersLabel, onClick: () => setShowTodayCustomers(true), group: 'customers' });
          }
          quickActions.push({ key: 'my-achievements', icon: <CalendarCheck className="w-6 h-6" />, label: t('worker_home.today_achievements'), onClick: () => navigate('/my-achievements'), group: 'other' });
          if ((isSupervisor || isAdminAssistant) && !isWorkerActionsHidden && !isWorkerActionsButtonHidden) {
            quickActions.push({ key: 'worker-actions', icon: <HardHat className="w-6 h-6" />, label: t('worker.worker_actions'), onClick: () => navigate('/worker-actions'), group: 'other' });
          }
          if (isSupervisor || isAdminAssistant) {
            quickActions.push({ key: 'promo-tracking', icon: <Gift className="w-6 h-6" />, label: t('admin.promo_tracking'), onClick: () => navigate('/promo-tracking'), group: 'other' });
          }

          const itemColors: Record<string, { icon: string; ring: string; bg: string }> = {
            deliveries: { icon: 'text-blue-600', ring: 'ring-blue-200', bg: 'bg-blue-50' },
            'direct-sale': { icon: 'text-emerald-600', ring: 'ring-emerald-200', bg: 'bg-emerald-50' },
            'my-stock': { icon: 'text-violet-600', ring: 'ring-violet-200', bg: 'bg-violet-50' },
            orders: { icon: 'text-indigo-600', ring: 'ring-indigo-200', bg: 'bg-indigo-50' },
            'create-order': { icon: 'text-blue-700', ring: 'ring-blue-200', bg: 'bg-blue-50' },
            'order-tracking': { icon: 'text-slate-600', ring: 'ring-slate-200', bg: 'bg-slate-50' },
            promos: { icon: 'text-amber-600', ring: 'ring-amber-200', bg: 'bg-amber-50' },
            debts: { icon: 'text-rose-600', ring: 'ring-rose-200', bg: 'bg-rose-50' },
            customers: { icon: 'text-cyan-600', ring: 'ring-cyan-200', bg: 'bg-cyan-50' },
            expenses: { icon: 'text-yellow-600', ring: 'ring-yellow-200', bg: 'bg-yellow-50' },
            'today-customers': { icon: 'text-sky-600', ring: 'ring-sky-200', bg: 'bg-sky-50' },
            'my-achievements': { icon: 'text-violet-600', ring: 'ring-violet-200', bg: 'bg-violet-50' },
            'worker-actions': { icon: 'text-indigo-600', ring: 'ring-indigo-200', bg: 'bg-indigo-50' },
            'stock-management': { icon: 'text-teal-600', ring: 'ring-teal-200', bg: 'bg-teal-50' },
            'load-worker': { icon: 'text-orange-600', ring: 'ring-orange-200', bg: 'bg-orange-50' },
            'final-review': { icon: 'text-blue-600', ring: 'ring-blue-200', bg: 'bg-blue-50' },
            'promo-tracking': { icon: 'text-amber-600', ring: 'ring-amber-200', bg: 'bg-amber-50' },
          };
          const defaultColor = { icon: 'text-primary', ring: 'ring-border', bg: 'bg-muted/30' };

          const groupLabels: Record<Action['group'], string> = {
            sales: '🛒 المبيعات',
            delivery: '🚚 التوصيل',
            stock: '📦 المخزن',
            customers: '👥 العملاء',
            other: '⚙️ أخرى',
          };
          const groupOrder: Action['group'][] = ['sales', 'delivery', 'stock', 'customers', 'other'];
          const grouped = groupOrder
            .map(g => ({ group: g, items: quickActions.filter(a => a.group === g) }))
            .filter(s => s.items.length > 0);

          const renderTile = (action: Action) => {
            const ic = itemColors[action.key] || defaultColor;
            return (
              <button
                key={action.key}
                onClick={action.onClick}
                className="group flex flex-col items-center justify-center p-3 gap-2 rounded-2xl bg-card border border-border/60 cursor-pointer active:scale-95 transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className={`w-11 h-11 rounded-xl ${ic.bg} flex items-center justify-center ring-1 ${ic.ring}`}>
                  {React.cloneElement(action.icon as React.ReactElement, { className: `w-5 h-5 ${ic.icon}` })}
                </div>
                <span className="text-[11px] font-semibold text-center leading-tight text-foreground line-clamp-2">{action.label}</span>
              </button>
            );
          };

          return quickActions.length > 0 ? (
            <div className="p-4 space-y-4">
              {grouped.map(({ group, items }) => (
                <div key={group} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <h3 className="text-xs font-bold text-muted-foreground tracking-wide">{groupLabels[group]}</h3>
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-[10px] text-muted-foreground/70">{items.length}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {items.map(renderTile)}
                  </div>
                </div>
              ))}
            </div>
          ) : null;
        })()
      ) : (
        /* No specific permissions */
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Gift className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-lg font-medium">{t('common.no_permissions')}</p>
          <p className="text-sm">{t('common.contact_admin')}</p>
        </div>
      )}

      <SalesHubDialog
        open={showSalesHubDialog}
        onOpenChange={(open) => {
          setShowSalesHubDialog(open);
          if (!open) setSelectedCustomerForAction(null);
        }}
        initialCustomerId={selectedCustomerForAction?.id}
        initialTab={salesHubTab}
        stockSource={isWarehouseManager ? 'warehouse' : 'worker'}
        stockItems={(isWarehouseManager ? (warehouseStockItems || []) : (stockItems || [])).map(s => ({
          id: s.id,
          product_id: s.product_id,
          quantity: s.quantity,
          product: (s as { product?: Product }).product,
        }))}
      />

      <OrderFlowDialog
        open={showCreateOrderDialog}
        onOpenChange={setShowCreateOrderDialog}
        mode="create"
        initialCustomerId={selectedCustomerForAction?.id}
      />

      <CustomerActionDialog
        open={showActionDialog}
        onOpenChange={setShowActionDialog}
        onSale={(customer) => {
          setSelectedCustomerForAction(customer);
          setSalesHubTab('direct');
          setShowSalesHubDialog(true);
        }}
        directAction="sale"
        allowedActions={['sale']}
      />
      <CustomerPickerDialog
        open={showCustomerPickerForOrder}
        onOpenChange={setShowCustomerPickerForOrder}
        customers={allCustomers}
        isLoading={customersLoading}
        onSelect={(customer) => {
          setSelectedCustomerForAction(customer);
          setShowCustomerPickerForOrder(false);
          setShowCreateOrderDialog(true);
        }}
      />
      <WorkerHandoverPreviewDialog
        open={showHandoverPreview}
        onOpenChange={setShowHandoverPreview}
      />
      <TodayCustomersDialog
        open={showTodayCustomers}
        onOpenChange={setShowTodayCustomers}
      />
      <PalletCalculatorDialog
        open={showPalletCalculator}
        onOpenChange={setShowPalletCalculator}
      />
      <ManualPromoEntryDialog
        open={showManualPromoEntry}
        onOpenChange={setShowManualPromoEntry}
      />
      <FactoryReceiptQuickDialog
        open={showFactoryReceipt}
        onOpenChange={setShowFactoryReceipt}
      />
      <FactoryDeliveryQuickDialog
        open={showFactoryDelivery}
        onOpenChange={setShowFactoryDelivery}
      />
      <WorkerSalesSummaryDialog
        open={showSalesSummary}
        onOpenChange={setShowSalesSummary}
        workerId={workerId || undefined}
        workerName={user?.full_name}
      />

      {showStockManagement && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowStockManagement(false)}>
          <div className="bg-background rounded-t-2xl w-full max-w-lg p-5 pb-8 space-y-3 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-center mb-4">{t('worker_home.stock_management')}</h3>
            <button
              onClick={() => { setShowStockManagement(false); navigate('/warehouse'); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-accent transition-colors"
            >
              <Package className="w-6 h-6 text-primary" />
              <span className="font-semibold">{t('worker_home.branch_stock')}</span>
            </button>
            <button
              onClick={() => { setShowStockManagement(false); setShowFactoryReceipt(true); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-accent transition-colors"
            >
              <ArrowDownToLine className="w-6 h-6 text-emerald-600" />
              <span className="font-semibold">{t('worker_home.factory_receipt')}</span>
            </button>
            <button
              onClick={() => { setShowStockManagement(false); setShowFactoryDelivery(true); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-accent transition-colors"
            >
              <Truck className="w-6 h-6 text-orange-600" />
              <span className="font-semibold">{t('worker_home.factory_delivery')}</span>
            </button>
            {/* Stock Review - scheduled Sun, Tue, Thu but always accessible */}
            {(() => {
              const today = new Date().getDay();
              const isReviewDay = [0, 2, 4].includes(today);
              return (
                <button
                  onClick={() => { setShowStockManagement(false); navigate('/warehouse-review'); }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${isReviewDay ? 'border-blue-300 bg-blue-50/50 hover:bg-blue-100/50 dark:border-blue-800 dark:bg-blue-950/20' : 'border-border hover:bg-accent'}`}
                >
                  <ClipboardCheck className={`w-6 h-6 ${isReviewDay ? 'text-blue-600' : 'text-primary'}`} />
                  <div className="text-right">
                    <span className="font-semibold block">{t('worker_home.stock_review')}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t('worker_home.review_days')} {isReviewDay ? t('worker_home.today_is_review') : ''}
                    </span>
                  </div>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Worker Picker for Load Stock */}
      <WorkerPickerDialog
        open={showLoadWorkerPicker}
        onOpenChange={setShowLoadWorkerPicker}
        workers={loadWorkersList}
        selectedWorkerId=""
        onSelect={(wId) => {
          setShowLoadWorkerPicker(false);
          setContextWorker(wId);
          navigate('/load-stock');
        }}
      />

      {/* Final Review picker + dialog */}
      <WorkerPickerDialog
        open={showFinalReviewPicker}
        onOpenChange={setShowFinalReviewPicker}
        workers={loadWorkersList}
        selectedWorkerId=""
        onSelect={(wId) => {
          const w = loadWorkersList.find((x: { id: string; full_name?: string }) => x.id === wId);
          setFinalReviewWorker({ id: wId, name: w?.full_name || '' });
          setShowFinalReviewPicker(false);
        }}
      />
      {finalReviewWorker && (
        <FinalReviewDialog
          open={!!finalReviewWorker}
          onOpenChange={(o) => { if (!o) setFinalReviewWorker(null); }}
          workerId={finalReviewWorker.id}
          workerName={finalReviewWorker.name}
          branchId={activeBranch?.id || null}
        />
      )}
    </div>
  );
};

export default WorkerHome;
