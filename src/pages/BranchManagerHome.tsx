import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, Activity, MapPin, CalendarCheck, Gift, Eye, UserCheck,
  Route as RouteIcon, Wallet, TrendingUp, Receipt, FileText, Banknote,
  AlertTriangle, ClipboardList, ScrollText, BookOpenCheck, ShieldCheck, LucideIcon,
} from 'lucide-react';

interface BMItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
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

  const branchId = activeBranch?.id;

  const { data: kpis } = useQuery({
    queryKey: ['bm-kpis', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const [workers, customers, openSessions, activeDebts] = await Promise.all([
        supabase.from('workers').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('branch_id', branchId!),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId!),
        supabase.from('accounting_sessions').select('id', { count: 'exact', head: true }).eq('branch_id', branchId!).eq('status', 'open'),
        supabase.from('customer_debts').select('id', { count: 'exact', head: true }).eq('branch_id', branchId!).gt('remaining_amount', 0),
      ]);
      return {
        workers: workers.count || 0,
        customers: customers.count || 0,
        openSessions: openSessions.count || 0,
        activeDebts: activeDebts.count || 0,
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
      titleKey: 'branch_manager.section_finance',
      icon: Wallet,
      items: [
        { key: 'worker_debts', label: t('nav.worker_debts'), icon: Banknote, path: '/worker-debts' },
        { key: 'sales_summary', label: t('worker_actions.sales_summary'), icon: TrendingUp, path: '/manager-sales-summary' },
        { key: 'customer_debts', label: t('branch_manager.debts_management'), icon: Banknote, path: '/customer-debts' },
        { key: 'expenses_management', label: t('branch_manager.expenses_management'), icon: Receipt, path: '/expenses-management' },
        { key: 'shared_invoices', label: t('nav.shared_invoices'), icon: FileText, path: '/shared-invoices' },
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
        { key: 'manager_accounting_review', label: t('admin_home.item.manager_accounting_review'), icon: BookOpenCheck, path: '/manager-accounting-review' },
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <KpiCard label={t('branch_manager.kpi_workers')} value={kpis?.workers ?? '—'} icon={Users} accent="blue" />
            <KpiCard label={t('branch_manager.kpi_customers')} value={kpis?.customers ?? '—'} icon={UserCheck} accent="slate" />
            <KpiCard label={t('branch_manager.kpi_open_sessions')} value={kpis?.openSessions ?? '—'} icon={BookOpenCheck} accent="blue" />
            <KpiCard label={t('branch_manager.kpi_active_debts')} value={kpis?.activeDebts ?? '—'} icon={Banknote} accent="slate" />
          </div>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card
                      key={item.key}
                      onClick={() => navigate(item.path)}
                      className="group cursor-pointer border-slate-200 bg-white hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/10 transition-all"
                    >
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                          <Icon className="w-6 h-6 text-blue-600 group-hover:text-blue-700" />
                        </div>
                        <p className="text-sm font-medium text-slate-800 leading-tight">
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
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: number | string; icon: LucideIcon; accent: 'blue' | 'slate' }> = ({ label, value, icon: Icon, accent }) => {
  const isBlue = accent === 'blue';
  return (
    <Card className={`border ${isBlue ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={`w-5 h-5 ${isBlue ? 'text-blue-600' : 'text-slate-500'}`} />
        </div>
        <p className={`text-3xl font-bold ${isBlue ? 'text-blue-700' : 'text-slate-800'}`}>{value}</p>
        <p className="text-xs text-slate-600 mt-1 font-medium">{label}</p>
      </CardContent>
    </Card>
  );
};

export default BranchManagerHome;
