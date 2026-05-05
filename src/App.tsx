import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { isAdminRole, isCompanyManagerRole, isInternalSupervisorRole } from "@/lib/utils";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FontSizeProvider } from "@/contexts/FontSizeContext";
import { UIThemeProvider } from "@/contexts/UIThemeContext";
import { SelectedWorkerProvider } from "@/contexts/SelectedWorkerContext";
import { InvoiceFilterProvider } from "@/contexts/InvoiceFilterContext";
import MobileLayout from "@/components/layout/MobileLayout";
import GpsGuard from "@/components/auth/GpsGuard";
import VersionGuard from "@/components/VersionGuard";
import LoginForm from "@/components/auth/LoginForm";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import MyPromos from "./pages/MyPromos";
import Orders from "./pages/Orders";
import MyDeliveries from "./pages/MyDeliveries";
import MyStock from "./pages/MyStock";
import Workers from "./pages/admin/Workers";
import Products from "./pages/admin/Products";
import Customers from "./pages/admin/Customers";
import Stats from "./pages/admin/Stats";
import Settings from "./pages/admin/Settings";
import PromoTable from "./pages/admin/PromoTable";
import Branches from "./pages/admin/Branches";
import Permissions from "./pages/admin/Permissions";
import ActivityLogs from "./pages/admin/ActivityLogs";
import NearbyStores from "./pages/admin/NearbyStores";
import CustomerAccounts from "./pages/admin/CustomerAccounts";
import CustomerJourney from "./pages/admin/CustomerJourney";
import ProductOffers from "./pages/admin/ProductOffers";
import AvailableOffers from "./pages/AvailableOffers";
import Expenses from "./pages/Expenses";
import ExpensesManagement from "./pages/admin/ExpensesManagement";
import Guide from "./pages/Guide";
import WarehouseStock from "./pages/admin/WarehouseStock";
import WarehouseReview from "./pages/admin/WarehouseReview";
import PendingWarehouseReviews from "./pages/admin/PendingWarehouseReviews";
import StockReceipts from "./pages/admin/StockReceipts";
import StockMovementsLedger from "./pages/admin/StockMovementsLedger";
import OfferLedger from "./pages/admin/OfferLedger";
import CashLedger from "./pages/admin/CashLedger";
import DebtLedger from "./pages/admin/DebtLedger";
import LoadStock from "./pages/admin/LoadStock";
import CustomerDebts from "./pages/admin/CustomerDebts";
import AccountingSessions from "./pages/admin/AccountingSessions";
import WorkerDebts from "./pages/admin/WorkerDebts";
import WorkerTracking from "./pages/admin/WorkerTracking";
import GeoOperations from "./pages/admin/GeoOperations";
import WorkerActions from "./pages/admin/WorkerActions";
import DailyReceipts from "./pages/admin/DailyReceipts";
import ManagerTreasury from "./pages/admin/ManagerTreasury";
import WorkerLiability from "./pages/admin/WorkerLiability";
import ShareTarget from "./pages/ShareTarget";
import SharedInvoices from "./pages/admin/SharedInvoices";
import AssistantApprovals from "./pages/admin/AssistantApprovals";
import Suppliers from "./pages/admin/Suppliers";
import BranchInvoiceApprovals from "./pages/admin/BranchInvoiceApprovals";
import BranchManagerApprovals from "./pages/admin/BranchManagerApprovals";
import SurplusDeficitTreasury from "./pages/admin/SurplusDeficitTreasury";
import Rewards from "./pages/admin/Rewards";
import Targets from "./pages/admin/Targets";
import TargetsLeaderboardPage from "./pages/admin/TargetsLeaderboardPage";
import WorkerRewards from "./pages/WorkerRewards";
import MyAchievements from "./pages/MyAchievements";
import PromoSplits from "./pages/admin/PromoSplits";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import ProductJourney from "./pages/ProductJourney";
import Chat from "./pages/Chat";
import Attendance from "./pages/admin/Attendance";
import OrderTracking from "./pages/admin/OrderTracking";
import OrderModificationsLog from "./pages/admin/OrderModificationsLog";
import Training from "./pages/admin/Training";
import ComponentsReference from "./pages/admin/ComponentsReference";
import BackupRestore from "./pages/admin/BackupRestore";
import ManagerSalesSummaryPage from "./pages/admin/ManagerSalesSummaryPage";
import PromoTracking from "./pages/admin/PromoTracking";
import ManagerAccountingReview from "./pages/admin/ManagerAccountingReview";
import WorkerRounds from "./pages/admin/WorkerRounds";
import WorkerRolesManagement from "./pages/admin/WorkerRolesManagement";
import AssistantPermissionsControl from "./pages/admin/AssistantPermissionsControl";
import FloatingChat from "./components/chat/FloatingChat";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // 2 minutes – avoid refetching on every mount
      gcTime: 10 * 60 * 1000,     // 10 minutes cache
      refetchOnWindowFocus: false, // prevent refetch on tab switch
      retry: 1,
    },
  },
});

