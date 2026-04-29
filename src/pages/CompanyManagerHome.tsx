import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Crown, ShieldCheck, Split, FileText, BarChart3, Warehouse, Truck, ClipboardCheck,
  Package, Gift, Users, Building2, Settings, Database, Shield, FileSpreadsheet,
  TrendingUp, Wallet, Banknote, Pencil, LucideIcon
} from 'lucide-react';
import ManualPromoEntryDialog from '@/components/offers/ManualPromoEntryDialog';
import FactoryReceiptQuickDialog from '@/components/stock/FactoryReceiptQuickDialog';
import FactoryDeliveryQuickDialog from '@/components/stock/FactoryDeliveryQuickDialog';
import InvoiceRequestDialog from '@/components/treasury/InvoiceRequestDialog';

interface ExecItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  action?: () => void;
}

interface ExecSection {
  titleKey: string;
  icon: LucideIcon;
  items: ExecItem[];
}

const CompanyManagerHome: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, activeBranch } = useAuth();

  const [manualPromoOpen, setManualPromoOpen] = useState(false);
  const [factoryReceiptOpen, setFactoryReceiptOpen] = useState(false);
  const [factoryDeliveryOpen, setFactoryDeliveryOpen] = useState(false);
  const [invoiceRequestOpen, setInvoiceRequestOpen] = useState(false);

  // KPIs
  const { data: kpis } = useQuery({
    queryKey: ['cm-kpis', activeBranch?.id],
    queryFn: async () => {
      const [workers, branches, pendingFactory] = await Promise.all([
        supabase.from('workers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('stock_receipts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      return {
        workers: workers.count || 0,
        branches: branches.count || 0,
        pendingApprovals: pendingFactory.count || 0,
      };
    },
    staleTime: 60_000,
  });

  const sections: ExecSection[] = [
    {
      titleKey: 'company_manager.section_approvals',
      icon: ShieldCheck,
      items: [
        { key: 'factory_receipt', label: t('company_manager.factory_approvals') + ' — ' + t('worker_home.factory_receipt'), icon: Truck, action: () => setFactoryReceiptOpen(true) },
        { key: 'factory_delivery', label: t('company_manager.factory_approvals') + ' — ' + t('worker_home.factory_delivery'), icon: ClipboardCheck, action: () => setFactoryDeliveryOpen(true) },
        { key: 'sector_comp', label: t('company_manager.sector_compensation'), icon: Split, path: '/promo-splits' },
        { key: 'invoice_requests', label: t('company_manager.invoice_requests'), icon: FileText, action: () => setInvoiceRequestOpen(true) },
        { key: 'shared_invoices', label: t('nav.shared_invoices'), icon: FileText, path: '/shared-invoices' },
      ],
    },
    {
      titleKey: 'company_manager.section_executive',
      icon: TrendingUp,
      items: [
        { key: 'sales_summary', label: t('company_manager.sales_summary'), icon: BarChart3, path: '/manager-sales-summary' },
        { key: 'stats', label: t('nav.stats'), icon: BarChart3, path: '/stats' },
        { key: 'promo_table', label: t('nav.table'), icon: FileSpreadsheet, path: '/promo-table' },
        { key: 'manager_treasury', label: t('nav.manager_treasury'), icon: Wallet, path: '/manager-treasury' },
        { key: 'rewards', label: t('nav.rewards'), icon: Banknote, path: '/rewards' },
      ],
    },
    {
      titleKey: 'company_manager.section_hr',
      icon: Users,
      items: [
        { key: 'workers', label: t('nav.workers'), icon: Users, path: '/workers' },
        { key: 'permissions', label: t('nav.permissions'), icon: Shield, path: '/permissions' },
        { key: 'roles', label: t('nav.worker_roles_management'), icon: Shield, path: '/worker-roles-management' },
      ],
    },
    {
      titleKey: 'company_manager.section_products',
      icon: Package,
      items: [
        { key: 'products', label: t('nav.products'), icon: Package, path: '/products' },
        { key: 'product_offers', label: t('nav.product_offers'), icon: Gift, path: '/product-offers' },
        { key: 'manual_promo', label: t('company_manager.manual_promo_entry'), icon: Pencil, action: () => setManualPromoOpen(true) },
      ],
    },
    {
      titleKey: 'company_manager.section_warehouse',
      icon: Warehouse,
      items: [
        { key: 'warehouse', label: t('stock.warehouse_stock'), icon: Warehouse, path: '/warehouse' },
        { key: 'warehouse_review', label: t('nav.warehouse_review'), icon: ClipboardCheck, path: '/warehouse-review' },
        { key: 'manual_stock', label: t('company_manager.manual_stock'), icon: Pencil, path: '/warehouse' },
      ],
    },
    {
      titleKey: 'company_manager.section_admin',
      icon: Settings,
      items: [
        { key: 'branches', label: t('nav.branches'), icon: Building2, path: '/branches' },
        { key: 'settings', label: t('nav.settings'), icon: Settings, path: '/settings' },
        { key: 'backup', label: t('company_manager.backup'), icon: Database, path: '/backup' },
      ],
    },
  ];

  const handleClick = (item: ExecItem) => {
    if (item.action) item.action();
    else if (item.path) navigate(item.path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 text-emerald-50 pb-24">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-amber-500/30">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-emerald-500/10" />
        <div className="relative px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/40">
              <Crown className="w-9 h-9 text-emerald-950" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-100 tracking-tight">
                {t('company_manager.welcome')}
              </h1>
              <p className="text-sm text-emerald-200/80 mt-1">{t('company_manager.subtitle')}</p>
              {user?.full_name && (
                <Badge variant="outline" className="mt-2 border-amber-400/40 text-amber-200 bg-amber-500/10">
                  {user.full_name}
                  {activeBranch?.name && ` — ${activeBranch.name}`}
                </Badge>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <KpiCard label={t('company_manager.kpi_pending_approvals')} value={kpis?.pendingApprovals ?? '—'} icon={ShieldCheck} accent="amber" />
            <KpiCard label={t('company_manager.kpi_active_workers')} value={kpis?.workers ?? '—'} icon={Users} accent="emerald" />
            <KpiCard label={t('company_manager.kpi_branches')} value={kpis?.branches ?? '—'} icon={Building2} accent="emerald" />
            <KpiCard label={t('company_manager.kpi_total_sales')} value="—" icon={TrendingUp} accent="amber" />
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
                <SecIcon className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-amber-100">{t(section.titleKey)}</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-amber-500/40 to-transparent" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card
                      key={item.key}
                      onClick={() => handleClick(item)}
                      className="group cursor-pointer border-emerald-700/40 bg-gradient-to-br from-emerald-900/60 to-emerald-950/80 backdrop-blur hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-500/10 transition-all"
                    >
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 flex items-center justify-center group-hover:from-amber-400/30 group-hover:to-emerald-400/30 transition-colors">
                          <Icon className="w-6 h-6 text-amber-300 group-hover:text-amber-200" />
                        </div>
                        <p className="text-sm font-medium text-emerald-50 leading-tight">
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

      {/* Dialogs */}
      <ManualPromoEntryDialog open={manualPromoOpen} onOpenChange={setManualPromoOpen} />
      <FactoryReceiptQuickDialog open={factoryReceiptOpen} onOpenChange={setFactoryReceiptOpen} />
      <FactoryDeliveryQuickDialog open={factoryDeliveryOpen} onOpenChange={setFactoryDeliveryOpen} />
      <InvoiceRequestDialog open={invoiceRequestOpen} onOpenChange={setInvoiceRequestOpen} />
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: number | string; icon: LucideIcon; accent: 'amber' | 'emerald' }> = ({ label, value, icon: Icon, accent }) => {
  const accentClasses = accent === 'amber'
    ? 'border-amber-500/30 from-amber-500/15 to-transparent text-amber-200'
    : 'border-emerald-500/30 from-emerald-500/15 to-transparent text-emerald-200';
  return (
    <Card className={`border bg-gradient-to-br ${accentClasses} backdrop-blur`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={`w-5 h-5 ${accent === 'amber' ? 'text-amber-300' : 'text-emerald-300'}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs opacity-80 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
};

export default CompanyManagerHome;
