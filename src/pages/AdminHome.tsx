import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFontSize } from '@/contexts/FontSizeContext';
import {
  Calculator, Banknote, Navigation, Users, Receipt, ShoppingCart, Scale, Trophy,
  CalendarDays, Gift, ArrowDownToLine, Truck, ClipboardCheck, Building2, Warehouse, Package,
  Wallet, FileText, Vault, FolderOpen, MapPin, Activity, Store, UserCheck, UserCog, Settings,
  BookOpen, Shield, BarChart3, FileSpreadsheet, Split, Radar, ClipboardList, LucideIcon,
  CheckSquare, MessageSquareMore, ListTodo, TimerReset, Pencil, Database, ShieldCheck
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsElementHidden } from '@/hooks/useUIOverrides';
import InvoiceRequestDialog from '@/components/treasury/InvoiceRequestDialog';
import OrderFlowDialog from '@/components/orders/OrderFlowDialog';
import WorkerGiftsSummaryDialog from '@/components/accounting/WorkerGiftsSummaryDialog';
import ManualPromoEntryDialog from '@/components/offers/ManualPromoEntryDialog';
import FactoryReceiptQuickDialog from '@/components/stock/FactoryReceiptQuickDialog';
import FactoryDeliveryQuickDialog from '@/components/stock/FactoryDeliveryQuickDialog';
import SalesHubDialog from '@/components/sales/SalesHubDialog';
import { cn, isAdminRole, isSuperAdminRole } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AddTaskDialog from '@/components/tasks/AddTaskDialog';
import { useTasks } from '@/hooks/useTasks';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// ─── Functional Group Definitions ───

interface GroupItem {
  path: string;
  icon: LucideIcon;
  label: string;
  action?: () => void; // for dialog-opening buttons
}

interface FunctionalGroup {
  title: string;
  tKey?: string;
  color: { bg: string; border: string; title: string; iconDefault: string };
  branchColor?: { bg: string; border: string; title: string; iconDefault: string };
  items: GroupItem[];
}

