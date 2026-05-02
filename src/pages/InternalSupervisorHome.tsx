import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, Users, BarChart3, Banknote, MapPin, CalendarDays,
  Activity, UserCheck, ShoppingCart, Radar, FileSpreadsheet, UserCog,
  Navigation, LucideIcon, Warehouse, Truck, ClipboardCheck, ClipboardList,
  Wallet, FileText, Vault, Scale, Gift,
} from 'lucide-react';

interface Item {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

interface Section {
  titleKey: string;
  icon: LucideIcon;
  items: Item[];
}

const InternalSupervisorHome: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, activeBranch } = useAuth();

  const { data: kpis } = useQuery({
    queryKey: ['internal-supervisor-kpis', activeBranch?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      const workersQ = supabase
        .from('workers')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      const ordersQ = supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayIso);
      const debtsQ = supabase
        .from('customer_debts')
        .select('id', { count: 'exact', head: true })
        .gt('remaining_amount', 0);

      if (activeBranch?.id) {
        workersQ.eq('branch_id', activeBranch.id);
        ordersQ.eq('branch_id', activeBranch.id);
        debtsQ.eq('branch_id', activeBranch.id);
      }

      const [workers, orders, debts] = await Promise.all([workersQ, ordersQ, debtsQ]);
      return {
        workers: workers.count || 0,
        todayOrders: orders.count || 0,
        pendingDebts: debts.count || 0,
      };
    },
    staleTime: 60_000,
  });

  const sections: Section[] = [
    // المرحلة: التوصيل للعملاء والتحصيل
    {
      titleKey: 'internal_supervisor.section_delivery_stage',
      icon: Truck,
      items: [
        { key: 'orders', label: t('nav.orders'), icon: ShoppingCart, path: '/orders' },
        { key: 'order_tracking', label: t('nav.order_tracking'), icon: Radar, path: '/order-tracking' },
        { key: 'customers', label: t('nav.customers'), icon: UserCheck, path: '/customers' },
        { key: 'customer_journey', label: t('nav.customer_journey'), icon: Activity, path: '/customer-journey' },
        { key: 'customer_debts', label: t('debts.title'), icon: Banknote, path: '/customer-debts' },
      ],
    },
    // مراجعة المخزون والتسوية النهائية
    {
      titleKey: 'internal_supervisor.section_handover_stage',
      icon: Vault,
      items: [
        { key: 'warehouse_review', label: t('nav.warehouse_review'), icon: ClipboardCheck, path: '/warehouse-review' },
        { key: 'surplus_deficit', label: t('nav.surplus_deficit'), icon: Scale, path: '/surplus-deficit' },
      ],
    },
    // الانضباط ومتابعة الالتزام
    {
      titleKey: 'internal_supervisor.section_discipline',
      icon: ShieldCheck,
      items: [
        { key: 'worker_tracking', label: t('navigation.worker_tracking'), icon: MapPin, path: '/worker-tracking' },
        { key: 'geo_operations', label: t('nav.geo_operations'), icon: Navigation, path: '/geo-operations' },
        { key: 'activity_logs', label: t('nav.activity_logs'), icon: Activity, path: '/activity-logs' },
      ],
    },
    // الأداء العام
    {
      titleKey: 'internal_supervisor.section_performance',
      icon: BarChart3,
      items: [
        { key: 'sales_summary', label: t('admin_home.item.manager_sales_summary'), icon: BarChart3, path: '/manager-sales-summary' },
        { key: 'promo_table', label: t('nav.table'), icon: FileSpreadsheet, path: '/promo-table' },
        { key: 'promo_tracking', label: t('admin.promo_tracking'), icon: Gift, path: '/promo-tracking' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Hero — Sky/Blue distinct theme */}
      <div className="relative overflow-hidden border-b border-sky-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-50 via-white to-cyan-50/60" />
        <div className="relative px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-sky-500/30 ring-2 ring-sky-300/40">
              <ShieldCheck className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-sky-700 tracking-tight">
                {t('internal_supervisor.welcome')}
              </h1>
              <p className="text-sm text-slate-600 mt-1">{t('internal_supervisor.subtitle')}</p>
              {user?.full_name && (
                <Badge variant="outline" className="mt-2 border-sky-400/60 text-sky-700 bg-sky-50">
                  {user.full_name}
                  {activeBranch?.name && ` — ${activeBranch.name}`}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <KpiCard label={t('internal_supervisor.kpi_active_workers')} value={kpis?.workers ?? '—'} icon={Users} accent="sky" />
            <KpiCard label={t('internal_supervisor.kpi_today_orders')} value={kpis?.todayOrders ?? '—'} icon={ShoppingCart} accent="slate" />
            <KpiCard label={t('internal_supervisor.kpi_pending_debts')} value={kpis?.pendingDebts ?? '—'} icon={Banknote} accent="sky" />
            <KpiCard label={t('internal_supervisor.kpi_attendance_today')} value="—" icon={CalendarDays} accent="slate" />
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
                <SecIcon className="w-5 h-5 text-sky-600" />
                <h2 className="text-base font-semibold text-slate-800">{t(section.titleKey)}</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-sky-300/60 to-transparent" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card
                      key={item.key}
                      onClick={() => navigate(item.path)}
                      className="group cursor-pointer border-slate-200 bg-white hover:border-sky-400 hover:shadow-md hover:shadow-sky-500/10 transition-all"
                    >
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center group-hover:bg-sky-100 transition-colors">
                          <Icon className="w-6 h-6 text-sky-600 group-hover:text-sky-700" />
                        </div>
                        <p className="text-sm font-medium text-slate-800 leading-tight">{item.label}</p>
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

const KpiCard: React.FC<{ label: string; value: number | string; icon: LucideIcon; accent: 'sky' | 'slate' }> = ({ label, value, icon: Icon, accent }) => {
  const isSky = accent === 'sky';
  return (
    <Card className={`border ${isSky ? 'border-sky-300 bg-sky-50/60' : 'border-slate-200 bg-white'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={`w-5 h-5 ${isSky ? 'text-sky-600' : 'text-slate-500'}`} />
        </div>
        <p className={`text-3xl font-bold ${isSky ? 'text-sky-700' : 'text-slate-800'}`}>{value}</p>
        <p className="text-xs text-slate-600 mt-1 font-medium">{label}</p>
      </CardContent>
    </Card>
  );
};

export default InternalSupervisorHome;
