import React, { useState } from 'react';
import ProductShowcaseHero from '@/components/home/ProductShowcaseHero';
import managerHeroBg from '@/assets/hero-manager-bg.jpg';
import TodayCustomersDialog from '@/components/sectors/TodayCustomersDialog';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  ShieldCheck, BarChart3, Warehouse, Truck, ClipboardCheck,
  Package, Gift, Users, Building2, Settings, Database, Shield, FileSpreadsheet,
  TrendingUp, Wallet, Banknote, Pencil, Coins, HandCoins, PackageSearch, BookOpen,
  ClipboardList, LucideIcon,
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

  const [manualPromoOpen, setManualPromoOpen] = useState(false);
  const [factoryReceiptOpen, setFactoryReceiptOpen] = useState(false);
  const [factoryDeliveryOpen, setFactoryDeliveryOpen] = useState(false);
  const [invoiceRequestOpen, setInvoiceRequestOpen] = useState(false);
  const [dailyTasksOpen, setDailyTasksOpen] = useState(false);

  const sections: ExecSection[] = [
    {
      titleKey: 'company_manager.section_approvals',
      icon: ShieldCheck,
      items: [
        { key: 'final_approvals', label: t('assistant_approvals.title'), icon: ShieldCheck, path: '/assistant-approvals' },
      ],
    },
    {
      titleKey: 'company_manager.section_executive',
      icon: TrendingUp,
      items: [
        { key: 'sales_summary', label: t('company_manager.sales_summary'), icon: BarChart3, path: '/manager-sales-summary' },
        { key: 'stats', label: t('nav.stats'), icon: BarChart3, path: '/stats' },
        { key: 'promo_table', label: t('nav.table'), icon: FileSpreadsheet, path: '/promo-table' },
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
        { key: 'suppliers', label: 'الموردون', icon: Truck, path: '/suppliers' },
      ],
    },
    {
      titleKey: 'company_manager.section_warehouse',
      icon: Warehouse,
      items: [
        { key: 'warehouse', label: t('stock.warehouse_stock'), icon: Warehouse, path: '/warehouse' },
        { key: 'manual_stock', label: t('company_manager.manual_stock'), icon: Pencil, path: '/warehouse' },
      ],
    },
    {
      titleKey: 'company_manager.section_admin',
      icon: Settings,
      items: [
        { key: 'settings', label: t('nav.settings'), icon: Settings, path: '/settings' },
      ],
    },
  ];

  const handleClick = (item: ExecItem) => {
    if (item.action) item.action();
    else if (item.path) navigate(item.path);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-2">
      {/* Hero — same blue identity as branch manager */}
      <ProductShowcaseHero
        bgImage={managerHeroBg}
        overlayClassName="bg-gradient-to-l from-blue-900/20 via-white/30 to-white/10"
      />

      {/* Final approvals button */}
      <div className="relative overflow-hidden border-b border-blue-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-sky-50/60 to-blue-50/40" />
        <div className="relative px-3 py-1.5">
          <button
            onClick={() => navigate('/assistant-approvals')}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 px-4 py-2 text-white shadow-md shadow-blue-500/30 hover:shadow-lg hover:scale-[1.01] transition-all"
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-base font-bold">{t('assistant_approvals.title') || 'الموافقات النهائية'}</span>
          </button>
        </div>
      </div>

      {/* Unified interface — all items in one grid, no section separators */}
      <div className="px-2 sm:px-3 py-2">
        <div className="grid grid-cols-4 gap-1.5">
          {sections.flatMap(s => s.items).map((item, iIdx) => {
            const Icon = item.icon;
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
            const cp = cardPalettes[iIdx % cardPalettes.length];
            return (
              <Card
                key={item.key}
                onClick={() => handleClick(item)}
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

      {/* Dialogs */}
      <ManualPromoEntryDialog open={manualPromoOpen} onOpenChange={setManualPromoOpen} />
      <FactoryReceiptQuickDialog open={factoryReceiptOpen} onOpenChange={setFactoryReceiptOpen} />
      <FactoryDeliveryQuickDialog open={factoryDeliveryOpen} onOpenChange={setFactoryDeliveryOpen} />
      <InvoiceRequestDialog open={invoiceRequestOpen} onOpenChange={setInvoiceRequestOpen} />
      <TodayCustomersDialog open={dailyTasksOpen} onOpenChange={setDailyTasksOpen} />
    </div>
  );
};

export default CompanyManagerHome;