const itemColors: Record<string, { bg: string; icon: string; border: string }> = {
  '/accounting': { bg: 'bg-amber-50 dark:bg-amber-950/30', icon: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  '/customer-debts': { bg: 'bg-rose-50 dark:bg-rose-950/30', icon: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
  '/surplus-deficit': { bg: 'bg-violet-50 dark:bg-violet-950/30', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
  '/expenses': { bg: 'bg-yellow-50 dark:bg-yellow-950/30', icon: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  '/expenses-management': { bg: 'bg-red-50 dark:bg-red-950/30', icon: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
  '/manager-treasury': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  '/shared-invoices': { bg: 'bg-orange-50 dark:bg-orange-950/30', icon: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  '/daily-receipts': { bg: 'bg-teal-50 dark:bg-teal-950/30', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  '/worker-debts': { bg: 'bg-pink-50 dark:bg-pink-950/30', icon: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
  '/orders': { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  '/order-tracking': { bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  '/order-modifications': { bg: 'bg-orange-50 dark:bg-orange-950/30', icon: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  '/my-deliveries': { bg: 'bg-teal-50 dark:bg-teal-950/30', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  '/warehouse': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  '/warehouse-direct-sale': { bg: 'bg-green-50 dark:bg-green-950/30', icon: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  '/warehouse-review': { bg: 'bg-teal-50 dark:bg-teal-950/30', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  '/stock-receipts': { bg: 'bg-lime-50 dark:bg-lime-950/30', icon: 'text-lime-600 dark:text-lime-400', border: 'border-lime-200 dark:border-lime-800' },
  '/load-stock': { bg: 'bg-green-50 dark:bg-green-950/30', icon: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  '/customers': { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  '/customer-accounts': { bg: 'bg-cyan-50 dark:bg-cyan-950/30', icon: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
  '/customer-journey': { bg: 'bg-sky-50 dark:bg-sky-950/30', icon: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
  '/nearby-stores': { bg: 'bg-sky-50 dark:bg-sky-950/30', icon: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
  '/promo-table': { bg: 'bg-orange-50 dark:bg-orange-950/30', icon: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  '/product-offers': { bg: 'bg-rose-50 dark:bg-rose-950/30', icon: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
  '/my-promos': { bg: 'bg-amber-50 dark:bg-amber-950/30', icon: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  '/promo-splits': { bg: 'bg-cyan-50 dark:bg-cyan-950/30', icon: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
  '/workers': { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', icon: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-800' },
  '/worker-actions': { bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  '/worker-tracking': { bg: 'bg-sky-50 dark:bg-sky-950/30', icon: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
  '/attendance': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  '/rewards': { bg: 'bg-yellow-50 dark:bg-yellow-950/30', icon: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  '/products': { bg: 'bg-pink-50 dark:bg-pink-950/30', icon: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
  '/stats': { bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  '/geo-operations': { bg: 'bg-teal-50 dark:bg-teal-950/30', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  '/activity-logs': { bg: 'bg-violet-50 dark:bg-violet-950/30', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
  '/branches': { bg: 'bg-purple-50 dark:bg-purple-950/30', icon: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  '/permissions': { bg: 'bg-slate-50 dark:bg-slate-950/30', icon: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-800' },
  '/settings': { bg: 'bg-gray-50 dark:bg-gray-950/30', icon: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-800' },
  '/guide': { bg: 'bg-stone-50 dark:bg-stone-950/30', icon: 'text-stone-600 dark:text-stone-400', border: 'border-stone-200 dark:border-stone-800' },
  '/manager-sales-summary': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  '/training': { bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  '/manager-accounting-review': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  '/components-reference': { bg: 'bg-cyan-50 dark:bg-cyan-950/30', icon: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
};

const defaultItemColor = { bg: 'bg-muted/30', icon: 'text-primary', border: 'border-border' };

const AdminHome: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { gridCols } = useFontSize();
  const { activeBranch, role, activeRole } = useAuth();
  const { incompleteTasks } = useTasks('task');
  const { incompleteTasks: incompleteRequests } = useTasks('request');
  const [invoiceRequestOpen, setInvoiceRequestOpen] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [giftsWorkerIdx, setGiftsWorkerIdx] = useState(0);
  const [manualPromoOpen, setManualPromoOpen] = useState(false);
  const [factoryReceiptOpen, setFactoryReceiptOpen] = useState(false);
  const [factoryDeliveryOpen, setFactoryDeliveryOpen] = useState(false);
  const [warehouseDirectSaleOpen, setWarehouseDirectSaleOpen] = useState(false);
  const [taskDialogType, setTaskDialogType] = useState<'task' | 'request' | null>(null);

  const isBranchAdmin = role === 'branch_admin';
  const isProjectManager = role === 'project_manager';

  const isAccountingHidden = useIsElementHidden('page', '/accounting');
  const isDebtsHidden = useIsElementHidden('page', '/customer-debts');
  const isGeoHidden = useIsElementHidden('page', '/geo-operations');
  const isWorkerActionsHidden = useIsElementHidden('page', '/worker-actions');
  const showInvoiceButton = isAdminRole(role);
  const showGiftsButton = isAdminRole(role);
  const isWarehouseManager = activeRole?.custom_role_code === 'warehouse_manager';
  const warehouseBranchId = activeBranch?.id || activeRole?.branch_id || null;

  const { data: activeWorkers = [] } = useQuery({
    queryKey: ['admin-home-workers', activeBranch?.id],
    queryFn: async () => {
      let rolesQuery = supabase
        .from('worker_roles')
        .select('worker_id, custom_roles!inner(code)')
        .eq('custom_roles.code', 'delivery_rep');

      if (activeBranch?.id) {
        rolesQuery = rolesQuery.eq('branch_id', activeBranch.id);
      }

      const { data: workerRoles } = await rolesQuery;
      if (!workerRoles || workerRoles.length === 0) return [];

      const workerIds = [...new Set(workerRoles.map(wr => wr.worker_id))];
      const { data } = await supabase
        .from('workers')
        .select('id, full_name, username')
        .in('id', workerIds)
        .eq('is_active', true)
        .order('full_name');

      return data || [];
    },
    enabled: showGiftsButton,
  });

  const { data: warehouseStockItemsForSale = [] } = useQuery({
    queryKey: ['admin-home-warehouse-direct-sale', warehouseBranchId],
    queryFn: async () => {
      if (!warehouseBranchId) return [];
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select('id, product_id, quantity, product:products(*)')
        .eq('branch_id', warehouseBranchId)
        .gt('quantity', 0);
      if (error) throw error;
      return data || [];
    },
    enabled: isWarehouseManager && !!warehouseBranchId,
  });

  const currentGiftsWorker = activeWorkers[giftsWorkerIdx] || null;
  const overdueTasksCount = [...incompleteTasks, ...incompleteRequests].filter((task) => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }).length;

  const { data: activeDebts } = useQuery({
    queryKey: ['active-debts-count', activeBranch?.id],
    queryFn: async () => {
      let query = supabase.from('customer_debts').select('remaining_amount', { count: 'exact' }).in('status', ['active', 'partially_paid']);
      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
      const { data, count } = await query;
      const total = data?.reduce((sum, d) => sum + Number(d.remaining_amount || 0), 0) || 0;
      return { count: count || 0, total };
    },
  });

  const { data: openSessions } = useQuery({
    queryKey: ['open-sessions-count', activeBranch?.id],
    queryFn: async () => {
      let query = supabase.from('accounting_sessions').select('id', { count: 'exact' }).eq('status', 'open');
      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
      const { count } = await query;
      return count || 0;
    },
  });

  const { data: operationalSnapshot } = useQuery({
    queryKey: ['admin-home-operational-snapshot', role, activeBranch?.id],
    queryFn: async () => {
      let workersQuery = supabase
        .from('workers')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      let branchesQuery = supabase
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      let pendingAccountsQuery = supabase
        .from('customer_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      let ordersQuery = supabase
        .from('orders')
        .select('id, status')
        .in('status', ['pending', 'assigned', 'in_progress']);

      if (activeBranch?.id) {
        workersQuery = workersQuery.eq('branch_id', activeBranch.id);
        pendingAccountsQuery = (pendingAccountsQuery as any).eq('branch_id', activeBranch.id);
        ordersQuery = ordersQuery.eq('branch_id', activeBranch.id);
      }

      const [
        { count: workersCount },
        { count: branchesCount },
        { count: pendingAccountsCount },
        { data: activeOrders, error: ordersError },
      ] = await Promise.all([
        workersQuery,
        branchesQuery,
        pendingAccountsQuery,
        ordersQuery,
      ]);

      if (ordersError) throw ordersError;

      const orderRows = activeOrders || [];

      return {
        workersCount: workersCount || 0,
        branchesCount: branchesCount || 0,
        pendingAccountsCount: pendingAccountsCount || 0,
        activeOrdersCount: orderRows.length,
        pendingOrdersCount: orderRows.filter((order) => order.status === 'pending' || order.status === 'assigned').length,
        inProgressOrdersCount: orderRows.filter((order) => order.status === 'in_progress').length,
      };
    },
    enabled: isAdminRole(role),
  });

  const managerSummaryCards = [
    {
      key: 'branches',
      label: t('admin_home.active_branches'),
      value: operationalSnapshot?.branchesCount || 0,
      icon: Building2,
      tone: 'from-slate-50 to-white border-slate-200 text-slate-700',
    },
    {
      key: 'workers',
      label: t('admin_home.active_workers'),
      value: operationalSnapshot?.workersCount || 0,
      icon: Users,
      tone: 'from-fuchsia-50 to-white border-fuchsia-200 text-fuchsia-700',
    },
    {
      key: 'orders',
      label: t('admin_home.open_orders'),
      value: operationalSnapshot?.activeOrdersCount || 0,
      icon: ShoppingCart,
      tone: 'from-blue-50 to-white border-blue-200 text-blue-700',
    },
    {
      key: 'tasks',
      label: t('admin_home.open_followups'),
      value: incompleteTasks.length + incompleteRequests.length,
      icon: ListTodo,
      tone: 'from-amber-50 to-white border-amber-200 text-amber-700',
    },
  ];

  const managerQuickActions = [
    { key: 'new-task', label: t('admin_home.assign_task'), icon: CheckSquare, onClick: () => setTaskDialogType('task') },
    { key: 'new-request', label: t('admin_home.add_request'), icon: MessageSquareMore, onClick: () => setTaskDialogType('request') },
    { key: 'branches', label: t('admin_home.manage_branches'), icon: Building2, onClick: () => navigate('/branches') },
    { key: 'permissions', label: t('admin_home.permissions'), icon: Shield, onClick: () => navigate('/permissions') },
    { key: 'worker-roles-mgmt', label: t('nav.worker_roles_management'), icon: Shield, onClick: () => navigate('/worker-roles-management') },
    { key: 'stats', label: t('admin_home.reports'), icon: BarChart3, onClick: () => navigate('/stats') },
    { key: 'logs', label: t('admin_home.activity_log'), icon: Activity, onClick: () => navigate('/activity-logs') },
  ];

  // ─── Build Functional Groups ───

  const groups: FunctionalGroup[] = [
    // 1. المحاسبة والمالية
    {
      title: 'المحاسبة والمالية',
      tKey: 'sidebar.group.accounting',
      color: { bg: 'bg-amber-500/10', border: 'border-amber-300', title: 'text-amber-800', iconDefault: 'text-amber-600' },
      branchColor: { bg: 'bg-teal-500/10', border: 'border-teal-300', title: 'text-teal-800', iconDefault: 'text-teal-600' },
      items: [
        ...(!isAccountingHidden ? [{ path: '/accounting', icon: Calculator, label: t('accounting.title') }] : []),
        ...(isAdminRole(role) ? [{ path: '/manager-accounting-review', icon: ClipboardCheck, label: t('admin_home.item.manager_accounting_review') }] : []),
        ...(!isDebtsHidden ? [{ path: '/customer-debts', icon: Banknote, label: t('debts.title') }] : []),
        { path: '/surplus-deficit', icon: Scale, label: t('admin_home.item.surplus_deficit') },
        { path: '/expenses', icon: Wallet, label: t('expenses.my_expenses') },
        { path: '/expenses-management', icon: Wallet, label: t('expenses.title') },
        { path: '/manager-treasury', icon: Vault, label: t('nav.manager_treasury') },
        ...(!isBranchAdmin ? [{ path: '/daily-receipts', icon: FileText, label: t('nav.daily_receipts') }] : []),
        { path: '/shared-invoices', icon: FolderOpen, label: t('admin_home.item.shared_invoices') },
        ...(isAdminRole(role) ? [{ path: '/assistant-approvals', icon: ShieldCheck, label: t('nav.assistant_approvals') }] : []),
        { path: '/worker-debts', icon: Banknote, label: t('nav.worker_debts') },
        ...(isAdminRole(role) ? [{ path: '/manager-sales-summary', icon: ShoppingCart, label: t('admin_home.item.manager_sales_summary') }] : []),
      ],
    },
    // 2. الطلبات والتوصيل
    {
      title: 'الطلبات والتوصيل',
      tKey: 'sidebar.group.orders',
      color: { bg: 'bg-blue-500/10', border: 'border-blue-300', title: 'text-blue-800', iconDefault: 'text-blue-600' },
      branchColor: { bg: 'bg-cyan-500/10', border: 'border-cyan-300', title: 'text-cyan-800', iconDefault: 'text-cyan-600' },
      items: [
        { path: '/create-order', icon: ShoppingCart, label: t('orders.create_order'), action: () => setShowCreateOrder(true) },
        { path: '/orders', icon: ShoppingCart, label: t('nav.orders') },
        { path: '/order-tracking', icon: Radar, label: t('admin_home.item.order_tracking') },
        { path: '/order-modifications', icon: Pencil, label: t('admin_home.item.order_modifications') },
        ...(!isBranchAdmin ? [{ path: '/my-deliveries', icon: Truck, label: t('nav.my_deliveries') }] : []),
        ...(showInvoiceButton ? [{ path: '/invoice-request', icon: Receipt, label: t('admin.invoice_request'), action: () => setInvoiceRequestOpen(true) }] : []),
      ],
    },
    // 3. المخزون والمستودع - hidden for branch_admin
    ...(!isBranchAdmin ? [{
      title: 'المخزون والمستودع',
      tKey: 'sidebar.group.warehouse',
      color: { bg: 'bg-emerald-500/10', border: 'border-emerald-300', title: 'text-emerald-800', iconDefault: 'text-emerald-600' },
      branchColor: { bg: 'bg-green-500/10', border: 'border-green-300', title: 'text-green-800', iconDefault: 'text-green-600' },
      items: [
        { path: '/warehouse', icon: Warehouse, label: t('stock.warehouse_stock') },
        { path: '/warehouse-review', icon: ClipboardCheck, label: t('admin_home.item.warehouse_review') },
        { path: '/stock-receipts', icon: ClipboardList, label: t('stock.receipts') },
        { path: '/load-stock', icon: Truck, label: t('stock.load_to_worker') },
        { path: '/factory-receipt', icon: ArrowDownToLine, label: t('admin_home.item.factory_receipt'), action: () => setFactoryReceiptOpen(true) },
        { path: '/factory-delivery', icon: Truck, label: t('admin_home.item.factory_delivery'), action: () => setFactoryDeliveryOpen(true) },
        ...(isWarehouseManager ? [{ path: '/warehouse-direct-sale', icon: ShoppingCart, label: t('admin_home.item.warehouse_direct_sale'), action: () => setWarehouseDirectSaleOpen(true) }] : []),
      ],
    }] : []),
    // 4. العملاء
    {
      title: 'العملاء',
      tKey: 'sidebar.group.customers',
      color: { bg: 'bg-sky-500/10', border: 'border-sky-300', title: 'text-sky-800', iconDefault: 'text-sky-600' },
      items: [
        { path: '/customers', icon: UserCheck, label: t('nav.customers') },
        ...(!isBranchAdmin ? [{ path: '/customer-accounts', icon: UserCog, label: t('nav.customer_accounts') }] : []),
        { path: '/customer-journey', icon: Activity, label: t('nav.customer_journey') },
        { path: '/nearby-stores', icon: Store, label: t('nav.nearby_stores') },
      ],
    },
    // 5. العروض والترويج
    {
      title: 'العروض والترويج',
      tKey: 'sidebar.group.promotions',
      color: { bg: 'bg-orange-500/10', border: 'border-orange-300', title: 'text-orange-800', iconDefault: 'text-orange-600' },
      branchColor: { bg: 'bg-amber-500/10', border: 'border-amber-300', title: 'text-amber-800', iconDefault: 'text-amber-600' },
      items: [
        { path: '/promo-table', icon: FileSpreadsheet, label: t('nav.table') },
        { path: '/product-offers', icon: Gift, label: t('nav.product_offers') },
        { path: '/my-promos', icon: BarChart3, label: t('nav.my_promos') },
        { path: '/promo-splits', icon: Split, label: t('admin_home.item.promo_splits') },
        { path: '/manual-promo', icon: Gift, label: t('admin.manual_promo'), action: () => setManualPromoOpen(true) },
        ...(isSuperAdminRole(role) ? [{ path: '/gifts-tracking', icon: Gift, label: t('admin.promo_tracking'), action: () => { setGiftsWorkerIdx(0); setGiftsOpen(true); } }] : []),
      ],
    },
    // 6. الموارد البشرية
    {
      title: 'الموارد البشرية',
      tKey: 'sidebar.group.hr',
      color: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-300', title: 'text-fuchsia-800', iconDefault: 'text-fuchsia-600' },
      branchColor: { bg: 'bg-purple-500/10', border: 'border-purple-300', title: 'text-purple-800', iconDefault: 'text-purple-600' },
      items: [
        ...(!isBranchAdmin ? [{ path: '/workers', icon: Users, label: t('nav.workers') }] : []),
        ...(isAdminRole(role) ? [{ path: '/worker-roles-management', icon: Shield, label: t('nav.worker_roles_management') }] : []),
        ...(!isWorkerActionsHidden ? [{ path: '/worker-actions', icon: Users, label: t('nav.worker_actions') }] : []),
        { path: '/worker-tracking', icon: MapPin, label: t('navigation.worker_tracking') },
        { path: '/attendance', icon: CalendarDays, label: t('admin_home.item.attendance') },
        { path: '/rewards', icon: Trophy, label: t('admin_home.item.rewards_penalties') },
      ],
    },
    // 7. الإدارة والتقارير - hidden for branch_admin
    ...(!isBranchAdmin ? [{
      title: 'الإدارة والتقارير',
      tKey: 'sidebar.group.admin',
      color: { bg: 'bg-slate-500/10', border: 'border-slate-300', title: 'text-slate-800', iconDefault: 'text-slate-600' },
      items: [
        { path: '/products', icon: Package, label: t('nav.products') },
        { path: '/stats', icon: BarChart3, label: t('nav.stats') },
        ...(!isGeoHidden ? [{ path: '/geo-operations', icon: Navigation, label: t('nav.geo_operations') }] : []),
        { path: '/activity-logs', icon: Activity, label: t('nav.activity_logs') },
        ...(isSuperAdminRole(role) ? [
          { path: '/branches', icon: Building2, label: t('nav.branches') },
          { path: '/permissions', icon: Shield, label: t('nav.permissions') },
        ] : []),
        { path: '/settings', icon: Settings, label: t('nav.settings') },
        { path: '/backup', icon: Database, label: t('admin_home.item.backup') },
        { path: '/guide', icon: BookOpen, label: t('nav.guide') },
        { path: '/training', icon: BookOpen, label: t('admin_home.item.training') },
        { path: '/components-reference', icon: ClipboardList, label: t('admin_home.item.components_reference') },
      ],
    }] : []),
  ];

  const gridColsClass: Record<number, string> = { 3: 'grid-cols-3', 4: 'grid-cols-4' };
  const cols = gridColsClass[gridCols] || 'grid-cols-4';

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      {isProjectManager ? (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-800 to-cyan-700 p-5 text-white shadow-xl">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-cyan-300/40 blur-2xl" />
            <div className="absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          </div>
          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">{t('admin_home.project_manager')}</Badge>
                <h2 className="text-2xl font-bold">{t('admin_home.project_dashboard')}</h2>
                <p className="text-sm text-slate-200">
                  {activeBranch?.name ? `${t('admin_home.selected_branch')}: ${activeBranch.name}` : t('admin_home.review_all_branches')}
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                <Radar className="h-7 w-7 text-cyan-200" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {managerSummaryCards.map((card) => (
                <Card key={card.key} className={cn('border bg-gradient-to-br shadow-sm', card.tone)}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
                    </div>
                    <div className="rounded-xl bg-card/80 dark:bg-card p-2">
                      <card.icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <p className="text-[11px] text-slate-300">{t('admin_home.orders_need_dispatch')}</p>
                <p className="mt-1 text-lg font-bold">{operationalSnapshot?.pendingOrdersCount || 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <p className="text-[11px] text-slate-300">{t('admin_home.orders_in_progress')}</p>
                <p className="mt-1 text-lg font-bold">{operationalSnapshot?.inProgressOrdersCount || 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <p className="text-[11px] text-slate-300">{t('admin_home.overdue_followups')}</p>
                <p className="mt-1 text-lg font-bold">{overdueTasksCount}</p>
              </div>
            </div>
          </div>
        </div>
      ) : isBranchAdmin ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-500 p-5 text-white shadow-lg">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/20" />
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/15" />
          </div>
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-teal-100 text-xs font-medium">{t('admin_home.branch_manager')}</p>
              <h2 className="text-xl font-bold">{activeBranch?.name || t('admin_home.branch')}</h2>
            </div>
          </div>
        </div>
      ) : (
        <h2 className="text-xl font-bold">{t('nav.home')}</h2>
      )}

      {isProjectManager && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">{t('admin_home.quick_actions')}</h3>
              <p className="text-xs text-muted-foreground">{t('admin_home.quick_actions_desc')}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/orders')}>
              <ShoppingCart className="me-1 h-4 w-4" />
              {t('nav.orders')}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {managerQuickActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 px-3 py-3 text-start transition hover:border-border hover:bg-muted"
              >
                <div className="rounded-xl bg-card p-2 shadow-sm">
                  <action.icon className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-xs font-semibold text-foreground">{action.label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700">
                <TimerReset className="h-4 w-4" />
                <span className="text-xs font-semibold">{t('admin_home.overdue_tasks')}</span>
              </div>
              <p className="mt-2 text-lg font-bold text-amber-900">{overdueTasksCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <UserCheck className="h-4 w-4" />
                <span className="text-xs font-semibold">{t('admin_home.accounts_pending_review')}</span>
              </div>
              <p className="mt-2 text-lg font-bold text-emerald-900">{operationalSnapshot?.pendingAccountsCount || 0}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <div className="flex items-center gap-2 text-rose-700">
                <Banknote className="h-4 w-4" />
                <span className="text-xs font-semibold">{t('admin_home.active_debts')}</span>
              </div>
              <p className="mt-2 text-lg font-bold text-rose-900">{activeDebts?.count || 0}</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
              <div className="flex items-center gap-2 text-violet-700">
                <Calculator className="h-4 w-4" />
                <span className="text-xs font-semibold">{t('admin_home.open_accounting_sessions')}</span>
              </div>
              <p className="mt-2 text-lg font-bold text-violet-900">{openSessions || 0}</p>
            </div>
          </div>
        </div>
      )}




      {/* Functional Groups - Mobile: grid cards, Desktop: collapsible accordion */}
      <div className="md:hidden space-y-4">
        {groups.map((group) => {
          if (group.items.length === 0) return null;
          const gColor = isBranchAdmin && group.branchColor ? group.branchColor : group.color;
          return (
            <div key={group.title} className={`rounded-xl border ${gColor.border} ${gColor.bg} p-3 space-y-2`}>
              <h3 className={`text-xs font-bold ${gColor.title} px-1`}>{group.tKey ? t(group.tKey) : group.title}</h3>
              <div className={`grid ${cols} gap-2`}>
                {group.items.map((item) => {
                  const ic = itemColors[item.path] || defaultItemColor;
                  return (
                    <div
                      key={item.path}
                      className={`flex flex-col items-center justify-center p-2.5 gap-1.5 rounded-xl border cursor-pointer active:scale-95 transition-all bg-card ${ic.border} hover:shadow-md`}
                      onClick={() => item.action ? item.action() : navigate(item.path)}
                    >
                      <item.icon className={`w-5 h-5 ${ic.icon}`} />
                      <span className="text-[10px] font-medium text-center leading-tight text-foreground">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Sidebar already shows the navigation — fill space with brand logo */}
      <div className="hidden md:flex flex-col items-center justify-center min-h-[60vh] gap-6 select-none">
        <img
          src={logo}
          alt="Laser Food Logo"
          className="w-72 h-72 object-contain drop-shadow-xl"
          draggable={false}
        />
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-foreground">Laser Food</h2>
          <p className="text-sm text-muted-foreground">
            {t('admin_home.use_sidebar_hint')}
          </p>
          {activeBranch?.name && (
            <p className="text-xs text-muted-foreground">{t('admin_home.current_branch')}: {activeBranch.name}</p>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <InvoiceRequestDialog open={invoiceRequestOpen} onOpenChange={setInvoiceRequestOpen} />
      <OrderFlowDialog open={showCreateOrder} onOpenChange={setShowCreateOrder} mode="create" />
      <ManualPromoEntryDialog open={manualPromoOpen} onOpenChange={setManualPromoOpen} />
      <FactoryReceiptQuickDialog open={factoryReceiptOpen} onOpenChange={setFactoryReceiptOpen} />
      <FactoryDeliveryQuickDialog open={factoryDeliveryOpen} onOpenChange={setFactoryDeliveryOpen} />
      {warehouseDirectSaleOpen && (
        <SalesHubDialog
          open={warehouseDirectSaleOpen}
          onOpenChange={setWarehouseDirectSaleOpen}
          initialTab="direct"
          stockSource="warehouse"
          stockItems={warehouseStockItemsForSale}
        />
      )}
      <AddTaskDialog
        open={taskDialogType === 'task'}
        onOpenChange={(open) => setTaskDialogType(open ? 'task' : null)}
        taskType="task"
      />
      <AddTaskDialog
        open={taskDialogType === 'request'}
        onOpenChange={(open) => setTaskDialogType(open ? 'request' : null)}
        taskType="request"
      />

      {giftsOpen && (
        <WorkerGiftsSummaryDialog
          open={giftsOpen}
          onOpenChange={setGiftsOpen}
          workerId={currentGiftsWorker?.id}
          workerName={currentGiftsWorker?.full_name || currentGiftsWorker?.username}
        />
      )}

      {giftsOpen && activeWorkers.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] bg-background border-t p-2 flex items-center gap-1 overflow-x-auto" dir="rtl">
          {activeWorkers.map((w, idx) => (
            <button
              key={w.id}
              onClick={() => setGiftsWorkerIdx(idx)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                idx === giftsWorkerIdx
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {w.full_name || w.username}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminHome;
