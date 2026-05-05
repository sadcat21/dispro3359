import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, FileText, ClipboardCheck, ArrowLeft, ChevronLeft, LucideIcon, PackageCheck, Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import FactoryApprovalsDialog from '@/components/stock/FactoryApprovalsDialog';

interface ApprovalCard {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  path?: string;
  onClick?: () => void;
  badge?: number;
  color: string;
}

const BranchManagerApprovals: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { activeBranch } = useAuth();
  const branchId = activeBranch?.id;
  const [factoryOpen, setFactoryOpen] = useState(false);

  const { data: counts } = useQuery({
    queryKey: ['branch-approvals-counts', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const [invoices, warehouseReviews, stockReceipts, factory] = await Promise.all([
        supabase.from('manual_invoice_requests').select('id', { count: 'exact', head: true })
          .eq('branch_id', branchId!).eq('status', 'pending_branch'),
        supabase.from('warehouse_review_items').select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('stock_receipts').select('id', { count: 'exact', head: true })
          .eq('branch_id', branchId!).in('status', ['pending_approval', 'pending_branch']),
        supabase.from('factory_orders').select('id', { count: 'exact', head: true })
          .eq('branch_id', branchId!).eq('order_type', 'sending').eq('status', 'pending_approval'),
      ]);
      return {
        invoices: invoices.count || 0,
        warehouseReviews: warehouseReviews.count || 0,
        stockReceipts: stockReceipts.count || 0,
        factory: factory.count || 0,
      };
    },
    staleTime: 30_000,
  });

  const totalPending = (counts?.invoices || 0) + (counts?.warehouseReviews || 0) + (counts?.stockReceipts || 0) + (counts?.factory || 0);

  const approvals: ApprovalCard[] = [
    {
      key: 'invoice_approvals',
      title: 'طلبات الفواتير',
      description: 'مراجعة طلبات الفواتير المرسلة من العمال قبل تحويلها للإدارة',
      icon: FileText,
      path: '/branch-invoice-approvals',
      badge: counts?.invoices,
      color: 'from-blue-500 to-sky-600',
    },
    {
      key: 'warehouse_review',
      title: t('nav.warehouse_review') || 'مراجعة فروقات المخزون',
      description: 'البت في الزيادات والنواقص بعد مراجعة مخزون العامل',
      icon: ClipboardCheck,
      path: '/warehouse-pending-reviews',
      badge: counts?.warehouseReviews,
      color: 'from-amber-500 to-orange-600',
    },
    {
      key: 'stock_receipts',
      title: 'موافقات الاستلام والتسليم',
      description: 'مراجعة وصولات استلام وتسليم البضاعة بين العمال والمخزن',
      icon: PackageCheck,
      onClick: () => setFactoryOpen(true),
      badge: counts?.stockReceipts,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      key: 'factory_approvals',
      title: 'موافقات استلام/تسليم المصنع',
      description: 'مراجعة طلبات الاستلام والتسليم من وإلى المصنع',
      icon: Truck,
      onClick: () => setFactoryOpen(true),
      badge: counts?.factory,
      color: 'from-rose-500 to-red-600',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">موافقات مدير الفرع</h1>
            <p className="text-xs text-slate-500 truncate">المهام التي تحتاج قرارك</p>
          </div>
          {totalPending > 0 && (
            <Badge className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 shrink-0">
              {totalPending}
            </Badge>
          )}
        </div>
      </div>

      {/* Cards List */}
      <div className="px-4 py-5 space-y-3 max-w-2xl mx-auto">
        {approvals.map((item) => {
          const Icon = item.icon;
          const hasBadge = !!item.badge && item.badge > 0;
          return (
            <Card
              key={item.key}
              className="cursor-pointer hover:shadow-lg active:scale-[0.99] transition-all border-slate-200 hover:border-blue-300 group overflow-hidden"
              onClick={() => item.onClick ? item.onClick() : item.path && navigate(item.path)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md shrink-0`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-700 transition-colors truncate">
                      {item.title}
                    </h3>
                    {hasBadge && (
                      <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 shrink-0">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{item.description}</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-blue-500 shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FactoryApprovalsDialog open={factoryOpen} onOpenChange={setFactoryOpen} />
    </div>
  );
};

export default BranchManagerApprovals;
