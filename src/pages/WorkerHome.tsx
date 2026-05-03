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

  // Hero primary action based on role
  const heroAction = (() => {
    if (isWarehouseManager) {
      return { label: t('worker_home.stock_management'), sub: 'إدارة شاملة للمخزن والشحن', icon: <Warehouse className="w-7 h-7" />, onClick: () => setShowStockManagement(true), gradient: 'from-teal-500 to-emerald-600' };
    }
    if (hasDeliveryAccess) {
      return { label: t('deliveries.title'), sub: 'الطلبات المخصصة لك اليوم', icon: <Truck className="w-7 h-7" />, onClick: () => navigate('/my-deliveries'), gradient: 'from-blue-500 to-indigo-600' };
    }
    if (isSalesRole && hasOrdersAccess) {
      return { label: t('orders.create_new'), sub: 'إنشاء طلبية لعميل', icon: <ShoppingCart className="w-7 h-7" />, onClick: () => setShowCustomerPickerForOrder(true), gradient: 'from-violet-500 to-purple-600' };
    }
    return null;
  })();

  // Today's spotlight cards (horizontal scroll)
  const spotlightCards: { key: string; title: string; sub: string; icon: React.ReactNode; onClick: () => void; tone: string }[] = [];
  if (isSupervisor || isWarehouseManager || hasDeliveryAccess || isSalesRole) {
    if (!isTodayCustomersHidden) {
      spotlightCards.push({ key: 'today', title: todayCustomersLabel, sub: t('worker.today_schedule_desc'), icon: <CalendarCheck className="w-6 h-6" />, onClick: () => setShowTodayCustomers(true), tone: 'sky' });
    }
  }
  if (isWarehouseManager) {
    spotlightCards.push({ key: 'review', title: 'المراجعة النهائية', sub: 'قبل جلسة المحاسبة', icon: <ClipboardCheck className="w-6 h-6" />, onClick: () => setShowFinalReviewPicker(true), tone: 'blue' });
    spotlightCards.push({ key: 'load', title: t('worker_home.load_worker'), sub: 'شحن مندوب توصيل', icon: <ArrowDownToLine className="w-6 h-6" />, onClick: () => setShowLoadWorkerPicker(true), tone: 'orange' });
  }
  if (hasDeliveryAccess && !isMyStockPageHidden && !isMyStockHidden) {
    spotlightCards.push({ key: 'mystock', title: t('stock.my_stock'), sub: 'مخزونك الحالي', icon: <Package className="w-6 h-6" />, onClick: () => navigate('/my-stock'), tone: 'violet' });
  }

  const toneMap: Record<string, { bg: string; ic: string; ring: string }> = {
    sky: { bg: 'bg-sky-50', ic: 'text-sky-600', ring: 'ring-sky-200' },
    blue: { bg: 'bg-blue-50', ic: 'text-blue-600', ring: 'ring-blue-200' },
    orange: { bg: 'bg-orange-50', ic: 'text-orange-600', ring: 'ring-orange-200' },
    violet: { bg: 'bg-violet-50', ic: 'text-violet-600', ring: 'ring-violet-200' },
    emerald: { bg: 'bg-emerald-50', ic: 'text-emerald-600', ring: 'ring-emerald-200' },
  };

  return (
    <div className="pb-24 touch-pan-y bg-gradient-to-b from-muted/30 to-background min-h-screen">
      {/* Compact Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground px-4 pt-5 pb-8">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-primary-foreground/70">{t('common.welcome')}</p>
            <h2 className="text-lg font-bold truncate">{user?.full_name} 👋</h2>
            {(activeRole?.custom_role_name || activeBranch?.name) && (
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {activeRole?.custom_role_name && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                    {activeRole.custom_role_name}
                  </span>
                )}
                {activeBranch?.name && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
                    📍 {activeBranch.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sales Summary — pulled into hero */}
      <div className="-mt-5 px-3">
        <WorkerSalesSummaryCard onOpenSalesSummary={() => setShowSalesSummary(true)} />
      </div>

      {/* Hero CTA */}
      {heroAction && (
        <div className="px-3 mt-3">
          <button
            onClick={heroAction.onClick}
            className={`w-full rounded-2xl bg-gradient-to-br ${heroAction.gradient} text-white p-4 flex items-center gap-3 shadow-lg active:scale-[0.98] transition-all`}
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              {heroAction.icon}
            </div>
            <div className="text-right flex-1 min-w-0">
              <p className="font-bold text-base">{heroAction.label}</p>
              <p className="text-xs text-white/80 truncate">{heroAction.sub}</p>
            </div>
            <ArrowDownToLine className="w-5 h-5 -rotate-90 text-white/70 shrink-0" />
          </button>
        </div>
      )}

      {/* Spotlight horizontal scroll */}
      {spotlightCards.length > 0 && (
        <div className="mt-3 overflow-x-auto scrollbar-none">
          <div className="flex gap-2.5 px-3 pb-1 min-w-min">
            {spotlightCards.map(card => {
              const tm = toneMap[card.tone] || toneMap.blue;
              return (
                <button
                  key={card.key}
                  onClick={card.onClick}
                  className={`shrink-0 w-44 rounded-xl bg-card border border-border/60 p-3 text-right active:scale-95 transition-all hover:shadow-md`}
                >
                  <div className={`w-9 h-9 rounded-lg ${tm.bg} ${tm.ic} flex items-center justify-center ring-1 ${tm.ring} mb-2`}>
                    {card.icon}
                  </div>
                  <p className="font-bold text-xs text-foreground line-clamp-1">{card.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{card.sub}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasPromoAccess ? (
        <>
          <div className="px-3 mt-4">
            <button
              onClick={() => setShowManualPromoEntry(true)}
              className="w-full rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white p-4 flex items-center justify-center gap-2 shadow-lg active:scale-[0.97] transition-all"
            >
              <Gift className="w-5 h-5" />
              <span className="font-bold text-sm">{t('worker.manual_promo')}</span>
            </button>
          </div>

          <div className="mt-4">
            <div className="px-3 mb-2">
              <h3 className="text-lg font-bold">{t('products.list')}</h3>
            </div>
            <ProductGrid
              products={products}
              onProductSelect={handleProductSelect}
              isLoading={isLoading}
            />
          </div>

          <AddPromoDialog
            open={showPromoDialog}
            onOpenChange={setShowPromoDialog}
            product={selectedProduct}
            onSuccess={() => {}}
          />
        </>
      ) : (hasOrdersAccess || hasDeliveryAccess || hasDebtAccess || isWarehouseManager) ? (
        (() => {
          type Action = { key: string; icon: React.ReactNode; label: string; onClick: () => void; group: 'work' | 'customers' | 'reports' };
          const quickActions: Action[] = [];

          if (hasDeliveryAccess && !isDirectSaleHidden) {
            quickActions.push({ key: 'direct-sale', icon: <ShoppingBag className="w-5 h-5" />, label: t('stock.direct_sale'), onClick: () => { setSalesHubTab('direct'); setShowActionDialog(true); }, group: 'work' });
          }
          if (isWarehouseManager && !isDirectSaleHidden) {
            quickActions.push({ key: 'depot-sale', icon: <ShoppingBag className="w-5 h-5" />, label: `${t('worker_home.depot_sale')} - Vente Dépôt`, onClick: () => { setSalesHubTab('direct'); setShowActionDialog(true); }, group: 'work' });
          }
          if (hasOrdersAccess && !isWarehouseManager && !isOrdersPageHidden && !isCreateOrderHidden) {
            quickActions.push({ key: 'create-order', icon: <ShoppingCart className="w-5 h-5" />, label: t('orders.create_new'), onClick: () => setShowCustomerPickerForOrder(true), group: 'work' });
            quickActions.push({ key: 'orders', icon: <ClipboardList className="w-5 h-5" />, label: t('orders.manage'), onClick: () => navigate('/orders'), group: 'work' });
          }
          if (hasOrdersAccess && !hasDeliveryAccess && !isWarehouseManager && !isMyPromosPageHidden) {
            quickActions.push({ key: 'promos', icon: <Gift className="w-5 h-5" />, label: t('promos.add_new'), onClick: () => navigate('/my-promos'), group: 'work' });
          }
          if (hasDeliveryAccess && !isDeliveriesPageHidden && !isDeliveriesHidden) {
            quickActions.push({ key: 'deliveries', icon: <Truck className="w-5 h-5" />, label: t('deliveries.title'), onClick: () => navigate('/my-deliveries'), group: 'work' });
          }

          if (hasCustomerAccess && !isCustomersPageHidden && !isAddCustomerHidden) {
            quickActions.push({ key: 'customers', icon: <Users className="w-5 h-5" />, label: t('nav.customers'), onClick: () => navigate('/customers'), group: 'customers' });
          }
          if (hasDebtAccess && !isCollectDebtHidden && !isDebtsPageHidden) {
            quickActions.push({ key: 'debts', icon: <Banknote className="w-5 h-5" />, label: t('debts.title'), onClick: () => navigate('/customer-debts'), group: 'customers' });
          }
          if (hasExpenseAccess && !isExpensesPageHidden && !isExpensesHidden) {
            quickActions.push({ key: 'expenses', icon: <Wallet className="w-5 h-5" />, label: t('expenses.my_expenses'), onClick: () => navigate('/expenses'), group: 'customers' });
          }

          quickActions.push({ key: 'my-achievements', icon: <CalendarCheck className="w-5 h-5" />, label: t('worker_home.today_achievements'), onClick: () => navigate('/my-achievements'), group: 'reports' });
          if (hasOrdersAccess && !isWarehouseManager) {
            quickActions.push({ key: 'order-tracking', icon: <ClipboardCheck className="w-5 h-5" />, label: t('worker_home.my_order_tracking'), onClick: () => navigate('/my-order-tracking'), group: 'reports' });
          }
          if (isWarehouseManager) {
            quickActions.push({ key: 'order-tracking-wh', icon: <ClipboardCheck className="w-5 h-5" />, label: t('worker_home.order_tracking'), onClick: () => navigate('/order-tracking'), group: 'reports' });
          }
          if ((isSupervisor || isAdminAssistant) && !isWorkerActionsHidden && !isWorkerActionsButtonHidden) {
            quickActions.push({ key: 'worker-actions', icon: <HardHat className="w-5 h-5" />, label: t('worker.worker_actions'), onClick: () => navigate('/worker-actions'), group: 'reports' });
          }
          if (isSupervisor || isAdminAssistant) {
            quickActions.push({ key: 'promo-tracking', icon: <Gift className="w-5 h-5" />, label: t('admin.promo_tracking'), onClick: () => navigate('/promo-tracking'), group: 'reports' });
          }

          const groupMeta: Record<Action['group'], { label: string; accent: string }> = {
            work: { label: 'العمل اليومي', accent: 'bg-emerald-500' },
            customers: { label: 'العملاء والمالية', accent: 'bg-cyan-500' },
            reports: { label: 'متابعة وتقارير', accent: 'bg-amber-500' },
          };
          const groupOrder: Action['group'][] = ['work', 'customers', 'reports'];
          const grouped = groupOrder
            .map(g => ({ group: g, items: quickActions.filter(a => a.group === g) }))
            .filter(s => s.items.length > 0);

          return quickActions.length > 0 ? (
            <div className="px-3 mt-5 space-y-5">
              {grouped.map(({ group, items }) => {
                const meta = groupMeta[group];
                return (
                  <section key={group}>
                    <div className="flex items-center gap-2 mb-2.5 px-1">
                      <span className={`w-1 h-4 rounded-full ${meta.accent}`} />
                      <h3 className="text-sm font-bold text-foreground">{meta.label}</h3>
                      <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{items.length}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {items.map(action => (
                        <button
                          key={action.key}
                          onClick={action.onClick}
                          className="flex flex-col items-center justify-start p-2.5 gap-1.5 rounded-xl bg-card border border-border/50 active:scale-95 transition-all hover:shadow-md hover:border-primary/30 min-h-[78px]"
                        >
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground/80">
                            {action.icon}
                          </div>
                          <span className="text-[10px] font-medium text-center leading-tight text-foreground line-clamp-2">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null;
        })()
      ) : (
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
