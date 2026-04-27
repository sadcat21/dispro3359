import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, MoreHorizontal, Bluetooth, BluetoothOff, Printer, Receipt, MessageCircle, ArrowRight, ArrowLeft, Sun, Moon, Monitor, CalendarCheck } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { cn, isAdminRole } from '@/lib/utils';
import icon from '@/assets/icon.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import BranchSelectionDialog from '@/components/auth/BranchSelectionDialog';
import OffersNotification from '@/components/offers/OffersNotification';
import StockConfirmationsPopover from '@/components/stock/StockConfirmationsPopover';
import StockDisputesPopover from '@/components/stock/StockDisputesPopover';
// ManagerConfirmationsPanel merged into StockConfirmationsPopover
import StockAlertsNotification from '@/components/stock/StockAlertsNotification';
import TasksPopover from '@/components/tasks/TasksPopover';
import WorkerRequestsPopover from '@/components/tasks/WorkerRequestsPopover';
// DebtCollectionsPopover moved into SectorCustomersPopover
import SectorCustomersPopover from '@/components/sectors/SectorCustomersPopover';
import TodayCustomersDialog from '@/components/sectors/TodayCustomersDialog';
import DebtCollectionsPopover from '@/components/debts/DebtCollectionsPopover';
import DocumentCollectionsPopover from '@/components/documents/DocumentCollectionsPopover';
import ReceiptModificationsNotification from '@/components/printing/ReceiptModificationsNotification';
import InvoiceRequestDialog from '@/components/treasury/InvoiceRequestDialog';
import { useChat } from '@/hooks/useChat';
import { ALGERIAN_WILAYAS } from '@/data/algerianWilayas';
import { useNavigation } from '@/hooks/useNavigation';
import { useNavbarPreferences } from '@/hooks/useNavbarPreferences';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { useLocationBroadcast } from '@/hooks/useWorkerLocation';
import AttendanceButton from '@/components/attendance/AttendanceButton';
import { useIsElementHidden } from '@/hooks/useUIOverrides';
import { useInvoiceFilter } from '@/contexts/InvoiceFilterContext';

interface MobileLayoutProps {
  children: React.ReactNode;
}

