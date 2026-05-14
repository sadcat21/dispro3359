import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import OrderFlowDialog from '@/components/orders/OrderFlowDialog';
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import { Customer } from '@/types/database';
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

  // Order creation state
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const effectiveBranchId = activeBranch?.id || null;

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

  // Customers for picker
  const { data: allCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers-for-order-picker-supervisor', effectiveBranchId],
    queryFn: async () => {
      let q = supabase.from('customers').select('*').eq('status', 'active').order('name');
      if (effectiveBranchId) q = q.eq('branch_id', effectiveBranchId);
      const { data } = await q;
      return (data || []) as Customer[];
    },
    enabled: showCustomerPicker,
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
        <div className="relative px-3 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-md shadow-sky-500/30 ring-2 ring-sky-300/40 shrink-0">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-sky-700 tracking-tight truncate">
                {t('internal_supervisor.welcome')}
              </h1>
              {user?.full_name && (
                <Badge variant="outline" className="mt-1 border-sky-400/60 text-sky-700 bg-sky-50 text-[10px]">
                  {user.full_name}
                  {activeBranch?.name && ` — ${activeBranch.name}`}
                </Badge>
              )}
            </div>
          </div>

          {/* Create Order Button */}
          <Button
            onClick={() => setShowCustomerPicker(true)}
            className="w-full h-10 bg-gradient-to-r from-sky-600 via-cyan-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white gap-2 text-sm font-bold shadow-lg shadow-sky-500/30"
          >
            <Plus className="w-5 h-5" />
            {t('orders.create_new')}
          </Button>
        </div>
      </div>

      {/* Sections — same colored-container layout as Branch Manager */}
      <div className="px-2 sm:px-3 py-2 space-y-2" dir="rtl">
        {sections.filter(s => s.items.length > 0).map((section, sIdx) => {
          const SecIcon = section.icon;
          const sectionPalette = [
            { wrap: 'bg-amber-50/60 border-amber-200', title: 'text-amber-700' },
            { wrap: 'bg-emerald-50/60 border-emerald-200', title: 'text-emerald-700' },
            { wrap: 'bg-sky-50/60 border-sky-200', title: 'text-sky-700' },
            { wrap: 'bg-rose-50/60 border-rose-200', title: 'text-rose-700' },
            { wrap: 'bg-violet-50/60 border-violet-200', title: 'text-violet-700' },
            { wrap: 'bg-orange-50/60 border-orange-200', title: 'text-orange-700' },
            { wrap: 'bg-teal-50/60 border-teal-200', title: 'text-teal-700' },
          ][sIdx % 7];

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

          return (
            <div
              key={section.titleKey}
              className={`relative rounded-2xl border ${sectionPalette.wrap} p-2`}
            >
              <div className="flex items-center justify-center gap-2 mb-1.5 px-1">
                <SecIcon className={`w-4 h-4 ${sectionPalette.title}`} />
                <h2 className={`text-xs sm:text-sm font-bold ${sectionPalette.title}`}>
                  {t(section.titleKey)}
                </h2>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {section.items.map((item, iIdx) => {
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
            </div>
          );
        })}
      </div>

      {/* Customer Picker for Order Creation */}
      <CustomerPickerDialog
        open={showCustomerPicker}
        onOpenChange={setShowCustomerPicker}
        customers={allCustomers}
        isLoading={customersLoading}
        onSelect={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerPicker(false);
          setShowCreateOrder(true);
        }}
      />

      {/* Create Order Dialog */}
      <OrderFlowDialog
        open={showCreateOrder}
        onOpenChange={setShowCreateOrder}
        mode="create"
        initialCustomerId={selectedCustomer?.id}
      />
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
