import { lazy, Suspense } from "react";
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
import ScrollToTop from "@/components/ScrollToTop";
import { Loader2 } from "lucide-react";

const LoginForm = lazy(() => import("@/components/auth/LoginForm"));
const Index = lazy(() => import("./pages/Index"));
const MyPromos = lazy(() => import("./pages/MyPromos"));
const Orders = lazy(() => import("./pages/Orders"));
const MyDeliveries = lazy(() => import("./pages/MyDeliveries"));
const MyStock = lazy(() => import("./pages/MyStock"));
const Workers = lazy(() => import("./pages/admin/Workers"));
const Products = lazy(() => import("./pages/admin/Products"));
const Customers = lazy(() => import("./pages/admin/Customers"));
const DuplicateCustomers = lazy(() => import("./pages/admin/DuplicateCustomers"));
const Stats = lazy(() => import("./pages/admin/Stats"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const PromoTable = lazy(() => import("./pages/admin/PromoTable"));
const Branches = lazy(() => import("./pages/admin/Branches"));
const Permissions = lazy(() => import("./pages/admin/Permissions"));
const ActivityLogs = lazy(() => import("./pages/admin/ActivityLogs"));
const NearbyStores = lazy(() => import("./pages/admin/NearbyStores"));
const CustomerAccounts = lazy(() => import("./pages/admin/CustomerAccounts"));
const CustomerJourney = lazy(() => import("./pages/admin/CustomerJourney"));
const ProductOffers = lazy(() => import("./pages/admin/ProductOffers"));
const AvailableOffers = lazy(() => import("./pages/AvailableOffers"));
const Expenses = lazy(() => import("./pages/Expenses"));
const ExpensesManagement = lazy(() => import("./pages/admin/ExpensesManagement"));
const Guide = lazy(() => import("./pages/Guide"));
const WarehouseStock = lazy(() => import("./pages/admin/WarehouseStock"));
const WarehouseReview = lazy(() => import("./pages/admin/WarehouseReview"));
const PendingWarehouseReviews = lazy(() => import("./pages/admin/PendingWarehouseReviews"));
const StockReceipts = lazy(() => import("./pages/admin/StockReceipts"));
const StockMovementsLedger = lazy(() => import("./pages/admin/StockMovementsLedger"));
const OfferLedger = lazy(() => import("./pages/admin/OfferLedger"));
const SalesTrackingLedger = lazy(() => import("./pages/admin/SalesTrackingLedger"));
const CashLedger = lazy(() => import("./pages/admin/CashLedger"));
const DebtLedger = lazy(() => import("./pages/admin/DebtLedger"));
const LoadStock = lazy(() => import("./pages/admin/LoadStock"));
const CustomerDebts = lazy(() => import("./pages/admin/CustomerDebts"));
const AccountingSessions = lazy(() => import("./pages/admin/AccountingSessions"));
const WorkerDebts = lazy(() => import("./pages/admin/WorkerDebts"));
const WorkerTracking = lazy(() => import("./pages/admin/WorkerTracking"));
const GeoOperations = lazy(() => import("./pages/admin/GeoOperations"));
const WorkerActions = lazy(() => import("./pages/admin/WorkerActions"));
const DailyReceipts = lazy(() => import("./pages/admin/DailyReceipts"));
const ManagerTreasury = lazy(() => import("./pages/admin/ManagerTreasury"));
const WorkerLiability = lazy(() => import("./pages/admin/WorkerLiability"));
const ShareTarget = lazy(() => import("./pages/ShareTarget"));
const SharedInvoices = lazy(() => import("./pages/admin/SharedInvoices"));
const AssistantApprovals = lazy(() => import("./pages/admin/AssistantApprovals"));
const Suppliers = lazy(() => import("./pages/admin/Suppliers"));
const BranchInvoiceApprovals = lazy(() => import("./pages/admin/BranchInvoiceApprovals"));
const BranchManagerApprovals = lazy(() => import("./pages/admin/BranchManagerApprovals"));
const SurplusDeficitTreasury = lazy(() => import("./pages/admin/SurplusDeficitTreasury"));
const Rewards = lazy(() => import("./pages/admin/Rewards"));
const Targets = lazy(() => import("./pages/admin/Targets"));
const TargetsLeaderboardPage = lazy(() => import("./pages/admin/TargetsLeaderboardPage"));
const WorkerRewards = lazy(() => import("./pages/WorkerRewards"));
const MyAchievements = lazy(() => import("./pages/MyAchievements"));
const PromoSplits = lazy(() => import("./pages/admin/PromoSplits"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Landing = lazy(() => import("./pages/Landing"));
const ProductJourney = lazy(() => import("./pages/ProductJourney"));
const Chat = lazy(() => import("./pages/Chat"));
const Attendance = lazy(() => import("./pages/admin/Attendance"));
const OrderTracking = lazy(() => import("./pages/admin/OrderTracking"));
const OrderModificationsLog = lazy(() => import("./pages/admin/OrderModificationsLog"));
const Training = lazy(() => import("./pages/admin/Training"));
const ComponentsReference = lazy(() => import("./pages/admin/ComponentsReference"));
const BackupRestore = lazy(() => import("./pages/admin/BackupRestore"));
const ManagerSalesSummaryPage = lazy(() => import("./pages/admin/ManagerSalesSummaryPage"));
const PromoTracking = lazy(() => import("./pages/admin/PromoTracking"));
const ManagerAccountingReview = lazy(() => import("./pages/admin/ManagerAccountingReview"));
const WorkerRounds = lazy(() => import("./pages/admin/WorkerRounds"));
const WorkerRolesManagement = lazy(() => import("./pages/admin/WorkerRolesManagement"));
const AssistantPermissionsControl = lazy(() => import("./pages/admin/AssistantPermissionsControl"));

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

      <Route path="/duplicate-customers" element={
        <ProtectedRoute adminOnly>
          <DuplicateCustomers />
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

      <Route path="/sales-tracking" element={
        <ProtectedRoute allowedRoles={['admin', 'branch_admin']} allowedCustomRoles={['warehouse_manager', 'company_manager', 'accountant']}>
          <SalesTrackingLedger />
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

      <Route path="/accounting-sessions" element={
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
