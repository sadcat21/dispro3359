import React, { useState } from 'react';
import ProductShowcaseHero from '@/components/home/ProductShowcaseHero';
import managerHeroBg from '@/assets/hero-manager-bg.jpg';
import TodayCustomersDialog from '@/components/sectors/TodayCustomersDialog';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, Activity, MapPin, Gift, UserCheck, ShieldCheck, FileText, Truck,
  ClipboardList, Trophy, Target, Receipt, LucideIcon,
} from 'lucide-react';

interface AMItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  onClick?: () => void;
  badge?: number;
}
interface AMSection {
  titleKey: string;
  icon: LucideIcon;
  items: AMItem[];
}

const AssistantManagerHome: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { activeBranch } = useAuth();

  const branchId = activeBranch?.id;
  const [dailyTasksOpen, setDailyTasksOpen] = useState(false);

  const { data: pendingCounts } = useQuery({
    queryKey: ['am-pending-counts', branchId],
    queryFn: async () => {
      const [receipts, invoices] = await Promise.all([
        (() => {
          let q = supabase.from('stock_receipts').select('id', { count: 'exact', head: true }).eq('status', 'pending_assistant');
          if (branchId) q = q.eq('branch_id', branchId);
          return q;
        })(),
        (() => {
          let q = supabase.from('manual_invoice_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending_assistant');
          if (branchId) q = q.eq('branch_id', branchId);
          return q;
        })(),
      ]);
      return {
        receipts: receipts.count || 0,
        invoices: invoices.count || 0,
        total: (receipts.count || 0) + (invoices.count || 0),
      };
    },
    refetchInterval: 30_000,
  });

  const sections: AMSection[] = [
    {
      titleKey: 'assistant_approvals.title',
      icon: ShieldCheck,
      items: [
        { key: 'approvals', label: t('assistant_approvals.title') || 'الموافقات', icon: ShieldCheck, path: '/assistant-approvals', badge: pendingCounts?.total },
        { key: 'factory_in', label: t('assistant_approvals.tab_factory_in') || 'استلامات المصنع', icon: Truck, path: '/assistant-approvals?tab=factory_in', badge: pendingCounts?.receipts },
        { key: 'invoices', label: t('assistant_approvals.tab_invoices') || 'طلبات الفواتير', icon: FileText, path: '/assistant-approvals?tab=invoices', badge: pendingCounts?.invoices },
        { key: 'sector', label: t('assistant_approvals.tab_sector') || 'تعويض السكتورات', icon: Users, path: '/assistant-approvals?tab=sector' },
      ],
    },
    {
      titleKey: 'branch_manager.section_workers',
      icon: Users,
      items: [
        { key: 'worker_actions', label: t('nav.worker_actions') || 'إجراءات العمال', icon: Activity, path: '/worker-actions' },
        { key: 'worker_tracking', label: t('navigation.worker_tracking') || 'تتبع العمال', icon: MapPin, path: '/worker-tracking' },
        { key: 'promo_tracking', label: t('admin.promo_tracking') || 'متابعة العروض', icon: Gift, path: '/promo-tracking' },
        { key: 'today_customers', label: t('worker.today_customers') || 'عملاء اليوم', icon: ClipboardList, onClick: () => setDailyTasksOpen(true) },
      ],
    },
    {
      titleKey: 'branch_manager.section_customers',
      icon: UserCheck,
      items: [
        { key: 'customers', label: t('nav.customers') || 'العملاء', icon: Users, path: '/customers' },
        { key: 'targets', label: t('nav.targets') || 'الأهداف', icon: Target, path: '/targets' },
        { key: 'leaderboard', label: t('nav.targets_leaderboard') || 'ترتيب الأهداف', icon: Trophy, path: '/targets-leaderboard' },
        { key: 'expenses', label: t('expenses.my_expenses') || 'المصاريف', icon: Receipt, path: '/expenses' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-2">
      {/* Offers Showcase — same blue identity as branch manager */}
      <ProductShowcaseHero
        bgImage={managerHeroBg}
        overlayClassName="bg-gradient-to-l from-blue-900/20 via-white/30 to-white/10"
      />

      {/* Daily worker tasks button — below hero */}
      <div className="relative overflow-hidden border-b border-blue-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-sky-50/60 to-blue-50/40" />
        <div className="relative px-3 py-1.5">
          <button
            onClick={() => setDailyTasksOpen(true)}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 px-4 py-2 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-base font-bold">مهام العمال اليومية</span>
          </button>
        </div>
      </div>

      {/* Sections — same structure as BranchManagerHome */}
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
                  const showBadge = typeof item.badge === 'number' && item.badge > 0;
                  const cp = cardPalettes[iIdx % cardPalettes.length];
                  return (
                    <Card
                      key={item.key}
                      onClick={() => item.onClick ? item.onClick() : item.path && navigate(item.path)}
                      className={`group cursor-pointer bg-white border hover:shadow-sm hover:-translate-y-0.5 transition-all relative rounded-lg ${
                        showBadge
                          ? 'border-red-400 ring-1 ring-red-200/60'
                          : cp.border
                      }`}
                    >
                      {showBadge && (
                        <Badge className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white border border-white shadow min-w-[16px] h-[16px] text-[9px] flex items-center justify-center px-1 animate-pulse z-10">
                          {item.badge}
                        </Badge>
                      )}
                      <CardContent className="p-1 flex flex-col items-center justify-center text-center gap-0.5 min-h-[48px]">
                        <Icon className={`w-4 h-4 ${showBadge ? 'text-red-600' : cp.icon}`} strokeWidth={2} />
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

      <TodayCustomersDialog open={dailyTasksOpen} onOpenChange={setDailyTasksOpen} />
    </div>
  );
};

export default AssistantManagerHome;