const INTERNAL_SUPERVISOR_ALLOWED_PATHS = new Set([
  '/',
  '/attendance',
  '/worker-tracking',
  '/order-tracking',
  '/warehouse-review',
  '/load-stock',
  '/stock-receipts',
  '/orders',
  '/customers',
  '/customer-accounts',
  '/customer-journey',
  '/customer-debts',
  '/worker-liability',
  '/daily-receipts',
  '/manager-treasury',
  '/surplus-deficit',
  '/manager-sales-summary',
  '/stats',
  '/promo-table',
  '/workers',
  '/geo-operations',
  '/activity-logs',
  '/guide',
]);

// Protected Route Component
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode;
  adminOnly?: boolean;
  allowedRoles?: string[];
  allowedCustomRoles?: string[];
}> = ({ children, adminOnly = false, allowedRoles, allowedCustomRoles }) => {
  const { isAuthenticated, isLoading, role, activeRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const customCode = activeRole?.custom_role_code;
  // مساعد المدير العام له صلاحيات إدارية كاملة على جميع المسارات
  const isCompanyManager = isCompanyManagerRole(customCode);
  const isInternalSupervisorAllowed =
    isInternalSupervisorRole(customCode) && INTERNAL_SUPERVISOR_ALLOWED_PATHS.has(location.pathname);

  if (isInternalSupervisorAllowed) {
    return <GpsGuard><MobileLayout>{children}</MobileLayout></GpsGuard>;
  }

  // Check for specific allowed roles (includes custom role codes)
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const hasCustomAccess = allowedCustomRoles && customCode && allowedCustomRoles.includes(customCode);
    if (!hasCustomAccess && !isCompanyManager) {
      return <Navigate to="/" replace />;
    }
  }

  // Legacy adminOnly check - uses isAdminRole to include admin, branch_admin, project_manager
  if (adminOnly && !isAdminRole(role) && !isCompanyManager) {
    return <Navigate to="/" replace />;
  }

  return <GpsGuard><MobileLayout>{children}</MobileLayout></GpsGuard>;
};

