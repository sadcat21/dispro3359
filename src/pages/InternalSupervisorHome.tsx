import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ProductShowcaseHero from '@/components/home/ProductShowcaseHero';
import managerHeroBg from '@/assets/hero-manager-bg.jpg';
import TodayCustomersDialog from '@/components/sectors/TodayCustomersDialog';
import OrderFlowDialog from '@/components/orders/OrderFlowDialog';
import {
  ShieldCheck, Users, BarChart3, Banknote, MapPin, CalendarDays,
  Activity, UserCheck, ShoppingCart, Radar, FileSpreadsheet, UserCog,
  Navigation, LucideIcon, Warehouse, Truck, ClipboardCheck, ClipboardList,
  Wallet, FileText, Vault, Scale, Gift, Plus,
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

  const [dailyTasksOpen, setDailyTasksOpen] = useState(false);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);

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
        { key: 'customers', label: t('nav.customers'), icon: UserCheck, path: '/customers' },
        { key: 'customer_debts', label: t('debts.title'), icon: Banknote, path: '/customer-debts' },
      ],
    },
    // الانضباط ومتابعة الالتزام
    {
      titleKey: 'internal_supervisor.section_discipline',
      icon: ShieldCheck,
      items: [
        { key: 'worker_tracking', label: t('navigation.worker_tracking'), icon: MapPin, path: '/worker-tracking' },
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
    <div className="bg-slate-50 text-slate-900 pb-2">
      {/* Offers Showcase — blue identity (same as Branch Manager) */}
      <ProductShowcaseHero
        bgImage={managerHeroBg}
        overlayClassName="bg-gradient-to-l from-blue-900/20 via-white/30 to-white/10"
      />

      {/* Create Order button — below hero with blue identity */}
      <div className="relative overflow-hidden border-b border-blue-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-sky-50/60 to-blue-50/40" />
        <div className="relative px-3 py-1.5 space-y-1.5">
          {user?.full_name && (
            <div className="flex items-center justify-center">
              <Badge variant="outline" className="border-blue-400/60 text-blue-700 bg-blue-50 text-[10px]">
                <ShieldCheck className="w-3 h-3 ms-1" />
                {user.full_name}
                {activeBranch?.name && ` — ${activeBranch.name}`}
              </Badge>
            </div>
          )}
          <button
            onClick={() => setDailyTasksOpen(true)}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 px-4 py-2 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-base font-bold">مهام العمال اليومية</span>
          </button>
          <button
            onClick={() => setShowCreateOrderDialog(true)}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 px-4 py-2 text-white shadow-md shadow-emerald-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="text-base font-bold">إنشاء طلب جديد</span>
          </button>
        </div>
      </div>

      {/* All buttons unified — no section dividers */}
      <div className="px-2 sm:px-3 py-2">
        {(() => {
          const cardPalettes = [
            { border: 'border-rose-300', icon: 'text-rose-500' },
            { border: 'border-emerald-300', icon: 'text-emerald-500' },
            { border: 'border-amber-300', icon: 'text-amber-500' },
            { border: 'border-violet-300', icon: 'text-violet-500' },
            { border: 'border-sky-300', icon: 'text-sky-500' },
            { border: 'border-orange-300', icon: 'text-orange-500' },
            { border: 'border-teal-300', icon: 'text-teal-500' },
            { border: 'border-pink-300', icon: 'text-pink-500' },
            { border: 'border-indigo-300', icon: 'text-indigo-500' },
          ];
          const allItems = sections.flatMap(s => s.items);
          return (
            <div className="grid grid-cols-4 gap-1.5">
              {allItems.map((item, iIdx) => {
                const Icon = item.icon;
                const cp = cardPalettes[iIdx % cardPalettes.length];
                return (
                  <Card
                    key={item.key}
                    onClick={() => navigate(item.path)}
                    className={`group cursor-pointer bg-white border hover:shadow-sm hover:-translate-y-0.5 transition-all relative rounded-lg ${cp.border}`}
                  >
                    <CardContent className="p-1 flex flex-col items-center justify-center text-center gap-0.5 min-h-[48px]">
                      <Icon className={`w-4 h-4 ${cp.icon}`} strokeWidth={2} />
                      <p className="text-[10px] font-semibold text-slate-700 leading-tight line-clamp-2">
                        {item.label}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })()}
      </div>

      <TodayCustomersDialog open={dailyTasksOpen} onOpenChange={setDailyTasksOpen} />
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
