import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, FileText, ClipboardCheck, Truck, Package,
  Banknote, ArrowLeft, LucideIcon,
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
  const [factoryDialogOpen, setFactoryDialogOpen] = useState(false);

  const { data: counts } = useQuery({
    queryKey: ['branch-approvals-counts', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const [invoices, warehouseReviews, stockReceipts, factoryDeliveries] = await Promise.all([
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
        factoryDeliveries: factoryDeliveries.count || 0,
        debtCollections: (debtCollections as any)?.count || 0,
      };
    },
    staleTime: 30_000,
  });

  const totalPending =
    (counts?.invoices || 0) +
    (counts?.warehouseReviews || 0) +
    (counts?.stockReceipts || 0) +
    (counts?.factoryDeliveries || 0);

  const approvals: ApprovalCard[] = [
    {
      key: 'invoice_approvals',
      title: t('branch_invoice_approvals.title') || 'الموافقة على طلبات الفواتير',
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
      path: '/warehouse-review',
      badge: counts?.warehouseReviews,
      color: 'from-amber-500 to-orange-600',
    },
    {
      key: 'factory_approvals',
      title: 'موافقات استلام/تسليم المصنع',
      description: 'الموافقة على عمليات استلام البضاعة وتسليم المرتجعات للمصنع',
      icon: Truck,
      onClick: () => setFactoryDialogOpen(true),
      badge: (counts?.stockReceipts || 0) + (counts?.factoryDeliveries || 0),
      color: 'from-emerald-500 to-teal-600',
    },
    {
      key: 'stock_receipts',
      title: t('stock.receipts') || 'إيصالات استلام المخزون',
      description: 'الاطلاع على وصولات الاستلام والمصادقة عليها',
      icon: Package,
      path: '/stock-receipts',
      badge: counts?.stockReceipts,
      color: 'from-indigo-500 to-purple-600',
    },
    {
      key: 'manager_accounting_review',
      title: t('admin_home.item.manager_accounting_review') || 'مراجعة المحاسبة',
      description: 'مراجعة جلسات محاسبة العمال والموافقة عليها',
      icon: Banknote,
      path: '/manager-accounting-review',
      color: 'from-rose-500 to-pink-600',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-blue-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-sky-50/60 to-blue-50/40" />
        <div className="relative px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-blue-700 hover:bg-blue-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-2 ring-blue-300/40">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-blue-700">موافقات مدير الفرع</h1>
              <p className="text-sm text-slate-600">جميع الموافقات المطلوبة من مدير الفرع في مكان واحد</p>
            </div>
            {totalPending > 0 && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white text-base px-3 py-1">
                {totalPending} في الانتظار
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="px-4 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {approvals.map((item) => {
          const Icon = item.icon;
          const hasBadge = !!item.badge && item.badge > 0;
          return (
            <Card
              key={item.key}
              className="cursor-pointer hover:shadow-xl transition-all border-slate-200 hover:border-blue-300 group overflow-hidden"
              onClick={() => {
                if (item.onClick) item.onClick();
                else if (item.path) navigate(item.path);
              }}
            >
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${item.color} p-5 flex items-center justify-between`}>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  {hasBadge && (
                    <Badge className="bg-white text-red-600 hover:bg-white text-sm font-bold px-2.5 py-1">
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-slate-900 text-lg mb-1 group-hover:text-blue-700 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FactoryApprovalsDialog open={factoryDialogOpen} onOpenChange={setFactoryDialogOpen} />
    </div>
  );
};

export default BranchManagerApprovals;
