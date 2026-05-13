import React, { useEffect, useState } from 'react';
import FactoryApprovalsDialog from '@/components/stock/FactoryApprovalsDialog';
import FinalReviewDialog from '@/components/warehouse/FinalReviewDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, Activity, MapPin, CalendarCheck, Gift, Eye, UserCheck,
  Route as RouteIcon, Wallet, TrendingUp, Receipt, FileText, Banknote,
  AlertTriangle, ClipboardList, ScrollText, BookOpenCheck, ShieldCheck, Truck, LucideIcon,
  Coins, HandCoins, PackageSearch, ClipboardCheck, HardHat,
} from 'lucide-react';

interface BMItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  onClick?: () => void;
  badge?: number;
}
interface BMSection {
  titleKey: string;
  icon: LucideIcon;
  items: BMItem[];
}

const BranchManagerHome: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, activeBranch } = useAuth();
  const queryClient = useQueryClient();

  const branchId = activeBranch?.id;
  const [factoryApprovalsOpen, setFactoryApprovalsOpen] = useState(false);
  const [finalReviewPickerOpen, setFinalReviewPickerOpen] = useState(false);
  const [finalReviewWorker, setFinalReviewWorker] = useState<{ id: string; name: string } | null>(null);

  const { data: deliveryWorkers = [] } = useQuery({
    queryKey: ['bm-delivery-workers', branchId],
    enabled: !!branchId && finalReviewPickerOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from('workers')
        .select('id, full_name')
        .eq('is_active', true)
        .eq('branch_id', branchId!)
        .order('full_name');
      return (data || []) as { id: string; full_name: string }[];
    },
  });

  // Realtime: تنبيه فوري عند وصول طلب فاتورة جديد للفرع
  useEffect(() => {
    if (!branchId) return;
    const channel = supabase
      .channel(`branch-invoice-requests-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manual_invoice_requests',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload: any) => {
          if (payload?.new?.status === 'pending_branch') {
            toast.info(t('branch_invoice_approvals.new_request_toast'), {
              action: {
                label: t('branch_invoice_approvals.review'),
                onClick: () => navigate('/branch-invoice-approvals'),
              },
            });
            queryClient.invalidateQueries({ queryKey: ['bm-kpis', branchId] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'manual_invoice_requests',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bm-kpis', branchId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, navigate, queryClient, t]);


  const { data: kpis } = useQuery({
    queryKey: ['bm-kpis', branchId, user?.id],
    enabled: !!branchId,
    queryFn: async () => {
      const [workers, customers, openSessions, activeDebts, pendingInvoices, pendingReceipts, pendingDeliveries] = await Promise.all([
        supabase.from('workers').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('branch_id', branchId!),
        supabase.from('customers').select('id', { count: 'exact', head: true }).or(`branch_id.eq.${branchId},branch_id.is.null`),
        supabase.from('accounting_sessions').select('id', { count: 'exact', head: true }).eq('branch_id', branchId!).eq('status', 'open'),
        supabase.from('customer_debts').select('id', { count: 'exact', head: true }).eq('branch_id', branchId!).gt('remaining_amount', 0),
        supabase.from('manual_invoice_requests').select('id', { count: 'exact', head: true }).eq('branch_id', branchId!).eq('status', 'pending_branch'),
        supabase.from('stock_receipts').select('id', { count: 'exact', head: true }).eq('branch_id', branchId!).in('status', ['pending_approval', 'pending_branch']),
        supabase.from('factory_orders').select('id', { count: 'exact', head: true }).eq('branch_id', branchId!).eq('order_type', 'sending').eq('status', 'pending_approval'),
      ]);
      return {
        workers: workers.count || 0,
        customers: customers.count || 0,
        openSessions: openSessions.count || 0,
        activeDebts: activeDebts.count || 0,
        pendingInvoices: pendingInvoices.count || 0,
        pendingStock: (pendingReceipts.count || 0) + (pendingDeliveries.count || 0),
      };
    },
    staleTime: 60_000,
  });

  const sections: BMSection[] = [
    {
      titleKey: 'branch_manager.section_workers',
      icon: Users,
      items: [
        { key: 'worker_actions', label: t('nav.worker_actions'), icon: Activity, path: '/worker-actions' },
        { key: 'worker_tracking', label: t('navigation.worker_tracking'), icon: MapPin, path: '/worker-tracking' },
        { key: 'attendance', label: t('nav.attendance'), icon: CalendarCheck, path: '/attendance' },
        { key: 'worker_rounds', label: t('branch_manager.worker_rounds'), icon: RouteIcon, path: '/worker-rounds' },
      ],
    },
    {
      titleKey: 'branch_manager.section_offers',
      icon: Gift,
      items: [
        { key: 'promo_table', label: t('nav.table'), icon: ClipboardList, path: '/promo-table' },
        { key: 'product_offers', label: t('nav.product_offers'), icon: Eye, path: '/product-offers' },
        { key: 'promo_tracking', label: t('admin.promo_tracking'), icon: Gift, path: '/promo-tracking' },
      ],
    },
    {
      titleKey: 'branch_manager.section_customers',
      icon: UserCheck,
      items: [
        { key: 'customers', label: t('nav.customers'), icon: Users, path: '/customers' },
        { key: 'customer_journey', label: t('nav.customer_journey'), icon: RouteIcon, path: '/customer-journey' },
      ],
    },
    {
      titleKey: 'branch_manager.section_approvals',
      icon: ShieldCheck,
      items: [
        { key: 'all_approvals', label: 'كل الموافقات', icon: ShieldCheck, path: '/branch-approvals', badge: (kpis?.pendingInvoices || 0) + (kpis?.pendingStock || 0) },
        { key: 'invoice_approvals', label: t('branch_invoice_approvals.title'), icon: FileText, path: '/branch-invoice-approvals', badge: kpis?.pendingInvoices },
        { key: 'final_review', label: 'المراجعة النهائية', icon: ClipboardCheck, onClick: () => setFinalReviewPickerOpen(true) },
        {
          key: 'factory_approvals',
          label: 'موافقات استلام/تسليم المصنع',
          icon: Truck,
          onClick: () => setFactoryApprovalsOpen(true),
          badge: kpis?.pendingStock,
        },
        { key: 'manager_accounting_review', label: t('admin_home.item.manager_accounting_review'), icon: BookOpenCheck, path: '/manager-accounting-review' },
      ],
    },
    {
      titleKey: 'branch_manager.section_finance',
      icon: Wallet,
      items: [
        { key: 'worker_debts', label: t('nav.worker_debts'), icon: Banknote, path: '/worker-debts' },
        { key: 'sales_summary', label: t('worker_actions.sales_summary'), icon: TrendingUp, path: '/manager-sales-summary' },
        { key: 'customer_debts', label: t('branch_manager.debts_management'), icon: Banknote, path: '/customer-debts' },
        { key: 'expenses_management', label: t('branch_manager.expenses_management'), icon: Receipt, path: '/expenses-management' },
        { key: 'shared_invoices', label: t('nav.shared_invoices'), icon: FileText, path: '/shared-invoices' },
        { key: 'cash_ledger', label: 'سجل حركة الأموال', icon: Coins, path: '/cash-ledger' },
        { key: 'debt_ledger', label: 'سجل حركة الديون', icon: HandCoins, path: '/debt-ledger' },
        { key: 'stock_movements', label: 'سجل حركة المخزون', icon: PackageSearch, path: '/stock-movements' },
        { key: 'sales_tracking', label: 'سجل تتبع المبيعات', icon: TrendingUp, path: '/sales-tracking' },
      ],
    },
    {
      titleKey: 'branch_manager.section_treasury',
      icon: Wallet,
      items: [
        { key: 'manager_treasury', label: t('nav.manager_treasury'), icon: Wallet, path: '/manager-treasury' },
        { key: 'surplus_deficit', label: t('nav.surplus_deficit'), icon: AlertTriangle, path: '/surplus-deficit' },
        { key: 'branch_expenses', label: t('branch_manager.branch_expenses'), icon: Receipt, path: '/expenses' },
      ],
    },
    {
      titleKey: 'branch_manager.section_accounting',
      icon: BookOpenCheck,
      items: [
        { key: 'accounting_sessions', label: t('worker_actions.accounting_sessions'), icon: ScrollText, path: '/accounting-sessions' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Hero Header — أزرق احترافي مع لمسة سماوية */}
      <div className="relative overflow-hidden border-b border-blue-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-sky-50/60 to-blue-50/40" />
        <div className="relative px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-2 ring-blue-300/40">
              <Building2 className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-blue-700 tracking-tight">
                {t('branch_manager.welcome')}
              </h1>
              <p className="text-sm text-slate-600 mt-1">{t('branch_manager.subtitle')}</p>
              {user?.full_name && (
                <Badge variant="outline" className="mt-2 border-blue-400/60 text-blue-700 bg-blue-50">
                  {user.full_name}
                  {activeBranch?.name && ` — ${activeBranch.name}`}
                </Badge>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            <KpiCard label={t('branch_manager.kpi_workers')} value={kpis?.workers ?? '—'} icon={Users} accent="blue" />
            <KpiCard label={t('branch_manager.kpi_customers')} value={kpis?.customers ?? '—'} icon={UserCheck} accent="slate" />
            <KpiCard label={t('branch_manager.kpi_open_sessions')} value={kpis?.openSessions ?? '—'} icon={BookOpenCheck} accent="blue" />
            <KpiCard label={t('branch_manager.kpi_active_debts')} value={kpis?.activeDebts ?? '—'} icon={Banknote} accent="slate" />
            <KpiCard
              label={t('branch_manager.kpi_pending_invoices')}
              value={kpis?.pendingInvoices ?? '—'}
              icon={ShieldCheck}
              accent={kpis?.pendingInvoices ? 'alert' : 'blue'}
              onClick={() => navigate('/branch-invoice-approvals')}
            />
          </div>

          {/* زر الموافقات البارز */}
          <button
            onClick={() => navigate('/branch-approvals')}
            className="mt-4 w-full flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 px-5 py-4 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-[1.01] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">مركز الموافقات</div>
                <div className="text-xs text-white/85">جميع الموافقات في مكان واحد</div>
              </div>
            </div>
            {((kpis?.pendingInvoices || 0) + (kpis?.pendingStock || 0)) > 0 && (
              <Badge className="bg-white text-red-600 hover:bg-white text-base font-bold px-3 py-1">
                {(kpis?.pendingInvoices || 0) + (kpis?.pendingStock || 0)}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 py-6 space-y-6">
        {sections.map((section) => {
          const SecIcon = section.icon;
          return (
            <div key={section.titleKey}>
              <div className="flex items-center gap-2 mb-3 px-2">
                <SecIcon className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-800">{t(section.titleKey)}</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-blue-300/60 to-transparent" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const showBadge = typeof item.badge === 'number' && item.badge > 0;
                  return (
                    <Card
                      key={item.key}
                      onClick={() => item.onClick ? item.onClick() : item.path && navigate(item.path)}
                      className={`group cursor-pointer bg-white hover:shadow-md transition-all relative ${
                        showBadge
                          ? 'border-red-300 ring-2 ring-red-200/60 hover:border-red-400 hover:shadow-red-500/10'
                          : 'border-slate-200 hover:border-blue-400 hover:shadow-blue-500/10'
                      }`}
                    >
                      {showBadge && (
                        <Badge className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white border-2 border-white shadow-md min-w-[18px] h-[18px] text-[10px] flex items-center justify-center px-1 animate-pulse">
                          {item.badge}
                        </Badge>
                      )}
                      <CardContent className="p-2 sm:p-3 flex flex-col items-center text-center gap-1.5">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors ${
                          showBadge ? 'bg-red-50 group-hover:bg-red-100' : 'bg-blue-50 group-hover:bg-blue-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${showBadge ? 'text-red-600' : 'text-blue-600 group-hover:text-blue-700'}`} />
                        </div>
                        <p className="text-[11px] sm:text-xs font-medium text-slate-800 leading-tight line-clamp-2">
                          {item.label}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <FactoryApprovalsDialog open={factoryApprovalsOpen} onOpenChange={setFactoryApprovalsOpen} />

      <Dialog open={finalReviewPickerOpen} onOpenChange={setFinalReviewPickerOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-600" />
              اختر عامل التوصيل للمراجعة النهائية
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
            {deliveryWorkers.length === 0 ? (
              <p className="col-span-2 text-center text-sm text-muted-foreground py-6">لا يوجد عمال نشطون</p>
            ) : deliveryWorkers.map(w => (
              <button
                key={w.id}
                onClick={() => {
                  setFinalReviewWorker({ id: w.id, name: w.full_name });
                  setFinalReviewPickerOpen(false);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 active:scale-95 transition-all"
              >
                <HardHat className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-bold text-center">{w.full_name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {finalReviewWorker && (
        <FinalReviewDialog
          open={!!finalReviewWorker}
          onOpenChange={(o) => { if (!o) setFinalReviewWorker(null); }}
          workerId={finalReviewWorker.id}
          workerName={finalReviewWorker.name}
          branchId={branchId || null}
        />
      )}
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent: 'blue' | 'slate' | 'alert';
  onClick?: () => void;
}> = ({ label, value, icon: Icon, accent, onClick }) => {
  const styles = {
    blue: { border: 'border-blue-300 bg-blue-50/60', icon: 'text-blue-600', value: 'text-blue-700' },
    slate: { border: 'border-slate-200 bg-white', icon: 'text-slate-500', value: 'text-slate-800' },
    alert: { border: 'border-red-300 bg-red-50/70 ring-2 ring-red-200/60 animate-pulse', icon: 'text-red-600', value: 'text-red-700' },
  }[accent];
  return (
    <Card
      onClick={onClick}
      className={`border ${styles.border} ${onClick ? 'cursor-pointer hover:shadow-md transition-all' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={`w-5 h-5 ${styles.icon}`} />
        </div>
        <p className={`text-3xl font-bold ${styles.value}`}>{value}</p>
        <p className="text-xs text-slate-600 mt-1 font-medium">{label}</p>
      </CardContent>
    </Card>
  );
};

export default BranchManagerHome;