const moreItemColors: Record<string, { bg: string; icon: string; border: string }> = {
  '/orders': { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  '/order-tracking': { bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  '/my-deliveries': { bg: 'bg-teal-50 dark:bg-teal-950/30', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  '/my-promos': { bg: 'bg-amber-50 dark:bg-amber-950/30', icon: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  '/product-offers': { bg: 'bg-rose-50 dark:bg-rose-950/30', icon: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
  '/promo-splits': { bg: 'bg-cyan-50 dark:bg-cyan-950/30', icon: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
  '/customer-accounts': { bg: 'bg-cyan-50 dark:bg-cyan-950/30', icon: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
  '/customer-journey': { bg: 'bg-sky-50 dark:bg-sky-950/30', icon: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
  '/warehouse': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  '/warehouse-review': { bg: 'bg-teal-50 dark:bg-teal-950/30', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  '/stock-receipts': { bg: 'bg-lime-50 dark:bg-lime-950/30', icon: 'text-lime-600 dark:text-lime-400', border: 'border-lime-200 dark:border-lime-800' },
  '/load-stock': { bg: 'bg-green-50 dark:bg-green-950/30', icon: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  '/my-stock': { bg: 'bg-green-50 dark:bg-green-950/30', icon: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
  '/expenses': { bg: 'bg-yellow-50 dark:bg-yellow-950/30', icon: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  '/expenses-management': { bg: 'bg-red-50 dark:bg-red-950/30', icon: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
  '/daily-receipts': { bg: 'bg-teal-50 dark:bg-teal-950/30', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  '/customer-debts': { bg: 'bg-rose-50 dark:bg-rose-950/30', icon: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
  '/accounting': { bg: 'bg-amber-50 dark:bg-amber-950/30', icon: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  '/manager-treasury': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  '/shared-invoices': { bg: 'bg-orange-50 dark:bg-orange-950/30', icon: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  '/surplus-deficit': { bg: 'bg-violet-50 dark:bg-violet-950/30', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
  '/rewards': { bg: 'bg-yellow-50 dark:bg-yellow-950/30', icon: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  '/worker-debts': { bg: 'bg-pink-50 dark:bg-pink-950/30', icon: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
  '/worker-tracking': { bg: 'bg-sky-50 dark:bg-sky-950/30', icon: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
  '/attendance': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  '/geo-operations': { bg: 'bg-teal-50 dark:bg-teal-950/30', icon: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  '/activity-logs': { bg: 'bg-violet-50 dark:bg-violet-950/30', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
  '/nearby-stores': { bg: 'bg-sky-50 dark:bg-sky-950/30', icon: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
  '/branches': { bg: 'bg-purple-50 dark:bg-purple-950/30', icon: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
  '/customers': { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  '/workers': { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', icon: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-800' },
  '/worker-actions': { bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
  '/products': { bg: 'bg-pink-50 dark:bg-pink-950/30', icon: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
  '/permissions': { bg: 'bg-slate-50 dark:bg-slate-950/30', icon: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-800' },
  '/settings': { bg: 'bg-gray-50 dark:bg-gray-950/30', icon: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-800' },
  '/guide': { bg: 'bg-stone-50 dark:bg-stone-950/30', icon: 'text-stone-600 dark:text-stone-400', border: 'border-stone-200 dark:border-stone-800' },
  '/promo-table': { bg: 'bg-orange-50 dark:bg-orange-950/30', icon: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  '/stats': { bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
};

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  const { role, user, logout, activeBranch, switchBranch, showBranchSelection, selectBranch, activeRole } = useAuth();
  const { cycleMode, badgeNumber, badgeColorClass, modeLabel } = useInvoiceFilter();
  const { t, dir, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/';
  const isLoadStockPage = location.pathname === '/load-stock';
  const { isConnected, deviceName, scanAndConnect, disconnect, status: printerStatus } = useBluetoothPrinter();
  const [invoiceRequestOpen, setInvoiceRequestOpen] = useState(false);
  const [todayCustomersOpen, setTodayCustomersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const showInvoiceButton = isAdminRole(role);
  const { totalUnread } = useChat();
  const { startTracking } = useLocationBroadcast();
  const isChatHidden = useIsElementHidden('notification', 'notif_chat');
  const isOffersHidden = useIsElementHidden('notification', 'notif_offers');
  const isTodayCustomersHidden = useIsElementHidden('notification', 'notif_today_customers');
  const isStockAlertsHidden = useIsElementHidden('notification', 'notif_stock_alerts');
  const isTasksHidden = useIsElementHidden('notification', 'notif_tasks');
  const isWorkerRequestsHidden = useIsElementHidden('notification', 'notif_worker_requests');
  const isReceiptModsHidden = useIsElementHidden('notification', 'notif_receipt_modifications');
  const isDocCollectionsHidden = useIsElementHidden('notification', 'notif_document_collections');
  const isAttendanceHidden = useIsElementHidden('notification', 'notif_attendance');
  const isFieldWorker = role === 'worker' || role === 'supervisor';

  // Fetch pending invoice orders count for badge
  const { data: pendingInvoiceCount } = useQuery({
    queryKey: ['pending-invoice-count', activeBranch?.id],
    queryFn: async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      let q = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_type', 'with_invoice')
        .is('invoice_sent_at', null)
        .in('status', ['pending', 'assigned', 'in_progress', 'delivered']);
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { count, error } = await q;
      if (error) return 0;
      return count || 0;
    },
    enabled: showInvoiceButton,
    refetchInterval: 30000,
  });

  const LANGUAGES: { code: Language; label: string; flag: string }[] = [
    { code: 'ar', label: 'العربية', flag: '🇩🇿' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
  ];
  const { main: defaultMainItems, more: defaultMoreItems } = useNavigation();
  const { tabPaths } = useNavbarPreferences();

  // Apply navbar preferences: if user has custom tabs, use them for main nav
  const allNavItems = [...defaultMainItems, ...defaultMoreItems];
  const homeItem = defaultMainItems.find(i => i.path === '/');
  
  let mainNavItems = defaultMainItems;
  let moreNavItems = defaultMoreItems;

  if (tabPaths && tabPaths.length > 0) {
    const customMain = tabPaths
      .map(path => allNavItems.find(i => i.path === path))
      .filter(Boolean) as typeof allNavItems;
    mainNavItems = homeItem ? [homeItem, ...customMain] : customMain;
    // More = everything not in main (excluding home)
    const mainPaths = new Set(mainNavItems.map(i => i.path));
    moreNavItems = allNavItems.filter(i => i.path !== '/' && !mainPaths.has(i.path));
  }

  const isMoreActive = moreNavItems.some(item => location.pathname === item.path);

  // Close more sheet on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  // Start worker GPS broadcast globally (not only in deliveries page)
  useEffect(() => {
    const isFieldWorker = role === 'worker' || role === 'supervisor';
    if (isFieldWorker) {
      startTracking();
    }
  }, [role, startTracking]);

  // Get role display text
  const getRoleDisplayText = () => {
    const parts: string[] = [];
    
    // Add system role (صفة)
    if (role === 'admin') {
      parts.push(t('workers.role_admin'));
    } else if (role === 'project_manager') {
      parts.push('مدير المشروع');
    } else if (role === 'branch_admin') {
      parts.push(t('workers.role_branch_admin'));
    } else if (role === 'supervisor') {
      parts.push(t('workers.role_supervisor'));
    } else if (role === 'accountant') {
      parts.push('محاسب');
    } else if (role === 'admin_assistant') {
      parts.push('عون إداري');
    } else if (role === 'worker') {
      parts.push(t('workers.role_worker'));
    }
    
    // Add functional role (دور وظيفي) if available
    if (activeRole?.custom_role_name) {
      parts.push(activeRole.custom_role_name);
    }
    
    return parts.join(' - ');
  };

  const isTestBranch = activeBranch?.name?.includes('تجريبي') ?? false;

  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-background flex flex-col overflow-hidden" dir={dir}>
      {/* Header */}
      <header className={cn("sticky top-0 z-50 safe-top text-white", isTestBranch ? "bg-green-900" : "bg-purple-900")}>
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
          {/* Branding icon only */}
          <button
            onClick={cycleMode}
            className="relative w-8 h-8 shrink-0 rounded-lg bg-white/10 p-1 hover:bg-white/20 transition-colors active:scale-95"
            title={modeLabel}
          >
            <img src={icon} alt="Laser Food" className="w-full h-full object-contain" />
            <span className={cn(
              'absolute -top-1.5 -right-1.5 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-lg',
              badgeColorClass
            )}>
              {badgeNumber}
            </span>
          </button>

          {/* Global back button */}
          {!isHomePage && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="رجوع"
            >
              {dir === 'rtl' ? (
                <ArrowRight className="w-4 h-4 text-white" />
              ) : (
                <ArrowLeft className="w-4 h-4 text-white" />
              )}
            </button>
          )}

          {/* Action icons */}
          {(role === 'worker' || role === 'supervisor') && !isAttendanceHidden && <AttendanceButton />}
          <StockConfirmationsPopover />
          <StockDisputesPopover />
          
          {!isWorkerRequestsHidden && <WorkerRequestsPopover />}
          {!isTasksHidden && <TasksPopover />}
          {!isTodayCustomersHidden && <SectorCustomersPopover />}
          {!isReceiptModsHidden && <ReceiptModificationsNotification />}
          {!isStockAlertsHidden && <StockAlertsNotification />}
          {!isOffersHidden && <OffersNotification />}
          {!isDocCollectionsHidden && <DocumentCollectionsPopover />}

          {/* Chat */}
          {!isChatHidden && (
            <Link
              to="/chat"
              className="relative flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-white" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </Link>
          )}

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                <MoreHorizontal className="w-4 h-4 text-white" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {/* User info inside dropdown */}
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-bold truncate">{user?.full_name}</p>
                {getRoleDisplayText() && (
                  <p className="text-[11px] text-primary font-semibold truncate">{getRoleDisplayText()}</p>
                )}
              </div>
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer',
                    language === lang.code && 'bg-primary/10 text-primary font-semibold'
                  )}
                >
                  <span>{lang.flag}</span>
                  <span className="text-sm">{lang.label}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {isConnected ? (
                <>
                  <DropdownMenuItem className="flex items-center gap-2 text-green-600 cursor-default">
                    <Printer className="w-4 h-4" />
                    <span className="text-sm truncate">{deviceName || 'طابعة متصلة'}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={disconnect}
                    className="flex items-center gap-2 cursor-pointer text-destructive"
                  >
                    <BluetoothOff className="w-4 h-4" />
                    <span className="text-sm">قطع الاتصال</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={scanAndConnect}
                  className="flex items-center gap-2 cursor-pointer"
                  disabled={printerStatus === 'connecting'}
                >
                  <Bluetooth className="w-4 h-4" />
                  <span className="text-sm">{printerStatus === 'connecting' ? 'جاري الاتصال...' : 'ربط الطابعة'}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {isAdminRole(role) && (
                <DropdownMenuItem
                  onClick={switchBranch}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span className="text-sm font-bold text-primary">
                    {activeBranch 
                      ? ALGERIAN_WILAYAS.find(w => w.name === activeBranch.wilaya)?.code || '∞'
                      : '∞'}
                  </span>
                  <span className="text-sm">{activeBranch ? activeBranch.name : t('branches.all_branches')}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 flex items-center gap-1">
                <button
                  onClick={() => setTheme('light')}
                  className={cn('flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors', theme === 'light' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={cn('flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors', theme === 'dark' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={cn('flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors', theme === 'system' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
              <DropdownMenuItem
                onClick={logout}
                className="flex items-center gap-2 cursor-pointer text-destructive"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">{t('auth.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y',
          isLoadStockPage ? 'pb-0' : 'pb-20'
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className={cn("fixed bottom-0 left-0 right-0 border-t border-border safe-bottom z-50", isTestBranch ? "bg-green-900" : "bg-purple-900")}>
        <div className="flex items-center justify-around py-1.5">
          {mainNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary-foreground bg-primary'
                    : isTestBranch ? 'text-white/80 hover:text-white' : 'text-secondary-foreground hover:text-primary'
                )}
                title={item.label}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            );
          })}
          
          {/* Invoice Request Button */}
          {showInvoiceButton && (
            <button
              onClick={() => setInvoiceRequestOpen(true)}
              className={cn(
                'relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
                'text-secondary-foreground hover:text-primary'
              )}
              title="طلب فاتورة"
            >
              <Receipt className="w-5 h-5" />
              {(pendingInvoiceCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {pendingInvoiceCount}
                </span>
              )}
            </button>
          )}

          {/* More Menu - Sheet Style */}
          {moreNavItems.length > 0 && (
            <>
              <button
                onClick={() => setMoreOpen(true)}
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
                  isMoreActive
                    ? 'text-primary-foreground bg-primary'
                    : 'text-secondary-foreground hover:text-primary'
                )}
                title={t('nav.more')}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {moreOpen && (
                <div className="fixed inset-0 z-[100]" onClick={() => setMoreOpen(false)}>
                  <div className="absolute inset-0 bg-black/40" />
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl max-h-[75vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                    </div>
                    <div className="px-4 pb-6 pt-2">
                      <div className="grid grid-cols-4 gap-3">
                        {moreNavItems.map((item) => {
                          const isActive = location.pathname === item.path;
                          const colors = moreItemColors[item.path] || { bg: 'bg-muted/50', icon: 'text-muted-foreground', border: 'border-border' };
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setMoreOpen(false)}
                              className={cn(
                                'flex flex-col items-center justify-center p-2.5 gap-1.5 rounded-xl border transition-all active:scale-95 hover:shadow-md',
                                isActive
                                  ? 'ring-2 ring-primary/40 shadow-md border-primary/30 bg-primary/5'
                                  : `${colors.bg} ${colors.border}`
                              )}
                            >
                              <item.icon className={cn('w-5 h-5', isActive ? 'text-primary' : colors.icon)} />
                              <span className={cn(
                                'text-[10px] font-medium text-center leading-tight',
                                isActive ? 'text-primary font-bold' : 'text-foreground'
                              )}>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Branch Selection Dialog */}
      <BranchSelectionDialog
        open={showBranchSelection}
        onSelectBranch={selectBranch}
      />
      
      {showInvoiceButton && (
        <InvoiceRequestDialog open={invoiceRequestOpen} onOpenChange={setInvoiceRequestOpen} />
      )}
    </div>
  );
};

export default MobileLayout;