// Public Route (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginForm />
        </PublicRoute>
      } />

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Index />
        </ProtectedRoute>
      } />

      <Route path="/my-promos" element={
        <ProtectedRoute>
          <MyPromos />
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/workers" element={
        <ProtectedRoute adminOnly>
          <Workers />
        </ProtectedRoute>
      } />

      <Route path="/targets" element={
        <ProtectedRoute allowedRoles={['admin', 'admin_assistant', 'company_manager', 'branch_admin']}>
          <Targets />
        </ProtectedRoute>
      } />

      <Route path="/targets-leaderboard" element={
        <ProtectedRoute allowedRoles={['admin', 'admin_assistant', 'company_manager', 'branch_admin']}>
          <TargetsLeaderboardPage />
        </ProtectedRoute>
      } />

      <Route path="/products" element={
        <ProtectedRoute adminOnly>
          <Products />
        </ProtectedRoute>
      } />

      <Route path="/customers" element={
        <ProtectedRoute>
          <Customers />
        </ProtectedRoute>
      } />

      <Route path="/stats" element={
        <ProtectedRoute adminOnly>
          <Stats />
        </ProtectedRoute>
      } />

      <Route path="/promo-table" element={
        <ProtectedRoute adminOnly>
          <PromoTable />
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute adminOnly>
          <Settings />
        </ProtectedRoute>
      } />

      <Route path="/branches" element={
        <ProtectedRoute allowedRoles={['admin', 'project_manager']}>
          <Branches />
        </ProtectedRoute>
      } />

      <Route path="/permissions" element={
        <ProtectedRoute allowedRoles={['admin', 'project_manager']}>
          <Permissions />
        </ProtectedRoute>
      } />

      <Route path="/worker-roles-management" element={
        <ProtectedRoute allowedRoles={['admin', 'project_manager']}>
          <WorkerRolesManagement />
        </ProtectedRoute>
      } />

      <Route path="/assistant-permissions-control" element={
        <ProtectedRoute allowedRoles={['admin', 'project_manager']}>
          <AssistantPermissionsControl />
        </ProtectedRoute>
      } />

      <Route path="/activity-logs" element={
        <ProtectedRoute adminOnly>
          <ActivityLogs />
        </ProtectedRoute>
      } />

      <Route path="/nearby-stores" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin', 'supervisor']}>
          <NearbyStores />
        </ProtectedRoute>
      } />

      <Route path="/customer-accounts" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <CustomerAccounts />
        </ProtectedRoute>
      } />

      <Route path="/customer-journey" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin', 'project_manager']}>
          <CustomerJourney />
        </ProtectedRoute>
      } />

      <Route path="/orders" element={
        <ProtectedRoute>
          <Orders />
        </ProtectedRoute>
      } />

      <Route path="/my-deliveries" element={
        <ProtectedRoute>
          <MyDeliveries />
        </ProtectedRoute>
      } />

      <Route path="/my-stock" element={
        <ProtectedRoute>
          <MyStock />
        </ProtectedRoute>
      } />

      <Route path="/guide" element={
        <ProtectedRoute>
          <Guide />
        </ProtectedRoute>
      } />

      <Route path="/product-offers" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <ProductOffers />
        </ProtectedRoute>
      } />

      <Route path="/available-offers" element={
        <ProtectedRoute>
          <AvailableOffers />
        </ProtectedRoute>
      } />

      <Route path="/expenses" element={
        <ProtectedRoute>
          <Expenses />
        </ProtectedRoute>
      } />

      <Route path="/expenses-management" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <ExpensesManagement />
        </ProtectedRoute>
      } />

      <Route path="/warehouse" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']} allowedCustomRoles={['warehouse_manager']}>
          <WarehouseStock />
        </ProtectedRoute>
      } />

      <Route path="/warehouse-review" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']} allowedCustomRoles={['warehouse_manager']}>
          <WarehouseReview />
        </ProtectedRoute>
      } />

      <Route path="/warehouse-pending-reviews" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']} allowedCustomRoles={['warehouse_manager']}>
          <PendingWarehouseReviews />
        </ProtectedRoute>
      } />

      <Route path="/stock-receipts" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <StockReceipts />
        </ProtectedRoute>
      } />

      <Route path="/stock-movements" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']} allowedCustomRoles={['warehouse_manager', 'company_manager']}>
          <StockMovementsLedger />
        </ProtectedRoute>
      } />

      <Route path="/offer-ledger" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']} allowedCustomRoles={['warehouse_manager', 'company_manager']}>
          <OfferLedger />
        </ProtectedRoute>
      } />

      <Route path="/cash-ledger" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']} allowedCustomRoles={['company_manager', 'accountant', 'warehouse_manager']}>
          <CashLedger />
        </ProtectedRoute>
      } />

      <Route path="/debt-ledger" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']} allowedCustomRoles={['company_manager', 'accountant']}>
          <DebtLedger />
        </ProtectedRoute>
      } />

      <Route path="/load-stock" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin', 'supervisor']} allowedCustomRoles={['warehouse_manager']}>
          <LoadStock />
        </ProtectedRoute>
      } />

      <Route path="/customer-debts" element={
        <ProtectedRoute>
          <CustomerDebts />
        </ProtectedRoute>
      } />

      <Route path="/accounting" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <AccountingSessions />
        </ProtectedRoute>
      } />

      <Route path="/worker-debts" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <WorkerDebts />
        </ProtectedRoute>
      } />

      <Route path="/worker-tracking" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <WorkerTracking />
        </ProtectedRoute>
      } />

      <Route path="/worker-actions" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin', 'supervisor', 'worker', 'admin_assistant', 'company_manager', 'project_manager']}>
          <WorkerActions />
        </ProtectedRoute>
      } />


      <Route path="/geo-operations" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <GeoOperations />
        </ProtectedRoute>
      } />

      <Route path="/daily-receipts" element={
        <ProtectedRoute>
          <DailyReceipts />
        </ProtectedRoute>
      } />

      <Route path="/manager-treasury" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <ManagerTreasury />
        </ProtectedRoute>
      } />

      <Route path="/worker-liability" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <WorkerLiability />
        </ProtectedRoute>
      } />

      <Route path="/manager-accounting-review" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <ManagerAccountingReview />
        </ProtectedRoute>
      } />

      <Route path="/shared-invoices" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <SharedInvoices />
        </ProtectedRoute>
      } />

      <Route path="/assistant-approvals" element={
        <ProtectedRoute allowedRoles={['admin']} allowedCustomRoles={['company_manager']}>
          <AssistantApprovals />
        </ProtectedRoute>
      } />

      <Route path="/suppliers" element={
        <ProtectedRoute allowedRoles={['admin']} allowedCustomRoles={['company_manager']}>
          <Suppliers />
        </ProtectedRoute>
      } />

      <Route path="/branch-invoice-approvals" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <BranchInvoiceApprovals />
        </ProtectedRoute>
      } />

      <Route path="/branch-approvals" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <BranchManagerApprovals />
        </ProtectedRoute>
      } />

      <Route path="/surplus-deficit" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <SurplusDeficitTreasury />
        </ProtectedRoute>
      } />

      <Route path="/rewards" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <Rewards />
        </ProtectedRoute>
      } />

      <Route path="/my-rewards" element={
        <ProtectedRoute>
          <WorkerRewards />
        </ProtectedRoute>
      } />

      <Route path="/my-achievements" element={
        <ProtectedRoute>
          <MyAchievements />
        </ProtectedRoute>
      } />

      {/* Attendance */}
      <Route path="/attendance" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <Attendance />
        </ProtectedRoute>
      } />

      {/* Promo Splits */}
      <Route path="/promo-splits" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <PromoSplits />
        </ProtectedRoute>
      } />

      {/* Order Tracking */}
      <Route path="/order-tracking" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <OrderTracking />
        </ProtectedRoute>
      } />

      {/* Order Modifications Log */}
      <Route path="/order-modifications" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']}>
          <OrderModificationsLog />
        </ProtectedRoute>
      } />

      <Route path="/manager-sales-summary" element={
        <ProtectedRoute adminOnly>
          <ManagerSalesSummaryPage />
        </ProtectedRoute>
      } />

      <Route path="/worker-rounds" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin', 'supervisor']} allowedCustomRoles={['warehouse_manager']}>
          <WorkerRounds />
        </ProtectedRoute>
      } />

      {/* Worker Order Tracking */}
      <Route path="/my-order-tracking" element={
        <ProtectedRoute allowedRoles={['worker']}>
          <OrderTracking workerMode />
        </ProtectedRoute>
      } />


      <Route path="/components-reference" element={
        <ProtectedRoute adminOnly>
          <ComponentsReference />
        </ProtectedRoute>
      } />

      <Route path="/training" element={
        <ProtectedRoute adminOnly>
          <Training />
        </ProtectedRoute>
      } />

      <Route path="/backup" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <BackupRestore />
        </ProtectedRoute>
      } />

      <Route path="/chat" element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      } />

      <Route path="/promo-tracking" element={
        <ProtectedRoute allowedRoles={['admin', 'project_manager', 'branch_admin', 'admin_assistant', 'supervisor']} allowedCustomRoles={['internal_supervisor', 'company_manager']}>
          <PromoTracking />
        </ProtectedRoute>
      } />

      {/* Landing Page */}
      <Route path="/landing" element={<Landing />} />
      <Route path="/product-journey" element={<ProductJourney />} />

      {/* Share Target */}
      <Route path="/share" element={<ShareTarget />} />

      {/* 404 */}
      <Route path="/tracking" element={<Navigate to="/promo-tracking" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" storageKey="laser_food_theme">
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <FontSizeProvider>
          <UIThemeProvider>
          <TooltipProvider>
            <VersionGuard>
              <AuthProvider>
                <InvoiceFilterProvider>
                  <SelectedWorkerProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <ScrollToTop />
                      <AppRoutes />
                    </BrowserRouter>
                  </SelectedWorkerProvider>
                </InvoiceFilterProvider>
              </AuthProvider>
            </VersionGuard>
          </TooltipProvider>
          </UIThemeProvider>
        </FontSizeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
