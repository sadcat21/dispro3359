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
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import SupervisorWorkerViewDialog from '@/components/supervisor/SupervisorWorkerViewDialog';
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

  const [dailyTasksOpen, setDailyTasksOpen] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [showWorkerViewDialog, setShowWorkerViewDialog] = useState(false);

  const { data: allCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers-for-order-picker-internal', activeBranch?.id, activeBranch?.wilaya],
    queryFn: async () => {
      let query = supabase.from('customers').select('*').order('name');
      if (activeBranch?.id) query = query.or(`branch_id.eq.${activeBranch.id},branch_id.is.null`);
      if (activeBranch?.wilaya) query = query.or(`wilaya.eq."${activeBranch.wilaya}",wilaya.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      const seen = new Set<string>();
      return (data as Customer[]).filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    },
    enabled: showCustomerPicker,
  });

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
    {
      titleKey: 'internal_supervisor.section_delivery_stage',
      icon: Truck,
      items: [
        { key: 'customers', label: t('nav.customers'), icon: UserCheck, path: '/customers' },
        { key: 'customer_debts', label: t('debts.title'), icon: Banknote, path: '/customer-debts' },
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
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setDailyTasksOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 px-3 py-2 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm font-bold">مهام العمال</span>
            </button>
            <button
              onClick={() => { setSelectedCustomerId(undefined); setShowCustomerPicker(true); }}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 px-3 py-2 text-white shadow-md shadow-emerald-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-bold">إنشاء طلبية</span>
            </button>
            <button
              onClick={() => setShowWorkerViewDialog(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 px-3 py-2 text-white shadow-md shadow-rose-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-bold">إجراءات العمال</span>
            </button>
          </div>
        </div>
      </div>

      {/* Client action buttons — gradient style matching top row */}
      <div className="px-3 py-2">
        {(() => {
          const gradients: Record<string, string> = {
            customers: 'from-fuchsia-600 via-purple-600 to-fuchsia-700 shadow-fuchsia-500/30',
            customer_debts: 'from-orange-600 via-amber-600 to-orange-700 shadow-orange-500/30',
          };
          const fallback = 'from-slate-600 via-slate-700 to-slate-800 shadow-slate-500/30';
          const allItems = sections.flatMap(s => s.items);
          return (
            <div className="grid grid-cols-2 gap-2">
              {allItems.map((item) => {
                const Icon = item.icon;
                const grad = gradients[item.key] || fallback;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      if (item.key === 'sales_summary') setShowWorkerViewDialog(true);
                      else navigate(item.path);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${grad} px-3 py-2.5 text-white shadow-md hover:shadow-lg hover:scale-[1.01] transition-all`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-bold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      <TodayCustomersDialog open={dailyTasksOpen} onOpenChange={setDailyTasksOpen} />
      <CustomerPickerDialog
        open={showCustomerPicker}
        onOpenChange={setShowCustomerPicker}
        customers={allCustomers}
        isLoading={customersLoading}
        onSelect={(customer) => {
          setSelectedCustomerId(customer.id);
          setShowCustomerPicker(false);
          setShowCreateOrderDialog(true);
        }}
      />
      <OrderFlowDialog open={showCreateOrderDialog} onOpenChange={setShowCreateOrderDialog} mode="create" initialCustomerId={selectedCustomerId} />
      <SupervisorWorkerViewDialog open={showWorkerViewDialog} onOpenChange={setShowWorkerViewDialog} />
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
