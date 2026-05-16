import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ProductShowcaseHero from '@/components/home/ProductShowcaseHero';
import managerHeroBg from '@/assets/hero-manager-bg.jpg';
import TodayCustomersDialog from '@/components/sectors/TodayCustomersDialog';
import OrderFlowDialog from '@/components/orders/OrderFlowDialog';
import CustomerPickerDialog from '@/components/orders/CustomerPickerDialog';
import SupervisorWorkerViewDialog from '@/components/supervisor/SupervisorWorkerViewDialog';
import { Customer } from '@/types/database';
import {
  ShieldCheck, UserCheck, ShoppingCart, ClipboardList, Wallet, BarChart3, Banknote,
} from 'lucide-react';

const ExternalSupervisorHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeBranch } = useAuth();
  const [dailyTasksOpen, setDailyTasksOpen] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [showWorkerViewDialog, setShowWorkerViewDialog] = useState(false);

  const { data: allCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers-for-order-picker', activeBranch?.id, activeBranch?.wilaya],
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

  const buttons = [
    { key: 'sales_summary', label: 'تجميع المبيعات', icon: BarChart3, onClick: () => setShowWorkerViewDialog(true), palette: { border: 'border-rose-300', icon: 'text-rose-500' } },
    { key: 'collect_sales', label: 'جمع المبيعات', icon: Wallet, onClick: () => navigate('/my-stock'), palette: { border: 'border-amber-300', icon: 'text-amber-500' } },
    { key: 'customers', label: 'إدارة العملاء', icon: UserCheck, onClick: () => navigate('/customers'), palette: { border: 'border-sky-300', icon: 'text-sky-500' } },
    { key: 'debts', label: 'إدارة الديون', icon: Banknote, onClick: () => navigate('/customer-debts'), palette: { border: 'border-red-300', icon: 'text-red-500' } },
  ];

  return (
    <div className="bg-slate-50 text-slate-900 pb-2">
      <ProductShowcaseHero
        bgImage={managerHeroBg}
        overlayClassName="bg-gradient-to-l from-blue-900/20 via-white/30 to-white/10"
      />

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
          <div className="flex items-stretch gap-2">
            <button
              onClick={() => setDailyTasksOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 px-3 py-2 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-sm font-bold">مهام العمال اليومية</span>
            </button>
            <button
              onClick={() => { setSelectedCustomerId(undefined); setShowCustomerPicker(true); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 px-3 py-2 text-white shadow-md shadow-emerald-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm font-bold">إنشاء طلب جديد</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-3 py-2">
        <div className="grid grid-cols-3 gap-1.5">
          {buttons.map((b) => {
            const Icon = b.icon;
            return (
              <Card
                key={b.key}
                onClick={b.onClick}
                className={`group cursor-pointer bg-white border hover:shadow-sm hover:-translate-y-0.5 transition-all relative rounded-lg ${b.palette.border}`}
              >
                <CardContent className="p-2 flex flex-col items-center justify-center text-center gap-1 min-h-[60px]">
                  <Icon className={`w-5 h-5 ${b.palette.icon}`} strokeWidth={2} />
                  <p className="text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2">
                    {b.label}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
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

      <OrderFlowDialog
        open={showCreateOrderDialog}
        onOpenChange={setShowCreateOrderDialog}
        mode="create"
        initialCustomerId={selectedCustomerId}
      />
    </div>
  );
};

export default ExternalSupervisorHome;
